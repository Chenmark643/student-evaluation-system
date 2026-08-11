# Win10 Offline WebView2 Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the desktop app and installer reliably usable on clean offline Windows 10 x64 machines by bundling, detecting, and installing Microsoft Edge WebView2 Runtime.

**Architecture:** A small shared `webview2_runtime.py` module owns registry detection for both the app and installer. The installer treats WebView2 as a blocking prerequisite and repairs it from the bundled Microsoft offline installer; the app checks before creating a window and explicitly requests Edge Chromium so MSHTML is never shown.

**Tech Stack:** Python 3.8, `winreg`, tkinter, pywebview/WinForms, PyInstaller, Microsoft Evergreen Standalone Installer, `unittest`.

---

## File Structure

- Create `webview2_runtime.py`: read-only WebView2 Evergreen registry detection and version validation.
- Create `tests/test_webview2_runtime.py`: platform-independent fake-registry unit tests.
- Modify `main.py`: fail fast before window creation and force Edge Chromium.
- Modify `installer/installer.py`: detect, repair, re-check, and block continuation when WebView2 is missing.
- Modify `installer/build_installer.spec`: bundle the official x64 offline runtime installer and include the project root in analysis paths.
- Modify `tests/test_desktop_contract.py`: protect the main-app startup contract.
- Modify `tests/test_installer_brand_contract.py`: protect the offline installer contract.
- Add binary `installer/MicrosoftEdgeWebView2RuntimeInstallerX64.exe`: Microsoft-signed Evergreen Standalone Installer.

### Task 1: Shared WebView2 Runtime Detection

**Files:**
- Create: `tests/test_webview2_runtime.py`
- Create: `webview2_runtime.py`

- [ ] **Step 1: Write failing fake-registry tests**

Create a fake `winreg` object with `HKEY_CURRENT_USER`, `HKEY_LOCAL_MACHINE`, `OpenKey`, and `QueryValueEx`, then assert:

```python
class WebView2RuntimeTests(unittest.TestCase):
    def test_detects_per_user_runtime(self):
        registry = FakeWinreg({
            ('HKCU', WEBVIEW2_REGISTRY_PATH): {'pv': '150.0.4078.65'},
        })
        self.assertEqual(get_webview2_version(registry), '150.0.4078.65')

    def test_detects_wow6432_machine_runtime(self):
        registry = FakeWinreg({
            ('HKLM', WEBVIEW2_WOW6432_REGISTRY_PATH): {'pv': '109.0.1518.140'},
        })
        self.assertEqual(get_webview2_version(registry), '109.0.1518.140')

    def test_rejects_missing_or_invalid_versions(self):
        self.assertIsNone(get_webview2_version(FakeWinreg({})))
        invalid = FakeWinreg({('HKLM', WEBVIEW2_REGISTRY_PATH): {'pv': '0.0.0.0'}})
        self.assertIsNone(get_webview2_version(invalid))
```

- [ ] **Step 2: Run tests and verify RED**

```powershell
.\venv38\Scripts\python.exe -m unittest tests.test_webview2_runtime -v
```

Expected: import failure because `webview2_runtime.py` does not exist.

- [ ] **Step 3: Implement the detector**

Use the official Evergreen client GUID and minimum version pywebview itself requires:

```python
WEBVIEW2_CLIENT_GUID = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
WEBVIEW2_REGISTRY_PATH = rf'SOFTWARE\Microsoft\EdgeUpdate\Clients\{WEBVIEW2_CLIENT_GUID}'
WEBVIEW2_WOW6432_REGISTRY_PATH = rf'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{WEBVIEW2_CLIENT_GUID}'
MINIMUM_WEBVIEW2_VERSION = (86, 0, 622, 0)

def _version_tuple(value):
    try:
        return tuple(int(part) for part in str(value).split('.'))
    except (TypeError, ValueError):
        return ()

def get_webview2_version(registry=None):
    if registry is None:
        if os.name != 'nt':
            return None
        import winreg as registry
    locations = (
        (registry.HKEY_CURRENT_USER, WEBVIEW2_REGISTRY_PATH),
        (registry.HKEY_LOCAL_MACHINE, WEBVIEW2_REGISTRY_PATH),
        (registry.HKEY_LOCAL_MACHINE, WEBVIEW2_WOW6432_REGISTRY_PATH),
    )
    for hive, path in locations:
        try:
            with registry.OpenKey(hive, path) as key:
                version, _ = registry.QueryValueEx(key, 'pv')
            if _version_tuple(version) >= MINIMUM_WEBVIEW2_VERSION:
                return str(version)
        except (OSError, AttributeError, TypeError, ValueError):
            continue
    return None
```

