const test = require('node:test');
const assert = require('node:assert/strict');
const { SendQueue } = require('../sender/queue');

test('SendQueue non mette in pausa sui timeout e marca il destinatario come failed continuando l’invio', async () => {
  const donors = [
    { name: 'Uno', phone: '1', valid: true, status: 'pending' },
    { name: 'Due', phone: '2', valid: true, status: 'pending' },
  ];
  let calls = 0;
  const logs = [];
  const queue = new SendQueue({
    items: donors,
    render: (donor) => donor.name,
    send: async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error('Timeout di consegna');
        error.code = 'SEND_TIMEOUT';
        throw error;
      }
    },
    minDelayMs: 0,
    maxDelayMs: 0,
    pauseAfter: 0,
  });
  queue.on('log', (message) => logs.push(message));

  await queue.start();

  assert.equal(queue.state, 'completed');
  assert.equal(donors[0].status, 'failed');
  assert.equal(donors[0].error, 'Timeout di consegna');
  assert.equal(donors[1].status, 'sent');
  assert.equal(calls, 2);
  assert.ok(logs.some((msg) => msg.includes('Invio non riuscito')));
  assert.ok(logs.some((msg) => msg.includes('Messaggio inviato a WhatsApp per il destinatario 2/2')));
});

test('SendQueue marca come failed qualsiasi errore di invio o conferma mancante e completa la sessione', async () => {
  const donors = [
    { name: 'Uno', phone: '1', valid: true, status: 'pending' },
    { name: 'Due', phone: '2', valid: true, status: 'pending' },
  ];
  const queue = new SendQueue({
    items: donors,
    render: () => 'messaggio',
    send: async (donor) => {
      if (donor.name === 'Uno') {
        const error = new Error('WhatsApp non ha confermato l’invio del messaggio.');
        error.code = 'SEND_NOT_CONFIRMED';
        throw error;
      }
    },
    minDelayMs: 0,
    maxDelayMs: 0,
    pauseAfter: 0,
  });

  await queue.start();

  assert.equal(queue.state, 'completed');
  assert.equal(donors[0].status, 'failed');
  assert.equal(donors[1].status, 'sent');
});

test('SendQueue consente la pausa e la ripresa manuale dell’operatore', async () => {
  const donors = [
    { name: 'Uno', phone: '1', valid: true, status: 'pending' },
    { name: 'Due', phone: '2', valid: true, status: 'pending' },
  ];
  let calls = 0;
  const queue = new SendQueue({
    items: donors,
    render: () => 'messaggio',
    send: async () => {
      calls += 1;
      if (calls === 1) {
        queue.pause('operator');
      }
    },
    minDelayMs: 0,
    maxDelayMs: 0,
    pauseAfter: 0,
  });

  const run = queue.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(queue.state, 'paused');
  assert.equal(queue.pauseReason, 'operator');
  assert.equal(calls, 1);

  queue.resume();
  await run;
  assert.equal(queue.state, 'completed');
  assert.equal(calls, 2);
  assert.equal(donors[0].status, 'sent');
  assert.equal(donors[1].status, 'sent');
});

test('SendQueue salta i destinatari non validi marcandoli come skipped e completa la coda', async () => {
  const donors = [
    { name: 'Invalido', phone: 'abc', valid: false, status: 'pending' },
    { name: 'Valido', phone: '393331112233', valid: true, status: 'pending' },
  ];
  let calls = 0;
  const queue = new SendQueue({
    items: donors,
    render: (donor) => donor.name,
    send: async () => {
      calls += 1;
    },
    minDelayMs: 0,
    maxDelayMs: 0,
    pauseAfter: 0,
  });

  await queue.start();
  assert.equal(queue.state, 'completed');
  assert.equal(donors[0].status, 'skipped');
  assert.equal(donors[1].status, 'sent');
  assert.equal(calls, 1);
});
