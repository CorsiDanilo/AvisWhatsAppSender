const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const { createWhatsAppSessionController } = require('../sender/whatsapp-session');

class FakeClient extends EventEmitter {
  constructor(initialize) {
    super();
    this.initialize = initialize;
    this.destroyed = false;
  }

  async destroy() {
    this.destroyed = true;
  }
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function createHarness({ clients, renderQr = async (value) => `data:${value}`, onPause = () => {} } = {}) {
  const state = { connection: 'disconnected', qrDataUrl: '' };
  const pauses = [];
  const audits = [];
  const logs = [];
  const notifications = [];
  const controller = createWhatsAppSessionController({
    createClient: () => clients.shift(),
    renderQr,
    retryOptions: { attempts: 2, delayMs: 0 },
    setConnection: (connection, qrDataUrl = '') => {
      state.connection = connection;
      state.qrDataUrl = qrDataUrl;
    },
    pauseQueue: (reason) => {
      pauses.push(reason);
      onPause(reason);
    },
    audit: (level, event, details) => audits.push({ level, event, details }),
    log: (message) => logs.push(message),
    notify: (title, body) => notifications.push({ title, body }),
  });
  return { controller, state, pauses, audits, logs, notifications };
}

test('WhatsApp session gestisce QR, autenticazione, ready e disconnessione', async () => {
  const client = new FakeClient(async () => {});
  const harness = createHarness({ clients: [client] });

  await harness.controller.connect();
  client.emit('qr', 'qr-token');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.state.connection, 'qr');
  assert.equal(harness.state.qrDataUrl, 'data:qr-token');
  assert.ok(harness.pauses.includes('qr'));

  client.emit('authenticated');
  assert.equal(harness.state.connection, 'authenticated');
  client.emit('ready');
  assert.equal(harness.state.connection, 'ready');
  assert.equal(harness.controller.isReady(), true);

  client.emit('disconnected', 'LOGOUT');
  assert.equal(harness.state.connection, 'disconnected');
  assert.equal(harness.controller.isReady(), false);
  assert.ok(harness.pauses.includes('disconnected:LOGOUT'));
});

test('WhatsApp session mette in pausa la coda su auth_failure e registra il motivo', async () => {
  const client = new FakeClient(async () => {});
  const harness = createHarness({ clients: [client] });

  await harness.controller.connect();
  client.emit('auth_failure', 'sessione non valida');

  assert.equal(harness.state.connection, 'error');
  assert.ok(harness.pauses.includes('auth-failure'));
  assert.ok(harness.audits.some(({ event }) => event === 'whatsapp.auth_failure'));
});

test('WhatsApp session ritenta un errore di inizializzazione e conserva il client valido', async () => {
  const retryError = new Error('browser non pronto');
  const first = new FakeClient(async () => { throw retryError; });
  const second = new FakeClient(async () => {});
  const harness = createHarness({ clients: [first, second] });

  await harness.controller.connect();

  assert.equal(first.destroyed, true);
  assert.equal(harness.controller.getClient(), second);
  assert.ok(harness.audits.some(({ event }) => event === 'whatsapp.retry'));
});

test('WhatsApp session ignora eventi provenienti da un client ormai obsoleto', async () => {
  const first = new FakeClient(async () => {});
  const second = new FakeClient(async () => {});
  const harness = createHarness({ clients: [first, second] });

  await harness.controller.connect();
  await harness.controller.reconnect();
  assert.equal(harness.controller.getClient(), second);
  first.emit('ready');
  assert.equal(harness.state.connection, 'connecting');
  second.emit('ready');
  assert.equal(harness.state.connection, 'ready');
});

test('WhatsApp session resetta il client e invalida la generazione precedente', async () => {
  const first = new FakeClient(async () => {});
  const harness = createHarness({ clients: [first, new FakeClient(async () => {})] });
  const deleted = [];
  harness.controller.setSessionResetter(async () => { deleted.push(true); });

  await harness.controller.connect();
  await harness.controller.reset();

  assert.equal(first.destroyed, true);
  assert.deepEqual(deleted, [true]);
  assert.equal(harness.controller.isReady(), false);
});

test('WhatsApp session mette in pausa la coda prima di distruggere il client durante il reset', async () => {
  const events = [];
  const client = new FakeClient(async () => {});
  client.destroy = async () => { events.push('destroy'); };
  const harness = createHarness({
    clients: [client],
    onPause: (reason) => {
      if (reason === 'connection:whatsapp.resetting') events.push('pause');
    },
  });

  await harness.controller.connect();
  await harness.controller.reset({ reconnectAfter: false });

  assert.deepEqual(events, ['pause', 'destroy']);
});

test('WhatsApp session non completa una connessione annullata da un reset concorrente', async () => {
  const pending = deferred();
  const first = new FakeClient(() => pending.promise);
  const second = new FakeClient(async () => {});
  const harness = createHarness({ clients: [first, second] });
  const connecting = harness.controller.connect();
  await new Promise((resolve) => setImmediate(resolve));
  await harness.controller.reset();
  pending.resolve();

  await connecting;
  assert.notEqual(harness.state.connection, 'ready');
});
