const assert = require('node:assert/strict');
const test = require('node:test');
const { createEmailNotifier } = require('../sender/email-notifier');

function createHarness(overrides = {}) {
  const sent = [];
  const notifier = createEmailNotifier({
    createTransport: () => ({ sendMail: async (message) => { sent.push(message); return { messageId: 'id' }; } }),
    getConfig: () => ({
      emailNotificationsEnabled: true,
      gmailAddress: 'avis@example.com',
      emailRecipients: [
        { label: 'Presidente', email: 'presidente@example.com', enabled: true },
        { label: 'Disattivato', email: 'off@example.com', enabled: false },
      ],
    }),
    getPassword: () => 'app-password',
    ...overrides,
  });
  return { notifier, sent };
}

test('invia un avviso di emergenza compatto solo ai destinatari attivi', async () => {
  const { notifier, sent } = createHarness();

  await notifier.sendEmergency({
    reason: 'disconnected:LOGOUT',
    summary: { sent: 171, failed: 9, total: 206 },
    shutdownInSeconds: 60,
    attachments: [
      { filename: 'esito_falliti.csv', path: 'C:\\esiti\\esito_falliti.csv' },
      { filename: 'esito.csv', path: 'C:\\esiti\\esito.csv' },
    ],
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].from, 'avis@example.com');
  assert.deepEqual(sent[0].to, ['presidente@example.com']);
  assert.match(sent[0].subject, /Emergenza/i);
  assert.match(sent[0].text, /171/);
  assert.deepEqual(sent[0].attachments, [
    { filename: 'esito_falliti.csv', path: 'C:\\esiti\\esito_falliti.csv' },
    { filename: 'esito.csv', path: 'C:\\esiti\\esito.csv' },
  ]);
});

test('propaga l’errore SMTP senza nasconderlo al fail-safe', async () => {
  const { notifier } = createHarness({
    createTransport: () => ({ sendMail: async () => { throw new Error('SMTP non raggiungibile'); } }),
  });

  await assert.rejects(
    notifier.sendEmergency({ reason: 'auth-failure', summary: {}, shutdownInSeconds: 300 }),
    /SMTP non raggiungibile/,
  );
});

test('invia il log allo sviluppatore soltanto su richiesta esplicita', async () => {
  const { notifier, sent } = createHarness();

  await notifier.sendDeveloperLog({
    to: 'sviluppatore@example.com',
    subject: 'Log AVIS',
    text: 'Dettagli',
    attachmentName: 'log.txt',
    attachmentContent: 'riga di log',
  });

  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ['sviluppatore@example.com']);
  assert.deepEqual(sent[0].attachments, [{ filename: 'log.txt', content: 'riga di log' }]);
});

test('invia il report e-mail anche quando le notifiche di emergenza sono disattivate', async () => {
  const { notifier, sent } = createHarness({
    getConfig: () => ({
      emailNotificationsEnabled: false,
      gmailAddress: 'avis@example.com',
    }),
  });

  await notifier.sendReport({
    recipients: ['segreteria@example.com'],
    text: 'Esito invio: 5 messaggi inviati.',
  });

  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, ['segreteria@example.com']);
  assert.match(sent[0].subject, /Esito invio/i);
  assert.equal(sent[0].text, 'Esito invio: 5 messaggi inviati.');
});

test('allega gli esiti CSV anche al report e-mail finale', async () => {
  const { notifier, sent } = createHarness();

  await notifier.sendReport({
    recipients: ['segreteria@example.com'],
    text: 'Esito invio',
    attachments: [{ filename: 'esito.csv', path: 'C:\\esiti\\esito.csv' }],
  });

  assert.deepEqual(sent[0].attachments, [{ filename: 'esito.csv', path: 'C:\\esiti\\esito.csv' }]);
});

test('usa sempre SMTP Gmail con SSL', async () => {
  let transportOptions;
  const notifier = createEmailNotifier({
    createTransport: (options) => {
      transportOptions = options;
      return { sendMail: async () => ({ messageId: 'gmail-test' }) };
    },
    getConfig: () => ({
      emailNotificationsEnabled: true,
      emailProvider: 'gmail',
      gmailAddress: 'avis@example.com',
      emailRecipients: [{ email: 'operatore@example.com', enabled: true }],
    }),
    getPassword: () => 'gmail-app-password',
  });

  await notifier.sendEmergency({ reason: 'test', shutdownInSeconds: 300 });
  assert.deepEqual(transportOptions, {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: 'avis@example.com', pass: 'gmail-app-password' },
  });
});
