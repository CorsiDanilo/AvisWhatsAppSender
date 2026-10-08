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

test('splits a full name at the last word and exposes the first given name', () => {
  assert.deepEqual(splitFullName('  MARIA   ELENA   ROSSI '), {
    name: 'Maria',
    givenNames: 'Maria Elena',
    surname: 'Rossi',
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
    'NOMEECOGNOME,DATADINASCITA,CELLULARE\nMARIA ELENA ROSSI,01/02/1980,+393331234567\n'
  );

  try {
    const inspection = await inspectFile(filePath);
    assert.equal(inspection.detectedMapping.name, 'NOMEECOGNOME');
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
    assert.equal(fs.readFileSync(filePath, 'utf8'), 'NOMEECOGNOME,DATADINASCITA,CELLULARE\nMARIA ELENA ROSSI,01/02/1980,+393331234567\n');
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
