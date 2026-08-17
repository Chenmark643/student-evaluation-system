"""
顿河学院学生测评管理软件 — 图形化安装程序
纯 Python + tkinter，无需任何外部依赖
"""

import os
import sys
import shutil
import ctypes
import subprocess
import tempfile
import struct
import tkinter as tk
from tkinter import ttk, messagebox, filedialog

# ── Constants ─────────────────────────────────────────────────────────

APP_NAME = '顿河学院学生测评管理软件'
APP_EXE = 'DonCollege-Student-Evaluation.exe'
DEFAULT_DIR = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')),
                           APP_NAME)
VERSION = '14.1.2'

# ── Fonts ──────────────────────────────────────────────────────────────
# Use system default fonts for maximum compatibility with Chinese text.
# On Chinese Windows, TkDefaultFont = Microsoft YaHei UI.
# For sizing: ('TkDefaultFont', size) or ('TkDefaultFont', size, 'bold')

BODY = 'TkDefaultFont'
MONO = 'TkFixedFont'
# For header/title: same font, just bigger
H1 = 'TkDefaultFont'

# Find source files — works in both dev and PyInstaller bundled mode
if getattr(sys, 'frozen', False):
    # PyInstaller bundled — all files at _MEIPASS root
    BASE_DIR = sys._MEIPASS
    SOURCE_EXE = os.path.join(BASE_DIR, APP_EXE)
    SOURCE_DATA = os.path.join(BASE_DIR, 'app_data')
    SOURCE_GUIDES_ROOT = BASE_DIR
    PROJECT_ROOT = BASE_DIR
    SOURCE_BRAND = os.path.join(BASE_DIR, 'installer-logo-header-native.png')
    SOURCE_ART = os.path.join(BASE_DIR, 'installer-campus-preview.png')
else:
    # Dev mode — files in ../dist/
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    SOURCE_EXE = os.path.join(BASE_DIR, 'dist', APP_EXE)
    SOURCE_DATA = os.path.join(BASE_DIR, 'dist', 'data')
    SOURCE_GUIDES_ROOT = os.path.join(BASE_DIR, 'dist')
    PROJECT_ROOT = BASE_DIR
    SOURCE_BRAND = os.path.join(BASE_DIR, 'installer', 'assets', 'installer-logo-header-native.png')
    SOURCE_ART = os.path.join(BASE_DIR, 'installer', 'assets', 'installer-campus-preview.png')

if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from webview2_runtime import get_webview2_version

WEBVIEW2_INSTALLER = 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'

SOURCE_GUIDES = [
    os.path.join(SOURCE_GUIDES_ROOT, '学分绩点操作教程(1).pdf'),
    os.path.join(SOURCE_GUIDES_ROOT, '德育分操作教程(2).pdf'),
    os.path.join(SOURCE_GUIDES_ROOT, '素质拓展分操作教程(1).pdf'),
]

# ── System Checks ─────────────────────────────────────────────────────

def _has_internet():
    """Check if we can reach the internet. Returns True/False."""
    try:
        import socket
        socket.create_connection(('8.8.8.8', 53), timeout=3)
        return True
    except Exception:
        pass
    try:
        socket.create_connection(('114.114.114.114', 53), timeout=3)
        return True
    except Exception:
        return False


def _enable_tls12():
    """Enable TLS 1.2 on old Windows (7/8) — critical for HTTPS downloads."""
    try:
        import winreg
        for path in [
            r'SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.2\Client',
            r'SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.2\Server',
        ]:
            try:
                with winreg.CreateKey(winreg.HKEY_LOCAL_MACHINE, path) as key:
                    winreg.SetValueEx(key, 'DisabledByDefault', 0, winreg.REG_DWORD, 0)
                    winreg.SetValueEx(key, 'Enabled', 0, winreg.REG_DWORD, 1)
            except Exception:
                pass  # Non-admin can't write here, but we try
    except Exception:
        pass
    # Also set .NET to use TLS 1.2
    os.environ['SystemDefaultTlsVersions'] = '1'


def _bundled_vcredist_path():
    """Get path to bundled VC++ Redist installer (may not exist)."""
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, 'vc_redist.x64.exe')
    else:
        return os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           'vc_redist.x64.exe')


def _bundled_webview2_path():
    """Return the bundled offline WebView2 Evergreen x64 installer path."""
    if getattr(sys, 'frozen', False):
        return os.path.join(sys._MEIPASS, WEBVIEW2_INSTALLER)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        WEBVIEW2_INSTALLER)


def installer_edition():
    """Return the user-facing edition from the actually bundled payload."""
    return ('完整版 · 内置 WebView2 离线运行库'
            if os.path.isfile(_bundled_webview2_path())
            else '轻量版 · 使用系统已有 WebView2')


def install_webview2_runtime():
    """Install the bundled WebView2 runtime and verify it is registered."""
    installer_path = _bundled_webview2_path()
    if not os.path.isfile(installer_path):
        return False, '安装包中缺少 WebView2 离线运行库'
    try:
        result = subprocess.run(
            [installer_path, '/silent', '/install'],
            capture_output=True,
            text=True,
            timeout=900,
            creationflags=0x08000000,
        )
        if result.returncode not in (0, 3010):
            return False, f'WebView2 安装程序返回代码 {result.returncode}'
        version = get_webview2_version()
        if not version:
            return False, '安装完成后仍未检测到 WebView2 运行库'
        return True, f'WebView2 {version}'
    except Exception as exc:
        return False, f'WebView2 安装失败：{exc}'


