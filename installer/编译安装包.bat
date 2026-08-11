@echo off
chcp 65001 >nul
title 编译安装程序 - 顿河学院学生测评管理软件

echo.
echo   ╔══════════════════════════════════════╗
echo   ║  顿河学院学生测评管理软件 — 安装包制作  ║
echo   ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: Check Python
if not exist "..\venv38\Scripts\python.exe" (
    echo   [错误] 未找到 Python 环境
    echo   请先创建虚拟环境: python -m venv venv38
    pause
    exit /b 1
)

:: Check dist
if not exist "..\dist\DonCollege-Student-Evaluation.exe" (
    echo   [错误] 未找到主程序 dist\DonCollege-Student-Evaluation.exe
    echo   请先用 PyInstaller 打包主程序
    pause
    exit /b 1
)

echo   [1/2] 编译 setup.exe (约 1-2 分钟)...
echo.

..\venv38\Scripts\python.exe -m PyInstaller --clean --distpath Output --workpath build_installer build_installer.spec

if %errorlevel% neq 0 (
    echo   [失败] 编译出错
    pause
    exit /b 1
)

echo.
echo   ╔══════════════════════════════════════╗
echo   ║  ✅  编译成功！                       ║
echo   ╠══════════════════════════════════════╣
echo   ║  安装包 → installer\Output\           ║
echo   ║  双击即可运行安装向导                   ║
echo   ╚══════════════════════════════════════╝
echo.
explorer "%~dp0Output\"
pause
