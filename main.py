"""Student evaluation desktop application entry point.

The UI is hosted by pywebview, so the application owns a real desktop window
and uses the Microsoft Edge WebView2 Runtime on Windows.
"""

from __future__ import annotations

import os
import platform
import sys
import traceback
from datetime import datetime

import webview


if getattr(sys, "frozen", False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(0, BASE_DIR)

from backend.api import DesktopApi  # noqa: E402
from webview2_runtime import get_webview2_version  # noqa: E402


APP_NAME = "顿河学院学生测评管理软件"
WINDOW_SIZE = (1400, 900)


def _app_support_dir() -> str:
    """Return the platform-native writable application data directory."""
    if sys.platform == "darwin":
        return os.path.join(
            os.path.expanduser("~/Library/Application Support"), APP_NAME
        )
    if os.name == "nt":
        return os.path.join(
            os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), APP_NAME
        )
    return os.path.join(
        os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share")),
        APP_NAME,
    )


LOG_DIR = _app_support_dir()
STARTUP_LOG = os.path.join(LOG_DIR, "startup.log")
WEB_DIR = os.path.join(BASE_DIR, "web")
_SINGLE_INSTANCE_HANDLE = None


def _acquire_single_instance() -> bool:
    """Prevent two packaged windows from writing the same cloud workbook."""
    global _SINGLE_INSTANCE_HANDLE
    if platform.system() != "Windows":
        return True
    import ctypes

    handle = ctypes.windll.kernel32.CreateMutexW(
        None, False, "Local\\DonCollegeStudentEvaluationCloudSync"
    )
    if not handle:
        return True
    if ctypes.windll.kernel32.GetLastError() == 183:  # ERROR_ALREADY_EXISTS
        ctypes.windll.kernel32.CloseHandle(handle)
        return False
    _SINGLE_INSTANCE_HANDLE = handle
    return True


def _activate_existing_window() -> bool:
    """Restore the existing app window instead of reporting a false dead end."""
    if platform.system() != "Windows":
        return False
    try:
        import ctypes

        hwnd = ctypes.windll.user32.FindWindowW(None, APP_NAME)
        if not hwnd:
            return False
        # SW_RESTORE also reveals a minimized or accidentally hidden window.
        ctypes.windll.user32.ShowWindow(hwnd, 9)
        ctypes.windll.user32.SetForegroundWindow(hwnd)
        return True
    except (AttributeError, OSError):
        return False


def _log_startup(message: str) -> None:
    try:
        os.makedirs(LOG_DIR, exist_ok=True)
        with open(STARTUP_LOG, "a", encoding="utf-8") as stream:
            stream.write(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {message}\n")
    except OSError:
        pass


def start_app() -> None:
    """Create the desktop window and start the native GUI event loop."""
    webview2_version = get_webview2_version()
    if platform.system() == "Windows" and not webview2_version:
        raise RuntimeError(
            "未检测到 Microsoft Edge WebView2 Runtime。\n"
            "请重新运行安装程序，并在环境检测页面完成离线修复。"
        )
    if webview2_version:
        _log_startup(f"WebView2 Runtime={webview2_version}")

    api = DesktopApi()
    index_path = os.path.join(WEB_DIR, "index.html")

    if not os.path.isfile(index_path):
        raise FileNotFoundError(f"找不到应用页面：{index_path}")

    window = webview.create_window(
        APP_NAME,
        url=index_path,
        js_api=api,
        width=WINDOW_SIZE[0],
        height=WINDOW_SIZE[1],
        min_size=(1100, 700),
        resizable=True,
        text_select=True,
        background_color="#f5f5f7",
    )
    api.attach_window(window)

    _log_startup(f"启动 pywebview，平台={platform.system()}")
    gui = "edgechromium" if platform.system() == "Windows" else (
        "cocoa" if platform.system() == "Darwin" else None
    )
    start_options = {
        "debug": False,
        "private_mode": False,
        "storage_path": os.path.join(LOG_DIR, "webview"),
    }
    if gui:
        start_options["gui"] = gui
    if platform.system() == "Windows":
        start_options["icon"] = os.path.join(BASE_DIR, "logo.ico")
    webview.start(**start_options)


if __name__ == "__main__":
    if platform.system() == "Windows":
        try:
            import ctypes

            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
                "student.eval.system.v1"
            )
        except (AttributeError, OSError):
            pass

    if not _acquire_single_instance():
        if _activate_existing_window():
            sys.exit(0)
        try:
            import tkinter as tk
            from tkinter import messagebox

            root = tk.Tk()
            root.withdraw()
            messagebox.showinfo("软件已在运行", "请回到已经打开的软件窗口，避免同时同步同一份云表。")
            root.destroy()
        except Exception:
            pass
        sys.exit(0)

    try:
        start_app()
    except Exception as exc:
        _log_startup(f"启动失败：{exc}\n{traceback.format_exc()}")
        try:
            import tkinter as tk
            from tkinter import messagebox

            root = tk.Tk()
            root.withdraw()
            messagebox.showerror(
                "软件启动失败", f"{exc}\n\n诊断日志：{STARTUP_LOG}"
            )
            root.destroy()
        except Exception:
            pass
        raise