def find_browser():
    """Check if Edge or Chrome is installed. Returns (name, path) or (None, None)."""
    candidates = [
        ('Microsoft Edge', [
            os.path.join(os.environ.get('ProgramFiles(x86)', 'C:\\Program Files (x86)'),
                        'Microsoft', 'Edge', 'Application', 'msedge.exe'),
            os.path.join(os.environ.get('ProgramFiles', 'C:\\Program Files'),
                        'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        ]),
        ('Google Chrome', [
            os.path.join(os.environ.get('ProgramFiles', 'C:\\Program Files'),
                        'Google', 'Chrome', 'Application', 'chrome.exe'),
            os.path.join(os.environ.get('ProgramFiles(x86)', 'C:\\Program Files (x86)'),
                        'Google', 'Chrome', 'Application', 'chrome.exe'),
            os.path.join(os.environ.get('LOCALAPPDATA', ''),
                        'Google', 'Chrome', 'Application', 'chrome.exe'),
        ]),
    ]
    for name, paths in candidates:
        for p in paths:
            if os.path.isfile(p):
                return name, p
    return None, None


def check_vcredist():
    """Check if VC++ 2015-2022 Redist (x64) is installed. Returns True/False."""
    try:
        import winreg
        key_paths = [
            r'SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64',
            r'SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64',
        ]
        for kp in key_paths:
            try:
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, kp) as key:
                    installed, _ = winreg.QueryValueEx(key, 'Installed')
                    if installed == 1:
                        return True
            except OSError:
                pass
    except Exception:
        pass

    # Fallback: check if vcruntime140.dll exists in System32
    vcruntime = os.path.join(os.environ.get('SystemRoot', 'C:\\Windows'),
                             'System32', 'vcruntime140.dll')
    return os.path.isfile(vcruntime)


def check_critical_dlls():
    """Check for critical DLLs the app needs. Returns list of missing DLL names."""
    system32 = os.path.join(os.environ.get('SystemRoot', 'C:\\Windows'), 'System32')
    critical = [
        ('ucrtbase.dll', 'Universal CRT (Windows 更新 KB2999226)'),
        ('vcruntime140.dll', 'VC++ 2015-2022 运行库'),
        ('msvcp140.dll', 'VC++ 2015-2022 运行库'),
        ('concrt140.dll', 'VC++ 2015-2022 运行库'),
        ('vcruntime140_1.dll', 'VC++ 2015-2022 运行库 (新版)'),
    ]
    missing = []
    for dll, desc in critical:
        path = os.path.join(system32, dll)
        if not os.path.isfile(path):
            # Also check SysWOW64 for 32-bit
            syswow64 = os.path.join(os.environ.get('SystemRoot', 'C:\\Windows'), 'SysWOW64')
            if not os.path.isfile(os.path.join(syswow64, dll)):
                missing.append((dll, desc))
    return missing


def check_disk_space(path, required_mb=300):
    """Check available disk space. Returns (ok, free_mb)."""
    try:
        # Walk up to find existing parent
        p = path
        while p and not os.path.exists(p):
            p = os.path.dirname(p)
        if not p:
            p = 'C:\\'
        usage = shutil.disk_usage(p)
        free_mb = usage.free // (1024 * 1024)
        return free_mb >= required_mb, free_mb
    except Exception:
        return True, 0  # Assume OK if can't check


def get_os_info():
    """Get friendly OS version string. Returns 'Windows 10', 'Windows 11', etc."""
    try:
        import platform
        winver = platform.version()
        release = platform.release()
        win = sys.getwindowsversion()
        sp = f' SP{win.service_pack_major}' if getattr(win, 'service_pack_major', 0) else ''
        arch = '64 位' if struct.calcsize('P') * 8 == 64 else '32 位'
        # Map Windows kernel versions to friendly names
        ver_map = {
            '10': 'Windows 10 / 11',
            '6.3': 'Windows 8.1',
            '6.2': 'Windows 8',
            '6.1': 'Windows 7',
            '6.0': 'Windows Vista',
        }
        for k, v in ver_map.items():
            if release.startswith(k):
                return f'{v}{sp} · {arch}'
        return f'Windows ({release}){sp} · {arch}'
    except Exception:
        return '未知'


def get_windows_compatibility():
    """Return (supported, blocking_reason, legacy) for the packaged x64 build."""
    try:
        win = sys.getwindowsversion()
        legacy = (win.major, win.minor) < (10, 0)
        if struct.calcsize('P') * 8 != 64:
            return False, '当前安装包仅支持 64 位 Windows，请使用 x86 专用版本。', legacy
        if (win.major, win.minor) < (10, 0):
            return False, '当前版本需要 Windows 10/11 64 位及 WebView2 渲染运行库。', True
        return True, '', legacy
    except Exception as e:
        return False, f'无法识别 Windows 版本：{e}', False


def _run_ps(script, timeout=300):
    """Run a PowerShell script, return (success, output)."""
    try:
        r = subprocess.run(
            ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass',
             '-WindowStyle', 'Hidden', '-Command', script],
            capture_output=True, text=True, timeout=timeout,
            creationflags=0x08000000,
        )
        return r.returncode == 0, r.stdout.strip()
    except Exception as e:
        return False, str(e)


def download_edge(progress_callback=None):
    """Download and install Microsoft Edge. Returns True on success."""
    supported, _, legacy = get_windows_compatibility()
    if not supported or legacy:
        # The current Edge bootstrapper requires Windows 10+. Never report a
        # successful repair on Win7/8; those systems need the legacy runtime.
        return False
    edge_setup = os.path.join(tempfile.gettempdir(), 'MicrosoftEdgeSetup.exe')

    # Step 1: Download Edge bootstrapper (~2 MB)
    url = 'https://go.microsoft.com/fwlink/?linkid=2109047'
    ps_download = f'''
$url = '{url}'
$out = '{edge_setup}'
try {{
    $ProgressPreference = 'SilentlyContinue'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
    Write-Output 'OK'
}} catch {{
    Write-Output "FAIL: $($_.Exception.Message)"
}}
'''
    ok, out = _run_ps(ps_download, timeout=120)
    if not ok or 'FAIL' in out:
        return False

    # Step 2: Run installer silently
    ps_install = f'''
try {{
    $p = Start-Process -FilePath '{edge_setup}' -ArgumentList '/silent','/install' -Wait -PassThru
    Write-Output "EXIT:$($p.ExitCode)"
}} catch {{
    Write-Output "FAIL: $($_.Exception.Message)"
}}
'''
    ok, out = _run_ps(ps_install, timeout=600)
    try:
        os.remove(edge_setup)
    except Exception:
        pass
    return ok and 'EXIT:0' in out


def download_vcredist(progress_callback=None):
    """Install VC++ 2015-2022 Redist x64. Uses bundled file first, then downloads. Returns True on success."""
    # Try bundled installer first
    bundled = _bundled_vcredist_path()
    if os.path.isfile(bundled):
        vcredist = bundled
    else:
        # Download from Microsoft
        vcredist = os.path.join(tempfile.gettempdir(), 'VC_redist.x64.exe')
        url = 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
        _enable_tls12()
        ps_download = f'''
$url = '{url}'
$out = '{vcredist}'
try {{
    $ProgressPreference = 'SilentlyContinue'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
    Write-Output 'OK'
}} catch {{
    Write-Output "FAIL: $($_.Exception.Message)"
}}
'''
        ok, out = _run_ps(ps_download, timeout=300)
        if not ok or 'FAIL' in out:
            return False

    # Install silently
    _enable_tls12()
    ps_install = f'''
try {{
    $p = Start-Process -FilePath '{vcredist}' -ArgumentList '/install','/quiet','/norestart' -Wait -PassThru
    Write-Output "EXIT:$($p.ExitCode)"
}} catch {{
    Write-Output "FAIL: $($_.Exception.Message)"
}}
'''
    ok, out = _run_ps(ps_install, timeout=300)

    # Clean up downloaded file (but keep bundled one)
    if vcredist != bundled:
        try:
            os.remove(vcredist)
        except Exception:
            pass
    if not ok or 'FAIL' in out:
        return False
    # 0=installed, 1638=another compatible version exists, 3010=reboot needed.
    return any(f'EXIT:{code}' in out for code in (0, 1638, 3010))


# ── Shortcut Creation ──────────────────────────────────────────────────

def create_shortcut(link_path, target_path, working_dir, description='', arguments=''):
    """Create a .lnk shortcut using PowerShell COM."""
    ps = f'''
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut("{link_path}")
$sc.TargetPath = "{target_path}"
$sc.WorkingDirectory = "{working_dir}"
$sc.Description = "{description}"
$sc.Arguments = "{arguments}"
$sc.WindowStyle = 1
$sc.Save()
'''
    subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass',
                     '-Command', ps],
                   capture_output=True, creationflags=0x08000000)


