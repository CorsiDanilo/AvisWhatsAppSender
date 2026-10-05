const fs = require('node:fs');
const path = require('node:path');

const { DEFAULT_SETTINGS, normalizeSettings } = require('./settings');

const DEFAULT_PRESETS = [
  {
    name: 'Promemoria donazione',
    message: 'Ciao [nome],\nti ricordiamo il tuo prossimo appuntamento per la donazione.\nGrazie per il tuo prezioso gesto! 🩸',
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    name: 'Ringraziamento',
    message: 'Ciao [nome],\nAVIS ti ringrazia di cuore per la tua donazione.\nIl tuo gesto è prezioso! 🩸',
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    name: 'Comunicazione generale',
    message: 'Gentile donatore,\nti informiamo che domenica si terrà una raccolta straordinaria.\nAVIS Comunale',
    settings: { ...DEFAULT_SETTINGS },
  },
];

function normalizePreset(preset) {
  const name = String(preset?.name ?? '').trim();
  const message = String(preset?.message ?? '');
  if (!name) throw new Error('Il nome del preset è obbligatorio.');
  return { name, message, settings: normalizeSettings(preset?.settings) };
}

function loadPresets(filePath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('Formato preset non valido');
    return parsed.map(normalizePreset);
  } catch {
    return DEFAULT_PRESETS.map((preset) => ({ ...preset, settings: { ...preset.settings } }));
  }
}

function savePresets(filePath, presets) {
  const normalized = presets.map(normalizePreset);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function upsertPreset(filePath, preset) {
  const next = normalizePreset(preset);
  const presets = loadPresets(filePath);
  const index = presets.findIndex((item) => item.name === next.name);
  if (index >= 0) presets[index] = next;
  else presets.push(next);
  return savePresets(filePath, presets);
}

function deletePreset(filePath, name) {
  const presets = loadPresets(filePath).filter((preset) => preset.name !== name);
  return savePresets(filePath, presets);
}

module.exports = { DEFAULT_PRESETS, loadPresets, savePresets, upsertPreset, deletePreset, normalizePreset };
