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

test('createPostSessionManager invia il messaggio alla chat personale del mittente', async () => {
  let sentTo = '';
  let sentText = '';
  const mockClient = {
    info: {
      wid: {
        _serialized: '393331234567@c.us',
      },
    },
    sendMessage: async (to, text) => {
      sentTo = to;
      sentText = text;
    },
  };

  const manager = createPostSessionManager({
    getClient: () => mockClient,
    getState: () => ({ fileName: 'Test.csv' }),
  });

  await manager.sendSelfReport({
    sent: 5,
    failed: 0,
    skipped: 0,
    activeSession: { presetName: 'Test Preset' },
  });

  assert.equal(sentTo, '393331234567@c.us');
  assert.ok(sentText.includes('Inviati con successo: *5*'));
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
