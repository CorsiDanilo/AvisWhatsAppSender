const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createImagePayload, inspectImage, MAX_IMAGE_BYTES } = require('../sender/media');

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'avis-media-test-'));
}

test('inspectImage valida percorsi vuoti, estensioni e file mancanti', () => {
  assert.equal(inspectImage('').valid, false);
  assert.match(inspectImage('').reason, /Nessuna immagine/);
  assert.match(inspectImage('missing.png').reason, /non accessibile/);
});

test('inspectImage accetta JPG e PNG e rifiuta directory e file troppo grandi', () => {
  const directory = temporaryDirectory();
  try {
    const imagePath = path.join(directory, 'foto.PNG');
    fs.writeFileSync(imagePath, Buffer.from([1, 2, 3]));
    assert.deepEqual(inspectImage(imagePath), { valid: true, mimeType: 'image/png', size: 3 });
    assert.equal(inspectImage(directory).valid, false);

    const oversized = path.join(directory, 'grande.jpg');
    const handle = fs.openSync(oversized, 'w');
    fs.ftruncateSync(handle, MAX_IMAGE_BYTES + 1);
    fs.closeSync(handle);
    assert.match(inspectImage(oversized).reason, /16 MB/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('createImagePayload costruisce media e caption usando il file validato', () => {
  const directory = temporaryDirectory();
  try {
    const imagePath = path.join(directory, 'foto.jpg');
    fs.writeFileSync(imagePath, 'image');
    const unsupportedPath = path.join(directory, 'no.gif');
    fs.writeFileSync(unsupportedPath, 'image');
    const MessageMedia = { fromFilePath: (filePath) => ({ filePath }) };
    assert.deepEqual(createImagePayload(imagePath, 'Ciao', MessageMedia), {
      media: { filePath: imagePath },
      options: { caption: 'Ciao' },
    });
    assert.throws(() => createImagePayload(unsupportedPath, 'Ciao', MessageMedia), /Formato non supportato/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
