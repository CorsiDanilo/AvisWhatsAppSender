const test = require('node:test');
const assert = require('node:assert/strict');

const { SendQueue } = require('../sender/queue');

function item(name, valid = true) {
  return { name, surname: '', phone: valid ? `3933312345${name.length}` : '', valid, status: 'pending' };
}

test('sends valid items in order and skips invalid items', async () => {
  const sent = [];
  const queue = new SendQueue({
    items: [item('Uno'), item('NoPhone', false), item('Due')],
    render: (donor) => `Ciao ${donor.name}`,
    send: async (donor, text) => sent.push([donor.name, text]),
    sleep: async () => {},
    minDelayMs: 0,
    maxDelayMs: 0,
  });

  await queue.start();

  assert.deepEqual(sent, [
    ['Uno', 'Ciao Uno'],
    ['Due', 'Ciao Due'],
  ]);
  assert.equal(queue.state, 'completed');
  assert.equal(queue.items[1].status, 'skipped');
});

test('pauses before the next item and resumes on command', async () => {
  const sent = [];
  let queue;
  queue = new SendQueue({
    items: [item('Uno'), item('Due')],
    render: (donor) => donor.name,
    send: async (donor) => {
      sent.push(donor.name);
      if (donor.name === 'Uno') queue.pause();
    },
    sleep: async () => {},
    minDelayMs: 0,
    maxDelayMs: 0,
  });

  const running = queue.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(sent, ['Uno']);
  assert.equal(queue.state, 'paused');

  queue.resume();
  await running;
  assert.deepEqual(sent, ['Uno', 'Due']);
});

test('stop prevents subsequent sends', async () => {
  const sent = [];
  let queue;
  queue = new SendQueue({
    items: [item('Uno'), item('Due')],
    render: (donor) => donor.name,
    send: async (donor) => {
      sent.push(donor.name);
      queue.stop();
    },
    sleep: async () => {},
    minDelayMs: 0,
    maxDelayMs: 0,
  });

  await queue.start();

  assert.deepEqual(sent, ['Uno']);
  assert.equal(queue.state, 'stopped');
});

test('does not resend items already marked as sent', async () => {
  const sent = [];
  const alreadySent = item('GiaInviato');
  alreadySent.status = 'sent';
  const queue = new SendQueue({
    items: [alreadySent, item('InAttesa')],
    render: (donor) => donor.name,
    send: async (donor) => sent.push(donor.name),
    sleep: async () => {},
    minDelayMs: 0,
    maxDelayMs: 0,
  });

  await queue.start();

  assert.deepEqual(sent, ['InAttesa']);
});
