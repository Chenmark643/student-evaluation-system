# -*- mode: python ; coding: utf-8 -*-
"""v14.0.10 full installer: application + VC++ + offline WebView2 runtime."""
import os

SPEC_DIR = SPECPATH
PROJECT_ROOT = os.path.join(SPEC_DIR, '..')
APP_DIST = os.path.join(PROJECT_ROOT, 'dist')
APP_EXE = 'DonCollege-Student-Evaluation.exe'

a = Analysis(
    ['installer.py'],
    pathex=[PROJECT_ROOT, SPEC_DIR],
    binaries=[],
    datas=[
        (os.path.join(APP_DIST, APP_EXE), '.'),
        (os.path.join(APP_DIST, '学分绩点操作教程(1).pdf'), '.'),
        (os.path.join(APP_DIST, '德育分操作教程(2).pdf'), '.'),
        (os.path.join(APP_DIST, '素质拓展分操作教程(1).pdf'), '.'),
        (os.path.join(PROJECT_ROOT, 'data', 'activity_mappings.json'), 'app_data'),
        (os.path.join(PROJECT_ROOT, 'data', 'custom_thresholds.json'), 'app_data'),
        (os.path.join(SPEC_DIR, 'assets', 'installer-icon-hd.ico'), '.'),
        (os.path.join(SPEC_DIR, 'assets', 'installer-logo-header-native.png'), '.'),
        (os.path.join(SPEC_DIR, 'assets', 'installer-logo-header-hd.png'), '.'),
        (os.path.join(SPEC_DIR, 'assets', 'installer-campus-preview.png'), '.'),
        (os.path.join(SPEC_DIR, 'vc_redist.x64.exe'), '.'),
        (os.path.join(SPEC_DIR, 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'), '.'),
    ],
    hiddenimports=['tkinter', 'tkinter.filedialog', 'tkinter.messagebox', 'ctypes', 'shutil', 'subprocess', 'webview2_runtime'],
    hookspath=[], hooksconfig={}, runtime_hooks=[],
    excludes=['matplotlib', 'PIL', 'PyQt5', 'PyQt6'],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, a.binaries, a.datas, [],
    name='DonCollege-Setup-v14.0.10-Full-WebView2',
    icon=os.path.join(SPEC_DIR, 'assets', 'installer-icon-hd.ico'),
    debug=False, bootloader_ignore_signals=False, strip=False, upx=True,
    console=False, disable_windowed_traceback=False,
)
