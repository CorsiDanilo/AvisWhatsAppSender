const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  copyPresetAttachment,
  deletePresetAttachment,
  normalizePresetAttachment,
  resolvePresetAttachment,
} = require('../sender/preset-attachments');

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'avis-preset-attachments-'));
}

test('normalizes safe preset attachment metadata and rejects unsafe paths', () => {
  assert.deepEqual(normalizePresetAttachment({
    fileName: 'auguri.png',
    relativePath: 'preset-attachments/abc.png',
  }), {
    fileName: 'auguri.png',
    relativePath: 'preset-attachments/abc.png',
  });
  assert.equal(normalizePresetAttachment({ fileName: 'x.png', relativePath: '../x.png' }), null);
  assert.equal(normalizePresetAttachment({ fileName: 'x.pdf', relativePath: 'preset-attachments/x.pdf' }), null);
});

test('copies a preset attachment into the application storage directory', () => {
  const directory = temporaryDirectory();
  const sourcePath = path.join(directory, 'auguri.png');
  fs.writeFileSync(sourcePath, 'image-data');

  try {
    const attachment = copyPresetAttachment(sourcePath, directory);
    const storedPath = resolvePresetAttachment(directory, attachment);

    assert.equal(attachment.fileName, 'auguri.png');
    assert.equal(path.dirname(storedPath), path.join(directory, 'preset-attachments'));
    assert.equal(fs.readFileSync(storedPath, 'utf8'), 'image-data');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('removes a stored preset attachment without touching the source file', () => {
  const directory = temporaryDirectory();
  const sourcePath = path.join(directory, 'auguri.jpg');
  fs.writeFileSync(sourcePath, 'image-data');

  try {
    const attachment = copyPresetAttachment(sourcePath, directory);
    const storedPath = resolvePresetAttachment(directory, attachment);
    deletePresetAttachment(directory, attachment);

    assert.equal(fs.existsSync(storedPath), false);
    assert.equal(fs.existsSync(sourcePath), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
