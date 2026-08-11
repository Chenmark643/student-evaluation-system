"""Regression coverage for the fresh moral roster import UI."""

import json
from pathlib import Path
import shutil
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]


class MoralRosterImportUiTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "Node.js is required for the JavaScript UI regression")
    def test_import_succeeds_without_removed_legacy_roster_selectors(self):
        script = r"""
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync('web/js/modules/moral.js', 'utf8');
const nodes = {
  'moral-roster-file': {value: 'mock.xlsx'},
  'moral-roster-status': {textContent: ''}
};
const toasts = [];
const context = {
  console,
  document: {
    getElementById: id => nodes[id] || null,
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => ({}),
    addEventListener: () => {}
  },
  eel: {
    read_roster_for_quality: () => async () => ({
      '2025001': {name: '测试学生', class: '信工251'}
    })
  },
  MajorScope: {
    requireForExport: () => true,
    get: () => '信工'
  },
  showToast: (message, type) => toasts.push({message: String(message), type}),
  saveAllToMemory: () => {},
  localStorage: {getItem: () => null, setItem: () => {}},
  setTimeout: callback => callback()
};
vm.createContext(context);
vm.runInContext(source, context);
(async () => {
  await vm.runInContext('moralImportRoster()', context);
  process.stdout.write(JSON.stringify({
    toasts,
    status: nodes['moral-roster-status'].textContent
  }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
"""
        result = subprocess.run(
            ["node", "-e", script],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=True,
        )
        payload = json.loads(result.stdout)

        self.assertEqual(payload["toasts"][-1]["type"], "success")
        self.assertIn("花名册导入成功", payload["toasts"][-1]["message"])
        self.assertIn("已导入 1 名学生", payload["status"])


if __name__ == "__main__":
    unittest.main()
