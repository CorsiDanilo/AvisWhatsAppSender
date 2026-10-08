const test = require('node:test');
const assert = require('node:assert/strict');
const {
  summarizePageSnapshot,
  truncateDiagnosticText,
} = require('../sender/whatsappDiagnostics');

test('truncateDiagnosticText limita i messaggi tecnici nei log', () => {
  assert.equal(truncateDiagnosticText('abcdef', 4), 'abc…');
  assert.equal(truncateDiagnosticText(null), '');
});

test('summarizePageSnapshot conserva solo lo stato utile della pagina', () => {
  assert.deepEqual(
    summarizePageSnapshot({
      url: 'https://web.whatsapp.com/',
      title: 'WhatsApp',
      readyState: 'loading',
      debugVersion: '',
      online: true,
      ignored: 'non registrato',
    }),
    {
      url: 'https://web.whatsapp.com/',
      title: 'WhatsApp',
      readyState: 'loading',
      debugVersion: '',
      online: true,
    },
  );
});
