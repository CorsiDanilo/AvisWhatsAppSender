const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('whatsapp-web.js strips the media internal id before sending', () => {
  const source = fs.readFileSync('node_modules/whatsapp-web.js/src/util/Injected/Utils.js', 'utf8');
  assert.match(source, /delete message\.__x_id/);
});
