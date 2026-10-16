const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings } = require('../sender/settings');

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

test('reportRecipients ha valore predefinito array vuoto e viene normalizzato', () => {
  assert.deepEqual(DEFAULT_SETTINGS.reportRecipients, []);
  assert.deepEqual(normalizeSettings({}).reportRecipients, []);

  const normalized = normalizeSettings({
    reportRecipients: [
      { label: '  Presidente  ', phone: ' 333 123 4567 ', enabled: true },
      { label: 'Segreteria', phone: '+39 340 9876543', enabled: false },
      { label: '', phone: '' },
    ],
  });

  assert.equal(normalized.reportRecipients.length, 2);
  assert.equal(normalized.reportRecipients[0].label, 'Presidente');
  assert.equal(normalized.reportRecipients[0].phone, '393331234567');
  assert.equal(normalized.reportRecipients[0].enabled, true);
  assert.equal(normalized.reportRecipients[1].label, 'Segreteria');
  assert.equal(normalized.reportRecipients[1].phone, '393409876543');
  assert.equal(normalized.reportRecipients[1].enabled, false);
});

test('conserva i destinatari del report e migra la precedente configurazione WhatsApp', () => {
  const normalized = normalizeSettings({
    reportRecipients: [{ label: 'Presidente', phone: '3331234567' }],
    reportEmailRecipients: [{ label: 'Segreteria', email: 'segreteria@avis.it' }],
  });

  assert.equal(normalized.reportDeliveryMode, 'whatsapp');
  assert.deepEqual(normalized.reportEmailRecipients, [{
    id: 'email_0', label: 'Segreteria', email: 'segreteria@avis.it', enabled: true,
  }]);
});

test('normalizza la modalita di consegna del report e scarta valori non validi', () => {
  assert.equal(normalizeSettings({ reportDeliveryMode: 'both' }).reportDeliveryMode, 'both');
  assert.equal(normalizeSettings({ reportDeliveryMode: 'email' }).reportDeliveryMode, 'email');
  assert.equal(normalizeSettings({ reportDeliveryMode: 'sconosciuto' }).reportDeliveryMode, 'none');
});

test('loadSettings e saveSettings gestiscono filesystem, valori fuori limite e file corrotti', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-settings-test-'));
  try {
    const filePath = path.join(directory, 'nested', 'settings.json');
    assert.equal(loadSettings(filePath).minDelayMs, DEFAULT_SETTINGS.minDelayMs);
    const saved = saveSettings(filePath, { minDelayMs: -1, maxDelayMs: 1, outputDir: '  C:\\AVIS  ' });
    assert.equal(saved.minDelayMs, 0);
    assert.equal(saved.maxDelayMs, 1);
    assert.equal(saved.outputDir, 'C:\\AVIS');
    assert.deepEqual(loadSettings(filePath), saved);
    fs.writeFileSync(filePath, '{bad', 'utf8');
    assert.deepEqual(loadSettings(filePath), DEFAULT_SETTINGS);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
