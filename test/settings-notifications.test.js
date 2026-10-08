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
