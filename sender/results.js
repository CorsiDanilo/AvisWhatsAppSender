const fs = require('node:fs');
const path = require('node:path');

function safeName(value) {
  const name = String(value || 'Senza preset')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return name || 'Senza preset';
}

function timestampName(date) {
  return date.toISOString().replace('T', '_').replace(/:/g, '-').replace(/\.\d{3}Z$/, '');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeSessionResult({
  desktopDir,
  outputDir = desktopDir,
  presetName,
  timestamp = new Date(),
  startedAt,
  endedAt = new Date(),
  reason,
  message,
  imageName,
  settings,
  summary,
  donors,
}) {
  const baseDir = outputDir || desktopDir;
  if (!baseDir) {
    throw new Error('Cartella di output non specificata.');
  }
  const folder = path.join(baseDir, `${safeName(presetName)}_${timestampName(timestamp)}`);
  fs.mkdirSync(folder, { recursive: true });

  const json = {
    version: 1,
    presetName: safeName(presetName),
    reason,
    startedAt,
    endedAt,
    message,
    imageName: imageName || '',
    settings,
    summary,
    donors,
  };
  fs.writeFileSync(path.join(folder, 'esito.json'), `${JSON.stringify(json, null, 2)}\n`, 'utf8');

  const rows = [
    ['Nome', 'Cognome', 'Telefono', 'Selezionato', 'Stato', 'Errore'],
    ...donors.map((donor) => [
      donor.name,
      donor.surname,
      donor.phone || donor.rawPhone,
      donor.selected !== false ? 'Sì' : 'No',
      donor.status,
      donor.error || donor.reason || '',
    ]),
  ];
  fs.writeFileSync(path.join(folder, 'esito.csv'), `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`, 'utf8');
  return folder;
}

module.exports = { writeSessionResult, safeName, timestampName };
