const assert = require('node:assert/strict');
const test = require('node:test');
const { createConnectionFailsafe } = require('../sender/connection-failsafe');

function createHarness() {
  const calls = { schedule: [], cancel: 0, outcomes: [], notices: [], publishes: 0, audits: [] };
  const state = {
    postSessionCountdown: null,
    progress: { current: 12, total: 20, sent: 10, failed: 2, skipped: 0, unknown: 0 },
  };
  const failsafe = createConnectionFailsafe({
    getState: () => state,
    scheduleShutdown: (seconds) => calls.schedule.push(seconds),
    cancelShutdown: () => { calls.cancel += 1; },
    saveOutcome: (reason, summary) => calls.outcomes.push({ reason, summary }),
    notifyEmergency: async (incident) => { calls.notices.push(incident); },
    audit: (level, event, details) => calls.audits.push({ level, event, details }),
    publish: () => { calls.publishes += 1; },
  });
  return { calls, state, failsafe };
}

test('arma una sola volta il fail-safe, salva l’esito parziale e programma cinque minuti', async () => {
  const { calls, state, failsafe } = createHarness();

  const armed = await failsafe.arm('disconnected:LOGOUT');

  assert.equal(armed, true);
  assert.deepEqual(calls.schedule, [300]);
  assert.deepEqual(state.postSessionCountdown, { action: 'shutdown', secondsLeft: 300, reason: 'disconnected:LOGOUT' });
  assert.deepEqual(calls.outcomes, [{
    reason: 'connection_lost',
    summary: { current: 12, total: 20, sent: 10, failed: 2, skipped: 0, unknown: 0 },
  }]);
  assert.equal(calls.notices.length, 1);
  assert.equal(calls.notices[0].reason, 'disconnected:LOGOUT');
});

test('ignora eventi ripetuti e mantiene il countdown già armato', async () => {
  const { calls, failsafe } = createHarness();

  await failsafe.arm('disconnected:LOGOUT');
  const armedAgain = await failsafe.arm('disconnected:LOGOUT');

  assert.equal(armedAgain, false);
  assert.deepEqual(calls.schedule, [300]);
  assert.equal(calls.outcomes.length, 1);
  assert.equal(calls.notices.length, 1);
});

test('mantiene lo spegnimento programmato se l’e-mail di emergenza fallisce', async () => {
  const { calls, state } = createHarness();
  const failsafe = createConnectionFailsafe({
    getState: () => state,
    scheduleShutdown: (seconds) => calls.schedule.push(seconds),
    saveOutcome: (reason, summary) => calls.outcomes.push({ reason, summary }),
    notifyEmergency: async () => { throw new Error('SMTP non raggiungibile'); },
    audit: (level, event, details) => calls.audits.push({ level, event, details }),
  });

  await failsafe.arm('auth-failure');

  assert.deepEqual(calls.schedule, [300]);
  assert.equal(calls.outcomes.length, 1);
  assert.ok(calls.audits.some(({ event }) => event === 'connection_failsafe.notification_failed'));
});

test('annulla il countdown e l’azione Windows su richiesta esplicita', async () => {
  const { calls, state, failsafe } = createHarness();
  await failsafe.arm('disconnected:LOGOUT');

  assert.equal(failsafe.cancel(), true);
  assert.equal(calls.cancel, 1);
  assert.equal(state.postSessionCountdown, null);
  assert.equal(failsafe.cancel(), false);
});

test('aggiorna il countdown visualizzato senza affidare lo spegnimento al timer JavaScript', async () => {
  const { calls, state } = createHarness();
  let tick;
  const failsafe = createConnectionFailsafe({
    getState: () => state,
    scheduleShutdown: (seconds) => calls.schedule.push(seconds),
    saveOutcome: () => {},
    notifyEmergency: async () => {},
    publish: () => { calls.publishes += 1; },
    setIntervalFn: (callback) => { tick = callback; return 'interval'; },
    clearIntervalFn: () => {},
  });

  await failsafe.arm('disconnected:LOGOUT');
  tick();

  assert.equal(state.postSessionCountdown.secondsLeft, 299);
  assert.deepEqual(calls.schedule, [300]);
});

test('non dichiara inviata una notifica quando il canale e-mail non è ancora configurato', async () => {
  const { calls, state } = createHarness();
  const failsafe = createConnectionFailsafe({
    getState: () => state,
    scheduleShutdown: (seconds) => calls.schedule.push(seconds),
    saveOutcome: () => {},
    audit: (level, event) => calls.audits.push({ level, event }),
  });

  await failsafe.arm('disconnected:LOGOUT');

  assert.ok(!calls.audits.some(({ event }) => event === 'connection_failsafe.notification_sent'));
});
