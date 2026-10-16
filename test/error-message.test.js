const test = require('node:test');
const assert = require('node:assert/strict');

test('toUserError traduce il timeout WhatsApp in un messaggio semplice', async () => {
  const { toUserError } = await import('../gui/src/errorMessage.js');
  assert.equal(
    toUserError(new Error('auth timeout')),
    'WhatsApp non ha risposto in tempo. Riprova a generare il QR code.',
  );
});

test('toUserError non confonde un rifiuto SMTP Gmail con WhatsApp', async () => {
  const { toUserError } = await import('../gui/src/errorMessage.js');
  const message = toUserError(new Error('Invalid login: 534 5.7.9 Application-specific password required'));
  assert.match(message, /Gmail|e-mail|password per app/i);
  assert.doesNotMatch(message, /WhatsApp non ha risposto/i);
});

test('toUserError riconosce il timeout di Puppeteer durante il caricamento WhatsApp Web', async () => {
  const { toUserError } = await import('../gui/src/errorMessage.js');
  assert.equal(
    toUserError(new Error('Waiting failed: 30000ms exceeded')),
    'WhatsApp non ha risposto in tempo. Riprova a generare il QR code.',
  );
});

test('toUserError traduce gli errori di importazione e aggiornamento', async () => {
  const { toUserError } = await import('../gui/src/errorMessage.js');
  assert.match(toUserError(new Error('ENOENT: file not found'), 'import'), /Impossibile leggere il file/);
  assert.match(toUserError(new Error('ERR_UPDATER_NETWORK'), 'update'), /aggiornamento/);
});

test('toUserError conserva i messaggi italiani già pronti per l’utente', async () => {
  const { toUserError } = await import('../gui/src/errorMessage.js');
  assert.equal(toUserError('Impossibile salvare il destinatario.'), 'Impossibile salvare il destinatario.');
});
