# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller build spec for Student Evaluation System — macOS.
Build:  python -m PyInstaller --clean build_mac.spec
Output: dist/顿河学院学生测评管理软件.app
"""

import sys
import os
from pathlib import Path

block_cipher = None

# Find eel package path
import eel as _eel
_eel_dir = os.path.dirname(_eel.__file__)

# Icon — prefer .icns on macOS; fall back to .png (PyInstaller >=6 can use PNG)
_icon_path = None
for candidate in ['logo.icns', 'logo.png', '../logo.png']:
    if os.path.exists(candidate):
        _icon_path = candidate
        break

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('web', 'web'),
        ('data', 'data'),
        (os.path.join(_eel_dir, 'eel.js'), 'eel'),
        ('config.py', '.'),
        ('backend', 'backend'),
    ],
    hiddenimports=[
        'eel',
        'eel.browsers',
        'bottle',
        'bottle_websocket',
        'gevent',
        'geventwebsocket',
        'pandas',
        'openpyxl',
        'xlrd',
        'backend',
        'backend.bridge',
        'backend.module_a_gpa',
        'backend.module_b_moral',
        'backend.module_c_quality',
        'backend.module_d_comprehensive',
        'backend.course_analyzer',
        'backend.ai_assistant',
        'backend.parsers',
        'backend.parsers.xls_reader',
        'backend.parsers.course_header_parser',
        'backend.parsers.dormitory_parser',
        'backend.parsers.absence_parser',
        'backend.parsers.discipline_parser',
        'backend.parsers.org_class_parser',
        'backend.utils',
        'backend.utils.excel_writer',
        'backend.utils.student_matcher',
        'backend.utils.rank_calculator',
        'backend.utils.class_utils',
        'backend.utils.progress_reporter',
        'config',
        'tkinter',
        'tkinter.filedialog',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'scipy',
        'PIL',
        'IPython',
        'jupyter',
        'notebook',
        'sphinx',
        'PyQt5',
        'PyQt6',
        'PySide2',
        'PySide6',
        'tkinter.test',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
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
    name='顿河学院学生测评管理软件',
    icon=_icon_path,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# ── macOS .app bundle ────────────────────────────────────────────────
app = BUNDLE(
    exe,
    name='顿河学院学生测评管理软件.app',
    icon=_icon_path,
    bundle_identifier='com.dunhe.student-evaluation',
    info_plist={
        'NSPrincipalClass': 'NSApplication',
        'NSHighResolutionCapable': 'True',
        'CFBundleDisplayName': '顿河学院学生测评管理软件',
        'CFBundleName': '顿河学院学生测评管理软件',
        'CFBundleShortVersionString': '7.1.0',
        'CFBundleVersion': '7.1.0',
        'NSHumanReadableCopyright': '© 2026 顿河学院团委秘书处',
    },
)
