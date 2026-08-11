"""Online application updates backed by a small GitHub Release manifest.

The updater downloads only the one-file Windows executable, verifies its
SHA-256 digest, and replaces the running executable after the application has
closed. User data lives outside the executable and is never touched here.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable

from config import APP_NAME, APP_VERSION, DATA_DIR


UPDATE_MANIFEST_URL = os.environ.get(
    "DONCOLLEGE_UPDATE_MANIFEST_URL",
    "https://github.com/Chenmark643/student-evaluation-system/"
    "releases/latest/download/update-windows.json",
)
UPDATE_DIR = Path(DATA_DIR).resolve().parent / "updates"
UPDATE_CACHE_SECONDS = 15 * 60
MIN_UPDATE_EXE_BYTES = 5 * 1024 * 1024
ALLOWED_DOWNLOAD_HOSTS = {
    "github.com",
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
}
_STATUS_LOCK = threading.Lock()
_STATUS_CACHE: tuple[float, dict] | None = None
ProgressCallback = Callable[[int, str], None]


class AppUpdateError(RuntimeError):
    pass


def _version_tuple(value: str) -> tuple[int, ...]:
    match = re.search(r"(?<!\d)(\d+)\.(\d+)\.(\d+)(?!\d)", str(value or ""))
    return tuple(int(part) for part in match.groups()) if match else ()


def _https_url(value: str, *, allowed_hosts: set[str] | None = None) -> str:
    parsed = urllib.parse.urlparse(str(value or "").strip())
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise AppUpdateError("更新地址不是安全的 HTTPS 地址。")
    if allowed_hosts and parsed.hostname.lower() not in allowed_hosts:
        raise AppUpdateError("更新文件来源不在允许的发布站点中。")
    return parsed.geturl()


def _open_url(url: str, *, timeout: int = 25):
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json, application/octet-stream;q=0.9, */*;q=0.8",
            "User-Agent": f"DonCollege-Student-Evaluation/{APP_VERSION}",
        },
    )
    return urllib.request.urlopen(request, timeout=timeout)


def _fetch_manifest() -> dict:
    url = _https_url(UPDATE_MANIFEST_URL)
    try:
        with _open_url(url) as response:
            raw = response.read(256 * 1024)
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise AppUpdateError("在线发布源尚未提供 Windows 更新文件。") from exc
        raise AppUpdateError(f"更新服务返回错误（HTTP {exc.code}）。") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise AppUpdateError("暂时无法连接在线更新服务，请检查网络后重试。") from exc
    try:
        manifest = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AppUpdateError("在线版本清单格式不正确。") from exc
    if not isinstance(manifest, dict):
        raise AppUpdateError("在线版本清单内容不正确。")
    return manifest


def _validated_manifest(manifest: dict) -> dict:
    version = str(manifest.get("version") or "").lstrip("vV")
    if not _version_tuple(version):
        raise AppUpdateError("在线版本号格式不正确。")
    if str(manifest.get("platform") or "windows-x64") != "windows-x64":
        raise AppUpdateError("最新发布不适用于当前 Windows 程序。")
    url = _https_url(str(manifest.get("url") or ""), allowed_hosts=ALLOWED_DOWNLOAD_HOSTS)
    sha256 = str(manifest.get("sha256") or "").lower().strip()
    if not re.fullmatch(r"[0-9a-f]{64}", sha256):
        raise AppUpdateError("最新发布缺少有效的 SHA-256 校验值。")
    size = int(manifest.get("size") or 0)
    if size < MIN_UPDATE_EXE_BYTES:
        raise AppUpdateError("在线更新文件大小异常。")
    return {
        "version": version,
        "platform": "windows-x64",
        "url": url,
        "sha256": sha256,
        "size": size,
        "notes": str(manifest.get("notes") or "本次版本包含功能改进与问题修复。")[:8000],
        "published_at": str(manifest.get("published_at") or ""),
    }


def get_app_update_status(force: bool = False) -> dict:
    """Return current/latest application versions without downloading the EXE."""
    global _STATUS_CACHE
    if os.name != "nt":
        return {
            "success": True,
            "supported": False,
            "current_version": APP_VERSION,
            "latest_version": APP_VERSION,
            "update_available": False,
            "message": "当前平台请通过安装包更新。",
        }
    now = time.monotonic()
    with _STATUS_LOCK:
        if not force and _STATUS_CACHE and now - _STATUS_CACHE[0] < UPDATE_CACHE_SECONDS:
            return dict(_STATUS_CACHE[1])
    try:
        manifest = _validated_manifest(_fetch_manifest())
        result = {
            "success": True,
            "supported": True,
            "current_version": APP_VERSION,
            "latest_version": manifest["version"],
            "update_available": _version_tuple(manifest["version"]) > _version_tuple(APP_VERSION),
            "download_size": manifest["size"],
            "notes": manifest["notes"],
            "published_at": manifest["published_at"],
        }
    except (AppUpdateError, ValueError, TypeError) as exc:
        result = {
            "success": False,
            "supported": os.name == "nt",
            "current_version": APP_VERSION,
            "latest_version": "",
            "update_available": False,
            "error": str(exc),
        }
    with _STATUS_LOCK:
        _STATUS_CACHE = (now, dict(result))
    return result


def _safe_update_dir(version: str) -> Path:
    root = UPDATE_DIR.resolve()
    target = (root / version).resolve()
    if target.parent != root:
        raise AppUpdateError("更新临时目录不安全。")
    return target


def _cleanup_other_downloads(keep: Path) -> None:
    root = UPDATE_DIR.resolve()
    if not root.is_dir():
        return
    for child in root.iterdir():
        resolved = child.resolve()
        if resolved == keep or resolved.parent != root:
            continue
        if resolved.is_dir():
            shutil.rmtree(resolved, ignore_errors=True)
        elif not (
            resolved.name.startswith("apply-update-")
            and resolved.suffix.lower() == ".ps1"
        ):
            try:
                resolved.unlink()
            except OSError:
                pass


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def inspect_windows_executable(path: str) -> dict:
    """Validate a local update candidate and return its trusted digest."""
    try:
        candidate = Path(path).resolve()
        if not candidate.is_file() or candidate.suffix.lower() != ".exe":
            raise AppUpdateError("请选择有效的 EXE 更新文件。")
        size = candidate.stat().st_size
        if size < MIN_UPDATE_EXE_BYTES:
            raise AppUpdateError("更新文件太小，可能没有下载完整。")
        with candidate.open("rb") as stream:
            if stream.read(2) != b"MZ":
                raise AppUpdateError("所选文件不是有效的 Windows 程序。")
        return {
            "valid": True,
            "path": str(candidate),
            "filename": candidate.name,
            "size": size,
            "sha256": _sha256(candidate),
        }
    except (AppUpdateError, OSError, ValueError) as exc:
        return {"valid": False, "error": str(exc)}


def download_app_update(progress_callback: ProgressCallback | None = None) -> dict:
    """Download and verify the latest application executable."""
    if os.name != "nt":
        return {"success": False, "error": "当前平台暂不支持程序内自动替换。"}
    try:
        manifest = _validated_manifest(_fetch_manifest())
        if _version_tuple(manifest["version"]) <= _version_tuple(APP_VERSION):
            return {
                "success": True,
                "updated": False,
                "current_version": APP_VERSION,
                "latest_version": manifest["version"],
                "message": "当前已经是最新版。",
            }
        target_dir = _safe_update_dir(manifest["version"])
        target_dir.mkdir(parents=True, exist_ok=True)
        _cleanup_other_downloads(target_dir)
        final_path = target_dir / "DonCollege-Student-Evaluation.exe"
        partial_path = final_path.with_suffix(".exe.part")
        if partial_path.exists():
            partial_path.unlink()

        if progress_callback:
            progress_callback(1, "正在连接下载服务器")
        written = 0
        expected_size = int(manifest["size"])
        digest = hashlib.sha256()
        try:
            with _open_url(manifest["url"], timeout=60) as response, partial_path.open("wb") as output:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    output.write(chunk)
                    digest.update(chunk)
                    written += len(chunk)
                    if progress_callback:
                        progress_callback(
                            min(96, max(2, int(written / expected_size * 96))),
                            f"正在下载新版（{written / 1024 / 1024:.1f} / {expected_size / 1024 / 1024:.1f} MB）",
                        )
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise AppUpdateError("新版程序下载中断，请检查网络后重试。") from exc

        if written != expected_size:
            raise AppUpdateError("新版程序下载不完整，已停止安装。")
        if digest.hexdigest().lower() != manifest["sha256"]:
            raise AppUpdateError("新版程序校验失败，已停止安装。")
        with partial_path.open("rb") as stream:
            if stream.read(2) != b"MZ":
                raise AppUpdateError("下载的文件不是有效的 Windows 程序。")
        os.replace(partial_path, final_path)
        if progress_callback:
            progress_callback(100, "下载完成，校验已通过")
        return {
            "success": True,
            "updated": True,
            "current_version": APP_VERSION,
            "latest_version": manifest["version"],
            "local_path": str(final_path),
            "sha256": manifest["sha256"],
            "size": written,
        }
    except (AppUpdateError, ValueError, TypeError, OSError) as exc:
        return {"success": False, "error": str(exc)}
    finally:
        try:
            if "partial_path" in locals() and partial_path.exists():
                partial_path.unlink()
        except OSError:
            pass


def _powershell_literal(value: str) -> str:
    """Return a single-quoted PowerShell literal without code interpolation."""
    text = str(value)
    if any(char in text for char in ("\x00", "\r", "\n")):
        raise AppUpdateError("更新文件路径包含不支持的字符。")
    return "'" + text.replace("'", "''") + "'"


def _stage_replacement_source(source: Path, expected_sha256: str) -> Path:
    """Keep cleanup targets inside one direct child of the private update root."""
    root = UPDATE_DIR.resolve()
    source = source.resolve()
    if source.parent.parent == root:
        return source

    stage_dir = _safe_update_dir(
        f"manual-{expected_sha256[:16]}-{os.getpid()}-{time.time_ns()}"
    )
    stage_dir.mkdir(parents=True, exist_ok=False)
    partial = stage_dir / "DonCollege-Student-Evaluation.exe.part"
    staged = stage_dir / "DonCollege-Student-Evaluation.exe"
    try:
        shutil.copy2(source, partial)
        os.replace(partial, staged)
        if _sha256(staged).lower() != expected_sha256.lower():
            raise AppUpdateError("手动更新文件复制后校验失败，已停止替换。")
        return staged
    except (AppUpdateError, OSError):
        shutil.rmtree(stage_dir, ignore_errors=True)
        raise


def mark_app_update_healthy() -> bool:
    """Acknowledge a replacement only after the desktop UI has loaded."""
    marker_value = os.environ.pop("DONCOLLEGE_UPDATE_HEALTH_MARKER", "").strip()
    if not marker_value:
        return False
    try:
        marker = Path(marker_value).resolve()
        root = UPDATE_DIR.resolve()
        if marker.parent != root or not marker.name.startswith("healthy-"):
            return False
        root.mkdir(parents=True, exist_ok=True)
        marker.write_text(APP_VERSION, encoding="utf-8")
        return True
    except (OSError, ValueError):
        return False


def launch_windows_replacement(new_exe_path: str, expected_sha256: str) -> dict:
    """Start a detached updater and exit the frozen application shortly after."""
    if os.name != "nt" or not getattr(sys, "frozen", False):
        return {"success": False, "error": "在线替换只能在已安装的 Windows 程序中执行。"}
    try:
        source = Path(new_exe_path).resolve()
        target = Path(sys.executable).resolve()
        if not source.is_file() or source == target:
            raise AppUpdateError("找不到已经下载的新版程序。")
        if source.stat().st_size < MIN_UPDATE_EXE_BYTES:
            raise AppUpdateError("新版程序文件大小异常。")
        expected_digest = str(expected_sha256 or "").lower()
        if not re.fullmatch(r"[0-9a-f]{64}", expected_digest):
            raise AppUpdateError("安装前缺少有效的 SHA-256 校验值。")
        if _sha256(source).lower() != expected_digest:
            raise AppUpdateError("安装前校验失败，已停止替换。")
        with source.open("rb") as stream:
            if stream.read(2) != b"MZ":
                raise AppUpdateError("新版文件不是有效的 Windows 程序。")

        UPDATE_DIR.mkdir(parents=True, exist_ok=True)
        source = _stage_replacement_source(source, expected_digest)
        update_root = UPDATE_DIR.resolve()
        source_dir = source.parent.resolve()
        if source_dir.parent != update_root:
            raise AppUpdateError("更新文件不在受控临时目录中，已停止替换。")

        backup = target.with_suffix(target.suffix + ".update-backup")
        pid = os.getpid()
        script = update_root / f"apply-update-{pid}-{expected_digest[:12]}.ps1"
        marker = update_root / f"healthy-{pid}-{expected_digest[:12]}.txt"
        content = f"""$ErrorActionPreference = 'Stop'
