const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('configura un timeout di autenticazione WhatsApp di 60 secondi', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
  assert.match(source, /authTimeoutMs:\s*60000/);
});
