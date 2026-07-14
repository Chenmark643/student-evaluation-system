# Win10 离线 WebView2 兼容修复设计

## 问题与根因

主程序由 pywebview 承载。Windows 10 设备没有 Microsoft Edge WebView2 Runtime 时，pywebview 会自动退回已经淘汰的 MSHTML（IE）内核。当前界面使用现代 JavaScript 与 CSS，MSHTML 无法运行启动脚本，因此只显示错位的静态加载页，所有功能均不可操作。

现有安装程序检查 Edge/Chrome 浏览器，却没有检查软件真正依赖的 WebView2 Runtime；而且环境检测通过后仍允许缺少渲染运行库的设备继续安装。

## 采用方案

采用微软官方推荐的离线 Evergreen Standalone Installer 方案：把 x64 WebView2 离线安装程序完整嵌入软件安装包，缺失时执行：

```text
MicrosoftEdgeWebView2RuntimeInstallerX64.exe /silent /install
```

不采用在线 Bootstrapper，因为目标电脑可能离线；不采用 Fixed Version Runtime，因为体积更大且需要软件自行维护安全更新。

## 共享运行库检测

新增一个小型共享模块，供主程序与安装程序调用：

- 检查 HKCU 与 HKLM 下 WebView2 Evergreen Runtime 的官方客户端 GUID；
- 同时检查 32 位与 WOW6432Node 注册表位置；
- 返回检测到的版本号，而不只返回布尔值；
- 空值、`0.0.0.0`、损坏键或读取异常均视为未安装。

检测模块不修改注册表，也不将 Edge 浏览器当作 WebView2 Runtime。

## 安装程序行为

1. 安装包内嵌 x64 Evergreen Standalone Installer、现有 VC++ 离线包、最新版主程序、三份教程和现有品牌素材。
2. 环境检测页面增加“WebView2 渲染运行库”一行，显示已安装版本或“缺失”。
3. WebView2 缺失时：
   - “下一步”不可用；
   - “一键修复”使用内嵌离线包静默安装；
   - 安装结束后重新检测；
   - 只有重新检测成功才允许继续。
4. 如果静默安装失败，显示退出码和手动处理提示，不谎报修复成功。
5. 最终确认页显示 WebView2 状态，不再显示与程序无关的“浏览器”状态。
6. 执行正式安装前再次检查 WebView2；若仍缺失则中止并返回环境检测页。

## 主程序保护

1. 创建桌面窗口前检查 WebView2 Runtime。
2. 缺失时不创建 MSHTML 窗口，改为显示原生 Windows 提示框，说明需要重新运行安装程序修复，并写入启动日志。
3. 检测通过后明确请求 `edgechromium` 渲染器，不允许静默退回 IE。
4. 启动日志记录检测到的 WebView2 版本，便于远程排查虚拟机。

## 支持范围

新的离线安装包面向 Windows 10/11 64 位。Windows 7/8 不再标记为可正常支持，因为当前 Evergreen WebView2 Runtime 不保证这些系统可用。

安装无需强制管理员权限：微软官方安装程序在非提升权限下可执行每用户安装；在提升权限下执行每机器安装。

## 验证

- 单元测试覆盖注册表检测：HKCU、HKLM、WOW6432Node、无效版本与完全缺失。
- 安装程序契约测试覆盖：离线包被嵌入、静默参数正确、缺失时禁用继续、修复后重新检测。
- 主程序契约测试覆盖：启动前检查、强制 `edgechromium`、缺失时不进入桌面页面。
- 构建后检查安装包归档，确认同时包含最新版主程序、WebView2 离线安装器、VC++ 包与品牌素材。
- 在干净 Windows 10 x64 虚拟机卸载 WebView2 后进行最终验收：安装程序识别缺失、离线修复成功、主页面完成加载、按钮和文件选择可操作。

