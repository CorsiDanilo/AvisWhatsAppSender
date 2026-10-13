const test = require('node:test');
const assert = require('node:assert/strict');
const { SendTimeoutError, withTimeout } = require('../sender/send-timeout');

test('withTimeout segnala un timeout di consegna senza confonderlo con un errore generico', async () => {
  await assert.rejects(
    withTimeout(() => new Promise(() => {}), 5, 'sendMessage'),
    (error) => error instanceof SendTimeoutError
      && error.code === 'SEND_TIMEOUT'
      && error.operation === 'sendMessage',
  );
});

test('withTimeout osserva il completamento tardivo dell’operazione', async () => {
  let resolveOperation;
  const late = new Promise((resolve) => { resolveOperation = resolve; });
  const lateResults = [];

  await assert.rejects(
    withTimeout(() => late, 5, 'sendMessage', {
      onLateResolve: (value) => lateResults.push(value),
    }),
    SendTimeoutError,
  );

  resolveOperation('sent-late');
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(lateResults, ['sent-late']);
});
