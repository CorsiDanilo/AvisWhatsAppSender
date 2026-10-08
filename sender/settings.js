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
  birthdayEnabled: true,
  birthdaySourceFilePath: '',
  birthdayPresetName: 'Auguri di compleanno',
});

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
    birthdayEnabled: booleanSetting(settings.birthdayEnabled, DEFAULT_SETTINGS.birthdayEnabled),
    birthdaySourceFilePath: stringSetting(settings.birthdaySourceFilePath, DEFAULT_SETTINGS.birthdaySourceFilePath),
    birthdayPresetName: stringSetting(settings.birthdayPresetName, DEFAULT_SETTINGS.birthdayPresetName),
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

module.exports = { DEFAULT_SETTINGS, loadSettings, saveSettings, normalizeSettings };
