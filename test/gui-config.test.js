const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('Vite uses relative asset paths for Electron loadFile', () => {
  const config = fs.readFileSync('gui/vite.config.js', 'utf8');
  assert.match(config, /base:\s*['"]\.\/['"]/);
});
