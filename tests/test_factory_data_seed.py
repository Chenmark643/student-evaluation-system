import json
import tempfile
import unittest
from pathlib import Path

import config


ROOT = Path(__file__).resolve().parents[1]


class FactoryDataSeedTests(unittest.TestCase):
    def test_seed_restores_bonus_items_and_cap_preset(self):
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / 'data'
            copied = config.seed_factory_data(ROOT / 'data', destination)
            self.assertEqual(
                set(copied),
                {'activity_mappings.json', 'custom_thresholds.json'},
            )
            mappings = json.loads(
                (destination / 'activity_mappings.json').read_text(encoding='utf-8')
            )
            thresholds = json.loads(
                (destination / 'custom_thresholds.json').read_text(encoding='utf-8')
            )
            self.assertIn('英语四级', mappings)
            self.assertTrue(any(row['name'] == '国家级证书上限' for row in thresholds))

    def test_seed_never_overwrites_existing_user_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            destination = Path(tmp) / 'data'
            destination.mkdir(parents=True)
            existing = destination / 'activity_mappings.json'
            existing.write_text('{"我的项目": {"default_score": 9}}', encoding='utf-8')

            copied = config.seed_factory_data(ROOT / 'data', destination)

            self.assertNotIn('activity_mappings.json', copied)
            self.assertEqual(
                json.loads(existing.read_text(encoding='utf-8')),
                {'我的项目': {'default_score': 9}},
            )

    def test_builds_bundle_only_safe_preset_files(self):
        main_spec = (ROOT / 'build.spec').read_text(encoding='utf-8')
        mac_spec = (ROOT / 'build_mac.spec').read_text(encoding='utf-8')
        installer_specs = [
            ROOT / 'installer' / 'build_installer.spec',
            ROOT / 'installer' / 'build_installer_full.spec',
            ROOT / 'installer' / 'build_installer_lite.spec',
        ]
        for text in [main_spec, mac_spec] + [path.read_text(encoding='utf-8') for path in installer_specs]:
            self.assertIn("'activity_mappings.json'", text)
            self.assertIn("'custom_thresholds.json'", text)
            self.assertNotIn("'.deepseek_key'", text)
            self.assertNotIn("'users.db'", text)


if __name__ == '__main__':
    unittest.main()
