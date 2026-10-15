const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  createAttachmentPayload,
  createImagePayload,
  inspectAttachment,
  inspectImage,
  MAX_IMAGE_BYTES,
  MAX_DOCUMENT_BYTES,
} = require('../sender/media');

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
    const unsupportedPath = path.join(directory, 'no.exe');
    fs.writeFileSync(unsupportedPath, 'exe');
    const MessageMedia = { fromFilePath: (filePath) => ({ filePath }) };
    assert.deepEqual(createImagePayload(imagePath, 'Ciao', MessageMedia), {
      media: { filePath: imagePath, filename: 'foto.jpg' },
      options: {
        caption: 'Ciao',
        sendMediaAsDocument: false,
        filename: 'foto.jpg',
        waitUntilMsgSent: false,
      },
      kind: 'image',
      badge: 'IMG',
      label: 'Immagine',
    });
    assert.throws(() => createImagePayload(unsupportedPath, 'Ciao', MessageMedia), /Formato non supportato/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('inspectAttachment accetta PDF, documenti, immagini, video e audio', () => {
  const directory = temporaryDirectory();
  try {
    const pdfPath = path.join(directory, 'documento.PDF');
    fs.writeFileSync(pdfPath, Buffer.from('%PDF-1.4 test'));
    const pngPath = path.join(directory, 'immagine.png');
    fs.writeFileSync(pngPath, Buffer.from([1, 2, 3]));
    const docxPath = path.join(directory, 'modulo.docx');
    fs.writeFileSync(docxPath, Buffer.from('docx-data'));
    const mp4Path = path.join(directory, 'video.mp4');
    fs.writeFileSync(mp4Path, Buffer.from('mp4-data'));
    const mp3Path = path.join(directory, 'audio.mp3');
    fs.writeFileSync(mp3Path, Buffer.from('mp3-data'));

    assert.deepEqual(inspectAttachment(pdfPath), {
      valid: true,
      mimeType: 'application/pdf',
      size: 13,
      kind: 'document',
      badge: 'PDF',
      label: 'Documento PDF',
      extension: '.pdf',
    });
    assert.deepEqual(inspectAttachment(pngPath), {
      valid: true,
      mimeType: 'image/png',
      size: 3,
      kind: 'image',
      badge: 'IMG',
      label: 'Immagine',
      extension: '.png',
    });
    assert.deepEqual(inspectAttachment(docxPath), {
      valid: true,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 9,
      kind: 'document',
      badge: 'DOC',
      label: 'Documento Word',
      extension: '.docx',
    });
    assert.deepEqual(inspectAttachment(mp4Path), {
      valid: true,
      mimeType: 'video/mp4',
      size: 8,
      kind: 'video',
      badge: 'VIDEO',
      label: 'Video',
      extension: '.mp4',
    });
    assert.deepEqual(inspectAttachment(mp3Path), {
      valid: true,
      mimeType: 'audio/mpeg',
      size: 8,
      kind: 'audio',
      badge: 'AUDIO',
      label: 'Audio',
      extension: '.mp3',
    });

    const unsupported = path.join(directory, 'doc.exe');
    fs.writeFileSync(unsupported, 'exe');
    assert.equal(inspectAttachment(unsupported).valid, false);
    assert.match(inspectAttachment(unsupported).reason, /Formato non supportato/);

    const oversizedPdf = path.join(directory, 'big.pdf');
    const handle = fs.openSync(oversizedPdf, 'w');
    fs.ftruncateSync(handle, MAX_DOCUMENT_BYTES + 1);
    fs.closeSync(handle);
    assert.match(inspectAttachment(oversizedPdf).reason, /50 MB/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('createAttachmentPayload imposta sendMediaAsDocument per i documenti PDF', () => {
  const directory = temporaryDirectory();
  try {
    const pdfPath = path.join(directory, 'convocazione.pdf');
    fs.writeFileSync(pdfPath, '%PDF');
    const MessageMedia = { fromFilePath: (filePath) => ({ filePath }) };
    const payload = createAttachmentPayload(pdfPath, 'Gentile donatore', MessageMedia);

    assert.deepEqual(payload, {
      media: { filePath: pdfPath, filename: 'convocazione.pdf' },
      options: {
        caption: 'Gentile donatore',
        sendMediaAsDocument: true,
        filename: 'convocazione.pdf',
        waitUntilMsgSent: false,
      },
      kind: 'document',
      badge: 'PDF',
      label: 'Documento PDF',
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('createAttachmentPayload omette caption per file audio e imposta badge AUDIO', () => {
  const directory = temporaryDirectory();
  try {
    const audioPath = path.join(directory, 'vocale.mp3');
    fs.writeFileSync(audioPath, 'mp3-data');
    const MessageMedia = { fromFilePath: (filePath) => ({ filePath }) };
    const payload = createAttachmentPayload(audioPath, 'Gentile donatore', MessageMedia);

    assert.deepEqual(payload, {
      media: { filePath: audioPath, filename: 'vocale.mp3' },
      options: {
        caption: undefined,
        sendMediaAsDocument: false,
        filename: 'vocale.mp3',
        waitUntilMsgSent: false,
      },
      kind: 'audio',
      badge: 'AUDIO',
      label: 'Audio',
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});


