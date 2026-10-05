const fs = require('node:fs');
const path = require('node:path');

const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

function inspectImage(filePath) {
  if (!filePath) return { valid: false, reason: 'Nessuna immagine selezionata' };

  try {
    const stats = fs.statSync(filePath);
    const mimeType = MIME_TYPES[path.extname(filePath).toLowerCase()];
    if (!mimeType) return { valid: false, reason: 'Formato non supportato: usa JPG o PNG' };
    if (!stats.isFile()) return { valid: false, reason: 'Il percorso selezionato non è un file' };
    if (stats.size > MAX_IMAGE_BYTES) return { valid: false, reason: 'L’immagine supera il limite di 16 MB' };
    return { valid: true, mimeType, size: stats.size };
  } catch {
    return { valid: false, reason: 'Immagine non accessibile' };
  }
}

function createImagePayload(filePath, caption, MessageMedia) {
  const inspection = inspectImage(filePath);
  if (!inspection.valid) throw new Error(inspection.reason);
  return {
    media: MessageMedia.fromFilePath(filePath),
    options: { caption },
  };
}

module.exports = { inspectImage, createImagePayload, MAX_IMAGE_BYTES };
