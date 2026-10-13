const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  DEFAULT_PRESETS,
  deletePreset,
  loadPresets,
  normalizePreset,
  savePresets,
  upsertPreset,
} = require('../sender/presets');

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'avis-presets-test-'));
}

test('normalizePreset valida nome e normalizza messaggio, settings e allegato', () => {
  assert.throws(() => normalizePreset({ name: '  ', message: 'x' }), /nome del preset/);
  const preset = normalizePreset({
    name: '  Prova  ',
    message: 123,
    settings: { minDelayMs: -1 },
    attachment: { fileName: 'x.png', relativePath: 'preset-attachments/x.png' },
  });
  assert.equal(preset.name, 'Prova');
  assert.equal(preset.message, '123');
  assert.equal(preset.settings.minDelayMs, 0);
  assert.deepEqual(preset.attachment, { fileName: 'x.png', relativePath: 'preset-attachments/x.png' });
});

test('loadPresets usa i default per JSON corrotto e salva sempre il preset compleanno', () => {
  const directory = temporaryDirectory();
  try {
    const filePath = path.join(directory, 'presets.json');
    fs.writeFileSync(filePath, '{corrotto', 'utf8');
    assert.equal(loadPresets(filePath).length, DEFAULT_PRESETS.length);

    fs.writeFileSync(filePath, JSON.stringify([{ name: 'Locale', message: 'Ciao', settings: {} }]));
    const loaded = loadPresets(filePath);
    assert.ok(loaded.some((preset) => preset.name === 'Locale'));
    assert.ok(loaded.some((preset) => preset.name === 'Auguri di compleanno'));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('savePresets, upsertPreset e deletePreset persistono inserimenti, aggiornamenti e rimozioni', () => {
  const directory = temporaryDirectory();
  try {
    const filePath = path.join(directory, 'nested', 'presets.json');
    const saved = savePresets(filePath, [{ name: 'Uno', message: 'A', settings: {} }]);
    assert.equal(saved[0].name, 'Uno');
    assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8'))[0].message, 'A');

    assert.equal(upsertPreset(filePath, { name: 'Uno', message: 'B', settings: {} }).find((p) => p.name === 'Uno').message, 'B');
    assert.ok(upsertPreset(filePath, { name: 'Due', message: 'C', settings: {} }).some((p) => p.name === 'Due'));
    assert.ok(!deletePreset(filePath, 'Uno').some((p) => p.name === 'Uno'));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
