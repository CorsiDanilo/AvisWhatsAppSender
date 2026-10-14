const fs = require('node:fs');
const path = require('node:path');
const csv = require('csv-parser');
const XLSX = require('xlsx');

const HEADER_ALIASES = {
  fullName: ['nomeecognome', 'cognomeenome', 'nominativo', 'fullname', 'nomecognome'],
  name: ['nome', 'name'],
  surname: ['cognome', 'surname'],
  phone: ['telefono', 'cellulare', 'tel', 'cell', 'mobile', 'phone'],
  birthDate: ['datadinascita', 'nascita', 'birthdate', 'dob'],
};

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const SURNAME_PREFIXES = new Set([
  'di', 'de', 'del', 'della', 'dello', 'dei', 'degli', 'delle',
  'da', 'dal', 'dalla', 'dallo', 'dalle', 'dai', 'dagli',
  'la', 'lo', 'li', 'le',
  'san', 'santa', 'santo', 'santi',
  'van', 'von',
  'd', "d'", "de'", "dell'",
]);

function validateName(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return { valid: false, reason: 'Nominativo mancante' };
  }
  const digitsMatch = text.match(/\d+/);
  if (digitsMatch) {
    return { valid: false, reason: `Nominativo contiene numeri ("${digitsMatch[0]}")` };
  }
  if (/[^\p{L}\p{M}\s'’-]/u.test(text)) {
    return { valid: false, reason: 'Nominativo contiene caratteri non validi' };
  }
  return { valid: true, reason: '' };
}

function normalizeNamePart(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\p{L}[\p{L}\p{M}]*/gu, (part) => `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`);
}

function splitFullName(value, splitStrategy = 'lastWordIsName') {
  const normalized = String(value ?? '').trim().replace(/\s+/g, ' ');
  const parts = normalized ? normalized.split(' ') : [];

  if (parts.length <= 1) {
    const name = normalizeNamePart(parts[0] || '');
    return {
      name,
      givenNames: name,
      surname: '',
      warning: name ? 'Cognome non rilevato' : '',
    };
  }

  if (parts.length >= 2 && SURNAME_PREFIXES.has(parts[0].toLowerCase())) {
    const surname = normalizeNamePart(`${parts.shift()} ${parts.shift()}`);
    const givenNames = normalizeNamePart(parts.join(' '));
    return {
      name: givenNames.split(' ')[0] || '',
      givenNames,
      surname,
      warning: givenNames ? '' : 'Nome non rilevato',
    };
  }

  if (splitStrategy === 'firstWordIsSurname') {
    const surname = normalizeNamePart(parts.shift());
    const givenNames = normalizeNamePart(parts.join(' '));
    return {
      name: givenNames.split(' ')[0] || '',
      givenNames,
      surname,
      warning: '',
    };
  }

  // Predefinito: 'lastWordIsName' (l'ultima parola è il nome, le precedenti sono il cognome)
  const name = normalizeNamePart(parts.pop());
  const surname = normalizeNamePart(parts.join(' '));
  return {
    name,
    givenNames: name,
    surname,
    warning: '',
  };
}

function normalizePhone(raw, countryCode = '39') {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return { phone: '', valid: false, reason: 'Numero di telefono mancante' };
  }

  let digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.length === 10 && digits.startsWith('3')) {
    digits = `${countryCode}${digits}`;
  }

  if (!new RegExp(`^${countryCode}3\\d{9}$`).test(digits)) {
    return { phone: '', valid: false, reason: 'Numero di telefono non valido' };
  }

  return { phone: digits, valid: true, reason: '' };
}

