const test = require('node:test');
const assert = require('node:assert/strict');
const { retryAsync } = require('../sender/retry');

test('retryAsync ritenta un errore transitorio e restituisce il risultato', async () => {
  let attempts = 0;
  const retries = [];

  const result = await retryAsync(async (attempt) => {
    attempts += 1;
    if (attempt < 3) throw new Error(`errore ${attempt}`);
    return 'ok';
  }, {
    attempts: 3,
    delayMs: 0,
    onRetry: (error, nextAttempt) => retries.push({ error: error.message, nextAttempt }),
  });

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
  assert.deepEqual(retries, [
    { error: 'errore 1', nextAttempt: 2 },
    { error: 'errore 2', nextAttempt: 3 },
  ]);
});

test('retryAsync rilancia l’ultimo errore dopo il numero massimo di tentativi', async () => {
  let attempts = 0;

  await assert.rejects(
    retryAsync(async () => {
      attempts += 1;
      throw new Error(`errore ${attempts}`);
    }, { attempts: 2, delayMs: 0 }),
    { message: 'errore 2' },
  );
  assert.equal(attempts, 2);
});
