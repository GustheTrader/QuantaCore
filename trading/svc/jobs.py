from dataclasses import dataclass, field
import multiprocessing
import queue
import sys
import threading
import time
from uuid import uuid4

from .contracts import event, validate_worker_request


class BusyError(RuntimeError):
    pass


@dataclass
class Job:
    run_id: str
    attempt: int
    request: dict
    operation: str
    process: object
    output: object
    started_at: float = field(default_factory=time.monotonic)
    cancelled: threading.Event = field(default_factory=threading.Event)
    closed: bool = False


class JobManager:
    """One transient process slot. Express owns the durable queue and journal."""

    def __init__(self, settings):
        self.settings = settings
        self.active = None
        self._lock = threading.RLock()
        self._context = multiprocessing.get_context("spawn")
        # Windows venv redirectors add a launcher PID. Spawn the real interpreter
        # so terminate()/kill() stop the actual graph process immediately.
        self._context.set_executable(sys._base_executable)

    def start(self, worker_request, operation="execute"):
        from .worker import run_child

        validate_worker_request(worker_request)
        with self._lock:
            if self.active is not None:
                raise BusyError("The worker already has an active run")
            output = self._context.Queue()
            process = self._context.Process(target=run_child,
                                            args=(worker_request, self.settings, operation, output),
                                            name=f"gnoesis-{worker_request['run_id']}", daemon=True)
            job = Job(worker_request["run_id"], worker_request["attempt"], worker_request,
                      operation, process, output)
            self.active = job
            try:
                process.start()
            except BaseException:
                self.active = None
                output.close()
                raise
            return job

    def current(self, identifier):
        with self._lock:
            job = self.active
            return job if job is not None and job.run_id == identifier and not job.cancelled.is_set() and not job.closed else None

    def cancel(self, identifier):
        with self._lock:
            job = self.active
            if job is None or job.run_id != identifier or job.closed:
                return False
            job.cancelled.set()
            if job.process.is_alive():
                job.process.terminate()
            job.process.join(timeout=2)
            if job.process.is_alive():
                job.process.kill()
                job.process.join(timeout=1)
            return True

    def iter_events(self, job):
        last_heartbeat = 0.0
        terminal = False
        try:
            while True:
                if job.cancelled.is_set():
                    yield event("error", payload={"code": "CANCELLED", "message": "Research run cancelled.",
                                                   "error_id": str(uuid4())})
                    break
                elapsed = time.monotonic() - job.started_at
                if elapsed > job.request["request"]["budget"]["max_duration_seconds"]:
                    self.cancel(job.run_id)
                    yield event("error", payload={"code": "BUDGET_EXCEEDED", "message": "Maximum run duration reached.",
                                                   "error_id": str(uuid4())})
                    break
                try:
                    item = job.output.get(timeout=0.1)
                except queue.Empty:
                    if job.cancelled.is_set():
                        continue
                    if not job.process.is_alive():
                        if not terminal:
                            yield event("error", payload={"code": "WORKER_EXITED", "message": "Research process stopped before completion.",
                                                           "error_id": str(uuid4())})
                        break
                    if elapsed - last_heartbeat >= 2:
                        yield event("heartbeat", payload={"elapsed_seconds": round(elapsed, 1),
                                                           "operation": job.operation, "attempt": job.attempt})
                        last_heartbeat = elapsed
                    continue
                if item is None:
                    break
                if job.cancelled.is_set():
                    continue
                terminal = item["type"] in {"result", "error"} or bool(item.get("payload", {}).get("complete"))
                yield item
                if terminal:
                    break
        finally:
            self.finish(job)

    def finish(self, job):
        with self._lock:
            if job.closed:
                return
            job.closed = True
            job.process.join(timeout=1)
            if job.process.is_alive():
                job.process.terminate()
                job.process.join(timeout=1)
            if self.active is job:
                self.active = None
        job.output.close()
        job.output.cancel_join_thread()

    def close(self):
        with self._lock:
            job = self.active
        if job is not None:
            self.cancel(job.run_id)
            self.finish(job)
