const assert = require('node:assert/strict');
const test = require('node:test');
const { buildSelfReportMessage, createPostSessionManager } = require('../sender/post-session');

test('buildSelfReportMessage formatta correttamente l’esito dell’invio', () => {
  const msg = buildSelfReportMessage({
    sent: 10,
    failed: 1,
    skipped: 2,
    fileName: 'Donatori.xlsx',
    presetName: 'Sollecito',
    date: new Date('2026-10-12T15:00:00Z'),
    postSessionAction: 'shutdown',
  });

  assert.ok(msg.includes('AVIS WhatsApp Sender — Esito Invio'));
  assert.ok(msg.includes('File: Donatori.xlsx'));
  assert.ok(msg.includes('Modello: Sollecito'));
  assert.ok(msg.includes('Inviati a WhatsApp: *10*'));
  assert.ok(msg.includes('Falliti: *1*'));
  assert.ok(msg.includes('Saltati (non validi): *2*'));
  assert.ok(msg.includes('Spegnimento del PC programmato'));
});

test('createPostSessionManager invia il messaggio ai numeri destinatari configurati con label', async () => {
  const sentMessages = [];
  const mockClient = {
    sendMessage: async (to, text) => {
      sentMessages.push({ to, text });
      return { id: 'report-message' };
    },
  };

  const manager = createPostSessionManager({
    getClient: () => mockClient,
    getState: () => ({ fileName: 'Test.csv', connection: 'ready' }),
  });

  await manager.sendSessionReports({
    sent: 5,
    failed: 0,
    skipped: 0,
    activeSession: {
      presetName: 'Test Preset',
      reportRecipients: [
        { id: '1', label: 'Presidente', phone: '393331234567', enabled: true },
        { id: '2', label: 'Segreteria', phone: '393409876543', enabled: true },
        { id: '3', label: 'Escluso', phone: '393281112233', enabled: false },
      ],
    },
  });

  assert.equal(sentMessages.length, 2);
  assert.equal(sentMessages[0].to, '393331234567@c.us');
  assert.equal(sentMessages[1].to, '393409876543@c.us');
  assert.ok(sentMessages[0].text.includes('Inviati a WhatsApp: *5*'));
});

test('createPostSessionManager invia il report via e-mail senza richiedere le notifiche di emergenza', async () => {
  const delivered = [];
  const manager = createPostSessionManager({
    getState: () => ({ fileName: 'Test.csv', connection: 'disconnected' }),
    emailNotifier: {
      sendReport: async (message) => delivered.push(message),
    },
  });

  await manager.sendSessionReports({
    sent: 5,
    failed: 1,
    skipped: 0,
    activeSession: {
      presetName: 'Test Preset',
      reportDeliveryMode: 'email',
      reportEmailRecipients: [{ label: 'Segreteria', email: 'segreteria@avis.it', enabled: true }],
    },
  });

  assert.equal(delivered.length, 1);
  assert.deepEqual(delivered[0].recipients, ['segreteria@avis.it']);
  assert.match(delivered[0].text, /Inviati a WhatsApp: \*5\*/);
});

test('createPostSessionManager inoltra gli allegati degli esiti al report e-mail', async () => {
  const delivered = [];
  const manager = createPostSessionManager({
    getState: () => ({ fileName: 'Test.csv', connection: 'disconnected' }),
    emailNotifier: { sendReport: async (message) => delivered.push(message) },
  });

  await manager.sendSessionReports({
    sent: 5,
    failed: 1,
    skipped: 0,
    outcomeAttachments: [{ filename: 'esito_falliti.csv', path: 'C:\\esiti\\esito_falliti.csv' }],
    activeSession: {
      reportDeliveryMode: 'email',
      reportEmailRecipients: [{ email: 'segreteria@avis.it', enabled: true }],
    },
  });

  assert.deepEqual(delivered[0].attachments, [{ filename: 'esito_falliti.csv', path: 'C:\\esiti\\esito_falliti.csv' }]);
});

test('createPostSessionManager invia l’esito di un’interruzione ai destinatari e-mail di emergenza', async () => {
  const delivered = [];
  const manager = createPostSessionManager({
    getState: () => ({ fileName: 'Test.csv' }),
    emailNotifier: { sendReport: async (message) => delivered.push(message) },
  });

  await manager.sendInterruptionReport({
    sent: 5,
    failed: 1,
    skipped: 0,
    activeSession: {
      presetName: 'Test Preset',
      emergencyEmailRecipients: [{ email: 'emergenze@avis.it', enabled: true }],
    },
    outcomeAttachments: [{ filename: 'esito_falliti.csv', path: 'C:\\esiti\\esito_falliti.csv' }],
  });

  assert.deepEqual(delivered[0].recipients, ['emergenze@avis.it']);
  assert.match(delivered[0].subject, /Invio interrotto/i);
  assert.match(delivered[0].text, /Invio interrotto/i);
  assert.deepEqual(delivered[0].attachments, [{ filename: 'esito_falliti.csv', path: 'C:\\esiti\\esito_falliti.csv' }]);
});

