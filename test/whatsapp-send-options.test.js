const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildWhatsAppSendOptions,
  ensureWhatsAppSendResult,
} = require('../sender/whatsapp-send-options');

test('buildWhatsAppSendOptions aspetta la conferma del server e non invia sendSeen', () => {
  assert.deepEqual(
    buildWhatsAppSendOptions({ caption: 'Test' }),
    { caption: 'Test', waitUntilMsgSent: true, sendSeen: false },
  );
});

test('ensureWhatsAppSendResult rifiuta un invio senza conferma', () => {
  assert.throws(
    () => ensureWhatsAppSendResult(undefined),
    (error) => error.code === 'SEND_NOT_CONFIRMED',
  );
});
