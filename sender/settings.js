const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SETTINGS = Object.freeze({
  minDelayMs: 15000,
  maxDelayMs: 35000,
  pauseAfter: 40,
  pauseMinutes: 15,
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

function normalizeSettings(settings = {}) {
  const normalized = {};
  for (const [name, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    normalized[name] = numberSetting(settings[name], fallback, LIMITS[name]);
  }
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
