const fs = require('node:fs');
const path = require('node:path');
const csv = require('csv-parser');
const XLSX = require('xlsx');

const HEADER_ALIASES = {
  name: ['nome', 'name', 'nominativo'],
  surname: ['cognome', 'surname'],
  phone: ['telefono', 'cellulare', 'tel', 'cell', 'mobile', 'phone'],
};

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
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

  return { phone: digits, valid: true };
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
  return {
    name: findColumn(headers, HEADER_ALIASES.name),
    surname: findColumn(headers, HEADER_ALIASES.surname),
    phone: findColumn(headers, HEADER_ALIASES.phone),
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
      .pipe(csv())
      .on('headers', (h) => {
        headers = h.map((col) => col.replace(/^\uFEFF/, '').trim()).filter(Boolean);
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
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows));
  });
}

async function parseWithMapping(filePath, sheetName, mapping) {
  const isExcel = ['.xls', '.xlsx'].includes(path.extname(filePath).toLowerCase());
  const rows = isExcel ? getRowsFromExcel(filePath, sheetName) : await getRowsFromCsv(filePath);
  
  return rows.map(row => {
    let name = '';
    let surname = '';
    
    if (mapping.nameAndSurnameInOneColumn) {
       const fullName = String(row[mapping.name] ?? '').trim();
       const parts = fullName.split(/\s+/);
       if (parts.length > 1) {
         surname = parts.pop();
         name = parts.join(' ');
       } else {
         name = fullName;
       }
    } else {
       name = String(row[mapping.name] ?? '').trim();
       surname = String(row[mapping.surname] ?? '').trim();
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
      name,
      surname,
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

module.exports = { normalizePhone, inspectFile, parseWithMapping };
