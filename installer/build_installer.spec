# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for packaging the installer + app into setup.exe
Output: installer\Output\DonCollege-Setup-v14.1.0-Full-WebView2.exe
"""

import sys
import os

block_cipher = None

SPEC_DIR = SPECPATH  # installer/ directory
PROJECT_ROOT = os.path.join(SPEC_DIR, '..')
DIST_DIR = os.path.join(PROJECT_ROOT, 'dist')

EXE_NAME = 'DonCollege-Student-Evaluation.exe'

a = Analysis(
    ['installer.py'],
    pathex=[PROJECT_ROOT, SPEC_DIR],
    binaries=[],
    datas=[
        # Main app executable (only the latest version)
        (os.path.join(DIST_DIR, EXE_NAME), '.'),
        # PDF guides
        (os.path.join(DIST_DIR, '学分绩点操作教程(1).pdf'), '.'),
        (os.path.join(DIST_DIR, '德育分操作教程(2).pdf'), '.'),
        (os.path.join(DIST_DIR, '素质拓展分操作教程(1).pdf'), '.'),
        (os.path.join(PROJECT_ROOT, 'data', 'activity_mappings.json'), 'app_data'),
        (os.path.join(PROJECT_ROOT, 'data', 'custom_thresholds.json'), 'app_data'),
        # Logo icon
        (os.path.join(PROJECT_ROOT, 'installer', 'assets', 'installer-icon-hd.ico'), '.'),
        (os.path.join(PROJECT_ROOT, 'installer', 'assets', 'installer-logo-header-native.png'), '.'),
        (os.path.join(PROJECT_ROOT, 'installer', 'assets', 'installer-logo-header-hd.png'), '.'),
        (os.path.join(PROJECT_ROOT, 'installer', 'assets', 'installer-campus-preview.png'), '.'),
        # Offline VC++ Redist installer (~25 MB) — critical for Win7/8 with no internet
        (os.path.join(SPEC_DIR, 'vc_redist.x64.exe'), '.'),
        # Official Microsoft WebView2 Evergreen standalone installer (x64)
        (os.path.join(SPEC_DIR, 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'), '.'),
    ],
    hiddenimports=[
        'tkinter',
        'tkinter.filedialog',
        'tkinter.messagebox',
        'ctypes',
        'shutil',
        'subprocess',
        'webview2_runtime',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'PIL',
        'PyQt5',
        'PyQt6',
    ],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='DonCollege-Setup-v14.1.0-Full-WebView2',
    icon=os.path.join(PROJECT_ROOT, 'installer', 'assets', 'installer-icon-hd.ico'),
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
)