test('createPostSessionManager invia l’interruzione anche con il vecchio flag disattivato', async () => {
  const delivered = [];
  const manager = createPostSessionManager({
    getState: () => ({
      fileName: 'Test.csv',
      settings: { emailNotificationsEnabled: false },
    }),
    emailNotifier: { sendReport: async (message) => delivered.push(message) },
  });

  const result = await manager.sendInterruptionReport({
    sent: 5,
    failed: 1,
    skipped: 0,
    activeSession: {
      presetName: 'Test Preset',
      emergencyEmailRecipients: [{ email: 'emergenze@avis.it', enabled: true }],
    },
  });

  assert.equal(result, true);
  assert.equal(delivered.length, 1);
});

test('createPostSessionManager continua con il report e-mail se WhatsApp non riesce', async () => {
  const delivered = [];
  const manager = createPostSessionManager({
    getClient: () => ({ sendMessage: async () => { throw new Error('WhatsApp non disponibile'); } }),
    getState: () => ({ connection: 'ready' }),
    emailNotifier: { sendReport: async (message) => delivered.push(message) },
  });

  await manager.sendSessionReports({
    sent: 1,
    failed: 0,
    skipped: 0,
    activeSession: {
      reportDeliveryMode: 'both',
      reportRecipients: [{ label: 'Presidente', phone: '393331234567', enabled: true }],
      reportEmailRecipients: [{ label: 'Segreteria', email: 'segreteria@avis.it', enabled: true }],
    },
  });

  assert.equal(delivered.length, 1);
  assert.deepEqual(delivered[0].recipients, ['segreteria@avis.it']);
});

test('createPostSessionManager non conferma il riepilogo quando WhatsApp non restituisce un messaggio', async () => {
  const logs = [];
  const errors = [];
  const manager = createPostSessionManager({
    getClient: () => ({ sendMessage: async () => undefined }),
    getState: () => ({ connection: 'ready' }),
    log: (message) => logs.push(message),
    logError: (event) => errors.push(event),
  });

  await manager.sendSessionReports({
    sent: 1,
    failed: 0,
    skipped: 0,
    activeSession: { reportRecipients: [{ phone: '393331234567', enabled: true }] },
  });

  assert.deepEqual(errors, ['post_session.report_failed']);
  assert.ok(!logs.some((message) => message.startsWith('Riepilogo inviato')));
});

test('createPostSessionManager non tenta il riepilogo quando WhatsApp non è pronto', async () => {
  let sendCalls = 0;
  const events = [];
  const manager = createPostSessionManager({
    getClient: () => ({ sendMessage: async () => { sendCalls += 1; } }),
    getState: () => ({ connection: 'disconnected' }),
    audit: (_level, event) => events.push(event),
  });

  await manager.sendSessionReports({
    sent: 1,
    failed: 0,
    skipped: 0,
    activeSession: { reportRecipients: [{ phone: '393331234567', enabled: true }] },
  });

  assert.equal(sendCalls, 0);
  assert.ok(events.includes('post_session.report_skipped_not_ready'));
});

test('createPostSessionManager marca come incerto un timeout del riepilogo', async () => {
  const events = [];
  const errors = [];
  const manager = createPostSessionManager({
    getClient: () => ({ sendMessage: async () => new Promise(() => {}) }),
    getState: () => ({ connection: 'ready' }),
    reportSendTimeoutMs: 5,
    audit: (_level, event) => events.push(event),
    logError: (event) => errors.push(event),
  });

  const result = await Promise.race([
    manager.sendSessionReports({
      sent: 1,
      failed: 0,
      skipped: 0,
      activeSession: { reportRecipients: [{ phone: '393331234567', enabled: true }] },
    }).then(() => 'completed'),
    new Promise((resolve) => setTimeout(() => resolve('hung'), 50)),
  ]);

  assert.equal(result, 'completed');
  assert.ok(events.includes('post_session.report_uncertain'));
  assert.ok(errors.includes('post_session.report_failed'));
});

test('createPostSessionManager pianifica e consente di annullare l’azione programmata', () => {
  const state = { postSessionCountdown: null };
  let cancelledCmd = '';

  const manager = createPostSessionManager({
    getState: () => state,
    countdownSeconds: 10,
    execCommand: (cmd) => { cancelledCmd = cmd; },
  });

  manager.scheduleAction('shutdown');
  assert.deepEqual(state.postSessionCountdown, { action: 'shutdown', secondsLeft: 10 });

  const cancelled = manager.cancelAction();
  assert.equal(cancelled, true);
  assert.equal(state.postSessionCountdown, null);
});
