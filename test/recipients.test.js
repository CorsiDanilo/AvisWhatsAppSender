const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  createManualDonor,
  inspectFile,
  normalizeNamePart,
  parseWithMapping,
  splitFullName,
  updateDonor,
} = require('../sender/data');
const { renderTemplate } = require('../sender/template');

function temporaryCsv(contents) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-recipient-test-'));
  const filePath = path.join(directory, 'recipients.csv');
  fs.writeFileSync(filePath, contents, 'utf8');
  return { directory, filePath };
}

test('normalizes name parts without losing apostrophes or hyphens', () => {
  assert.equal(normalizeNamePart("  D'ANGELO  "), "D'Angelo");
  assert.equal(normalizeNamePart('ROSSI-BIANCHI'), 'Rossi-Bianchi');
});

test('splits a full name assuming surname first and exposes the first given name', () => {
  assert.deepEqual(splitFullName('  ROSSI   MARIA   ELENA '), {
    name: 'Maria',
    givenNames: 'Maria Elena',
    surname: 'Rossi',
    warning: '',
  });
  assert.deepEqual(splitFullName('ARON ALINA LACRAMIORA'), {
    name: 'Alina',
    givenNames: 'Alina Lacramiora',
    surname: 'Aron',
    warning: '',
  });
});

test('keeps a one-word name and reports a non-blocking warning', () => {
  assert.deepEqual(splitFullName('MADONNA'), {
    name: 'Madonna',
    givenNames: 'Madonna',
    surname: '',
    warning: 'Cognome non rilevato',
  });
});

test('detects and parses the known AVIS columns without changing the source values', async () => {
  const { directory, filePath } = temporaryCsv(
    'COGNOMEENOME,DATADINASCITA,CELLULARE\nROSSI MARIA ELENA,01/02/1980,+393331234567\n'
  );

  try {
    const inspection = await inspectFile(filePath);
    assert.equal(inspection.detectedMapping.name, 'COGNOMEENOME');
    assert.equal(inspection.detectedMapping.nameAndSurnameInOneColumn, true);
    assert.equal(inspection.detectedMapping.phone, 'CELLULARE');
    assert.deepEqual(inspection.detectedMapping.customFields, ['DATADINASCITA']);

    const [donor] = await parseWithMapping(filePath, 'CSV', {
      ...inspection.detectedMapping,
      customFields: ['DATADINASCITA'],
    });

    assert.deepEqual(
      {
        name: donor.name,
        givenNames: donor.givenNames,
        surname: donor.surname,
        rawPhone: donor.rawPhone,
        phone: donor.phone,
        valid: donor.valid,
        customFields: donor.customFields,
      },
      {
        name: 'Maria',
        givenNames: 'Maria Elena',
        surname: 'Rossi',
        rawPhone: '+393331234567',
        phone: '393331234567',
        valid: true,
        customFields: { DATADINASCITA: '01/02/1980' },
      }
    );
    assert.equal(renderTemplate('Ciao [nome] [cognome]', donor), 'Ciao Maria Rossi');
    assert.equal(fs.readFileSync(filePath, 'utf8'), 'COGNOMEENOME,DATADINASCITA,CELLULARE\nROSSI MARIA ELENA,01/02/1980,+393331234567\n');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('updates editable recipient fields and recalculates phone validity', () => {
  const donor = {
    name: 'Maria',
    givenNames: 'Maria Elena',
    surname: 'Rossi',
    rawPhone: '+393331234567',
    phone: '393331234567',
    valid: true,
    reason: '',
    warning: '',
    status: 'sent',
    selected: false,
    customFields: { DATADINASCITA: '01/02/1980' },
  };

  assert.deepEqual(updateDonor(donor, {
    name: 'ELENA',
    surname: "D'ANGELO",
    phone: '123',
    customFields: { DATADINASCITA: '02/03/1981' },
  }), {
    name: 'Elena',
    givenNames: 'Elena',
    surname: "D'Angelo",
    rawPhone: '123',
    phone: '',
    valid: false,
    reason: 'Numero di telefono non valido',
    warning: '',
    status: 'sent',
    selected: false,
    customFields: { DATADINASCITA: '02/03/1981' },
  });
});

test('creates a selected pending donor with all current custom fields', () => {
  assert.deepEqual(createManualDonor({
    name: 'LUCA',
    surname: 'BIANCHI',
    phone: '3331234567',
    customFields: { DATADINASCITA: '04/05/1990' },
  }, ['DATADINASCITA', 'Gruppo']), {
    name: 'Luca',
    givenNames: 'Luca',
    surname: 'Bianchi',
    rawPhone: '3331234567',
    phone: '393331234567',
    valid: true,
    reason: '',
    warning: '',
    status: 'pending',
    selected: true,
    customFields: { DATADINASCITA: '04/05/1990', Gruppo: '' },
  });
});

test('detects and parses CSV files delimited by semicolon', async () => {
  const { directory, filePath } = temporaryCsv(
    'COGNOMEENOME;DATADINASCITA;CELLULARE\nROSSI MARIO;14/02/1990;3331234567\n'
  );

  try {
    const inspection = await inspectFile(filePath);
    assert.equal(inspection.detectedMapping.name, 'COGNOMEENOME');
    assert.equal(inspection.detectedMapping.phone, 'CELLULARE');
    assert.deepEqual(inspection.detectedMapping.customFields, ['DATADINASCITA']);

    const [donor] = await parseWithMapping(filePath, 'CSV', inspection.detectedMapping);
    assert.equal(donor.name, 'Mario');
    assert.equal(donor.surname, 'Rossi');
    assert.equal(donor.phone, '393331234567');
    assert.equal(donor.customFields.DATADINASCITA, '14/02/1990');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('reads Excel dates formatted in Italian dd/mm/yyyy format', async () => {
  const XLSX = require('xlsx');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-excel-test-'));
  const filePath = path.join(directory, 'test.xlsx');

  const ws = {
    '!ref': 'A1:C2',
    'A1': { t: 's', v: 'COGNOMEENOME' },
    'B1': { t: 's', v: 'DATADINASCITA' },
    'C1': { t: 's', v: 'CELLULARE' },
    'A2': { t: 's', v: 'ROSSI MARIO' },
    'B2': { t: 'n', v: 33171, z: XLSX.SSF._table[14] }, // 25 Oct 1990
    'C2': { t: 's', v: '3331234567' }
  };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filePath);

  try {
    const inspection = await inspectFile(filePath);
    assert.equal(inspection.detectedMapping.name, 'COGNOMEENOME');
    assert.deepEqual(inspection.detectedMapping.customFields, ['DATADINASCITA']);

    const [donor] = await parseWithMapping(filePath, 'Sheet1', inspection.detectedMapping);
    assert.equal(donor.customFields.DATADINASCITA, '25/10/1990');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
