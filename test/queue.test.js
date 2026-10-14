const test = require('node:test');
const assert = require('node:assert/strict');
const { SendQueue } = require('../sender/queue');

test('SendQueue mette in pausa e conserva come unknown un timeout di consegna', async () => {
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
      if (calls > 1) return;
      const error = new Error('Esito non confermato');
      error.code = 'SEND_TIMEOUT';
      throw error;
    },
    minDelayMs: 0,
    maxDelayMs: 0,
    pauseAfter: 0,
  });
  queue.on('log', (message) => logs.push(message));

  const run = queue.start();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(queue.state, 'paused');
  assert.equal(queue.pauseReason, 'send-uncertain');
  assert.equal(donors[0].status, 'unknown');
  assert.equal(donors[1].status, 'pending');
  assert.equal(calls, 1);

  queue.pause('connection:whatsapp.reconnecting');
  assert.equal(queue.pauseReason, 'send-uncertain');

  queue.resume();
  await run;

  assert.equal(donors[1].status, 'sent');
  assert.equal(calls, 2);
  assert.ok(logs.every((message) => !message.includes('Uno') && !message.includes('Due')));
});

test('SendQueue tratta come unknown anche un errore di invio avvenuto durante la disconnessione', async () => {
  const donor = { name: 'Uno', phone: '1', valid: true, status: 'pending' };
  const queue = new SendQueue({
    items: [donor],
    render: () => 'messaggio',
    send: async () => {
      const error = new Error('Connessione chiusa');
      error.code = 'SEND_UNCERTAIN';
      throw error;
    },
    minDelayMs: 0,
    maxDelayMs: 0,
    pauseAfter: 0,
  });

  const run = queue.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(donor.status, 'unknown');
  assert.equal(queue.pauseReason, 'send-uncertain');
  queue.resume();
  await run;
});

test('SendQueue tratta come unknown una conferma mancante', async () => {
  const donor = { name: 'Uno', phone: '1', valid: true, status: 'pending' };
  const queue = new SendQueue({
    items: [donor],
    render: () => 'messaggio',
    send: async () => {
      const error = new Error('WhatsApp non ha confermato l’invio del messaggio.');
      error.code = 'SEND_NOT_CONFIRMED';
      throw error;
    },
    minDelayMs: 0,
    maxDelayMs: 0,
    pauseAfter: 0,
  });

  const run = queue.start();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(donor.status, 'unknown');
  assert.equal(queue.pauseReason, 'send-uncertain');
  queue.resume();
  await run;
});
