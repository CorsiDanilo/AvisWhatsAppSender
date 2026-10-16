const assert = require('node:assert/strict');
const test = require('node:test');
const { createWindowsShutdownScheduler } = require('../sender/windows-shutdown');

test('programma e annulla lo spegnimento Windows con comandi di sistema espliciti', async () => {
  const calls = [];
  const scheduler = createWindowsShutdownScheduler({
    platform: 'win32',
    execFile: (command, args, options, callback) => {
      calls.push({ command, args, options });
      callback(null);
    },
  });

  await scheduler.schedule(300);
  await scheduler.cancel();

  assert.deepEqual(calls, [
    { command: 'shutdown', args: ['/s', '/t', '300', '/f'], options: { windowsHide: true } },
    { command: 'shutdown', args: ['/a'], options: { windowsHide: true } },
  ]);
});

test('non esegue comandi di spegnimento fuori da Windows', async () => {
  let called = false;
  const scheduler = createWindowsShutdownScheduler({
    platform: 'linux',
    execFile: () => { called = true; },
  });

  assert.equal(await scheduler.schedule(300), false);
  assert.equal(await scheduler.cancel(), false);
  assert.equal(called, false);
});