- [ ] **Step 4: Run detector tests and verify GREEN**

Run the Task 1 test command. Expected: all detector tests pass.

- [ ] **Step 5: Commit detector and tests**

```powershell
git add -- webview2_runtime.py tests/test_webview2_runtime.py
git commit -m "feat: detect WebView2 runtime on Windows"
```

### Task 2: Prevent the Main App from Falling Back to IE

**Files:**
- Modify: `tests/test_desktop_contract.py`
- Modify: `main.py`

- [ ] **Step 1: Add failing startup-contract assertions**

```python
def test_app_requires_webview2_and_forces_edge_chromium(self):
    self.assertIn('get_webview2_version', MAIN)
    self.assertIn('请重新运行安装程序', MAIN)
    self.assertIn('gui="edgechromium"', MAIN)
    self.assertLess(MAIN.index('get_webview2_version()'), MAIN.index('webview.create_window'))
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
.\venv38\Scripts\python.exe -m unittest tests.test_desktop_contract.DesktopContractTests.test_app_requires_webview2_and_forces_edge_chromium -v
```

Expected: FAIL because the main app currently creates the window without checking the runtime.

- [ ] **Step 3: Add fail-fast startup behavior**

Import `get_webview2_version`, check it at the beginning of `start_app`, log the detected version, and raise:

```python
version = get_webview2_version()
if not version:
    raise RuntimeError(
        '未检测到 Microsoft Edge WebView2 Runtime。\n'
        '请重新运行安装程序，并在环境检测页面完成离线修复。'
    )
_log_startup(f'WebView2 Runtime={version}')
```

Pass `gui="edgechromium"` to `webview.start`.

- [ ] **Step 4: Run desktop tests and verify GREEN**

```powershell
.\venv38\Scripts\python.exe -m unittest tests.test_desktop_contract -v
```

- [ ] **Step 5: Commit the main-app guard**

```powershell
git add -- main.py tests/test_desktop_contract.py
git commit -m "fix: refuse unsupported IE renderer"
```

### Task 3: Make WebView2 a Blocking Installer Prerequisite

**Files:**
- Modify: `tests/test_installer_brand_contract.py`
- Modify: `installer/installer.py`

- [ ] **Step 1: Add failing installer-contract assertions**

Require the installer source to contain:

```python
def test_installer_repairs_webview2_offline_and_blocks_when_missing(self):
    for token in ('get_webview2_version', '_bundled_webview2_path',
                  'MicrosoftEdgeWebView2RuntimeInstallerX64.exe',
                  "'/silent', '/install'", 'WebView2 渲染运行库'):
        self.assertIn(token, INSTALLER)
    self.assertNotIn("('浏览器',", INSTALLER)
```

- [ ] **Step 2: Run the focused installer test and verify RED**

```powershell
.\venv38\Scripts\python.exe -m unittest tests.test_installer_brand_contract.InstallerBrandContractTests.test_installer_repairs_webview2_offline_and_blocks_when_missing -v
```

- [ ] **Step 3: Add the bundled path and silent installer helper**

```python
WEBVIEW2_INSTALLER = 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'

def _bundled_webview2_path():
    root = sys._MEIPASS if getattr(sys, 'frozen', False) else os.path.dirname(__file__)
    return os.path.join(root, WEBVIEW2_INSTALLER)

def install_webview2_runtime():
    installer_path = _bundled_webview2_path()
    if not os.path.isfile(installer_path):
        return False, '安装包中缺少 WebView2 离线运行库'
    try:
        result = subprocess.run(
            [installer_path, '/silent', '/install'],
            capture_output=True, text=True, timeout=900,
            creationflags=0x08000000,
        )
        if result.returncode not in (0, 3010):
            return False, f'WebView2 安装失败，退出码 {result.returncode}'
        version = get_webview2_version()
        return (bool(version), f'WebView2 {version}' if version else '安装结束但仍未检测到运行库')
    except Exception as exc:
        return False, f'WebView2 安装异常：{exc}'
```

