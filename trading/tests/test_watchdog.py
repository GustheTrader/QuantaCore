import os
import threading

from svc.watchdog import process_alive, start_watchdog


def test_process_probe_is_safe_and_owner_watchdog_stops(monkeypatch):
    assert process_alive(os.getpid())
    assert not process_alive(2147483647)
    gone = threading.Event()
    monkeypatch.setattr("svc.watchdog.process_alive", lambda pid: False)
    stopped = start_watchdog([1234], gone.set, interval=0.01)
    assert gone.wait(1)
    stopped.set()


def test_external_service_has_no_owner_watchdog(monkeypatch):
    monkeypatch.setattr("svc.watchdog.process_alive", lambda pid: (_ for _ in ()).throw(AssertionError("No owner must be probed")))
    stopped = start_watchdog([None], lambda: (_ for _ in ()).throw(AssertionError("External service must remain running")), interval=0.01)
    stopped.set()
