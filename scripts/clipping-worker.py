"""Local Clip Studio: SQLite journal, serialized media jobs, JSON-line RPC.

No cloud inference or publishing. Media tools execute with argument arrays.
"""
import argparse, gc, hashlib, importlib.util, json, math, os, re, shutil, sqlite3
import subprocess, sys, threading, time, uuid
from pathlib import Path

sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')
os.environ['HF_HUB_DISABLE_XET'] = '1'

PROFILES = {
    'cpu': {'label': 'CPU fallback', 'model': 'tiny', 'device': 'cpu', 'compute': 'int8', 'vramMB': 0, 'ramMB': 1400},
    'basic': {'label': 'Basic GPU', 'model': 'small', 'device': 'cuda', 'compute': 'int8_float16', 'vramMB': 3000, 'ramMB': 2200},
    'bigger': {'label': 'Bigger GPU · 16 GB', 'model': 'large-v3', 'device': 'cuda', 'compute': 'float16', 'vramMB': 12000, 'ramMB': 4500},
}

def uid(): return str(uuid.uuid4())
def digest(file):
    h = hashlib.sha256()
    with open(file, 'rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''): h.update(chunk)
    return h.hexdigest()

def gpu_info():
    try:
        result = subprocess.run(['nvidia-smi', '--query-gpu=name,memory.total,memory.free,compute_cap', '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=8, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if result.returncode: return []
        return [{'name': p[0].strip(), 'totalMB': int(p[1]), 'freeMB': int(p[2]), 'computeCapability': p[3].strip()} for p in [line.split(',') for line in result.stdout.strip().splitlines()] if len(p) == 4]
    except (OSError, ValueError, subprocess.TimeoutExpired): return []

def free_ram_mb():
    if os.name == 'nt':
        import ctypes
        class Memory(ctypes.Structure):
            _fields_ = [('length', ctypes.c_ulong), ('load', ctypes.c_ulong)] + [(name, ctypes.c_ulonglong) for name in ['total', 'avail', 'totalPage', 'availPage', 'totalVirtual', 'availVirtual', 'extended']]
        m = Memory(); m.length = ctypes.sizeof(m)
        if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(m)): return m.avail // (1024 * 1024)
    return None

def model_ready(directory): return all((directory / name).is_file() for name in ['model.bin', 'config.json', 'tokenizer.json']) and any((directory / name).is_file() for name in ['vocabulary.txt', 'vocabulary.json'])

def terminate(process):
    if process.poll() is not None: return
    if os.name == 'nt':
        # Windows virtual-environment launchers may own a second Python process.
        subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    else: process.kill()
    process.wait()

class Studio:
    def __init__(self, root):
        self.root = Path(root).resolve(); self.root.mkdir(parents=True, exist_ok=True)
        self.guard = open(self.root / 'worker.lock', 'a+b')
        if os.name == 'nt':
            import msvcrt
            self.guard.seek(0); self.guard.write(b'0'); self.guard.flush(); self.guard.seek(0)
            msvcrt.locking(self.guard.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(self.guard.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        self.lock = threading.RLock(); self.stop = threading.Event(); self.current_process = None
        self.db = sqlite3.connect(self.root / 'journal.sqlite3', check_same_thread=False)
        self.db.execute('PRAGMA journal_mode=WAL'); self.db.execute('PRAGMA busy_timeout=5000')
        self.db.execute('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, space TEXT, kind TEXT, data TEXT)')
        self.db.commit()
        for job in self.rows(None, 'job'):
            if job['status'] == 'running':
                job.update(status='failed', error='Worker interrupted. Retry this stage; existing artifacts are retained.'); self.save(job, 'job')
        self.stable = {}
        threading.Thread(target=self.loop, daemon=True).start()

    def save(self, data, kind):
        with self.lock:
            self.db.execute('INSERT OR REPLACE INTO records VALUES (?,?,?,?)', (data['id'], data['space'], kind, json.dumps(data))); self.db.commit()
            if kind == 'clip':
                version = {**data, 'clipId': data['id'], 'id': data['id'] + ':' + str(data['version'])}
                self.db.execute('INSERT OR IGNORE INTO records VALUES (?,?,?,?)', (version['id'], version['space'], 'clip_version', json.dumps(version))); self.db.commit()
        return data

    def rows(self, space, kind):
        with self.lock:
            values = self.db.execute('SELECT data FROM records WHERE kind=?' + (' AND space=?' if space else ''), (kind, space) if space else (kind,)).fetchall()
        return [json.loads(v[0]) for v in values]

    def get(self, space, kind, item_id):
        item = next((x for x in self.rows(space, kind) if x['id'] == item_id), None)
        if not item: raise ValueError('Item not found in this space.')
        return item

    def directory(self, space):
        if space not in ['personal', 'work', 'ideas']: raise ValueError('Unknown space.')
        p = self.root / space; p.mkdir(exist_ok=True); return p

    def path(self, space, relative):
        base = self.directory(space).resolve(); target = (base / relative).resolve()
        if base not in target.parents or not target.is_file(): raise ValueError('Media is outside this space.')
        return target

    def tool(self, name):
        value = shutil.which(name)
        if not value: raise ValueError(name + ' is not installed. Use the Clip Studio setup script.')
        return value

    def run(self, args, job):
        log = self.directory(job['space']) / (job['id'] + '.log')
        with open(log, 'wb') as handle:
            p = subprocess.Popen(args, stdout=handle, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            self.current_process = p
            deadline = time.monotonic() + (900 if job['stage'] == 'download_model' else 86400)
            while p.poll() is None:
                if self.stop.is_set() or self.get(job['space'], 'job', job['id'])['status'] == 'cancelled':
                    terminate(p); raise ValueError('Cancelled.')
                if time.monotonic() > deadline:
                    terminate(p); raise ValueError('Stage timed out. Check network or resources, then retry. Download checkpoints are retained.')
                time.sleep(.4)
            self.current_process = None
        if p.returncode:
            message = log.read_text(errors='replace')[-1800:]
            message = re.sub(r'https?://\S+', '[remote URL]', message)
            raise ValueError('Media tool failed: ' + message)
        log.unlink(missing_ok=True)

    def enqueue(self, space, body):
        stage = body.get('stage'); profile = body.get('profile', 'cpu')
        if stage not in ['prepare', 'transcribe', 'suggest', 'pipeline', 'render', 'download_model']: raise ValueError('Unsupported stage.')
        if profile not in PROFILES: raise ValueError('Unknown processing profile.')
        if stage != 'download_model': self.get(space, 'source', body.get('sourceId'))
        if stage == 'render':
            clip = self.get(space, 'clip', body.get('clipId'))
            if clip['sourceId'] != body.get('sourceId'): raise ValueError('Clip/source mismatch.')
            body = {**body, 'clipVersion': clip['version'], 'clipSnapshot': clip}
        if len([j for j in self.rows(None, 'job') if j['status'] in ['queued', 'running']]) >= 40: raise ValueError('Queue is full.')
        body = {**body, 'stage': stage, 'profile': profile}
        key = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
        existing = next((j for j in self.rows(space, 'job') if j.get('key') == key and j['status'] in ['queued', 'running']), None)
        if existing: return existing
        return self.save({'id': uid(), 'space': space, 'createdAt': time.time(), 'status': 'queued', 'stage': stage, 'profile': profile, 'progress': '', 'error': '', 'body': body, 'key': key}, 'job')

    def source_import(self, space, body):
        upload = self.root / 'uploads' / body['uploadId']
        if not re.fullmatch(r'[a-f0-9-]{36}', body['uploadId']) or not upload.is_file(): raise ValueError('Upload not found.')
        fingerprint = digest(upload)
        duplicate = next((s for s in self.rows(space, 'source') if s['hash'] == fingerprint), None)
        if duplicate: upload.unlink(); return duplicate
        item_id = uid(); folder = self.directory(space) / item_id; folder.mkdir()
        extension = Path(body.get('name', 'recording')).suffix.lower()
        if extension not in ['.mp4', '.mov', '.mkv', '.webm', '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.avi']: raise ValueError('Unsupported media extension.')
        destination = folder / ('original' + extension); shutil.move(upload, destination)
        source = self.save({'id': item_id, 'space': space, 'name': Path(body['name']).name[:200], 'hash': fingerprint, 'createdAt': time.time(), 'original': str(destination.relative_to(self.directory(space))), 'status': 'imported', 'duration': 0, 'transcript': [], 'transcriptVersion': 0, 'peaks': []}, 'source')
        self.enqueue(space, {'stage': 'prepare', 'sourceId': item_id}); return source

    def prepare(self, source, job):
        original = self.path(source['space'], source['original']); folder = original.parent
        # Probe output is a structured artifact, separate from the tool error log.
        probe = subprocess.run([self.tool('ffprobe'), '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(original)], capture_output=True, text=True, timeout=30, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if probe.returncode: raise ValueError('Cannot inspect media.')
        metadata = json.loads(probe.stdout); source['duration'] = float(metadata.get('format', {}).get('duration', 0))
        source['video'] = any(s['codec_type'] == 'video' for s in metadata['streams'])
        source['audio'] = any(s['codec_type'] == 'audio' for s in metadata['streams'])
        if not math.isfinite(source['duration']) or not 0 < source['duration'] <= 21600: raise ValueError('Recording duration must be between 0 and 6 hours.')
        if shutil.disk_usage(folder).free < max(1024**3, original.stat().st_size): raise ValueError('Free at least 1 GB and enough disk for a preview.')
        source['metadata'] = metadata
        proxy = folder / ('preview.mp4' if source['video'] else 'preview.m4a')
        args = [self.tool('ffmpeg'), '-nostdin', '-y', '-i', str(original)]
        if source['video']: args += ['-vf', 'scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-threads', '2']
        else: args += ['-vn']
        args += ['-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', str(proxy)]
        self.run(args, job); source['preview'] = str(proxy.relative_to(self.directory(source['space'])))
        if not source['audio']:
            source.update(peaks=[], status='ready'); self.save(source, 'source'); return
        pcm = folder / 'wave.raw'
        self.run([self.tool('ffmpeg'), '-nostdin', '-y', '-i', str(original), '-vn', '-ac', '1', '-ar', '1000', '-f', 's16le', str(pcm)], job)
        import array
        count = max(1, math.ceil(source['duration'] * 1000 / 800)); peaks = []
        with open(pcm, 'rb') as handle:
            while chunk := handle.read(count * 2):
                samples = array.array('h'); samples.frombytes(chunk[:len(chunk)//2*2]); peaks.append(round(max((abs(v) for v in samples), default=0)/32768, 4))
        pcm.unlink(missing_ok=True); source.update(peaks=peaks, status='ready'); self.save(source, 'source')

    def transcribe(self, source, job):
        if not source.get('audio'): raise ValueError('This recording has no audio stream. Manual video trimming is available.')
        profile = PROFILES[job['profile']]; model_path = self.root / 'models' / profile['model']
        if not model_ready(model_path): raise ValueError('Download this profile model in Setup first.')
        available = free_ram_mb()
        if available is not None and available < profile['ramMB']: raise ValueError('Not enough free system RAM. Close apps or use a smaller profile, then retry.')
        if profile['device'] == 'cuda':
            gpus = gpu_info()
            if not gpus or gpus[0]['freeMB'] < profile['vramMB']: raise ValueError('GPU profile requires a compatible NVIDIA CUDA GPU with at least ' + str(profile['vramMB']) + ' MB free VRAM. Choose CPU fallback on this machine.')
            if float(gpus[0]['computeCapability']) < 7: raise ValueError('This GPU architecture is too old for this CUDA profile. Choose CPU fallback.')
        output = self.path(source['space'], source['original']).parent / 'transcription.tmp.json'
        self.run([sys.executable, str(Path(__file__).resolve()), '--asr', str(self.path(source['space'], source['original'])), '--model', str(model_path), '--profile', job['profile'], '--output', str(output)], job)
        transcript = json.loads(output.read_text('utf-8')); output.unlink(missing_ok=True)
        source['transcript'] = transcript['segments']; source['transcriptVersion'] += 1
        self.save({'id': source['id'] + ':' + str(source['transcriptVersion']), 'space': source['space'], 'segments': transcript['segments']}, 'transcript_version')
        source['language'] = transcript['language']; source['engine'] = {'name': 'faster-whisper', **profile}
        self.save(source, 'source'); (self.path(source['space'], source['original']).parent / ('transcript-v' + str(source['transcriptVersion']) + '.json')).write_text(json.dumps(transcript, ensure_ascii=False, indent=2), encoding='utf-8')

    def suggest(self, source, job):
        segments = source.get('transcript', [])
        if not segments: raise ValueError('Transcribe or import a timed transcript first.')
        body = job['body']; low = max(10, min(180, float(body.get('minDuration', 25)))); high = max(low, min(300, float(body.get('maxDuration', 90))))
        keywords = set(re.findall(r'\w{4,}', str(body.get('brief', '')).lower()))
        candidates = []
        for index, segment in enumerate(segments):
            end_index = index
            while end_index + 1 < len(segments) and segments[end_index]['end'] - segment['start'] < low: end_index += 1
            end = segments[end_index]['end']; text = ' '.join(s['text'] for s in segments[index:end_index+1])
            if end - segment['start'] < low or end - segment['start'] > high: continue
            matches = len(keywords.intersection(re.findall(r'\w{4,}', text.lower())))
            score = matches * 3 + min(len(set(text.lower().split()))/80, 1) + (.5 if text.rstrip().endswith(('.', '?', '!')) else 0)
            candidates.append((score, segment['start'], end, text, matches))
        chosen = []
        for row in sorted(candidates, reverse=True):
            if any(min(row[2], old[2]) - max(row[1], old[1]) > 0 for old in chosen): continue
            chosen.append(row)
            if len(chosen) >= max(1, min(12, int(body.get('count', 5)))): break
        for score, start, end, text, matches in chosen:
            if any(c['sourceId'] == source['id'] and c['transcriptVersion'] == source['transcriptVersion'] and abs(c['start']-start) < .1 and abs(c['end']-end) < .1 for c in self.rows(source['space'], 'clip')): continue
            self.save({'id': uid(), 'space': source['space'], 'sourceId': source['id'], 'title': text[:80], 'start': start, 'end': end, 'version': 1, 'transcriptVersion': source['transcriptVersion'], 'review': 'pending', 'reason': str(matches) + ' brief keyword matches. Local transcript ranking; review surrounding context.', 'context': text[:2400], 'format': 'landscape', 'captions': True, 'createdAt': time.time()}, 'clip')

    def render(self, source, job):
        clip = job['body']['clipSnapshot']; base = self.path(source['space'], source['original']).parent; output = base / (job['id'] + ('.mp3' if clip['format'] == 'audio' else '.mp4'))
        if not source.get('video') and clip['format'] != 'audio': raise ValueError('Choose Audio for this audio-only recording.')
        suffix = output.suffix; temporary = output.with_name(output.stem + '.tmp' + suffix)
        args = [self.tool('ffmpeg'), '-nostdin', '-y', '-ss', str(clip['start']), '-i', str(self.path(source['space'], source['original'])), '-t', str(clip['end']-clip['start'])]
        if clip['format'] == 'audio': args += ['-vn', '-c:a', 'libmp3lame', '-b:a', '192k']
        else:
            width, height = {'landscape': (1280, 720), 'portrait': (720, 1280), 'square': (720, 720)}[clip['format']]
            args += ['-vf', f'scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2', '-c:v', 'libx264', '-preset', 'fast', '-crf', '21', '-threads', '2', '-c:a', 'aac', '-movflags', '+faststart']
        self.run(args + [str(temporary)], job)
        probe = subprocess.run([self.tool('ffprobe'), '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(temporary)], capture_output=True, text=True, timeout=30, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if probe.returncode: raise ValueError('Rendered draft could not be decoded for inspection.')
        inspected = json.loads(probe.stdout)
        if abs(float(inspected['format']['duration'])-(clip['end']-clip['start'])) > 1: raise ValueError('Rendered duration differs from the requested clip. Review source timestamps.')
        temporary.replace(output)
        subtitles = []
        version = self.get(source['space'], 'transcript_version', source['id'] + ':' + str(clip['transcriptVersion'])) if clip['transcriptVersion'] else {'segments': []}
        for s in version['segments']:
            a, b = max(s['start'], clip['start']), min(s['end'], clip['end'])
            if a < b: subtitles.append({'start': a-clip['start'], 'end': b-clip['start'], 'text': s['text']})
        def stamp(n):
            n = round(n*1000); return f'{n//3600000:02}:{n//60000%60:02}:{n//1000%60:02},{n%1000:03}'
        srt = output.with_suffix('.srt')
        if clip['captions']: srt.write_text('\n\n'.join(f'{i+1}\n{stamp(s["start"])} --> {stamp(s["end"])}\n{s["text"]}' for i,s in enumerate(subtitles)), encoding='utf-8')
        renderer = subprocess.run([self.tool('ffmpeg'), '-version'], capture_output=True, text=True, timeout=10, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)).stdout.splitlines()[0]
        artifact = {'id': uid(), 'space': source['space'], 'sourceId': source['id'], 'clipId': clip['id'], 'clipVersion': clip['version'], 'transcriptVersion': clip['transcriptVersion'], 'title': clip['title'], 'file': str(output.relative_to(self.directory(source['space']))), 'srt': str(srt.relative_to(self.directory(source['space']))) if srt.exists() else None, 'hash': digest(output), 'sourceHash': source['hash'], 'start': clip['start'], 'end': clip['end'], 'createdAt': time.time(), 'review': 'pending', 'edit': clip, 'jobId': job['id'], 'renderer': renderer, 'inspection': inspected, 'asr': source.get('engine'), 'delivery': 'local only'}
        output.with_suffix('.manifest.json').write_text(json.dumps(artifact, indent=2), encoding='utf-8'); self.save(artifact, 'artifact')

    def execute(self, job):
        if job['stage'] == 'download_model':
            profile = PROFILES[job['profile']]; destination = self.root / 'models' / profile['model']; destination.mkdir(parents=True, exist_ok=True)
            self.run([sys.executable, str(Path(__file__).resolve()), '--download', str(destination), '--profile', job['profile']], job); return
        source = self.get(job['space'], 'source', job['body']['sourceId'])
        stages = ['prepare', 'transcribe', 'suggest'] if job['stage'] == 'pipeline' else [job['stage']]
        for stage in stages:
            with self.lock:
                if self.get(job['space'], 'job', job['id'])['status'] == 'cancelled': raise ValueError('Cancelled.')
                job['progress'] = stage; self.save(job, 'job')
            if stage == 'prepare' and source.get('preview'): continue
            if stage == 'transcribe' and job['stage'] == 'pipeline' and source.get('transcript'): continue
            getattr(self, stage)(source, job)

    def watch(self):
        for workflow in self.rows(None, 'workflow'):
            if not workflow.get('enabled'): continue
            folder = Path(workflow['folder'])
            if not folder.is_dir() or folder.is_symlink(): continue
            for file in list(folder.iterdir())[:100]:
                current = self.get(workflow['space'], 'workflow', workflow['id'])
                if not current.get('enabled') or current['folder'] != str(folder): break
                workflow = current
                if not file.is_file() or file.is_symlink() or file.suffix.lower() not in ['.mp4', '.mov', '.mkv', '.webm', '.mp3', '.wav', '.m4a', '.flac']: continue
                key = workflow['id'] + '|' + str(file); stat = file.stat(); state = (stat.st_size, stat.st_mtime_ns)
                prior = self.stable.get(key)
                if not prior or prior[0] != state: self.stable[key] = (state, time.time()); continue
                if time.time()-prior[1] < 30 or stat.st_size == 0 or stat.st_size > 2*1024**3: continue
                fingerprint = digest(file)
                if fingerprint in workflow.get('seen', []): continue
                today = time.strftime('%Y-%m-%d'); used = workflow.get('dailyCount', 0) if workflow.get('day') == today else 0
                if used >= workflow['dailyLimit']: break
                uploads = self.root / 'uploads'; uploads.mkdir(exist_ok=True); upload_id = uid(); shutil.copyfile(file, uploads / upload_id)
                item = self.source_import(workflow['space'], {'uploadId': upload_id, 'name': file.name})
                self.enqueue(workflow['space'], {'stage': 'pipeline', 'sourceId': item['id'], 'profile': workflow['profile'], 'brief': workflow['brief'], 'count': 5})
                workflow.update(seen=(workflow.get('seen', []) + [fingerprint])[-2000:], day=today, dailyCount=used+1); self.save(workflow, 'workflow')

    def loop(self):
        last_watch = 0
        while not self.stop.is_set():
            try:
                queued = sorted((j for j in self.rows(None, 'job') if j['status'] == 'queued'), key=lambda j: j['createdAt'])
                if queued:
                    job = queued[0]
                    with self.lock:
                        if self.get(job['space'], 'job', job['id'])['status'] != 'queued': continue
                        job.update(status='running', startedAt=time.time()); self.save(job, 'job')
                    try:
                        self.execute(job)
                        with self.lock:
                            if self.get(job['space'], 'job', job['id'])['status'] != 'cancelled': job.update(status='succeeded', finishedAt=time.time()); self.save(job, 'job')
                    except Exception as error:
                        with self.lock:
                            cancelled = self.get(job['space'], 'job', job['id'])['status'] == 'cancelled'
                            job.update(status='cancelled' if cancelled else 'failed', error=str(error)[-2000:], finishedAt=time.time()); self.save(job, 'job')
                elif time.time()-last_watch > 15: self.watch(); last_watch = time.time()
            except Exception as error: print('Worker: ' + str(error), file=sys.stderr)
            self.stop.wait(1)

    def rpc(self, space, action, body):
        self.directory(space)
        if action == 'status':
            return {'worker': 'ready', 'ffmpeg': bool(shutil.which('ffmpeg')), 'ffprobe': bool(shutil.which('ffprobe')), 'asrInstalled': importlib.util.find_spec('faster_whisper') is not None, 'gpus': gpu_info(), 'freeRamMB': free_ram_mb(), 'freeDiskGB': round(shutil.disk_usage(self.root).free/1024**3, 1), 'profiles': [{'id': key, **value, 'modelReady': model_ready(self.root / 'models' / value['model'])} for key,value in PROFILES.items()], 'externalDelivery': 'not configured'}
        if action == 'list': return {kind+'s': self.rows(space, kind) for kind in ['source', 'clip', 'artifact', 'job', 'workflow']}
        if action == 'import': return self.source_import(space, body)
        if action == 'job': return self.enqueue(space, body)
        if action == 'cancel':
            with self.lock:
                job = self.get(space, 'job', body['id'])
                if job['status'] not in ['running', 'queued']: raise ValueError('Job already ended.')
                job['status'] = 'cancelled'; return self.save(job, 'job')
        if action == 'clip':
            source = self.get(space, 'source', body['sourceId']); start, end = float(body['start']), float(body['end'])
            if not math.isfinite(start) or not math.isfinite(end) or not (0 <= start < end <= source['duration']) or end-start > 600: raise ValueError('Choose a valid source range, at most 10 minutes.')
            if body.get('format', 'landscape') not in ['landscape', 'portrait', 'square', 'audio']: raise ValueError('Unknown format.')
            previous = self.get(space, 'clip', body['id']) if body.get('id') else None
            if previous and previous['sourceId'] != source['id']: raise ValueError('Clip/source mismatch.')
            clip = {'id': previous['id'] if previous else uid(), 'space': space, 'sourceId': source['id'], 'title': str(body.get('title', 'Clip'))[:200], 'start': start, 'end': end, 'version': previous['version']+1 if previous else 1, 'transcriptVersion': source['transcriptVersion'], 'format': body.get('format', 'landscape'), 'captions': bool(body.get('captions', True)), 'review': 'pending', 'createdAt': time.time()}
            return self.save(clip, 'clip')
        if action == 'transcript':
            source = self.get(space, 'source', body['sourceId']); segments = body['segments']
            if not isinstance(segments, list) or len(segments) > 30000: raise ValueError('Invalid transcript.')
            end = 0
            for item in segments:
                a,b = float(item['start']), float(item['end'])
                if not math.isfinite(a) or not math.isfinite(b) or a < end or not 0 <= a < b <= source['duration']+.5 or len(str(item['text'])) > 10000: raise ValueError('Transcript requires ordered, non-overlapping valid times.')
                end = b
            source['transcript'] = [{'start': float(s['start']), 'end': float(s['end']), 'text': str(s['text'])} for s in segments]; source['transcriptVersion'] += 1
            self.save({'id': source['id'] + ':' + str(source['transcriptVersion']), 'space': space, 'segments': source['transcript']}, 'transcript_version')
            (self.path(space, source['original']).parent / ('transcript-v'+str(source['transcriptVersion'])+'.json')).write_text(json.dumps(source['transcript'], ensure_ascii=False, indent=2), encoding='utf-8')
            return self.save(source, 'source')
        if action == 'approve':
            artifact = self.get(space, 'artifact', body['id']); artifact.update(review='approved', reviewedAt=time.time())
            self.path(space, artifact['file']).with_suffix('.manifest.json').write_text(json.dumps(artifact, indent=2), encoding='utf-8')
            return self.save(artifact, 'artifact')
        if action == 'media':
            item = self.get(space, 'source' if body['kind'] == 'source' else 'artifact', body['id'])
            field = 'preview' if body['kind'] == 'source' else ('srt' if body.get('subtitles') else 'file')
            if not item.get(field): raise ValueError('Media is not ready.')
            return {'path': str(self.path(space, item[field])), 'name': item.get('name', item.get('title', 'clip')), 'download': body['kind'] != 'source'}
        if action == 'workflow':
            profile = body.get('profile', 'cpu')
            if profile not in PROFILES: raise ValueError('Unknown profile.')
            folder = Path(str(body.get('folder', '')))
            if not folder.is_absolute() or not folder.is_dir() or folder.is_symlink(): raise ValueError('Select an existing absolute local folder.')
            resolved = folder.resolve()
            if self.root == resolved or self.root in resolved.parents or resolved in self.root.parents: raise ValueError('Choose a specific media inbox outside the application data directory.')
            existing = self.get(space, 'workflow', body['id']) if body.get('id') else None
            workflow = {**(existing or {}), 'id': existing['id'] if existing else uid(), 'space': space, 'name': str(body.get('name', 'Clipping workflow'))[:150], 'folder': str(resolved), 'profile': profile, 'brief': str(body.get('brief', ''))[:4000], 'enabled': bool(body.get('enabled')), 'dailyLimit': max(1, min(20, int(body.get('dailyLimit', 3)))), 'autonomy': 'local drafts', 'createdAt': existing['createdAt'] if existing else time.time()}
            return self.save(workflow, 'workflow')
        raise ValueError('Unsupported action.')

def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--root'); parser.add_argument('--asr'); parser.add_argument('--download'); parser.add_argument('--model'); parser.add_argument('--profile'); parser.add_argument('--output'); args = parser.parse_args()
    if args.asr or args.download:
        profile = PROFILES[args.profile]
        if args.download:
            from faster_whisper.utils import download_model
            download_model(profile['model'], output_dir=args.download); return
        from faster_whisper import WhisperModel
        model = WhisperModel(args.model, device=profile['device'], compute_type=profile['compute'], cpu_threads=2, num_workers=1, local_files_only=True)
        segments, info = model.transcribe(args.asr, beam_size=3 if args.profile != 'bigger' else 5, word_timestamps=True, vad_filter=True)
        result = [{'start': s.start, 'end': s.end, 'text': s.text, 'words': [{'start': w.start, 'end': w.end, 'word': w.word, 'probability': w.probability} for w in s.words or []]} for s in segments]
        Path(args.output).write_text(json.dumps({'language': info.language, 'segments': result}, ensure_ascii=False), encoding='utf-8'); del model; gc.collect(); return
    studio = Studio(args.root)
    try:
        for line in sys.stdin:
            request = {}
            try:
                request = json.loads(line); result = studio.rpc(request['space'], request['action'], request.get('body', {})); response = {'id': request['id'], 'result': result}
            except Exception as error: response = {'id': request.get('id'), 'error': str(error)}
            print(json.dumps(response, ensure_ascii=False), flush=True)
    finally:
        studio.stop.set()
        if studio.current_process:
            try: terminate(studio.current_process)
            except OSError: pass

if __name__ == '__main__': main()
