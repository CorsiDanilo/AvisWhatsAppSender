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

test('formatRemainingTime: edge cases zero and negative', async () => {
  const { formatRemainingTime } = await import(moduleUrl);

  assert.equal(formatRemainingTime(0), 'Quasi terminato…');
  assert.equal(formatRemainingTime(-10), 'Quasi terminato…');
});

test('formatRemainingTime: less than one minute', async () => {
  const { formatRemainingTime } = await import(moduleUrl);

  assert.equal(formatRemainingTime(1), 'Meno di un minuto');
  assert.equal(formatRemainingTime(59), 'Meno di un minuto');
});

test('formatRemainingTime: minutes range', async () => {
  const { formatRemainingTime } = await import(moduleUrl);

  assert.equal(formatRemainingTime(60), '~ 1 minuto');
  assert.equal(formatRemainingTime(90), '~ 2 minuti');
  assert.equal(formatRemainingTime(3540), '~ 59 minuti');
});

test('formatRemainingTime: hours range', async () => {
  const { formatRemainingTime } = await import(moduleUrl);

  assert.equal(formatRemainingTime(3600), '~ 1 ora');
  assert.equal(formatRemainingTime(3660), '~ 1 ora e 1 minuto');
  assert.equal(formatRemainingTime(7800), '~ 2 ore e 10 minuti');
  assert.equal(formatRemainingTime(28800), '~ 8 ore');
});
