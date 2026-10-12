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
  assert.ok(msg.includes('Inviati con successo: *10*'));
  assert.ok(msg.includes('Falliti: *1*'));
  assert.ok(msg.includes('Saltati (non validi): *2*'));
  assert.ok(msg.includes('Spegnimento del PC programmato'));
});

test('createPostSessionManager invia il messaggio ai numeri destinatari configurati con label', async () => {
  const sentMessages = [];
  const mockClient = {
    sendMessage: async (to, text) => {
      sentMessages.push({ to, text });
    },
  };

  const manager = createPostSessionManager({
    getClient: () => mockClient,
    getState: () => ({ fileName: 'Test.csv' }),
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
  assert.ok(sentMessages[0].text.includes('Inviati con successo: *5*'));
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