def remove_shortcut(name):
    """Remove shortcuts from Start Menu and Desktop."""
    start_menu = os.path.join(os.environ['APPDATA'],
                              'Microsoft', 'Windows', 'Start Menu', 'Programs')
    desktop = os.path.join(os.environ['USERPROFILE'], 'Desktop')
    for base in [start_menu, desktop]:
        for ext in ['', '.lnk']:
            p = os.path.join(base, name + ext)
            if os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass


# ── Installer GUI ──────────────────────────────────────────────────────

def enable_crisp_high_dpi_rendering():
    """Prevent Windows from bitmap-scaling the whole Tk window on HiDPI displays."""
    if os.name != 'nt':
        return
    try:
        # System-DPI awareness keeps Tk geometry stable while allowing text and
        # native-size raster assets to render directly at the monitor DPI.
        ctypes.windll.user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-2))
        return
    except Exception:
        pass
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
        return
    except Exception:
        pass
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass

class InstallerApp:
    def __init__(self):
        enable_crisp_high_dpi_rendering()
        self.root = tk.Tk()
        self.root.title(f'{APP_NAME} — {installer_edition()} — v{VERSION}')
        self.root.geometry('980x620')
        self.root.minsize(920, 580)
        self.root.configure(bg='#f5f5f7')

        # Center window
        self.root.update_idletasks()
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        x = (sw - 980) // 2
        y = (sh - 620) // 2
        self.root.geometry(f'+{x}+{y}')

        # Set taskbar icon
        try:
            icon_path = (os.path.join(BASE_DIR, 'installer-icon-hd.ico')
                         if getattr(sys, 'frozen', False)
                         else os.path.join(BASE_DIR, 'installer', 'assets', 'installer-icon-hd.ico'))
            self.root.iconbitmap(icon_path)
        except Exception:
            pass

        # State
        self.install_dir = tk.StringVar(value=DEFAULT_DIR)
        self.create_desktop = tk.BooleanVar(value=True)
        self.create_startmenu = tk.BooleanVar(value=True)
        self.current_step = 0

        supported, reason, _ = get_windows_compatibility()
        if not supported:
            messagebox.showerror('系统不兼容', reason)
            self.root.destroy()
            raise SystemExit(2)

        self._build_ui()
        self._show_step(0)

    def _build_ui(self):
        shell = tk.Frame(self.root, bg='#edf2f8')
        shell.pack(fill='both', expand=True)

        # Persistent brand rail: the installer now belongs to the same visual
        # family as the application instead of looking like a generic wizard.
        rail = tk.Frame(shell, bg='#f7f9fc', width=300)
        rail.pack(side='left', fill='y')
        rail.pack_propagate(False)
        try:
            self.installer_art = tk.PhotoImage(file=SOURCE_ART)
            tk.Label(rail, image=self.installer_art, bg='#f7f9fc', bd=0).pack(fill='x')
        except Exception:
            self.installer_art = None
        rail_copy = tk.Frame(rail, bg='#0b3b79', height=140)
        rail_copy.pack(side='bottom', fill='x')
        rail_copy.pack_propagate(False)
        tk.Label(rail_copy, text='顿河学院', font=(H1, 18, 'bold'),
                 bg='#0b3b79', fg='white').pack(anchor='w', padx=24, pady=(22, 4))
        tk.Label(rail_copy, text='学生综合测评管理软件', font=(BODY, 10),
                 bg='#0b3b79', fg='#cfe2ff').pack(anchor='w', padx=24)
        tk.Label(rail_copy, text='本地计算  ·  数据安全  ·  专业高效', font=(BODY, 8),
                 bg='#0b3b79', fg='#8fb7e8').pack(anchor='w', padx=24, pady=(7, 0))

        body = tk.Frame(shell, bg='#f5f5f7')
        body.pack(side='right', fill='both', expand=True)

        header = tk.Frame(body, bg='#ffffff', height=78,
                          highlightbackground='#e5e9ef', highlightthickness=1)
        header.pack(fill='x')
        header.pack_propagate(False)
        try:
            self.brand_logo = tk.PhotoImage(file=SOURCE_BRAND)
            tk.Label(header, image=self.brand_logo, bg='#ffffff', bd=0).place(x=24, y=10)
        except Exception:
            self.brand_logo = None
        tk.Label(header, text='安装学生综合测评管理软件', font=(H1, 14, 'bold'),
                 bg='#ffffff', fg='#172033', anchor='w').place(x=92, y=14)
        tk.Label(header, text=f'{installer_edition()}  ·  版本 {VERSION}', font=(BODY, 9),
                 bg='#ffffff', fg='#758195', anchor='w').place(x=92, y=44)

        self.step_frame = tk.Frame(body, bg='#f5f7fa', height=48)
        self.step_frame.pack(fill='x')
        self.step_frame.pack_propagate(False)
        step_inner = tk.Frame(self.step_frame, bg='#f5f7fa')
        step_inner.pack(expand=True)
        steps = ['01 欢迎', '02 协议', '03 位置', '04 检测', '05 确认', '06 安装']
        self.step_labels = []
        for s in steps:
            lbl = tk.Label(step_inner, text=s, font=(BODY, 9),
                           bg='#f5f7fa', fg='#8a95a5')
            lbl.pack(side='left', padx=11)
            self.step_labels.append(lbl)

        self.nav = tk.Frame(body, bg='#ffffff', height=68,
                            highlightbackground='#e5e9ef', highlightthickness=1)
        self.nav.pack(side='bottom', fill='x')
        self.nav.pack_propagate(False)

        nav_inner = tk.Frame(self.nav, bg='#ffffff')
        nav_inner.pack(fill='both', padx=24, pady=10)

        # Button container: left=取消, right=上一步+下一步
        self.btn_cancel = tk.Button(nav_inner, text='取消', font=(BODY, 10),
                                     bg='#edf1f5', fg='#566174', bd=0, padx=22, pady=8,
                                     cursor='hand2', command=self._on_cancel)
        self.btn_cancel.pack(side='left')

        self.btn_next = tk.Button(nav_inner, text='下一步 →', font=(BODY, 10, 'bold'),
                                   bg='#0b66d4', fg='white', bd=0, padx=28, pady=8,
                                   cursor='hand2', command=self._on_next)
        self.btn_next.pack(side='right')

        self.btn_back = tk.Button(nav_inner, text='← 上一步', font=(BODY, 10),
                                   bg='#edf1f5', fg='#566174', bd=0, padx=22, pady=8,
                                   cursor='hand2', command=self._on_back)
        self.btn_back.pack(side='right', padx=(0, 8))

        # ── Content area (fills space between header and nav) ──
        self.content = tk.Frame(body, bg='#ffffff',
                                highlightbackground='#e5e9ef', highlightthickness=1)
        self.content.pack(fill='both', expand=True, padx=20, pady=(8, 12))

    def _set_step_highlight(self, idx):
        for i, lbl in enumerate(self.step_labels):
            if i == idx:
                lbl.configure(fg='#0071e3')
            elif i < idx:
                lbl.configure(fg='#34c759')
            else:
                lbl.configure(fg='#999999')

    def _show_step(self, idx):
        for w in self.content.winfo_children():
            w.destroy()
        self.current_step = idx
        self._set_step_highlight(idx)

        if idx == 0:
            self._show_welcome()
        elif idx == 1:
            self._show_license()
        elif idx == 2:
            self._show_location()
        elif idx == 3:
            self._show_detect()
        elif idx == 4:
            self._show_confirm()
        elif idx == 5:
            self._show_install()

        self.btn_back.configure(bg='#f0f0f0' if idx > 0 else '#e8e8e8',
                                state='normal' if idx > 0 else 'disabled')
        # Reset next button text when navigating
        if idx != 4:
            self.btn_next.configure(text='下一步 →', bg='#1a73e8',
                                    activebackground='#1557b0')

    def _show_welcome(self):
        tk.Label(self.content, text='欢迎使用',
                 font=(BODY, 20, 'bold'),
                 bg='#ffffff', fg='#1a1a2e').pack(pady=(24, 8))
        tk.Label(self.content, text=APP_NAME,
                 font=(BODY, 12,),
                 bg='#ffffff', fg='#555555').pack()
        tk.Label(self.content, text=installer_edition(),
                 font=(BODY, 9, 'bold'),
                 bg='#ffffff', fg='#0b66d4').pack(pady=(5, 0))
        tk.Label(self.content, text='',
                 bg='#ffffff').pack(pady=8)

        features = [
            '📊  学分绩点计算 — 自动转化五级制，动态生成GPA公式',
            '📋  德育分计算 — 多源数据自动比对，精准匹配学生',
            '⭐  素质拓展分 — 自动计算/辅助人工双模式，阈值管控',
            '📈  综合测评 — 三合一排名输出，学期对比分析',
            '🧭  兼容性导入 — 字段映射、课程审核与异常追溯',
        ]
        for f in features:
            tk.Label(self.content, text=f, font=(BODY, 10,),
                     bg='#ffffff', fg='#444444', anchor='w', justify='left',
                     wraplength=500).pack(anchor='w', pady=2, padx=40)

    def _show_license(self):
        tk.Label(self.content, text='软件许可协议',
                 font=(BODY, 14, 'bold'),
                 bg='#ffffff', fg='#1a1a2e').pack(pady=(16, 8))

        license_frame = tk.Frame(self.content, bg='#f5f5f5',
                                  highlightbackground='#e0e0e0',
                                  highlightthickness=1)
        license_frame.pack(fill='both', expand=True, padx=16, pady=8)

        license_text = (
            f'{APP_NAME} v{VERSION}\n\n'
            f'版权所有 © 2025 顿河学院团委秘书处\n'
            f'开发者：陈雨昂\n\n'
            f'本软件供顿河学院内部使用，用于学生综合测评数据的计算与管理。\n\n'
            f'使用条款：\n'
            f'1. 本软件仅限于顿河学院学生测评工作使用\n'
            f'2. 不得将本软件用于任何非法用途\n'
            f'3. 未经授权不得修改、反编译或分发本软件\n'
            f'4. 软件按"现状"提供，开发者不承担因使用本软件产生的任何数据丢失或错误责任\n\n'
            f'数据隐私：\n'
            f'• 所有数据均存储在本地，不会上传至任何服务器\n'
            f'• AI 功能通过 DeepSeek API 调用，使用时需联网且受 DeepSeek 隐私政策约束'
        )
        text_widget = tk.Text(license_frame, font=(BODY, 9,),
                              bg='#f5f5f5', fg='#333333', wrap='word',
                              relief='flat', borderwidth=0, padx=12, pady=12)
        text_widget.insert('1.0', license_text)
        text_widget.configure(state='disabled')
        text_widget.pack(fill='both', expand=True)

    def _show_location(self):
        tk.Label(self.content, text='选择安装位置',
                 font=(BODY, 14, 'bold'),
                 bg='#ffffff', fg='#1a1a2e').pack(pady=(20, 8))
        tk.Label(self.content, text='选择软件的安装目录，建议使用默认路径',
                 font=(BODY, 9,),
                 bg='#ffffff', fg='#888888').pack(pady=(0, 16))

        dir_frame = tk.Frame(self.content, bg='#ffffff')
        dir_frame.pack(fill='x', padx=16, pady=8)

        tk.Label(dir_frame, text='安装路径:', font=(BODY, 10,),
                 bg='#ffffff', fg='#333333').pack(anchor='w')

        path_frame = tk.Frame(dir_frame, bg='#ffffff')
        path_frame.pack(fill='x', pady=(4, 0))

        self.path_entry = tk.Entry(path_frame, textvariable=self.install_dir,
                                    font=('Consolas', 10), bg='#f8f9fa',
                                    relief='solid', borderwidth=1)
        self.path_entry.pack(side='left', fill='x', expand=True, ipady=4)

        tk.Button(path_frame, text='浏览...', font=(BODY, 9,),
                  bg='#f0f0f0', fg='#333333', bd=0, padx=12, pady=4,
                  cursor='hand2', command=self._browse_dir).pack(side='right', padx=(8, 0))

        # Space required
        tk.Label(self.content, text='', bg='#ffffff').pack()
        info_frame = tk.Frame(self.content, bg='#f5f5f5',
                               highlightbackground='#e0e0e0',
                               highlightthickness=1)
        info_frame.pack(fill='x', padx=16, pady=8)
        required_space = '约 300 MB（含 WebView2 修复组件）' if os.path.isfile(_bundled_webview2_path()) else '约 100 MB（使用系统 WebView2）'
        tk.Label(info_frame, text=f'所需空间: {required_space}', font=(BODY, 9,),
                 bg='#f5f5f5', fg='#555555').pack(anchor='w', padx=12, pady=8)

        edition_note = ('✓ 已内置 WebView2 离线修复组件，无需另行下载'
                        if os.path.isfile(_bundled_webview2_path())
                        else '✓ 轻量安装包；适合已自带 WebView2 的 Windows 10/11')
        tk.Label(self.content, text=edition_note,
                 font=(BODY, 9), bg='#ffffff', fg='#21865b').pack(pady=(8, 0))

        # Options
        tk.Label(self.content, text='', bg='#ffffff').pack()
        tk.Checkbutton(self.content, text='创建桌面快捷方式',
                       variable=self.create_desktop, font=(BODY, 10,),
                       bg='#ffffff', activebackground='#ffffff',
                       cursor='hand2').pack(anchor='w', padx=16)
        tk.Checkbutton(self.content, text='创建开始菜单文件夹',
                       variable=self.create_startmenu, font=(BODY, 10,),
                       bg='#ffffff', activebackground='#ffffff',
                       cursor='hand2').pack(anchor='w', padx=16)

    # ── Step 4: Environment Check ────────────────────────────────────

    def _show_detect(self):
        self._fixing = False

        tk.Label(self.content, text='🔍 环境检测',
                 font=(BODY, 14, 'bold'),
                 bg='#ffffff', fg='#1a1a2e').pack(pady=(12, 4))
        tk.Label(self.content, text='正在扫描系统环境，确保软件正常运行所需组件齐全',
                 font=(BODY, 9), bg='#ffffff', fg='#888888').pack(pady=(0, 8))

        # Container for check items
        self.detect_frame = tk.Frame(self.content, bg='#ffffff')
        self.detect_frame.pack(fill='both', expand=True, padx=8)

        # Run checks
        vcredist_ok = check_vcredist()
        missing_dlls = check_critical_dlls()
        space_ok, free_mb = check_disk_space(self.install_dir.get(), 300)
        os_info = get_os_info()
        os_ok, os_reason, _ = get_windows_compatibility()
        webview2_version = get_webview2_version()

        self.detect_results = {}
        all_ok = True

        # --- WebView2 ---
        webview2_ok = bool(webview2_version)
        webview_status = (webview2_version or
                          ('未安装，可使用内置组件修复' if os.path.isfile(_bundled_webview2_path())
                           else '未安装；轻量版不含修复组件'))
        self._add_check_row(0, 'WebView2 渲染运行库', 'Microsoft Evergreen (x64)',
                           webview2_ok,
                           webview_status,
                           not webview2_ok and os.path.isfile(_bundled_webview2_path()))
        if not webview2_ok:
            all_ok = False

        # --- DLLs ---
        dll_ok = len(missing_dlls) == 0
        if dll_ok:
            self._add_check_row(1, '系统 DLL', 'ucrtbase / vcruntime140 / msvcp140',
                               True, '全部正常', False)
        else:
            dll_names = ', '.join(d[0] for d in missing_dlls[:3])
            fixable = any('VC++' in d[1] for d in missing_dlls)
            self._add_check_row(1, '系统 DLL', f'缺少: {dll_names}',
                               False,
                               f'缺 {len(missing_dlls)} 个关键 DLL',
                               fixable)
            all_ok = False

        # --- VC++ ---
        if not dll_ok and any('VC++' in d[1] for d in missing_dlls):
            vc_status = '需安装（修复 DLL 缺失）'
        elif vcredist_ok:
            vc_status = '已安装'
        else:
            vc_status = '未安装'
        self._add_check_row(2, 'VC++ 运行库', '2015-2022 (x64)',
                           vcredist_ok and dll_ok,
                           vc_status,
                           not vcredist_ok or not dll_ok)

        # --- Disk space ---
        self._add_check_row(3, '磁盘空间', f'≥ 300 MB (可用: {free_mb} MB)',
                           space_ok,
                           f'{free_mb} MB 可用' if space_ok else f'仅 {free_mb} MB',
                           not space_ok)

        # --- OS ---
        self._add_check_row(4, '操作系统', 'Windows 10/11 (64 位)',
                           os_ok,
                           os_info if os_ok else os_reason,
                           False)

        # --- Summary ---
        tk.Label(self.content, text='', bg='#ffffff').pack(pady=4)

        if not space_ok:
            all_ok = False
        if not os_ok:
            all_ok = False

        self._all_env_ok = all_ok
        self._webview2_ok = webview2_ok
        self._missing_dlls = missing_dlls

        if all_ok:
            tk.Label(self.content, text='✅ 所有检测通过，可以继续安装',
                     font=(BODY, 10,), bg='#ffffff', fg='#4CAF50').pack(pady=4)
        else:
            self._fix_btn_frame = tk.Frame(self.content, bg='#ffffff')
            self._fix_btn_frame.pack(pady=4)
            tk.Label(self._fix_btn_frame, text='⚠️ 检测到缺失组件，',
                     font=(BODY, 10,), bg='#ffffff', fg='#f44336').pack(side='left')
            tk.Button(self._fix_btn_frame, text='🔧 一键修复',
                      font=(BODY, 10, 'bold'), bg='#FF9800', fg='white',
                      bd=0, padx=16, pady=4, cursor='hand2',
                      command=self._auto_fix).pack(side='left', padx=4)

        self.btn_next.configure(state='normal' if all_ok else 'disabled')

    def _add_check_row(self, idx, name, requirement, ok, status_text, can_fix):
        """Add a check result row to the detect frame."""
        row = tk.Frame(self.detect_frame, bg='#fafafa' if idx % 2 == 0 else '#ffffff')
        row.pack(fill='x', pady=1)

        # Status icon
        icon = '✅' if ok else ('🔧' if can_fix else '⚠️')
        tk.Label(row, text=icon, font=(BODY, 12), bg=row['bg'],
                 width=2).pack(side='left', padx=(8, 4), pady=6)

        # Name + requirement
        info = tk.Frame(row, bg=row['bg'])
        info.pack(side='left', fill='x', expand=True)
        tk.Label(info, text=name, font=(BODY, 10, 'bold'),
                 bg=row['bg'], fg='#333333').pack(anchor='w')
        tk.Label(info, text=f'需要: {requirement}', font=(BODY, 8),
                 bg=row['bg'], fg='#888888').pack(anchor='w')

        # Status text
        color = '#4CAF50' if ok else '#f44336'
        tk.Label(row, text=status_text, font=(BODY, 10),
                 bg=row['bg'], fg=color).pack(side='right', padx=(4, 12), pady=6)

        self.detect_results[name] = {'ok': ok, 'can_fix': can_fix}

    def _auto_fix(self):
        """Automatically fix missing components."""
        self._fixing = True
        self.btn_back.configure(state='disabled')
        self.btn_next.configure(state='disabled')

        # Clear old content and show fix progress
        if hasattr(self, '_fix_btn_frame'):
            self._fix_btn_frame.destroy()

        self._fix_status = tk.Label(self.content, text='正在修复...',
                                     font=(BODY, 10, 'bold'),
                                     bg='#ffffff', fg='#FF9800')
        self._fix_status.pack(pady=8)

        self._fix_progress = ttk.Progressbar(self.content, length=300,
                                              mode='indeterminate')
        self._fix_progress.pack(pady=4)
        self._fix_progress.start()

        self._fix_log = tk.Text(self.content, font=(MONO, 8),
                                 bg='#f8f9fa', fg='#555555',
                                 height=4, relief='flat', borderwidth=0,
                                 state='normal')
        self._fix_log.pack(fill='x', padx=16, pady=8)

        # Start fix in background via after()
        self.root.after(200, self._run_fix)

    def _fix_log_msg(self, msg):
        self._fix_log.insert('end', msg + '\n')
        self._fix_log.see('end')
        self.root.update()

    def _run_fix(self):
        self._fix_log_msg('🔧 正在检查运行环境...')
        _enable_tls12()

        online = _has_internet()
        if not online:
            self._fix_log_msg('⚠️ 未检测到网络连接，将使用内置安装包')
        else:
            self._fix_log_msg('✅ 网络连接正常')

        webview2_version = get_webview2_version()
        vcredist_ok = check_vcredist()
        missing_dlls = check_critical_dlls()
        has_dll_issue = len(missing_dlls) > 0
        fixed_any = False

        # Fix 1: WebView2 (always offline; no browser installation required)
        if not webview2_version:
            if os.path.isfile(_bundled_webview2_path()):
                self._fix_log_msg('📦 安装内置 WebView2 渲染运行库...')
                self._fix_status.configure(text='正在离线安装 WebView2 运行库...')
                success, detail = install_webview2_runtime()
                if success:
                    self._fix_log_msg(f'  ✅ {detail} 安装成功')
                    fixed_any = True
                else:
                    self._fix_log_msg(f'  ❌ {detail}')
            else:
                self._fix_log_msg('❌ 当前系统没有 WebView2，轻量版不包含修复组件')
                self._fix_log_msg('  请改用“完整版（含 WebView2）”安装包')

        # Fix 2: DLLs / VC++
        if has_dll_issue or not vcredist_ok:
            bundled = _bundled_vcredist_path()
            if os.path.isfile(bundled):
                self._fix_log_msg('📦 安装内置 VC++ 运行库 (离线安装包)...')
                self._fix_status.configure(text='正在安装 VC++ 运行库 (离线)...')
            elif online:
                self._fix_log_msg('📥 下载 VC++ 运行库 (约 25 MB)...')
                self._fix_status.configure(text='正在下载并安装 VC++ 运行库...')
            else:
                self._fix_log_msg('❌ VC++ 缺失 且 无网络连接，无法下载')
                self._fix_log_msg('  📋 请手动下载: https://aka.ms/vs/17/release/vc_redist.x64.exe')
                self._fix_log_msg('  文件名: vc_redist.x64.exe，拷贝到此电脑双击安装即可')

            if os.path.isfile(bundled) or online:
                if download_vcredist():
                    self._fix_log_msg('  ✅ VC++ 运行库安装成功')
                    still_missing = check_critical_dlls()
                    if len(still_missing) == 0:
                        self._fix_log_msg('  ✅ 所有 DLL 依赖已修复')
                    else:
                        still = ', '.join(d[0] for d in still_missing)
                        self._fix_log_msg(f'  ⚠️ 仍有 {len(still_missing)} 个 DLL 缺失: {still}')
                        if any('ucrtbase' in d[0] for d in still_missing):
                            self._fix_log_msg('  💡 ucrtbase.dll 需要 Windows 更新 KB2999226')
                            self._fix_log_msg('     下载: https://support.microsoft.com/kb/2999226')
                    fixed_any = True
                else:
                    self._fix_log_msg('  ❌ VC++ 安装失败，请手动安装')

        self._fix_progress.stop()

        if fixed_any:
            self._fix_status.configure(text='✅ 修复完成！重新检测中...',
                                       fg='#4CAF50')
        else:
            self._fix_status.configure(text='⚠️ 部分组件修复失败，可手动安装后继续',
                                       fg='#f44336')

        self.root.after(800, lambda: self._refresh_detect())

    def _refresh_detect(self):
        """Re-run the environment check."""
        self._fixing = False
        self.btn_back.configure(state='normal')
        self.btn_next.configure(state='normal')
        self._show_step(3)

    # ── Step 5: Confirm ──────────────────────────────────────────────

    def _show_confirm(self):
        tk.Label(self.content, text='准备安装',
                 font=(BODY, 14, 'bold'),
                 bg='#ffffff', fg='#1a1a2e').pack(pady=(20, 8))
        tk.Label(self.content, text='请确认以下设置，然后点击「安装」开始',
                 font=(BODY, 9,),
                 bg='#ffffff', fg='#888888').pack(pady=(0, 16))

        # Show environment status
        webview2_version = get_webview2_version()
        vcredist_ok = check_vcredist()
        missing_dlls = check_critical_dlls()
        space_ok, _ = check_disk_space(self.install_dir.get(), 300)
        dll_ok = len(missing_dlls) == 0

        items = [
            ('软件名称', APP_NAME),
            ('版本', f'v{VERSION} · {installer_edition()}'),
            ('安装位置', self.install_dir.get()),
            ('WebView2', f'✅ {webview2_version}' if webview2_version else '❌ 未安装'),
            ('系统 DLL', '✅ 全部正常' if dll_ok else f'⚠️ 缺 {len(missing_dlls)} 个'),
            ('VC++ 运行库', '✅ 已安装' if vcredist_ok else '⚠️ 未安装'),
            ('磁盘空间', '✅ 充足' if space_ok else '❌ 不足'),
            ('桌面快捷方式', '创建' if self.create_desktop.get() else '不创建'),
            ('开始菜单', '创建' if self.create_startmenu.get() else '不创建'),
        ]
        for label, value in items:
            row = tk.Frame(self.content, bg='#ffffff')
            row.pack(fill='x', padx=40, pady=4)
            tk.Label(row, text=label, font=(BODY, 10,),
                     bg='#ffffff', fg='#888888', width=12, anchor='e').pack(side='left')
            tk.Label(row, text='  ', bg='#ffffff').pack(side='left')
            tk.Label(row, text=value, font=(BODY, 10, 'bold'),
                     bg='#ffffff', fg='#333333').pack(side='left')

        self.btn_next.configure(text='安装', bg='#4CAF50', activebackground='#388E3C')

    def _show_install(self):
        tk.Label(self.content, text='正在安装...',
                 font=(BODY, 14, 'bold'),
                 bg='#ffffff', fg='#1a1a2e').pack(pady=(24, 16))

        self.progress = ttk.Progressbar(self.content, length=400, mode='determinate')
        self.progress.pack(pady=8)

        self.status_label = tk.Label(self.content, text='准备中...',
                                      font=(BODY, 9,),
                                      bg='#ffffff', fg='#555555', wraplength=450)
        self.status_label.pack(pady=8)

        self.detail_text = tk.Text(self.content, font=('Consolas', 8),
                                    bg='#f8f9fa', fg='#555555',
                                    height=7, relief='flat', borderwidth=0,
                                    state='disabled')
        self.detail_text.pack(fill='both', expand=True, padx=16, pady=8)

        # Disable nav during install
        self.btn_next.configure(state='disabled')
        self.btn_back.configure(state='disabled')
        self.btn_cancel.configure(text='取消', state='disabled')

        # Run install
        self.root.after(100, self._run_install)

    # ── Navigation ─────────────────────────────────────────────────────

    def _on_cancel(self):
        if self.current_step == 5:
            return  # Can't cancel during install
        if self.current_step == 3 and hasattr(self, '_fixing') and self._fixing:
            return  # Can't cancel during fix
        if messagebox.askyesno('取消安装', f'确定要退出{APP_NAME}安装向导吗？'):
            self.root.destroy()

    def _on_back(self):
        if self.current_step > 0:
            if self.current_step == 4:
                self.btn_next.configure(text='下一步 →', bg='#1a73e8',
                                        activebackground='#1557b0')
            self._show_step(self.current_step - 1)

    def _on_next(self):
        if self.current_step == 3 and not getattr(self, '_all_env_ok', False):
            messagebox.showwarning('环境尚未就绪',
                                   '请先完成 WebView2 等运行环境修复，再继续安装。')
            return
        if self.current_step == 4:
            self._show_step(5)  # Confirm → Install
        elif self.current_step < 4:
            self._show_step(self.current_step + 1)

    def _browse_dir(self):
        d = filedialog.askdirectory(title='选择安装目录', initialdir=self.install_dir.get())
        if d:
            self.install_dir.set(os.path.join(d, APP_NAME))

    # ── Install Logic ──────────────────────────────────────────────────

    def _log(self, msg):
        self.detail_text.configure(state='normal')
        self.detail_text.insert('end', msg + '\n')
        self.detail_text.see('end')
        self.detail_text.configure(state='disabled')

    def _run_install(self):
        dest = os.path.abspath(os.path.normpath(self.install_dir.get()))
        steps = 6
        ok = True

        try:
            if os.path.basename(dest).casefold() != APP_NAME.casefold():
                raise RuntimeError(f'安装目录必须以“{APP_NAME}”作为最后一级文件夹。')
            if not get_webview2_version():
                raise RuntimeError(
                    '未检测到 WebView2 渲染运行库，请返回环境检测页面完成离线修复。'
                )
            # Step 1: Check source
            self.status_label.configure(text='[1/6] 检查安装源...')
            self.progress['value'] = 100 / steps
            self._log('检查安装文件...')
            if not os.path.isfile(SOURCE_EXE):
                raise RuntimeError(f'未找到主程序文件: {SOURCE_EXE}')
            self._log(f'  ✓ 找到主程序 ({os.path.getsize(SOURCE_EXE)/1024/1024:.0f} MB)')

            # Step 2: Create directory
            self.status_label.configure(text='[2/6] 创建安装目录...')
            self.progress['value'] = 200 / steps
            if os.path.exists(dest):
                self._log(f'  警告: 目录已存在，将覆盖安装')
                self._log('  已保留原有 data 目录和用户数据')
            os.makedirs(dest, exist_ok=True)
            self._log(f'  ✓ 安装目录: {dest}')

            # Step 3: Copy files
            self.status_label.configure(text=f'[3/6] 复制主程序 ({os.path.getsize(SOURCE_EXE)/1024/1024:.0f} MB)...')
            self.progress['value'] = 300 / steps
            self._log('  复制主程序...')

            import time
            dest_exe = os.path.join(dest, APP_EXE)
            with open(SOURCE_EXE, 'rb') as src, open(dest_exe, 'wb') as dst:
                total = os.path.getsize(SOURCE_EXE)
                copied = 0
                while True:
                    chunk = src.read(8 * 1024 * 1024)  # 8MB chunks
                    if not chunk:
                        break
                    dst.write(chunk)
                    copied += len(chunk)
                    pct = copied / total * 100
                    self.progress['value'] = 300 / steps + (pct * 0.5) / steps
                    self.status_label.configure(
                        text=f'[3/6] 复制主程序... {copied/1024/1024:.0f}/{total/1024/1024:.0f} MB')
                    self.root.update()

            self._log(f'  ✓ 主程序安装完成')

            # Step 4: Copy data
            self.status_label.configure(text='[4/6] 复制数据与文档...')
            self.progress['value'] = 450 / steps
            self._log('  复制数据文件...')
            if os.path.isdir(SOURCE_DATA):
                dest_data = os.path.join(
                    os.environ.get('LOCALAPPDATA', os.path.expanduser('~')),
                    APP_NAME,
                    'data',
                )
                os.makedirs(dest_data, exist_ok=True)
                for f in os.listdir(SOURCE_DATA):
                    src_f = os.path.join(SOURCE_DATA, f)
                    dest_f = os.path.join(dest_data, f)
                    if os.path.isfile(src_f) and not os.path.exists(dest_f):
                        shutil.copy2(src_f, dest_f)
                        self._log(f'    {f}')
            self._log('  ✓ 配置文件就绪')

            self._log('  复制使用教程...')
            for guide in SOURCE_GUIDES:
                if os.path.isfile(guide):
                    shutil.copy2(guide, os.path.join(dest, os.path.basename(guide)))
                    self._log(f'    {os.path.basename(guide)}')
            self._log('  ✓ 使用教程就绪')

            # Step 5: Create shortcuts
            self.status_label.configure(text='[5/6] 创建快捷方式...')
            self.progress['value'] = 500 / steps

            if self.create_desktop.get():
                desktop = os.path.join(os.environ['USERPROFILE'], 'Desktop',
                                       f'{APP_NAME}.lnk')
                create_shortcut(desktop, dest_exe, dest, f'{APP_NAME} - 学生综合测评系统')
                self._log('  ✓ 桌面快捷方式')

            if self.create_startmenu.get():
                start_menu = os.path.join(os.environ['APPDATA'],
                                          'Microsoft', 'Windows',
                                          'Start Menu', 'Programs', APP_NAME)
                os.makedirs(start_menu, exist_ok=True)

                create_shortcut(os.path.join(start_menu, f'{APP_NAME}.lnk'),
                               dest_exe, dest)
                self._log('  ✓ 开始菜单 → 主程序')

                for guide in SOURCE_GUIDES:
                    if os.path.isfile(guide):
                        gdest = os.path.join(dest, os.path.basename(guide))
                        create_shortcut(os.path.join(start_menu,
                                        os.path.basename(guide) + '.lnk'),
                                       gdest, dest)
                self._log('  ✓ 开始菜单 → 使用教程')

                # Uninstall entry
                uninstall_ps1 = os.path.join(dest, '_uninstall.ps1')
                self._write_uninstaller(uninstall_ps1, dest)
                create_shortcut(os.path.join(start_menu, f'卸载 {APP_NAME}.lnk'),
                               'powershell.exe',
                               dest,
                               f'卸载 {APP_NAME}',
                               f'-NoProfile -ExecutionPolicy Bypass -File "{uninstall_ps1}"')
                self._log('  ✓ 开始菜单 → 卸载程序')

            # Step 6: Write uninstall registry
            self.status_label.configure(text='[6/6] 注册卸载信息...')
            self.progress['value'] = 580 / steps
            self._write_uninstall_info(dest)
            self._log('  ✓ 安装信息已注册')

            # Done
            self.progress['value'] = 600 / steps
            self.status_label.configure(text='✅ 安装完成！')
            self._log('\n' + '=' * 50)
            self._log(f'  {APP_NAME} v{VERSION} 安装成功！')
            self._log(f'  安装位置: {dest}')
            self._log('=' * 50)

            self.root.after(800, self._show_finish)

        except Exception as e:
            self.status_label.configure(text=f'❌ 安装失败: {str(e)}')
            self._log(f'\n  错误: {str(e)}')
            self.btn_cancel.configure(text='退出', state='normal', command=self.root.destroy)

    def _write_uninstaller(self, path, install_dir):
        """Create an uninstall PowerShell script."""
        ps = f'''
$AppName = "{APP_NAME}"
$InstallDir = "{install_dir}"

Write-Host "卸载 $AppName ..." -ForegroundColor Yellow

# Remove shortcuts
$StartMenu = Join-Path $env:APPDATA "Microsoft\\Windows\\Start Menu\\Programs\\$AppName"
$Desktop = Join-Path $env:USERPROFILE "Desktop\\$AppName.lnk"
Remove-Item $Desktop -Force -ErrorAction SilentlyContinue
if (Test-Path $StartMenu) {{ Remove-Item -Recurse -Force $StartMenu -ErrorAction SilentlyContinue }}

# Remove install directory
if (Test-Path $InstallDir) {{
    Remove-Item -Recurse -Force $InstallDir -ErrorAction SilentlyContinue
    Write-Host "已删除: $InstallDir" -ForegroundColor Green
}}

# Remove registry
Remove-Item "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{APP_NAME}" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "卸载完成" -ForegroundColor Green
Read-Host "按 Enter 退出"
'''
        with open(path, 'w', encoding='utf-8') as f:
            f.write(ps)

    def _write_uninstall_info(self, install_dir):
        """Write uninstall info to Windows registry."""
        try:
            import winreg
            key_path = r'Software\Microsoft\Windows\CurrentVersion\Uninstall'
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER,
                                  f'{key_path}\\{APP_NAME}') as key:
                winreg.SetValueEx(key, 'DisplayName', 0, winreg.REG_SZ, APP_NAME)
                winreg.SetValueEx(key, 'DisplayVersion', 0, winreg.REG_SZ, VERSION)
                winreg.SetValueEx(key, 'Publisher', 0, winreg.REG_SZ,
                                  '顿河学院团委秘书处')
                winreg.SetValueEx(key, 'DisplayIcon', 0, winreg.REG_SZ,
                                  os.path.join(install_dir, APP_EXE))
                winreg.SetValueEx(key, 'InstallLocation', 0, winreg.REG_SZ,
                                  install_dir)
                winreg.SetValueEx(key, 'UninstallString', 0, winreg.REG_SZ,
                                  f'powershell.exe -ExecutionPolicy Bypass -File "{install_dir}\\_uninstall.ps1"')
                winreg.SetValueEx(key, 'NoModify', 0, winreg.REG_DWORD, 1)
                winreg.SetValueEx(key, 'NoRepair', 0, winreg.REG_DWORD, 1)
        except Exception:
            pass  # Non-critical

    def _show_finish(self):
        for w in self.content.winfo_children():
            w.destroy()

        tk.Label(self.content, text='✅', font=('Segoe UI', 48),
                 bg='#ffffff').pack(pady=(20, 4))
        tk.Label(self.content, text='安装完成！',
                 font=(BODY, 18, 'bold'),
                 bg='#ffffff', fg='#4CAF50').pack()
        tk.Label(self.content, text=f'{APP_NAME} 已成功安装到您的计算机',
                 font=(BODY, 10,),
                 bg='#ffffff', fg='#555555').pack(pady=(4, 16))

        self.launch_var = tk.BooleanVar(value=True)
        tk.Checkbutton(self.content, text=f'立即启动 {APP_NAME}',
                       variable=self.launch_var,
                       font=(BODY, 10,),
                       bg='#ffffff', activebackground='#ffffff',
                       cursor='hand2').pack()

        tk.Label(self.content, text='', bg='#ffffff').pack()

        self.btn_cancel.configure(text='关闭', state='normal',
                                   command=self._on_finish)
        self.btn_back.place_forget()
        self.btn_next.configure(text='完成', state='normal',
                                 bg='#4CAF50', activebackground='#388E3C',
                                 command=self._on_finish)

        self._set_step_highlight(5)

    def _on_finish(self):
        if self.launch_var.get():
            dest_exe = os.path.join(self.install_dir.get(), APP_EXE)
            if os.path.isfile(dest_exe):
                os.startfile(dest_exe)
        self.root.destroy()

    def run(self):
        self.root.mainloop()


# ── Entry Point ────────────────────────────────────────────────────────

def main():
    # Windows taskbar identity
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
            'student.eval.installer'
        )
    except Exception:
        pass

    # Check source files
    if not os.path.isfile(SOURCE_EXE):
        messagebox.showerror(
            '安装源缺失',
            f'未找到主程序文件。\n\n'
            f'请确保以下文件存在:\n'
            f'  {SOURCE_EXE}\n\n'
            f'请先将软件打包为 EXE（PyInstaller），再运行此安装程序。'
        )
        sys.exit(1)

    app = InstallerApp()
    app.run()


if __name__ == '__main__':
    main()
