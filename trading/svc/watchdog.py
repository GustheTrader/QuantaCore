import ctypes
import os
import threading


def process_alive(pid):
    if not isinstance(pid, int) or pid <= 0:
        return False
    if os.name == "nt":
        # os.kill(pid, 0) is destructive on Windows. Query the process handle.
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]
        kernel.OpenProcess.restype = ctypes.c_void_p
        kernel.GetExitCodeProcess.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
        kernel.GetExitCodeProcess.restype = ctypes.c_int
        kernel.CloseHandle.argtypes = [ctypes.c_void_p]
        kernel.CloseHandle.restype = ctypes.c_int
        handle = kernel.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        try:
            exit_code = ctypes.c_uint32()
            return bool(kernel.GetExitCodeProcess(handle, ctypes.byref(exit_code))) and exit_code.value == 259
        finally:
            kernel.CloseHandle(handle)
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def start_watchdog(pids, on_owner_exit, interval=1.0):
    identifiers = tuple(pid for pid in pids if isinstance(pid, int) and pid > 0)
    stop = threading.Event()
    if not identifiers:
        return stop

    def watch():
        while not stop.wait(interval):
            if any(not process_alive(pid) for pid in identifiers):
                on_owner_exit()
                return

    thread = threading.Thread(target=watch, name="gnoesis-owner-watchdog", daemon=True)
    thread.start()
    return stop
