const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');
const { updateDonor } = require('../sender/data');

const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'gui', 'src', 'components', 'recipientEditor.js')).href;

test('recipient editor exposes all imported custom fields in a stable order', async () => {
  const { getCustomFieldKeys } = await import(moduleUrl);
  assert.deepEqual(getCustomFieldKeys([
    { customFields: { DATADINASCITA: '01/01/1980', Gruppo: 'A' } },
    { customFields: { Gruppo: 'B', Note: 'Preferisce SMS' } },
  ]), ['DATADINASCITA', 'Gruppo', 'Note']);
});

test('recipient editor creates editable drafts without mutating the donor', async () => {
  const { createRecipientDraft } = await import(moduleUrl);
  const donor = {
    name: 'Maria',
    surname: 'Rossi',
    rawPhone: '+393331234567',
    customFields: { DATADINASCITA: '01/02/1980' },
  };

  const draft = createRecipientDraft(donor, ['DATADINASCITA', 'Gruppo']);

  assert.deepEqual(draft, {
    name: 'Maria',
    givenNames: 'Maria',
    surname: 'Rossi',
    phone: '+393331234567',
    customFields: { DATADINASCITA: '01/02/1980', Gruppo: '' },
  });
  assert.equal(donor.customFields.Gruppo, undefined);
});

test('recipient editor creates an empty manual draft with selected fields', async () => {
  const { createEmptyRecipientDraft } = await import(moduleUrl);
  assert.deepEqual(createEmptyRecipientDraft(['DATADINASCITA']), {
    name: '',
    givenNames: '',
    surname: '',
    phone: '',
    customFields: { DATADINASCITA: '' },
  });
});

test('saving an unchanged editor draft preserves all given names', async () => {
  const { createRecipientDraft } = await import(moduleUrl);
  const donor = {
    name: 'Maria',
    givenNames: 'Maria Elena',
    surname: 'Rossi',
    rawPhone: '+393331234567',
    customFields: {},
  };

  const updated = updateDonor(donor, createRecipientDraft(donor));

  assert.equal(updated.name, 'Maria');
  assert.equal(updated.givenNames, 'Maria Elena');
});
