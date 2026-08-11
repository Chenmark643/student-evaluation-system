# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller build spec for Student Evaluation System.
Build: pyinstaller --clean build.spec
"""

import sys
import os
from pathlib import Path

block_cipher = None

# Find eel package path
app_datas = [
    ('web', 'web'),
    ('config.py', '.'),
    ('backend', 'backend'),
    ('tools', 'tools'),
    (os.path.join('outputs', 'moral-project-templates'), 'moral_templates'),
    (os.path.join('web', 'assets', 'emoji'), os.path.join('web', 'assets', 'emoji')),
    (os.path.join('web', 'js', 'emoji-replace.js'), os.path.join('web', 'js')),
]

vendor_cli = Path('vendor') / 'kdocs-cli.exe'
installed_cli = Path(os.environ.get('LOCALAPPDATA', '')) / 'kdocs-cli' / 'kdocs-cli.exe'
kdocs_cli = vendor_cli if vendor_cli.is_file() else installed_cli
app_binaries = [(str(kdocs_cli), '.')] if kdocs_cli.is_file() else []

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=app_binaries,
    datas=app_datas,
    hiddenimports=[
        'eel',
        'webview',
        'webview.http',
        'webview.platforms.winforms',
        'clr',
        'pythonnet',
        'bottle',
        'bottle_websocket',
        'gevent',
        'geventwebsocket',
        'pandas',
        'openpyxl',
        'xlrd',
        'backend',
        'backend.bridge',
        'backend.app_update',
        'backend.module_a_gpa',
        'backend.module_b_moral',
        'backend.module_c_quality',
        'backend.module_d_comprehensive',
        'backend.course_analyzer',
        'backend.kdocs_sync',
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
        'patoolib',
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
    # Keep the binary filename ASCII. Python 3.8's one-file bootloader fails
    # during embedded-interpreter initialization when the EXE basename is CJK.
    # The application window and shortcuts still use the Chinese product name.
    name='DonCollege-Student-Evaluation',
    icon='logo.ico',
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
