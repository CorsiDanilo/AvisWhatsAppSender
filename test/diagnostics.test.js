const test = require('node:test');
const assert = require('node:assert/strict');
const { maskPhone, redactDiagnosticText } = require('../sender/diagnostics');

test('maskPhone conserva solo le ultime quattro cifre', () => {
  assert.equal(maskPhone('+39 333 1234567'), '********4567');
  assert.equal(maskPhone('123'), '***');
  assert.equal(maskPhone(''), '');
});

test('redactDiagnosticText maschera i numeri completi nei messaggi di errore', () => {
  const result = redactDiagnosticText('Invio fallito per 393331234567: numero non valido');

  assert.equal(result, 'Invio fallito per <PHONE>: numero non valido');
});