$source = {_powershell_literal(str(source))}
$sourceDir = {_powershell_literal(str(source_dir))}
$updateRoot = {_powershell_literal(str(update_root))}
$target = {_powershell_literal(str(target))}
$backup = {_powershell_literal(str(backup))}
$marker = {_powershell_literal(str(marker))}
$expectedHash = {_powershell_literal(expected_digest)}
$scriptPath = $MyInvocation.MyCommand.Path
$oldPid = {pid}
$newProcess = $null
$targetBackedUp = $false
$exitCode = 0

try {{
    $actualParent = [IO.Path]::GetFullPath((Split-Path -Parent $sourceDir)).TrimEnd('\\')
    $expectedParent = [IO.Path]::GetFullPath($updateRoot).TrimEnd('\\')
    if ($actualParent -ne $expectedParent) {{
        throw 'Unsafe update source directory.'
    }}

    Wait-Process -Id $oldPid -ErrorAction SilentlyContinue
    $actualHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) {{
        throw 'The staged update failed SHA-256 verification.'
    }}
    Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue
    Move-Item -LiteralPath $target -Destination $backup -Force
    $targetBackedUp = $true
    Move-Item -LiteralPath $source -Destination $target -Force

    $env:DONCOLLEGE_UPDATE_HEALTH_MARKER = $marker
    $newProcess = Start-Process -FilePath $target -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    $healthy = $false
    while ([DateTime]::UtcNow -lt $deadline) {{
        if (Test-Path -LiteralPath $marker) {{
            $healthy = $true
            break
        }}
        $newProcess.Refresh()
        if ($newProcess.HasExited) {{ break }}
        Start-Sleep -Milliseconds 500
    }}
    if (-not $healthy) {{ throw 'The updated application did not report healthy startup.' }}
    Remove-Item -LiteralPath $backup -Force -ErrorAction Stop
}}
catch {{
    $exitCode = 1
    if ($newProcess -and -not $newProcess.HasExited) {{
        Stop-Process -Id $newProcess.Id -Force -ErrorAction SilentlyContinue
        Wait-Process -Id $newProcess.Id -ErrorAction SilentlyContinue
    }}
    if ($targetBackedUp) {{
        Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
    }}
    if ($targetBackedUp -and (Test-Path -LiteralPath $backup)) {{
        Move-Item -LiteralPath $backup -Destination $target -Force
        Start-Process -FilePath $target
    }}
}}
finally {{
    Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue
    $actualParent = [IO.Path]::GetFullPath((Split-Path -Parent $sourceDir)).TrimEnd('\\')
    $expectedParent = [IO.Path]::GetFullPath($updateRoot).TrimEnd('\\')
    if ($actualParent -eq $expectedParent) {{
        Remove-Item -LiteralPath $sourceDir -Recurse -Force -ErrorAction SilentlyContinue
    }}
}}

Start-Sleep -Milliseconds 500
Remove-Item -LiteralPath $scriptPath -Force -ErrorAction SilentlyContinue
exit $exitCode
"""
        with script.open("w", encoding="utf-8-sig", newline="\r\n") as stream:
            stream.write(content)
        creationflags = (
            getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200)
            | getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
            | getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
        )
        subprocess.Popen(
            [
                os.path.join(
                    os.environ.get("SystemRoot", r"C:\Windows"),
                    "System32",
                    "WindowsPowerShell",
                    "v1.0",
                    "powershell.exe",
                ),
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(script),
            ],
            close_fds=True,
            creationflags=creationflags,
        )
        threading.Timer(0.8, lambda: os._exit(0)).start()
        return {"success": True, "restarting": True}
    except (AppUpdateError, OSError, ValueError) as exc:
        return {"success": False, "error": str(exc)}
