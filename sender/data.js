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

function readExcel(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
  const columns = columnsFor(rows.length ? Object.keys(rows[0]) : []);
  return rows.map((row) => normalizeDonor(row, columns));
}

function readDonors(filePath) {
  if (['.xls', '.xlsx'].includes(path.extname(filePath).toLowerCase())) {
    return Promise.resolve(readExcel(filePath));
  }

  return new Promise((resolve, reject) => {
    const donors = [];
    let columns;

    fs.createReadStream(filePath)
      .on('error', reject)
      .pipe(csv())
      .on('headers', (headers) => {
        columns = columnsFor(headers);
      })
      .on('data', (row) => {
        donors.push(normalizeDonor(row, columns || {}));
      })
      .on('end', () => resolve(donors));
  });
}

module.exports = { normalizePhone, readDonors };
