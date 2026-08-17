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


GITHUB_MANIFEST_URL = (
    "https://github.com/Chenmark643/student-evaluation-system/"
    "releases/latest/download/update-windows.json"
)
GITHUB_RELEASE_API_URL = (
    "https://api.github.com/repos/Chenmark643/student-evaluation-system/releases/latest"
)
GITHUB_WINDOWS_ASSET = "DonCollege-Student-Evaluation-windows-x64.exe"
CHINA_MIRROR_PREFIX = "https://ghfast.top/"
_configured_manifest_urls = (
    os.environ.get("DONCOLLEGE_UPDATE_MANIFEST_URLS")
    or os.environ.get("DONCOLLEGE_UPDATE_MANIFEST_URL")
    or ""
).strip()
UPDATE_MANIFEST_URLS = tuple(
    item.strip() for item in _configured_manifest_urls.split(";") if item.strip()
) or (
    GITHUB_MANIFEST_URL,
)
UPDATE_DIR = Path(DATA_DIR).resolve().parent / "updates"
UPDATE_CACHE_SECONDS = 15 * 60
MIN_UPDATE_EXE_BYTES = 5 * 1024 * 1024
ALLOWED_DOWNLOAD_HOSTS = {
    "github.com",
    "objects.githubusercontent.com",
    "release-assets.githubusercontent.com",
    "api.github.com",
    "ghfast.top",
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


def _manifest_from_github_release(release: dict) -> dict:
    """Use GitHub's official asset digest as the trust anchor for mirrors."""
    assets = release.get("assets") or []
    asset = next(
        (
            item
            for item in assets
            if isinstance(item, dict) and item.get("name") == GITHUB_WINDOWS_ASSET
        ),
        None,
    )
    if not asset:
        raise AppUpdateError("最新发布尚未提供 Windows 更新文件。")
    digest = str(asset.get("digest") or "")
    if not digest.lower().startswith("sha256:"):
        raise AppUpdateError("GitHub 发布信息缺少安装包校验值。")
    return {
        "version": str(release.get("tag_name") or "").lstrip("vV"),
        "platform": "windows-x64",
        "url": str(asset.get("browser_download_url") or ""),
        "sha256": digest.split(":", 1)[1].lower(),
        "size": int(asset.get("size") or 0),
        "notes": str(release.get("body") or "本次版本包含功能改进与问题修复。"),
        "published_at": str(release.get("published_at") or ""),
    }


def _fetch_manifest() -> dict:
    failures = []
    try:
        api_url = _https_url(GITHUB_RELEASE_API_URL, allowed_hosts=ALLOWED_DOWNLOAD_HOSTS)
        with _open_url(api_url, timeout=15) as response:
            release = json.loads(response.read(512 * 1024).decode("utf-8-sig"))
        if not isinstance(release, dict):
            raise AppUpdateError("GitHub 发布信息格式不正确。")
        return _manifest_from_github_release(release)
    except urllib.error.HTTPError as exc:
        failures.append(f"GitHub API HTTP {exc.code}")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        failures.append(type(exc).__name__)
    except (UnicodeDecodeError, json.JSONDecodeError, AppUpdateError) as exc:
        failures.append(str(exc))

    for candidate in UPDATE_MANIFEST_URLS:
        url = _https_url(candidate)
        try:
            with _open_url(url) as response:
                raw = response.read(256 * 1024)
            manifest = json.loads(raw.decode("utf-8-sig"))
            if not isinstance(manifest, dict):
                raise AppUpdateError("在线版本清单内容不正确。")
            return manifest
        except urllib.error.HTTPError as exc:
            failures.append(f"HTTP {exc.code}")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            failures.append(type(exc).__name__)
        except (UnicodeDecodeError, json.JSONDecodeError, AppUpdateError) as exc:
            failures.append(str(exc))
    if failures and all(item == "HTTP 404" for item in failures):
        raise AppUpdateError("在线发布源尚未提供 Windows 更新文件。")
    raise AppUpdateError("暂时无法读取官方版本信息，请稍后重试。")


def _validated_manifest(manifest: dict) -> dict:
    version = str(manifest.get("version") or "").lstrip("vV")
    if not _version_tuple(version):
        raise AppUpdateError("在线版本号格式不正确。")
    if str(manifest.get("platform") or "windows-x64") != "windows-x64":
        raise AppUpdateError("最新发布不适用于当前 Windows 程序。")
    original_url = _https_url(
        str(manifest.get("url") or ""), allowed_hosts=ALLOWED_DOWNLOAD_HOSTS
    )
    urls = (
        _https_url(
            CHINA_MIRROR_PREFIX + original_url, allowed_hosts=ALLOWED_DOWNLOAD_HOSTS
        ),
        original_url,
    )
    sha256 = str(manifest.get("sha256") or "").lower().strip()
    if not re.fullmatch(r"[0-9a-f]{64}", sha256):
        raise AppUpdateError("最新发布缺少有效的 SHA-256 校验值。")
    size = int(manifest.get("size") or 0)
    if size < MIN_UPDATE_EXE_BYTES:
        raise AppUpdateError("在线更新文件大小异常。")
    return {
        "version": version,
        "platform": "windows-x64",
        "url": original_url,
        "download_urls": urls,
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
        expected_size = int(manifest["size"])
        download_failures = []
        for index, download_url in enumerate(manifest["download_urls"]):
            partial_path.unlink(missing_ok=True)
            written = 0
            digest = hashlib.sha256()
            channel = "国内通道" if index == 0 else "国际通道"
            if progress_callback:
                progress_callback(1, f"正在连接{channel}")
            try:
                with _open_url(download_url, timeout=60) as response, partial_path.open("wb") as output:
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
                                f"{channel}下载中（{written / 1024 / 1024:.1f} / {expected_size / 1024 / 1024:.1f} MB）",
                            )
                if written != expected_size:
                    raise AppUpdateError("下载文件大小与官方发布信息不一致。")
                if digest.hexdigest().lower() != manifest["sha256"]:
                    raise AppUpdateError("下载文件与 GitHub 官方校验值不一致。")
                with partial_path.open("rb") as stream:
                    if stream.read(2) != b"MZ":
                        raise AppUpdateError("下载的文件不是有效的 Windows 程序。")
                break
            except (urllib.error.URLError, TimeoutError, OSError, AppUpdateError) as exc:
                download_failures.append(f"{channel}: {exc}")
        else:
            detail = "；".join(download_failures[-2:])
            raise AppUpdateError(f"国内、国际通道均下载失败：{detail}")

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


UPDATE_HELPER_FLAG = "--doncollege-apply-update"
UPDATE_RESULT_LOG = UPDATE_DIR / "last-update.log"


def _append_update_log(message: str) -> None:
    try:
        UPDATE_DIR.mkdir(parents=True, exist_ok=True)
        with UPDATE_RESULT_LOG.open("a", encoding="utf-8") as stream:
            stream.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}\n")
    except OSError:
        pass


