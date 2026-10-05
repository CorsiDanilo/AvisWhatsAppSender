const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { DEFAULT_PRESETS, deletePreset, loadPresets, upsertPreset } = require('../sender/presets');

test('loads default presets and persists created/updated presets', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-presets-'));
  const file = path.join(dir, 'presets.json');

  assert.equal(loadPresets(file).length, DEFAULT_PRESETS.length);
  upsertPreset(file, { name: 'Nuovo preset', message: 'Ciao [nome]', settings: { pauseAfter: 5 } });
  assert.equal(loadPresets(file).find((preset) => preset.name === 'Nuovo preset').message, 'Ciao [nome]');

  upsertPreset(file, { name: 'Nuovo preset', message: 'Aggiornato [nome]', settings: {} });
  assert.equal(loadPresets(file).find((preset) => preset.name === 'Nuovo preset').message, 'Aggiornato [nome]');
});

test('deletes a preset by name', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-presets-'));
  const file = path.join(dir, 'presets.json');
  upsertPreset(file, { name: 'Da eliminare', message: 'Test', settings: {} });

  deletePreset(file, 'Da eliminare');

  assert.equal(loadPresets(file).some((preset) => preset.name === 'Da eliminare'), false);
});
