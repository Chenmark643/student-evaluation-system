"""
Student Comprehensive Evaluation System - Main Entry Point
Launches the Eel desktop application with a native browser frontend.

Supported platforms: Windows 10+, macOS 11+, Linux.
"""

import os
import sys
import platform as _platform

import eel

# Determine base path (works both in dev and PyInstaller bundled mode)
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

WEB_DIR = os.path.join(BASE_DIR, 'web')

# Ensure backend is importable
sys.path.insert(0, BASE_DIR)

# Initialize Eel with the web directory
eel.init(WEB_DIR)

# Import bridge to register all @eel.expose functions
import backend.bridge  # noqa: F401, E402

# Window settings
WINDOW_SIZE = (1400, 900)
APP_NAME = '顿河学院学生测评管理软件'


def _get_browser_list():
    """Return platform-appropriate browser list.

    macOS:  Chrome → Safari → default
    Windows: Chrome → Edge → default
    Linux:   Chrome → default
    """
    system = _platform.system()
    if system == 'Darwin':
        return ['chrome', 'safari', 'default']
    elif system == 'Windows':
        return ['chrome', 'edge', 'default']
    else:
        return ['chrome', 'default']


def start_app():
    """Launch the Eel application.

    Tries Chrome first (most consistent across platforms), then
    platform-native browsers, finally falling back to system default.
    """
    # Chrome/Edge command-line args for a clean app window
    chrome_args = [
        '--disable-features=TranslateUI',
        '--disable-extensions',
        '--disable-sync',
        '--no-first-run',
        '--no-default-browser-check',
    ]

    browsers = _get_browser_list()

    for browser in browsers:
        try:
            eel.start(
                'index.html',
                mode=browser,
                size=WINDOW_SIZE,
                port=0,  # Random available port
                block=True,
                disable_cache=True,
                cmdline_args=chrome_args if browser == 'chrome' else None,
            )
            return
        except EnvironmentError:
            if browser == browsers[-1]:
                # Last resort: try with no specific browser
                eel.start(
                    'index.html',
                    mode=None,
                    size=WINDOW_SIZE,
                    port=0,
                    block=True,
                )
                return
            continue


if __name__ == '__main__':
    # Set app ID for Windows taskbar (Windows only)
    if _platform.system() == 'Windows':
        try:
            import ctypes
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
                'student.eval.system.v1'
            )
        except Exception:
            pass

    start_app()