def _wait_for_windows_pid(pid: int, timeout_seconds: int = 180) -> bool:
    """Wait for a Windows process without depending on PowerShell."""
    if os.name != "nt":
        return True
    try:
        import ctypes

        synchronize = 0x00100000
        wait_object_0 = 0
        handle = ctypes.windll.kernel32.OpenProcess(synchronize, False, int(pid))
        if not handle:
            return True
        try:
            result = ctypes.windll.kernel32.WaitForSingleObject(
                handle, max(1, int(timeout_seconds)) * 1000
            )
            return result == wait_object_0
        finally:
            ctypes.windll.kernel32.CloseHandle(handle)
    except (AttributeError, OSError, ValueError):
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            try:
                os.kill(int(pid), 0)
            except OSError:
                return True
            time.sleep(0.25)
        return False


def run_windows_update_helper(argv: list[str] | None = None) -> int | None:
    """Run replacement mode inside the downloaded new executable.

    Returning ``None`` means this is a normal application start. Otherwise the
    caller must terminate with the returned helper exit code.
    """
    args = list(sys.argv[1:] if argv is None else argv)
    if not args or args[0] != UPDATE_HELPER_FLAG:
        return None
    if len(args) != 5:
        _append_update_log("更新助手参数数量不正确")
        return 2

    target = Path(args[1]).resolve()
    try:
        old_pid = int(args[2])
    except ValueError:
        _append_update_log("更新助手收到无效进程号")
        return 2
    expected_digest = str(args[3]).lower()
    ready = Path(args[4]).resolve()
    source = Path(sys.executable).resolve()
    update_root = UPDATE_DIR.resolve()
    backup = target.with_suffix(target.suffix + ".update-backup")
    pending = target.with_suffix(target.suffix + ".update-new")
    health = update_root / f"healthy-{old_pid}-{expected_digest[:12]}.txt"
    new_process = None
    target_backed_up = False

    try:
        if os.name != "nt" or not getattr(sys, "frozen", False):
            raise AppUpdateError("更新助手只能由已安装的 Windows 新版程序运行。")
        if not re.fullmatch(r"[0-9a-f]{64}", expected_digest):
            raise AppUpdateError("更新助手缺少有效校验值。")
        if source.parent.parent != update_root or ready.parent != update_root:
            raise AppUpdateError("更新助手路径不在受控临时目录中。")
        if not target.is_file() or source == target:
            raise AppUpdateError("更新助手找不到旧版主程序。")

        ready.write_text("ready", encoding="utf-8")
        _append_update_log(f"更新助手已启动，等待旧进程 {old_pid} 退出")
        if not _wait_for_windows_pid(old_pid):
            raise AppUpdateError("旧版程序在三分钟内没有退出。")
        if _sha256(source).lower() != expected_digest:
            raise AppUpdateError("更新助手自身校验失败。")

        for stale in (health, backup, pending):
            try:
                stale.unlink()
            except FileNotFoundError:
                pass
        os.replace(target, backup)
        target_backed_up = True
        shutil.copy2(source, pending)
        if _sha256(pending).lower() != expected_digest:
            raise AppUpdateError("新版程序复制后校验失败。")
        os.replace(pending, target)

        child_env = dict(os.environ)
        child_env["DONCOLLEGE_UPDATE_HEALTH_MARKER"] = str(health)
        new_process = subprocess.Popen([str(target)], close_fds=True, env=child_env)
        deadline = time.monotonic() + 90
        while time.monotonic() < deadline:
            if health.is_file():
                break
            if new_process.poll() is not None:
                raise AppUpdateError("新版程序启动后提前退出。")
            time.sleep(0.5)
        else:
            raise AppUpdateError("新版程序未在规定时间内完成启动确认。")

        backup.unlink()
        target_backed_up = False
        _append_update_log(f"更新成功：v{APP_VERSION}")
        return 0
    except (AppUpdateError, OSError, ValueError) as exc:
        _append_update_log(f"更新失败：{exc}")
        if new_process is not None and new_process.poll() is None:
            try:
                new_process.terminate()
                new_process.wait(timeout=10)
            except (OSError, subprocess.TimeoutExpired):
                pass
        try:
            pending.unlink()
        except OSError:
            pass
        if target_backed_up and backup.is_file():
            try:
                target.unlink(missing_ok=True)
                os.replace(backup, target)
                rollback_env = dict(os.environ)
                rollback_env.pop("DONCOLLEGE_UPDATE_HEALTH_MARKER", None)
                subprocess.Popen([str(target)], close_fds=True, env=rollback_env)
                _append_update_log("已恢复并重新启动旧版程序")
            except OSError as rollback_error:
                _append_update_log(f"旧版恢复失败：{rollback_error}")
        elif target.is_file():
            try:
                restart_env = dict(os.environ)
                restart_env.pop("DONCOLLEGE_UPDATE_HEALTH_MARKER", None)
                subprocess.Popen([str(target)], close_fds=True, env=restart_env)
                _append_update_log("替换前失败，已重新启动旧版程序")
            except OSError as restart_error:
                _append_update_log(f"旧版重新启动失败：{restart_error}")
        return 1
    finally:
        for marker in (health, ready):
            try:
                marker.unlink()
            except OSError:
                pass


