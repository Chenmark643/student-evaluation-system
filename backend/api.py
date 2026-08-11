"""pywebview API adapter for the existing Eel-oriented backend."""

from __future__ import annotations

import os
from typing import Iterable, Sequence

import eel
import webview


def _no_op(*_args, **_kwargs):
    return None


# Existing business functions report progress through Eel push callbacks.  A
# pywebview app has no Eel websocket, so make those optional callbacks harmless.
eel.spawn = _no_op
eel.updateProgress = _no_op
eel.onModuleError = _no_op
eel.sleep = _no_op

from backend import bridge  # noqa: E402


def _normalise_file_types(file_types: Iterable[Sequence[str]] | None) -> tuple[str, ...]:
    """Convert Eel/Tk style filters to pywebview's native filter format."""
    if not file_types:
        return ("所有文件 (*.*)",)

    result = []
    for item in file_types:
        if not item or len(item) < 2:
            continue
        description, patterns = str(item[0]), str(item[1])
        normalised = ";".join(patterns.replace(";", " ").split())
        result.append(f"{description} ({normalised})")
    return tuple(result) or ("所有文件 (*.*)",)


def _business_methods() -> dict[str, staticmethod]:
    exposed = getattr(eel, "_exposed_functions", {})
    return {
        name: staticmethod(func)
        for name, func in exposed.items()
        if callable(func) and name not in {"select_file", "select_files", "select_directory", "add_files_to_student"}
    }


class _DesktopApiBase:
    """Native desktop services layered over the existing business API."""

    def __init__(self) -> None:
        self._window = None

    def attach_window(self, window) -> None:
        self._window = window

    def _require_window(self):
        if self._window is None:
            raise RuntimeError("桌面窗口尚未初始化")
        return self._window

    def select_file(self, file_types=None, title="选择文件") -> str:
        del title  # pywebview currently uses the native dialog caption.
        paths = self._require_window().create_file_dialog(
            webview.FileDialog.OPEN,
            allow_multiple=False,
            file_types=_normalise_file_types(file_types),
        )
        return str(paths[0]) if paths else ""

    def select_files(self, file_types=None, title="选择文件") -> list[str]:
        del title
        paths = self._require_window().create_file_dialog(
            webview.FileDialog.OPEN,
            allow_multiple=True,
            file_types=_normalise_file_types(file_types),
        )
        return [str(path) for path in (paths or [])]

    def select_directory(self, title="选择目录") -> str:
        del title
        paths = self._require_window().create_file_dialog(webview.FileDialog.FOLDER)
        return str(paths[0]) if paths else ""

    def add_files_to_student(self, base_dir: str, student_rel_path: str) -> dict:
        paths = self.select_files(
            [
                ["图片和文档", "*.jpg *.jpeg *.png *.gif *.bmp *.pdf *.doc *.docx"],
                ["所有文件", "*.*"],
            ],
            "选择要添加的文件",
        )
        return bridge.add_files_to_student(base_dir, student_rel_path, paths)


DesktopApi = type("DesktopApi", (_DesktopApiBase,), _business_methods())


__all__ = ["DesktopApi", "_normalise_file_types"]
