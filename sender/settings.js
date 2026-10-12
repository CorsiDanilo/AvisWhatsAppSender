const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SETTINGS = Object.freeze({
  minDelayMs: 20000,
  maxDelayMs: 40000,
  pauseAfter: 35,
  pauseMinutes: 15,
  outputDir: '',
  logDir: '',
  notificationsEnabled: true,
  startWithWindows: true,
  sendSelfReport: false,
  postSessionAction: 'none',
  birthdayEnabled: true,
  birthdaySourceFilePath: '',
  birthdayPresetName: 'Auguri di compleanno',
  reportRecipients: Object.freeze([]),
});

const POST_SESSION_ACTIONS = Object.freeze(['none', 'sleep', 'hibernate', 'shutdown']);

const LIMITS = {
  minDelayMs: [0, 10 * 60 * 1000],
  maxDelayMs: [0, 10 * 60 * 1000],
  pauseAfter: [0, 1000],
  pauseMinutes: [0, 60],
};

function numberSetting(value, fallback, [minimum, maximum]) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(number)));
}

function stringSetting(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function booleanSetting(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function postSessionActionSetting(value, fallback = 'none') {
  if (typeof value === 'string' && POST_SESSION_ACTIONS.includes(value.trim().toLowerCase())) {
    return value.trim().toLowerCase();
  }
  return fallback;
}

function reportRecipientsSetting(value, fallback = []) {
  if (!Array.isArray(value)) return Array.isArray(fallback) ? [...fallback] : [];
  const result = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    const rawPhone = typeof item.phone === 'string' ? item.phone.trim() : (typeof item.rawPhone === 'string' ? item.rawPhone.trim() : '');
    const cleanDigits = rawPhone.replace(/\D/g, '');
    let phone = cleanDigits;
    if (cleanDigits.length === 10 && cleanDigits.startsWith('3')) {
      phone = `39${cleanDigits}`;
    }
    if (!phone && !label) continue;
    const enabled = typeof item.enabled === 'boolean' ? item.enabled : true;
    const id = typeof item.id === 'string' && item.id.trim()
      ? item.id.trim()
      : `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    result.push({
      id,
      label: label || 'Destinatario',
      phone,
      enabled,
    });
  }
  return result;
}

function normalizeSettings(settings = {}) {
  const normalized = {
    minDelayMs: numberSetting(settings.minDelayMs, DEFAULT_SETTINGS.minDelayMs, LIMITS.minDelayMs),
    maxDelayMs: numberSetting(settings.maxDelayMs, DEFAULT_SETTINGS.maxDelayMs, LIMITS.maxDelayMs),
    pauseAfter: numberSetting(settings.pauseAfter, DEFAULT_SETTINGS.pauseAfter, LIMITS.pauseAfter),
    pauseMinutes: numberSetting(settings.pauseMinutes, DEFAULT_SETTINGS.pauseMinutes, LIMITS.pauseMinutes),
    outputDir: stringSetting(settings.outputDir, DEFAULT_SETTINGS.outputDir),
    logDir: stringSetting(settings.logDir, DEFAULT_SETTINGS.logDir),
    notificationsEnabled: booleanSetting(settings.notificationsEnabled, DEFAULT_SETTINGS.notificationsEnabled),
    startWithWindows: booleanSetting(settings.startWithWindows, DEFAULT_SETTINGS.startWithWindows),
    sendSelfReport: booleanSetting(settings.sendSelfReport, DEFAULT_SETTINGS.sendSelfReport),
    postSessionAction: postSessionActionSetting(settings.postSessionAction, DEFAULT_SETTINGS.postSessionAction),
    birthdayEnabled: booleanSetting(settings.birthdayEnabled, DEFAULT_SETTINGS.birthdayEnabled),
    birthdaySourceFilePath: stringSetting(settings.birthdaySourceFilePath, DEFAULT_SETTINGS.birthdaySourceFilePath),
    birthdayPresetName: stringSetting(settings.birthdayPresetName, DEFAULT_SETTINGS.birthdayPresetName),
    reportRecipients: reportRecipientsSetting(settings.reportRecipients, DEFAULT_SETTINGS.reportRecipients),
  };
  normalized.maxDelayMs = Math.max(normalized.minDelayMs, normalized.maxDelayMs);
  return normalized;
}

function loadSettings(filePath) {
  try {
    return normalizeSettings(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(filePath, settings) {
  const normalized = normalizeSettings(settings);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

module.exports = {
  DEFAULT_SETTINGS,
  POST_SESSION_ACTIONS,
  loadSettings,
  saveSettings,
  normalizeSettings,
};