def launch_windows_replacement(new_exe_path: str, expected_sha256: str) -> dict:
    """Start the verified new EXE as an updater, confirm it, then exit."""
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

        pid = os.getpid()
        ready = update_root / f"helper-ready-{pid}-{expected_digest[:12]}.txt"
        ready.unlink(missing_ok=True)
        creationflags = (
            getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200)
            | getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
        )
        helper = subprocess.Popen(
            [
                str(source),
                UPDATE_HELPER_FLAG,
                str(target),
                str(pid),
                expected_digest,
                str(ready),
            ],
            close_fds=True,
            creationflags=creationflags,
        )
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if ready.is_file():
                break
            if helper.poll() is not None:
                raise AppUpdateError(
                    f"更新助手启动失败，请查看 {UPDATE_RESULT_LOG}。"
                )
            time.sleep(0.1)
        else:
            try:
                helper.terminate()
            except OSError:
                pass
            raise AppUpdateError("更新助手未能启动，当前程序不会退出。")
        threading.Timer(0.8, lambda: os._exit(0)).start()
        return {
            "success": True,
            "restarting": True,
            "log_path": str(UPDATE_RESULT_LOG),
        }
    except (AppUpdateError, OSError, ValueError) as exc:
        return {"success": False, "error": str(exc)}
