const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeEmailRecipients, normalizeEmailSettings } = require('../sender/email-settings');

test('normalizza destinatari e-mail validi con etichetta e stato', () => {
  assert.deepEqual(normalizeEmailRecipients([
    { label: 'Presidente', email: ' presidente@avis.it ', enabled: true },
    { label: '', email: 'segreteria@avis.it' },
    { label: 'Scartato', email: 'non-valido' },
  ]), [
    { id: 'email_0', label: 'Presidente', email: 'presidente@avis.it', enabled: true },
    { id: 'email_1', label: 'Destinatario', email: 'segreteria@avis.it', enabled: true },
  ]);
});

test('fornisce impostazioni e-mail Gmail disabilitate e non include segreti', () => {
  const settings = normalizeEmailSettings({
    emailNotificationsEnabled: true,
    gmailAddress: ' avissede@gmail.com ',
    emailRecipients: [{ label: 'Operatore', email: 'operatore@avis.it' }],
    gmailAppPassword: 'non-deve-essere-conservata',
  });

  assert.deepEqual(settings, {
    emailNotificationsEnabled: true,
    emailProvider: 'gmail',
    gmailAddress: 'avissede@gmail.com',
    emailAddresses: { gmail: 'avissede@gmail.com' },
    emailRecipients: [{ id: 'email_0', label: 'Operatore', email: 'operatore@avis.it', enabled: true }],
  });
});

test('migra una vecchia configurazione Outlook a Gmail senza riutilizzare l indirizzo Outlook', () => {
  const settings = normalizeEmailSettings({
    emailProvider: 'outlook',
    gmailAddress: 'danilo.corsi@outlook.it',
    emailAddresses: { gmail: '', outlook: 'danilo.corsi@outlook.it' },
  });

  assert.equal(settings.emailProvider, 'gmail');
  assert.equal(settings.gmailAddress, '');
  assert.deepEqual(settings.emailAddresses, { gmail: '' });
});
