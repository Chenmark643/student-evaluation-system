"""Read-only detection for the Microsoft Edge WebView2 Evergreen Runtime."""

from __future__ import annotations

import os


WEBVIEW2_CLIENT_GUID = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
WEBVIEW2_REGISTRY_PATH = (
    rf'SOFTWARE\Microsoft\EdgeUpdate\Clients\{WEBVIEW2_CLIENT_GUID}'
)
WEBVIEW2_WOW6432_REGISTRY_PATH = (
    rf'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{WEBVIEW2_CLIENT_GUID}'
)
MINIMUM_WEBVIEW2_VERSION = (86, 0, 622, 0)


def _version_tuple(value) -> tuple:
    try:
        return tuple(int(part) for part in str(value).split('.'))
    except (TypeError, ValueError):
        return ()


def get_webview2_version(registry=None):
    """Return the installed Evergreen Runtime version, or ``None``."""
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


def has_webview2_runtime(registry=None) -> bool:
    return get_webview2_version(registry) is not None
