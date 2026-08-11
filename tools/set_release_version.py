"""Synchronize the release version across application and installer files."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FILES = (
    ROOT / "config.py",
    ROOT / "web/js/main.js",
    ROOT / "installer/installer.py",
    ROOT / "installer/setup.iss",
    ROOT / "installer/build_installer.spec",
    ROOT / "installer/build_installer_full.spec",
    ROOT / "installer/build_installer_lite.spec",
    ROOT / ".github/workflows/build-mac.yml",
    ROOT / ".github/workflows/build-windows.yml",
    ROOT / "README.md",
    ROOT / "tests/test_installer_brand_contract.py",
)
VERSION_PATTERN = re.compile(r"(?<!\d)(\d+\.\d+\.\d+)(?!\d)")


def current_version() -> str:
    text = (ROOT / "config.py").read_text(encoding="utf-8")
    match = re.search(r'^APP_VERSION\s*=\s*["\'](\d+\.\d+\.\d+)["\']', text, re.M)
    if not match:
        raise RuntimeError("config.py 中没有找到 APP_VERSION")
    return match.group(1)


def set_version(new_version: str) -> list[Path]:
    if not re.fullmatch(r"\d+\.\d+\.\d+", new_version):
        raise ValueError("版本号必须采用 14.1.0 这样的三段格式")
    old_version = current_version()
    changed = []
    for path in FILES:
        text = path.read_text(encoding="utf-8")
        if old_version not in text:
            raise RuntimeError(f"{path.relative_to(ROOT)} 未包含当前版本 {old_version}")
        updated = VERSION_PATTERN.sub(
            lambda match: new_version if match.group(1) == old_version else match.group(1),
            text,
        )
        if updated != text:
            path.write_text(updated, encoding="utf-8")
            changed.append(path)
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description="同步顿河学院测评软件发布版本")
    parser.add_argument("version", help="新版本号，例如 14.1.0")
    args = parser.parse_args()
    changed = set_version(args.version)
    print(f"版本已更新为 {args.version}，共修改 {len(changed)} 个文件：")
    for path in changed:
        print(f"- {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
