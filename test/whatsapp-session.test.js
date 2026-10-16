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

function createHarness({ clients, renderQr = async (value) => `data:${value}`, onPause = () => {}, onConnectionLost = async () => {} } = {}) {
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
    onConnectionLost,
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
  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.notifications[0].title, 'QR pronto');

  // Il QR iniziale resta visibile finché l'operatore non richiede una rigenerazione.
  client.emit('qr', 'qr-token-2');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.state.qrDataUrl, 'data:qr-token');
  assert.equal(harness.notifications.length, 1);

  client.emit('authenticated');
  assert.equal(harness.state.connection, 'authenticated');
  client.emit('ready');
  assert.equal(harness.state.connection, 'ready');
  assert.equal(harness.controller.isReady(), true);

  client.emit('disconnected', 'LOGOUT');
  assert.equal(harness.state.connection, 'disconnected');
  assert.equal(harness.controller.isReady(), false);
  assert.ok(harness.pauses.includes('disconnected:LOGOUT'));
  const disconnectNotifs = harness.notifications.filter((n) => n.title === 'WhatsApp disconnesso');
  assert.equal(disconnectNotifs.length, 1);

  // Disconnessioni ripetute immediate non generano notifiche duplicate
  client.emit('disconnected', 'LOGOUT');
  const disconnectNotifs2 = harness.notifications.filter((n) => n.title === 'WhatsApp disconnesso');
  assert.equal(disconnectNotifs2.length, 1);
});

test('WhatsApp session segnala una disconnessione al fail-safe senza alterare la pausa esistente', async () => {
  const client = new FakeClient(async () => {});
  const losses = [];
  const harness = createHarness({
    clients: [client],
    onConnectionLost: async (reason) => { losses.push(reason); },
  });

  await harness.controller.connect();
  client.emit('ready');
  client.emit('disconnected', 'LOGOUT');
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(losses, ['disconnected:LOGOUT']);
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

test('WhatsApp session segnala auth_failure al fail-safe', async () => {
  const client = new FakeClient(async () => {});
  const losses = [];
  const harness = createHarness({
    clients: [client],
    onConnectionLost: async (reason) => { losses.push(reason); },
  });

  await harness.controller.connect();
  client.emit('auth_failure', 'sessione non valida');
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(losses, ['auth-failure']);
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

test('WhatsApp session completa la diagnostica prima di distruggere il client dopo il fallimento', async () => {
  const events = [];
  const client = new FakeClient(async () => { throw new Error('browser non pronto'); });
  const controller = createWhatsAppSessionController({
    createClient: () => client,
    retryOptions: { attempts: 1, delayMs: 0 },
    onFailure: async () => {
      events.push('failure-start');
      await new Promise((resolve) => setImmediate(resolve));
      events.push('failure-end');
    },
    destroyClient: async () => {
      events.push('destroy');
    },
  });

  await assert.rejects(controller.connect(), /browser non pronto/);
  assert.deepEqual(events, ['failure-start', 'failure-end', 'destroy']);
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

test('WhatsApp session transita a qr_expired senza azzerare il qrDataUrl né inviare notifiche invasive quando scade il QR', async () => {
  const client = new FakeClient(async () => {});
  const harness = createHarness({ clients: [client] });

  await harness.controller.connect();
  client.emit('qr', 'qr-token-test');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.state.connection, 'qr');
  assert.equal(harness.state.qrDataUrl, 'data:qr-token-test');

  // Raggiunto limite tentativi QR
  client.emit('disconnected', 'Max qrcode retries reached');
  assert.equal(harness.state.connection, 'qr_expired');
  assert.equal(harness.state.qrDataUrl, 'data:qr-token-test');
  assert.equal(harness.controller.isReady(), false);
  assert.ok(harness.pauses.includes('qr_expired'));
  // Nessuna notifica di disconnessione generata per il timeout QR
  assert.ok(!harness.notifications.some((n) => n.title === 'WhatsApp disconnesso'));
  assert.ok(harness.logs.some((m) => m.includes('Codice QR scaduto')));
  assert.ok(harness.audits.some(({ event }) => event === 'whatsapp.qr_expired'));
});

test('WhatsApp session invoca sessionResetter quando riceve una disconnessione per LOGOUT', async () => {
  const client = new FakeClient(async () => {});
  const harness = createHarness({ clients: [client] });
  let resetCalled = false;
  harness.controller.setSessionResetter(async () => { resetCalled = true; });

  await harness.controller.connect();
  client.emit('ready');
  assert.equal(harness.controller.isReady(), true);

  client.emit('disconnected', 'LOGOUT');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(resetCalled, true);
  assert.ok(harness.audits.some(({ event }) => event === 'whatsapp.session_cleared_on_logout'));
});

test('WhatsApp session non dichiara rimossa una sessione il cui cleanup fallisce', async () => {
  const client = new FakeClient(async () => {});
  const harness = createHarness({ clients: [client] });
  harness.controller.setSessionResetter(async () => false);

  await harness.controller.connect();
  client.emit('ready');
  client.emit('disconnected', 'LOGOUT');
  await new Promise((resolve) => setImmediate(resolve));

  assert.ok(!harness.audits.some(({ event }) => event === 'whatsapp.session_cleared_on_logout'));
  assert.ok(harness.audits.some(({ event }) => event === 'whatsapp.session_clear_on_logout_failed'));
});
