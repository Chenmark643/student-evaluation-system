; =============================================================================
; 顿河学院学生测评管理软件 — Windows 安装程序
;
; 使用 Inno Setup 6 编译：https://jrsoftware.org/isinfo.php
; 编译方式：
;   1. 安装 Inno Setup（winget install InnoSetup 或官网下载）
;   2. 右键 setup.iss → Compile（或拖入 Inno Setup Compiler 窗口）
;   3. 输出文件在 installer\Output\ 目录
; =============================================================================

#define MyAppName "顿河学院学生测评管理软件"
#define MyAppNameEn "Student Evaluation System"
#define MyAppVersion "14.1.0"
#define MyAppPublisher "顿河学院团委秘书处"
#define MyAppURL "https://dunhe.edu.cn"
#define MyAppExeName "DonCollege-Student-Evaluation.exe"

[Setup]
; 基础信息
AppId={{D8A7E3F2-9B56-4C12-AE7F-1D3B8E5C9A02}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={localappdata}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=no

; 安装目录选择页面
AllowNoIcons=yes
DisableDirPage=no

; 输出
OutputDir=Output
OutputBaseFilename=顿河学院学生测评管理软件_Setup_v{#MyAppVersion}

; 压缩
Compression=lzma2/ultra64
SolidCompression=yes

; 界面
WizardStyle=modern
WizardSizePercent=120,120
WindowResizable=no

; 图标
SetupIconFile=assets\installer-icon-hd.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
UninstallDisplayName={#MyAppName}

; 权限
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog

; 签名（如有代码签名证书可取消注释）
; SignTool=mycustomsigntool

; 显示语言
ShowLanguageDialog=yes

[Languages]
Name: "chinese"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
; 桌面快捷方式
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加快捷方式:"; Flags: checkedonce

[Files]
; 主程序
Source: "..\dist\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
; 数据目录（创建空目录）
Source: "..\dist\data\*"; DestDir: "{app}\data"; Flags: ignoreversion recursesubdirs createallsubdirs
; 使用教程
Source: "..\dist\秘书处使用教程.pdf"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\辅导员使用教程.pdf"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\软件更新方法.pdf"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; 桌面快捷方式
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
; 开始菜单
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\秘书处使用教程"; Filename: "{app}\秘书处使用教程.pdf"
Name: "{group}\辅导员使用教程"; Filename: "{app}\辅导员使用教程.pdf"
Name: "{group}\卸载 {#MyAppName}"; Filename: "{uninstallexe}"

[Run]
; 安装完成后运行程序
Filename: "{app}\{#MyAppExeName}"; Description: "启动 {#MyAppName}"; Flags: nowait postinstall skipifsilent

[Code]
// ============================================================================
// 安装前检查：浏览器检测
// ============================================================================

function IsChromeInstalled: Boolean;
begin
  Result := False;
  if FileExists(ExpandConstant('{pf}\Google\Chrome\Application\chrome.exe')) then Result := True;
  if FileExists(ExpandConstant('{pf32}\Google\Chrome\Application\chrome.exe')) then Result := True;
  if FileExists(ExpandConstant('{localappdata}\Google\Chrome\Application\chrome.exe')) then Result := True;
end;

function IsEdgeInstalled: Boolean;
begin
  Result := False;
  if FileExists(ExpandConstant('{pf}\Microsoft\Edge\Application\msedge.exe')) then Result := True;
  if FileExists(ExpandConstant('{pf32}\Microsoft\Edge\Application\msedge.exe')) then Result := True;
end;

function HasBrowser: Boolean;
begin
  Result := IsChromeInstalled or IsEdgeInstalled;
end;

// 检查旧版本
function GetOldInstallPath: String;
begin
  Result := '';
  if RegQueryStringValue(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}_is1', 'InstallLocation', Result) then
    Exit;
end;

function InitializeSetup: Boolean;
var
  OldPath: String;
  Msg: String;
begin
  Result := True;

  // 检查旧版本
  OldPath := GetOldInstallPath;
  if (OldPath <> '') and (OldPath <> ExpandConstant('{app}')) then
  begin
    Msg := '检测到已安装的旧版本，位于：' + #13#10 + OldPath + #13#10#13#10 +
           '建议先通过控制面板卸载旧版本后再安装。' + #13#10#13#10 +
           '是否继续安装？（旧版本不会被自动覆盖）';
    if MsgBox(Msg, mbConfirmation, MB_YESNO) = IDNO then
    begin
      Result := False;
      Exit;
    end;
  end;
end;

// 安装完成后的浏览器提示
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    if not HasBrowser then
    begin
      MsgBox(
        '⚠️  重要提示：' + #13#10#13#10 +
        '未检测到 Microsoft Edge 或 Google Chrome 浏览器。' + #13#10#13#10 +
        '本软件需要浏览器才能运行。请手动安装以下任一浏览器：' + #13#10 +
        '  • Microsoft Edge：https://www.microsoft.com/edge' + #13#10 +
        '  • Google Chrome：https://www.google.com/chrome' + #13#10#13#10 +
        '安装浏览器后，即可正常启动软件。',
        mbInformation, MB_OK
      );
    end;
  end;
end;

// 卸载时清理
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    // 删除可能残留的数据目录
    if DirExists(ExpandConstant('{app}\data')) then
      DelTree(ExpandConstant('{app}\data'), True, True, True);
    // 删除程序目录（如果为空）
    RemoveDir(ExpandConstant('{app}'));
  end;
end;
