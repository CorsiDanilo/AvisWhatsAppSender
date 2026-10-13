const assert = require('node:assert/strict');
const test = require('node:test');
const { buildWhatsAppSendOptions } = require('../sender/whatsapp-send-options');

test('buildWhatsAppSendOptions aspetta la conferma del server e non invia sendSeen', () => {
  assert.deepEqual(
    buildWhatsAppSendOptions({ caption: 'Test' }),
    { caption: 'Test', waitUntilMsgSent: true, sendSeen: false },
  );
});
