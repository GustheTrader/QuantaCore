param([ValidateSet('cpu','basic','bigger')][string]$Profile = 'cpu', [switch]$DownloadModel)
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path $PSScriptRoot -Parent
$uvTool = Join-Path $env:LOCALAPPDATA 'hermes\bin\uv.exe'
if (-not (Test-Path -LiteralPath $uvTool)) { throw 'Install uv before setting up the clipping runtime.' }
$runtimePath = Join-Path $appRoot '.quanta\clipping-runtime'
$pythonTool = Join-Path $runtimePath 'Scripts\python.exe'
if (-not (Test-Path -LiteralPath $pythonTool)) {
    & $uvTool venv --python 3.12 $runtimePath
    if ($LASTEXITCODE -ne 0) { throw 'Python runtime installation failed.' }
}
& $uvTool pip install --link-mode copy --python $pythonTool 'faster-whisper==1.2.1'
if ($LASTEXITCODE -ne 0) { throw 'Transcription dependency installation failed.' }
foreach ($mediaTool in @('ffmpeg','ffprobe')) { if (-not (Get-Command $mediaTool -ErrorAction SilentlyContinue)) { throw 'Install FFmpeg and ffprobe, then reopen the app to refresh PATH.' } }
if ($DownloadModel) {
    $modelName = @{cpu='tiny';basic='small';bigger='large-v3'}[$Profile]
    $modelPath = Join-Path $appRoot ".quanta\clipping\models\$modelName"
    & $pythonTool (Join-Path $PSScriptRoot 'clipping-worker.py') --download $modelPath --profile $Profile
    if ($LASTEXITCODE -ne 0) { throw 'Model download failed. Retry in Clip Studio Setup.' }
}
Write-Output 'Clipping runtime installed. GPU mode needs compatible CUDA 12/cuDNN 9 runtime libraries; Clip Studio reports actual hardware and model readiness. CPU fallback is available.'
