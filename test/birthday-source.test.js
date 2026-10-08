const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  inspectBirthdaySource,
  loadBirthdaySource,
  resolveBirthdaySource,
} = require('../sender/birthday-source');
const { DEFAULT_SETTINGS, normalizeSettings } = require('../sender/settings');
const { loadPresets, normalizePreset } = require('../sender/presets');

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'avis-birthday-source-'));
}

function writeSource(directory, fileName = 'donatori_compleanni.csv') {
  const filePath = path.join(directory, fileName);
  fs.writeFileSync(
    filePath,
    'COGNOMEENOME,DATADINASCITA,CELLULARE\nDANILO CORSI,14/02/1997,3285635342\n',
    'utf8'
  );
  return filePath;
}

test('uses the exact birthday file selected by the operator', () => {
  const directory = temporaryDirectory();
  try {
    const filePath = writeSource(directory);
    assert.deepEqual(resolveBirthdaySource(filePath), {
      filePath,
      fileName: 'donatori_compleanni.csv',
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects a missing or unsupported selected birthday file', () => {
  const directory = temporaryDirectory();
  try {
    assert.equal(resolveBirthdaySource('').errorCode, 'not-configured');
    assert.equal(resolveBirthdaySource(path.join(directory, 'mancante.csv')).errorCode, 'missing');
    const unsupportedPath = path.join(directory, 'donatori.txt');
    fs.writeFileSync(unsupportedPath, 'lista');
    assert.equal(resolveBirthdaySource(unsupportedPath).errorCode, 'unsupported-extension');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('inspects and loads the AVIS birthday source through the existing mapping', async () => {
  const directory = temporaryDirectory();
  try {
    const filePath = writeSource(directory);
    const inspection = await inspectBirthdaySource(filePath);

    assert.equal(inspection.detectedMapping.name, 'COGNOMEENOME');
    assert.equal(inspection.detectedMapping.phone, 'CELLULARE');
    assert.deepEqual(inspection.detectedMapping.customFields, ['DATADINASCITA']);

    const loaded = await loadBirthdaySource(filePath, inspection.currentSheet, inspection.detectedMapping);
    assert.equal(loaded.donors.length, 1);
    assert.equal(loaded.donors[0].customFields.DATADINASCITA, '14/02/1997');
    assert.equal(loaded.invalidRows.length, 0);
    assert.equal(typeof loaded.sourceMtimeMs, 'number');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps notification and birthday defaults when normalizing existing settings', () => {
  const settings = normalizeSettings({});

  assert.equal(settings.notificationsEnabled, DEFAULT_SETTINGS.notificationsEnabled);
  assert.equal(settings.startWithWindows, true);
  assert.equal(settings.birthdayEnabled, true);
  assert.equal(settings.birthdaySourceFilePath, '');
  assert.equal(settings.birthdayPresetName, 'Auguri di compleanno');
});

test('adds the birthday preset without removing stored custom presets', () => {
  const directory = temporaryDirectory();
  const presetsPath = path.join(directory, 'presets.json');
  try {
    fs.writeFileSync(presetsPath, JSON.stringify([
      { name: 'Modello locale', message: 'Ciao [nome]', settings: {} },
    ]));

    const presets = loadPresets(presetsPath);
    assert.equal(presets.some((preset) => preset.name === 'Modello locale'), true);
    assert.equal(presets.some((preset) => preset.name === 'Auguri di compleanno'), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('keeps only safe attachment metadata when normalizing a preset', () => {
  assert.deepEqual(normalizePreset({
    name: 'Compleanno',
    message: 'Auguri',
    attachment: { fileName: 'auguri.png', relativePath: 'preset-attachments/id.png' },
  }).attachment, {
    fileName: 'auguri.png',
    relativePath: 'preset-attachments/id.png',
  });
  assert.equal(normalizePreset({
    name: 'Senza allegato',
    message: 'Ciao',
    attachment: { fileName: 'file.pdf', relativePath: 'preset-attachments/file.pdf' },
  }).attachment, null);
});