- [ ] **Step 4: Integrate detection into the environment page**

Add a “WebView2 渲染运行库” row before VC++, set `all_ok = False` when missing, save `_webview2_ok`, and disable `btn_next` whenever `all_ok` is false. `_auto_fix` must install WebView2 first, report the exact result, then refresh detection.

- [ ] **Step 5: Protect navigation, confirmation, and final install**

In `_on_next`, refuse to leave environment step 3 if `_all_env_ok` is false. Replace the confirmation-page browser row with the detected WebView2 version. At the start of `_run_install`, raise `RuntimeError('WebView2 运行库缺失，请返回环境检测完成修复')` if detection fails.

- [ ] **Step 6: Run installer contract tests and verify GREEN**

```powershell
.\venv38\Scripts\python.exe -m unittest tests.test_installer_brand_contract tests.test_webview2_runtime -v
```

- [ ] **Step 7: Commit installer behavior**

```powershell
git add -- installer/installer.py tests/test_installer_brand_contract.py
git commit -m "fix: install WebView2 from offline setup"
```

### Task 4: Download and Bundle the Microsoft-Signed Offline Runtime

**Files:**
- Add: `installer/MicrosoftEdgeWebView2RuntimeInstallerX64.exe`
- Modify: `installer/build_installer.spec`

- [ ] **Step 1: Download from Microsoft's official redirect**

Download `https://go.microsoft.com/fwlink/p/?LinkId=2124703` to the exact installer path.

- [ ] **Step 2: Verify the downloaded binary before packaging**

Run `Get-AuthenticodeSignature` and require `Status = Valid` with a Microsoft signer. Record SHA-256 and file size. Stop if signature validation fails.

- [ ] **Step 3: Add a failing packaging assertion**

Require `build_installer.spec` to reference `MicrosoftEdgeWebView2RuntimeInstallerX64.exe` and include `PROJECT_ROOT` in `pathex`.

- [ ] **Step 4: Update the installer spec**

Add:

```python
pathex=[PROJECT_ROOT, '.'],
```

and this data entry:

```python
(os.path.join(SPEC_DIR, 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'), '.'),
```

- [ ] **Step 5: Run packaging contract tests**

Run the installer and desktop contract suites. Expected: all new WebView2 contract tests pass; report any unrelated pre-existing installer artwork assertion separately.

### Task 5: Rebuild, Inspect, and Hand Off

**Files:**
- Build output: `dist/顿河学院学生测评管理软件.exe`
- Build output: `installer/Output/顿河学院学生测评管理软件_Setup_v8.0.0.exe`
- Update: `installer/Output/SHA256SUMS.csv`

- [ ] **Step 1: Run fresh relevant tests**

```powershell
.\venv38\Scripts\python.exe -m unittest tests.test_webview2_runtime tests.test_desktop_contract tests.test_installer_brand_contract -v
```

- [ ] **Step 2: Rebuild the main EXE**

Stop only processes whose path exactly equals the dist EXE, then run:

```powershell
.\venv38\Scripts\pyinstaller.exe --clean --noconfirm build.spec
```

- [ ] **Step 3: Rebuild the installer EXE**

```powershell
..\venv38\Scripts\python.exe -m PyInstaller --clean --noconfirm --distpath Output --workpath build_installer build_installer.spec
```

from the `installer` directory.

- [ ] **Step 4: Inspect the setup archive**

Use `pyi-archive_viewer` to prove the archive contains the new main EXE, WebView2 standalone installer, VC++ installer, campus image, logo, and guides.

- [ ] **Step 5: Update and verify checksums**

Write fresh SHA-256 values for the main EXE and setup EXE into `SHA256SUMS.csv`, reload the CSV, and assert both recorded hashes equal the actual hashes.

- [ ] **Step 6: Report the VM acceptance step honestly**

Do not claim the clean-VM issue is fully closed until the user runs the rebuilt setup in the affected VM. Provide the exact setup path and ask for the environment-detection result or a screenshot if installation still fails.

