const assert = require('node:assert/strict');
const test = require('node:test');

const {
  handleWindowClose,
  showWindow,
} = require('../sender/window-lifecycle');

test('hides an open window in the tray instead of destroying it', () => {
  let prevented = false;
  let hidden = false;
  const events = [];

  const hiddenToTray = handleWindowClose({
    preventDefault() { prevented = true; },
  }, {
    isQuitting: false,
    hideWindow() { hidden = true; },
    audit(event) { events.push(event); },
  });

  assert.equal(hiddenToTray, true);
  assert.equal(prevented, true);
  assert.equal(hidden, true);
  assert.deepEqual(events, ['window.hidden_to_tray']);
});

test('reopens the existing window and refreshes birthdays every time', () => {
  const calls = [];
  const fakeWindow = {
    isDestroyed: () => false,
    isMinimized: () => true,
    restore() { calls.push('restore'); },
    show() { calls.push('show'); },
    focus() { calls.push('focus'); },
  };

  const opened = showWindow(fakeWindow, () => calls.push('refresh-birthdays'));

  assert.equal(opened, true);
  assert.deepEqual(calls, ['restore', 'show', 'focus', 'refresh-birthdays']);
});

test('allows the window to close normally during explicit app exit', () => {
  let prevented = false;
  let hidden = false;

  const hiddenToTray = handleWindowClose({
    preventDefault() { prevented = true; },
  }, {
    isQuitting: true,
    hideWindow() { hidden = true; },
  });

  assert.equal(hiddenToTray, false);
  assert.equal(prevented, false);
  assert.equal(hidden, false);
});
