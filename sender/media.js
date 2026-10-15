const fs = require('node:fs');
const path = require('node:path');
const mime = require('mime');

const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.3gp', '.mov', '.mkv']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac']);
const DOCUMENT_EXTENSIONS = new Set([
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.txt', '.csv', '.zip', '.rar',
]);

const SUPPORTED_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.msi', '.com', '.vbs', '.scr', '.pif', '.dll', '.jar', '.vbe', '.jse', '.wsf', '.wsh',
]);

const MIME_FALLBACKS = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.3gp': 'video/3gpp',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
};

function getAttachmentCategory(ext, mimeType) {
  if (IMAGE_EXTENSIONS.has(ext) || mimeType.startsWith('image/')) return 'image';
  if (VIDEO_EXTENSIONS.has(ext) || mimeType.startsWith('video/')) return 'video';
  if (AUDIO_EXTENSIONS.has(ext) || mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

function getDocumentBadge(ext) {
  switch (ext) {
    case '.pdf': return 'PDF';
    case '.docx':
    case '.doc': return 'DOC';
    case '.xlsx':
    case '.xls': return 'XLS';
    case '.pptx':
    case '.ppt': return 'PPT';
    case '.zip':
    case '.rar': return 'ZIP';
    case '.txt':
    case '.csv': return 'TXT';
    default: return 'DOC';
  }
}

function getAttachmentLabel(kind, badge) {
  if (kind === 'image') return 'Immagine';
  if (kind === 'video') return 'Video';
  if (kind === 'audio') return 'Audio';
  switch (badge) {
    case 'PDF': return 'Documento PDF';
    case 'DOC': return 'Documento Word';
    case 'XLS': return 'Foglio Excel';
    case 'PPT': return 'Presentazione PPT';
    case 'TXT': return 'File di testo';
    case 'ZIP': return 'Archivio compresso';
    default: return 'Documento';
  }
}

function inspectAttachment(filePath) {
  if (!filePath) return { valid: false, reason: 'Nessun file selezionato' };

  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) return { valid: false, reason: 'Il percorso selezionato non è un file' };
    if (stats.size === 0) return { valid: false, reason: 'Il file selezionato è vuoto' };

    const ext = path.extname(filePath).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return { valid: false, reason: 'Formato non supportato o potenzialmente non sicuro' };
    }

    const mimeType = mime.getType(filePath) || MIME_FALLBACKS[ext] || 'application/octet-stream';
    const kind = getAttachmentCategory(ext, mimeType);
    const isImage = kind === 'image';
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_MEDIA_BYTES;
    const limitLabel = isImage ? '16 MB' : '50 MB';

    if (stats.size > maxBytes) {
      return { valid: false, reason: `Il file supera il limite di ${limitLabel}` };
    }

    const badge = isImage ? 'IMG' : kind === 'video' ? 'VIDEO' : kind === 'audio' ? 'AUDIO' : getDocumentBadge(ext);
    const label = getAttachmentLabel(kind, badge);

    return {
      valid: true,
      mimeType,
      size: stats.size,
      kind,
      badge,
      label,
      extension: ext,
    };
  } catch {
    return { valid: false, reason: 'File non accessibile' };
  }
}

function inspectImage(filePath) {
  if (!filePath) return { valid: false, reason: 'Nessuna immagine selezionata' };

  try {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_FALLBACKS[ext] || mime.getType(filePath);
    if (!mimeType || !IMAGE_EXTENSIONS.has(ext)) {
      return { valid: false, reason: 'Formato non supportato: usa JPG o PNG' };
    }
    if (!stats.isFile()) return { valid: false, reason: 'Il percorso selezionato non è un file' };
    if (stats.size > MAX_IMAGE_BYTES) return { valid: false, reason: 'L’immagine supera il limite di 16 MB' };
    return { valid: true, mimeType, size: stats.size };
  } catch {
    return { valid: false, reason: 'Immagine non accessibile' };
  }
}

function createAttachmentPayload(filePath, caption, MessageMedia) {
  const inspection = inspectAttachment(filePath);
  if (!inspection.valid) throw new Error(inspection.reason);

  const isDocument = inspection.kind === 'document';
  const isAudio = inspection.kind === 'audio';
  const fileName = path.basename(filePath);

  const options = {
    caption: isAudio ? undefined : caption,
    sendMediaAsDocument: isDocument,
    filename: fileName,
    waitUntilMsgSent: false,
  };

  const media = MessageMedia.fromFilePath(filePath);
  if (media) {
    media.filename = fileName;
  }

  return {
    media,
    options,
    kind: inspection.kind,
    badge: inspection.badge,
    label: inspection.label,
  };
}

function createImagePayload(filePath, caption, MessageMedia) {
  return createAttachmentPayload(filePath, caption, MessageMedia);
}

module.exports = {
  inspectAttachment,
  createAttachmentPayload,
  inspectImage,
  createImagePayload,
  getAttachmentCategory,
  getDocumentBadge,
  getAttachmentLabel,
  MAX_IMAGE_BYTES,
  MAX_MEDIA_BYTES,
  MAX_DOCUMENT_BYTES,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  AUDIO_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  SUPPORTED_EXTENSIONS,
};