function updateDonor(donor = {}, patch = {}) {
  const explicitGivenNames = String(patch.givenNames ?? '').trim();
  const givenNamesInput = explicitGivenNames || patch.name || donor.givenNames || donor.name;
  const givenNames = normalizeNamePart(givenNamesInput);
  const name = givenNames.split(' ')[0] || '';
  const surname = normalizeNamePart(patch.surname ?? donor.surname);
  const rawPhone = String(patch.phone ?? donor.rawPhone ?? donor.phone ?? '').trim();
  const normalizedPhone = normalizePhone(rawPhone);
  const nameValidation = validateName(`${name} ${surname}`);

  const reasons = [];
  if (!normalizedPhone.valid) reasons.push(normalizedPhone.reason);
  if (!nameValidation.valid) reasons.push(nameValidation.reason);

  const customFields = { ...(donor.customFields || {}) };

  if (patch.customFields && typeof patch.customFields === 'object') {
    for (const [key, value] of Object.entries(patch.customFields)) {
      customFields[key] = String(value ?? '').trim();
    }
  }

  return {
    ...donor,
    name,
    givenNames,
    surname,
    warning: name && !surname ? 'Cognome non rilevato' : '',
    rawPhone,
    phone: normalizedPhone.phone,
    valid: normalizedPhone.valid && nameValidation.valid,
    reason: reasons.join('; '),
    customFields,
  };
}

function createManualDonor(input = {}, customFieldKeys = []) {
  const customFields = {};
  for (const key of customFieldKeys) customFields[key] = '';

  return updateDonor({
    status: 'pending',
    selected: true,
    customFields,
  }, input);
}

function findColumn(headers, aliases) {
  return headers.find((header) => aliases.includes(normalizeHeader(header)));
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function columnsWithValues(headers, rows) {
  return headers.filter((header) => rows.some((row) => hasValue(row[header])));
}

function normalizeCsvHeader(value) {
  return String(value ?? '').replace(/^\uFEFF/, '').trim();
}

function detectCsvSeparator(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(4096);
    const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
    const text = buffer.toString('utf8', 0, bytesRead);
    const firstLine = text.split(/\r?\n/)[0] || '';

    const semicolons = (firstLine.match(/;/g) || []).length;
    const commas = (firstLine.match(/,/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;

    if (semicolons > commas && semicolons > tabs) return ';';
    if (tabs > commas && tabs > semicolons) return '\t';
    return ',';
  } catch {
    return ',';
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}

function createCsvParser(separator = ',') {
  return csv({
    separator,
    mapHeaders: ({ header }) => normalizeCsvHeader(header),
  });
}

function normalizeDonor(row, columns) {
  const name = String(row[columns.name] ?? '').trim();
  const surname = String(row[columns.surname] ?? '').trim();
  const rawPhone = String(row[columns.phone] ?? '').trim();
  const normalized = normalizePhone(rawPhone);

  return {
    name,
    surname,
    rawPhone,
    phone: normalized.phone,
    valid: normalized.valid,
    reason: normalized.reason,
    status: 'pending',
    selected: true,
  };
}

function columnsFor(headers) {
  const fullName = findColumn(headers, HEADER_ALIASES.fullName);
  const name = fullName || findColumn(headers, HEADER_ALIASES.name);
  return {
    name,
    surname: findColumn(headers, HEADER_ALIASES.surname),
    phone: findColumn(headers, HEADER_ALIASES.phone),
    nameAndSurnameInOneColumn: Boolean(fullName),
    splitStrategy: 'lastWordIsName',
    customFields: headers.filter((header) => HEADER_ALIASES.birthDate.includes(normalizeHeader(header))),
  };
}

const EXCEL_WORKBOOK_OPTIONS = { cellDates: false, raw: false, dateNF: 'dd/mm/yyyy' };
const EXCEL_SHEET_OPTIONS = { defval: '', raw: false, dateNF: 'dd/mm/yyyy' };

function inspectExcel(filePath, sheetName) {
  const workbook = XLSX.readFile(filePath, EXCEL_WORKBOOK_OPTIONS);
  const sheets = workbook.SheetNames;
  if (sheets.length === 0) return { sheets: [], headers: [], sampleRows: [], detectedMapping: {}, currentSheet: '' };

  const targetSheet = sheetName && sheets.includes(sheetName) ? sheetName : sheets[0];
  const sheet = workbook.Sheets[targetSheet];
  if (!sheet) return { sheets, headers: [], sampleRows: [], detectedMapping: {}, currentSheet: targetSheet };

  const rows = XLSX.utils.sheet_to_json(sheet, EXCEL_SHEET_OPTIONS);
  let headers = [];
  if (rows.length > 0) {
    const candidateHeaders = Object.keys(rows[0]).filter((h) => h && !h.startsWith('__EMPTY'));
    headers = columnsWithValues(candidateHeaders, rows);
  }

  const detectedMapping = columnsFor(headers);
  const sampleRows = rows.slice(0, 5);

  return { sheets, headers, sampleRows, detectedMapping, currentSheet: targetSheet };
}

function inspectCsv(filePath) {
  return new Promise((resolve, reject) => {
    let headers = [];
    const sampleRows = [];
    const populatedHeaders = new Set();
    const separator = detectCsvSeparator(filePath);

    fs.createReadStream(filePath)
      .on('error', reject)
      .pipe(createCsvParser(separator))
      .on('headers', (h) => {
        headers = h.filter(Boolean);
      })
      .on('data', (row) => {
        headers.forEach((header) => {
          if (hasValue(row[header])) populatedHeaders.add(header);
        });
        if (sampleRows.length < 5) {
          sampleRows.push(row);
        }
      })
      .on('end', () => {
        const visibleHeaders = headers.filter((header) => populatedHeaders.has(header));
        resolve({
          sheets: ['CSV'],
          headers: visibleHeaders,
          sampleRows,
          detectedMapping: columnsFor(visibleHeaders),
          currentSheet: 'CSV',
        });
      });
  });
}

function inspectFile(filePath, sheetName) {
  if (['.xls', '.xlsx'].includes(path.extname(filePath).toLowerCase())) {
    return Promise.resolve(inspectExcel(filePath, sheetName));
  }
  return inspectCsv(filePath);
}

function getRowsFromExcel(filePath, sheetName) {
  const workbook = XLSX.readFile(filePath, EXCEL_WORKBOOK_OPTIONS);
  const sheet = sheetName && workbook.Sheets[sheetName] ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, EXCEL_SHEET_OPTIONS);
}

function getRowsFromCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const separator = detectCsvSeparator(filePath);
    fs.createReadStream(filePath)
      .on('error', reject)
      .pipe(createCsvParser(separator))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows));
  });
}

