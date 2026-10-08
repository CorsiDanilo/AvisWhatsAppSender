const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ATTACHMENT_DIRECTORY = 'preset-attachments';
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

function normalizePresetAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;

  const fileName = path.basename(String(attachment.fileName || '').trim());
  const relativePath = String(attachment.relativePath || '').trim().replaceAll('\\', '/');
  const extension = path.extname(fileName).toLowerCase();
  if (!fileName || !relativePath || !SUPPORTED_EXTENSIONS.has(extension)) return null;
  if (!relativePath.startsWith(`${ATTACHMENT_DIRECTORY}/`) || relativePath.includes('/../') || relativePath.endsWith('/..')) {
    return null;
  }

  return { fileName, relativePath };
}

function attachmentDirectory(userDataPath) {
  return path.join(userDataPath, ATTACHMENT_DIRECTORY);
}

function resolvePresetAttachment(userDataPath, attachment) {
  const normalized = normalizePresetAttachment(attachment);
  if (!normalized) return '';
  const directory = path.resolve(attachmentDirectory(userDataPath));
  const resolved = path.resolve(userDataPath, normalized.relativePath);
  if (resolved !== directory && !resolved.startsWith(`${directory}${path.sep}`)) return '';
  return resolved;
}

function copyPresetAttachment(sourcePath, userDataPath) {
  const fileName = path.basename(String(sourcePath || '').trim());
  const extension = path.extname(fileName).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) throw new Error('Formato allegato non supportato. Usa JPG, JPEG o PNG.');
  if (!fs.existsSync(sourcePath)) throw new Error('L’allegato selezionato non esiste più.');

  const storedFileName = `${crypto.randomUUID()}${extension}`;
  const relativePath = `${ATTACHMENT_DIRECTORY}/${storedFileName}`;
  const directory = attachmentDirectory(userDataPath);
  fs.mkdirSync(directory, { recursive: true });
  fs.copyFileSync(sourcePath, path.join(directory, storedFileName));
  return { fileName, relativePath };
}

function deletePresetAttachment(userDataPath, attachment) {
  const filePath = resolvePresetAttachment(userDataPath, attachment);
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

module.exports = {
  attachmentDirectory,
  copyPresetAttachment,
  deletePresetAttachment,
  normalizePresetAttachment,
  resolvePresetAttachment,
};
