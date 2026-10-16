const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { SUPPORTED_EXTENSIONS } = require('./media');

function prepareSessionAttachments(attachments, userDataPath, {
  fileSystem = fs,
  createId = crypto.randomUUID,
} = {}) {
  const list = Array.isArray(attachments) ? attachments : [];
  if (list.length === 0) return [];

  const sessionDirectory = path.join(userDataPath, 'session-attachments', createId());
  const prepared = list.map((attachment, index) => {
    const sourcePath = String(attachment?.path || '').trim();
    const fileName = path.basename(String(attachment?.name || sourcePath));
    const extension = path.extname(fileName).toLowerCase();
    if (!sourcePath || !fileSystem.existsSync(sourcePath) || !SUPPORTED_EXTENSIONS.has(extension)) {
      throw new Error(`L’allegato "${fileName || index + 1}" non è più disponibile o non è valido.`);
    }
    return { ...attachment, sourcePath, fileName };
  });

  fileSystem.mkdirSync(sessionDirectory, { recursive: true });
  const usedNames = new Set();
  return prepared.map(({ sourcePath, fileName, ...attachment }, index) => {
    const uniqueName = usedNames.has(fileName) ? `${index + 1}-${fileName}` : fileName;
    usedNames.add(fileName);
    const targetPath = path.join(sessionDirectory, uniqueName);
    fileSystem.copyFileSync(sourcePath, targetPath);
    return { ...attachment, path: targetPath, name: fileName };
  });
}

module.exports = { prepareSessionAttachments };
