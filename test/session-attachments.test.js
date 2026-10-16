const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { prepareSessionAttachments } = require('../sender/session-attachments');

test('copies valid attachments into a private session directory', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-session-attachments-'));
  const sourcePath = path.join(directory, 'promemoria.pdf');
  fs.writeFileSync(sourcePath, 'pdf-data');
  try {
    const attachments = prepareSessionAttachments([{ path: sourcePath, name: 'promemoria.pdf', type: 'document' }], directory, {
      createId: () => 'session-1',
    });
    assert.equal(attachments[0].name, 'promemoria.pdf');
    assert.equal(attachments[0].path, path.join(directory, 'session-attachments', 'session-1', 'promemoria.pdf'));
    assert.equal(fs.readFileSync(attachments[0].path, 'utf8'), 'pdf-data');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects an unavailable attachment before the queue starts', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-session-attachments-'));
  try {
    assert.throws(
      () => prepareSessionAttachments([{ path: path.join(directory, 'missing.png'), name: 'missing.png' }], directory),
      /non è più disponibile/i,
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
