const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { inspectImage, createImagePayload } = require('../sender/media');

test('accepts local JPG and PNG files and rejects unsupported files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-media-'));
  const imagePath = path.join(dir, 'volantino.png');
  const textPath = path.join(dir, 'note.txt');
  fs.writeFileSync(imagePath, Buffer.from('fake image'));
  fs.writeFileSync(textPath, 'not an image');

  assert.deepEqual(inspectImage(imagePath), {
    valid: true,
    mimeType: 'image/png',
    size: 10,
  });
  assert.equal(inspectImage(textPath).valid, false);
});

test('builds a WhatsApp media payload with caption', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-media-'));
  const imagePath = path.join(dir, 'volantino.jpg');
  fs.writeFileSync(imagePath, Buffer.from('fake image'));

  const fakeMessageMedia = {
    fromFilePath: (filePath) => ({ filePath }),
  };

  assert.deepEqual(
    createImagePayload(imagePath, 'Ciao Danilo 🩸', fakeMessageMedia),
    {
      media: { filePath: imagePath },
      options: { caption: 'Ciao Danilo 🩸' },
    },
  );
});
