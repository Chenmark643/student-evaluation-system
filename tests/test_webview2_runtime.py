import unittest


class _FakeKey:
    def __init__(self, values):
        self.values = values

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeWinreg:
    HKEY_CURRENT_USER = 'HKCU'
    HKEY_LOCAL_MACHINE = 'HKLM'

    def __init__(self, entries):
        self.entries = entries

    def OpenKey(self, hive, path):
        try:
            return _FakeKey(self.entries[(hive, path)])
        except KeyError as exc:
            raise OSError(path) from exc

    @staticmethod
    def QueryValueEx(key, name):
        if name not in key.values:
            raise OSError(name)
        return key.values[name], 1


class WebView2RuntimeTests(unittest.TestCase):
    def test_detects_per_user_runtime(self):
        from webview2_runtime import WEBVIEW2_REGISTRY_PATH, get_webview2_version

        registry = FakeWinreg({
            ('HKCU', WEBVIEW2_REGISTRY_PATH): {'pv': '150.0.4078.65'},
        })
        self.assertEqual(get_webview2_version(registry), '150.0.4078.65')

    def test_detects_wow6432_machine_runtime(self):
        from webview2_runtime import WEBVIEW2_WOW6432_REGISTRY_PATH, get_webview2_version

        registry = FakeWinreg({
            ('HKLM', WEBVIEW2_WOW6432_REGISTRY_PATH): {'pv': '109.0.1518.140'},
        })
        self.assertEqual(get_webview2_version(registry), '109.0.1518.140')

    def test_rejects_missing_invalid_and_too_old_versions(self):
        from webview2_runtime import WEBVIEW2_REGISTRY_PATH, get_webview2_version

        self.assertIsNone(get_webview2_version(FakeWinreg({})))
        for version in ('0.0.0.0', 'not-a-version', '85.0.600.0'):
            registry = FakeWinreg({
                ('HKLM', WEBVIEW2_REGISTRY_PATH): {'pv': version},
            })
            self.assertIsNone(get_webview2_version(registry))


if __name__ == '__main__':
    unittest.main()
