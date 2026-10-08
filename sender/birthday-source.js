const fs = require('node:fs');
const path = require('node:path');

const { inspectFile, parseWithMapping } = require('./data');
const { parseBirthdayDate } = require('./birthdays');

const SUPPORTED_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls']);
const BIRTH_DATE_KEYS = new Set(['datadinascita', 'nascita', 'birthdate', 'dob']);

function normalizeKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sourceError(errorCode, message) {
  return { errorCode, message };
}

function resolveBirthdaySource(sourceFilePath) {
  const filePath = String(sourceFilePath || '').trim();
  if (!filePath) return sourceError('not-configured', 'Configura il file della lista compleanni.');
  if (!fs.existsSync(filePath)) return sourceError('missing', 'Il file della lista compleanni non esiste più o non è accessibile.');
  if (!fs.statSync(filePath).isFile()) return sourceError('not-file', 'Seleziona un file CSV o Excel per la lista compleanni.');
  if (!SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return sourceError('unsupported-extension', 'Il file compleanni deve essere in formato CSV, XLSX o XLS.');
  }

  return { filePath, fileName: path.basename(filePath) };
}

async function inspectBirthdaySource(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return sourceError('missing', 'Il file della lista compleanni non esiste.');
  }

  const inspection = await inspectFile(filePath);
  const mapping = inspection.detectedMapping || {};
  if (!mapping.name || !mapping.phone) {
    return sourceError('missing-columns', 'La lista compleanni deve contenere nome e cellulare.');
  }
  if (!mapping.customFields?.some((field) => BIRTH_DATE_KEYS.has(normalizeKey(field)))) {
    return sourceError('missing-birth-date', 'La lista compleanni deve contenere la colonna DATADINASCITA.');
  }

  return { ...inspection, filePath };
}

function invalidBirthdayRows(donors) {
  return donors.filter((donor) => {
    const customFields = donor.customFields || {};
    const entry = Object.entries(customFields).find(([key]) => BIRTH_DATE_KEYS.has(normalizeKey(key)));
    return entry && String(entry[1] ?? '').trim() && !parseBirthdayDate(entry[1]);
  });
}

async function loadBirthdaySource(filePath, sheetName, mapping) {
  const inspection = await inspectBirthdaySource(filePath);
  if (inspection.errorCode) {
    const error = new Error(inspection.message);
    error.code = inspection.errorCode;
    throw error;
  }

  const donors = await parseWithMapping(filePath, sheetName || inspection.currentSheet, mapping || inspection.detectedMapping);
  const sourceMtimeMs = fs.statSync(filePath).mtimeMs;
  return { donors, invalidRows: invalidBirthdayRows(donors), sourceMtimeMs };
}

module.exports = {
  inspectBirthdaySource,
  loadBirthdaySource,
  resolveBirthdaySource,
};
