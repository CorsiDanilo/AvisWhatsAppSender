const assert = require('node:assert/strict');
const test = require('node:test');
const { DEFAULT_SETTINGS, normalizeSettings } = require('../sender/settings');

test('le notifiche Windows sono attive di default', () => {
  assert.equal(DEFAULT_SETTINGS.notificationsEnabled, true);
  assert.equal(normalizeSettings({}).notificationsEnabled, true);
});

test('normalizeSettings conserva un toggle notifiche booleano', () => {
  assert.equal(normalizeSettings({ notificationsEnabled: false }).notificationsEnabled, false);
  assert.equal(normalizeSettings({ notificationsEnabled: 'false' }).notificationsEnabled, true);
});

test('sendSelfReport e postSessionAction hanno valori predefiniti sicuri e vengono normalizzati', () => {
  assert.equal(DEFAULT_SETTINGS.sendSelfReport, false);
  assert.equal(DEFAULT_SETTINGS.postSessionAction, 'none');

  assert.equal(normalizeSettings({}).sendSelfReport, false);
  assert.equal(normalizeSettings({}).postSessionAction, 'none');

  assert.equal(normalizeSettings({ sendSelfReport: true }).sendSelfReport, true);
  assert.equal(normalizeSettings({ sendSelfReport: 'true' }).sendSelfReport, false);

  assert.equal(normalizeSettings({ postSessionAction: 'shutdown' }).postSessionAction, 'shutdown');
  assert.equal(normalizeSettings({ postSessionAction: 'sleep' }).postSessionAction, 'sleep');
  assert.equal(normalizeSettings({ postSessionAction: 'hibernate' }).postSessionAction, 'hibernate');
  assert.equal(normalizeSettings({ postSessionAction: 'invalid' }).postSessionAction, 'none');
});
