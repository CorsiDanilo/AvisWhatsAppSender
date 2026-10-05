const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const XLSX = require('xlsx');

const { normalizePhone, readDonors } = require('../sender/data');
const { renderTemplate } = require('../sender/template');

test('normalizes common Italian phone formats', () => {
  assert.deepEqual(normalizePhone('+39 333-123 4567'), {
    phone: '393331234567',
    valid: true,
  });
  assert.deepEqual(normalizePhone('0039 340 1122334'), {
    phone: '393401122334',
    valid: true,
  });
  assert.deepEqual(normalizePhone('3331234567'), {
    phone: '393331234567',
    valid: true,
  });
});

test('rejects missing and malformed phone numbers', () => {
  assert.equal(normalizePhone('').valid, false);
  assert.equal(normalizePhone('abc').valid, false);
  assert.equal(normalizePhone('1234').valid, false);
});

test('reads CSV aliases and keeps invalid rows visible', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-data-'));
  const file = path.join(dir, 'donatori.csv');
  fs.writeFileSync(
    file,
    'nome,Cellulare,Cognome\nDanilo,393285635342,Corsi\nSenzaNumero,,Test\n',
  );

  const donors = await readDonors(file);

  assert.equal(donors.length, 2);
  assert.deepEqual(donors[0], {
    name: 'Danilo',
    surname: 'Corsi',
    rawPhone: '393285635342',
    phone: '393285635342',
    valid: true,
    reason: undefined,
    status: 'pending',
    selected: true,
  });
  assert.equal(donors[1].valid, false);
  assert.equal(donors[1].reason, 'Numero di telefono mancante');
});

test('reads Excel workbooks using the first worksheet', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-data-xlsx-'));
  const file = path.join(dir, 'donatori.xlsx');
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Nome', 'Cognome', 'Telefono'],
    ['Danilo', 'Corsi', '393285635342'],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Donatori');
  XLSX.writeFile(workbook, file);

  const donors = await readDonors(file);

  assert.equal(donors.length, 1);
  assert.equal(donors[0].name, 'Danilo');
  assert.equal(donors[0].surname, 'Corsi');
  assert.equal(donors[0].phone, '393285635342');
  assert.equal(donors[0].valid, true);
});

test('renders placeholders without damaging Unicode text', () => {
  assert.equal(
    renderTemplate('Ciao [nome] [cognome] 👋', {
      name: 'danilo',
      surname: 'corsi',
    }),
    'Ciao Danilo Corsi 👋',
  );
  assert.equal(
    renderTemplate('AVIS comunica una raccolta 🩸', { name: '', surname: '' }),
    'AVIS comunica una raccolta 🩸',
  );
});
