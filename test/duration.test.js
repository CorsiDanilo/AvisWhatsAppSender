const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const moduleUrl = pathToFileURL(path.join(__dirname, '../gui/src/components/duration.mjs')).href;

test('formats estimates shorter than one hour in minutes', async () => {
  const { formatEstimatedDuration } = await import(moduleUrl);

  assert.equal(formatEstimatedDuration(59), '59 minuti');
});

test('formats whole hours and hours with remaining minutes', async () => {
  const { formatEstimatedDuration } = await import(moduleUrl);

  assert.equal(formatEstimatedDuration(60), '1 ora');
  assert.equal(formatEstimatedDuration(61), '1 ora e 1 minuto');
  assert.equal(formatEstimatedDuration(472), '7 ore e 52 minuti');
});
