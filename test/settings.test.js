const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { DEFAULT_SETTINGS, loadSettings, saveSettings } = require('../sender/settings');

test('loads defaults and preserves valid saved rhythm settings', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-settings-'));
  const file = path.join(dir, 'settings.json');

  assert.deepEqual(loadSettings(file), DEFAULT_SETTINGS);
  saveSettings(file, { minDelayMs: 5000, maxDelayMs: 12000, pauseAfter: 10, pauseMinutes: 5 });
  assert.deepEqual(loadSettings(file), {
    minDelayMs: 5000,
    maxDelayMs: 12000,
    pauseAfter: 10,
    pauseMinutes: 5,
  });
});

test('ignores malformed settings instead of breaking startup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-settings-'));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, '{broken');

  assert.deepEqual(loadSettings(file), DEFAULT_SETTINGS);
});
