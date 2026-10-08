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

function normalizeNamePart(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\p{L}[\p{L}\p{M}]*/gu, (part) => `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`);
}

function splitFullName(value) {
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

  const surname = normalizeNamePart(parts.pop());
  const givenNames = normalizeNamePart(parts.join(' '));
  return {
    name: givenNames.split(' ')[0] || '',
    givenNames,
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
    valid: normalizedPhone.valid,
    reason: normalizedPhone.reason,
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

function createCsvParser() {
  return csv({ mapHeaders: ({ header }) => normalizeCsvHeader(header) });
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
    customFields: headers.filter((header) => HEADER_ALIASES.birthDate.includes(normalizeHeader(header))),
  };
}

function inspectExcel(filePath, sheetName) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheets = workbook.SheetNames;
  if (sheets.length === 0) return { sheets: [], headers: [], sampleRows: [], detectedMapping: {}, currentSheet: '' };

  const targetSheet = sheetName && sheets.includes(sheetName) ? sheetName : sheets[0];
  const sheet = workbook.Sheets[targetSheet];
  if (!sheet) return { sheets, headers: [], sampleRows: [], detectedMapping: {}, currentSheet: targetSheet };

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
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

    fs.createReadStream(filePath)
      .on('error', reject)
      .pipe(createCsvParser())
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
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheet = sheetName && workbook.Sheets[sheetName] ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

function getRowsFromCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .on('error', reject)
      .pipe(createCsvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows));
  });
}

async function parseWithMapping(filePath, sheetName, mapping) {
  const isExcel = ['.xls', '.xlsx'].includes(path.extname(filePath).toLowerCase());
  const rows = isExcel ? getRowsFromExcel(filePath, sheetName) : await getRowsFromCsv(filePath);
  
  return rows.map(row => {
    let parsedName;
    
    if (mapping.nameAndSurnameInOneColumn) {
       parsedName = splitFullName(row[mapping.name]);
    } else {
       const givenNames = normalizeNamePart(row[mapping.name]);
       parsedName = {
         name: givenNames.split(' ')[0] || '',
         givenNames,
         surname: normalizeNamePart(row[mapping.surname]),
         warning: '',
       };
    }
    
    const rawPhone = String(row[mapping.phone] ?? '').trim();
    const normalized = normalizePhone(rawPhone);
    
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
      valid: normalized.valid,
      reason: normalized.reason,
      status: 'pending',
      selected: true,
      customFields
    };
  });
}

module.exports = {
  normalizeHeader,
  normalizeNamePart,
  normalizePhone,
  createManualDonor,
  inspectFile,
  parseWithMapping,
  splitFullName,
  updateDonor,
};
