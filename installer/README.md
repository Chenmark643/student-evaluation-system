# 制作 Windows 安装程序

当前发布同时提供两种安装包：

- `DonCollege-Setup-v14.1.2-Lite-NoWebView2.exe`：轻量版，使用电脑中已有的 WebView2。
- `DonCollege-Setup-v14.1.2-Full-WebView2.exe`：完整离线版，内置 WebView2 运行库。

两种安装包都包含主程序、VC++ 运行库、默认数据和三份 PDF 使用教程。安装器会检查 Windows 版本、WebView2、系统 DLL 和磁盘空间；重复安装时保留应用数据目录中的用户数据。

## 准备文件

先在项目根目录构建主程序：

```powershell
.\venv38\Scripts\python.exe -m PyInstaller --clean --noconfirm build.spec
```

随后确认这些文件存在：

```text
dist/DonCollege-Student-Evaluation.exe
dist/学分绩点操作教程(1).pdf
dist/德育分操作教程(2).pdf
dist/素质拓展分操作教程(1).pdf
data/activity_mappings.json
data/custom_thresholds.json
installer/vc_redist.x64.exe
installer/MicrosoftEdgeWebView2RuntimeInstallerX64.exe   # 仅完整离线版需要
```

## 构建安装包

轻量版：

```powershell
.\venv38\Scripts\python.exe -m PyInstaller --clean --noconfirm installer/build_installer_lite.spec
```

完整离线版：

```powershell
.\venv38\Scripts\python.exe -m PyInstaller --clean --noconfirm installer/build_installer_full.spec
```

产物位于 `dist/`。构建后应分别启动两个安装包做冒烟测试，并确认版本、安装目录、环境检查、快捷方式与主程序启动正常。

## 发布新版本

发布前必须让以下位置保持同一版本号：

- `config.py`
- `installer/installer.py`
- `installer/setup.iss`
- `installer/build_installer.spec`
- `installer/build_installer_lite.spec`
- `installer/build_installer_full.spec`
- `.github/workflows/build-windows.yml`

版本一致性由 `tests/test_installer_brand_contract.py` 检查。在线更新 Release 的发布步骤见 [程序在线更新发布说明](../docs/在线更新发布说明.md)。