async function parseWithMapping(filePath, sheetName, mapping) {
  const isExcel = ['.xls', '.xlsx'].includes(path.extname(filePath).toLowerCase());
  const rows = isExcel ? getRowsFromExcel(filePath, sheetName) : await getRowsFromCsv(filePath);
  
  return rows.map(row => {
    let parsedName;
    const rawNameCell = String(row[mapping.name] ?? '').trim();
    
    if (mapping.nameAndSurnameInOneColumn) {
       parsedName = splitFullName(rawNameCell, mapping.splitStrategy || 'lastWordIsName');
    } else {
       const givenNames = normalizeNamePart(rawNameCell);
       parsedName = {
         name: givenNames.split(' ')[0] || '',
         givenNames,
         surname: normalizeNamePart(row[mapping.surname]),
         warning: '',
       };
    }
    
    const rawPhone = String(row[mapping.phone] ?? '').trim();
    const normalized = normalizePhone(rawPhone);
    const rawSurnameCell = mapping.nameAndSurnameInOneColumn ? '' : String(row[mapping.surname] ?? '').trim();
    const nameToValidate = mapping.nameAndSurnameInOneColumn ? rawNameCell : `${rawNameCell} ${rawSurnameCell}`;
    const nameValidation = validateName(nameToValidate);

    const reasons = [];
    if (!normalized.valid) reasons.push(normalized.reason);
    if (!nameValidation.valid) reasons.push(nameValidation.reason);
    if (nameValidation.valid && !parsedName.name) reasons.push(parsedName.warning || 'Nome non rilevato');
    
    const customFields = {};
    if (mapping.customFields && Array.isArray(mapping.customFields)) {
      for (const field of mapping.customFields) {
        customFields[field] = String(row[field] ?? '').trim();
      }
    }

    return {
      ...parsedName,
      rawPhone,
      phone: normalized.phone,
      valid: normalized.valid && nameValidation.valid && Boolean(parsedName.name),
      reason: reasons.join('; '),
      status: 'pending',
      selected: true,
      customFields
    };
  });
}

module.exports = {
  detectCsvSeparator,
  normalizeHeader,
  normalizeNamePart,
  normalizePhone,
  createManualDonor,
  inspectFile,
  parseWithMapping,
  splitFullName,
  updateDonor,
  validateName,
  SURNAME_PREFIXES,
};
