const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const moduleUrl = pathToFileURL(path.join(__dirname, '../gui/src/components/importMapping.mjs')).href;

test('preselects the AVIS name, phone and optional birth-date columns', async () => {
  const { getInitialImportMapping } = await import(moduleUrl);

  assert.deepEqual(
    getInitialImportMapping(['COGNOMEENOME', 'DATADINASCITA', 'CELLULARE', 'Gruppo']),
    {
      name: 'COGNOMEENOME',
      surname: '',
      phone: 'CELLULARE',
      nameAndSurnameInOneColumn: true,
      splitStrategy: 'lastWordIsName',
      selectedColumns: ['COGNOMEENOME', 'DATADINASCITA', 'CELLULARE'],
    }
  );
});

test('falls back to the backend mapping when the default AVIS columns are missing', async () => {
  const { getInitialImportMapping } = await import(moduleUrl);

  assert.deepEqual(
    getInitialImportMapping(['Nominativo', 'Telefono', 'Data di nascita'], {
      name: 'Nominativo',
      surname: '',
      phone: 'Telefono',
      nameAndSurnameInOneColumn: true,
      customFields: ['Data di nascita'],
    }),
    {
      name: 'Nominativo',
      surname: '',
      phone: 'Telefono',
      nameAndSurnameInOneColumn: true,
      splitStrategy: 'lastWordIsName',
      selectedColumns: ['Nominativo', 'Data di nascita', 'Telefono'],
    }
  );
});
