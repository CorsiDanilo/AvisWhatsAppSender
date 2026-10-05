const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { writeSessionResult } = require('../sender/results');

test('writes JSON and CSV outcomes in a timestamped preset folder', () => {
  const desktop = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-desktop-'));
  const folder = writeSessionResult({
    desktopDir: desktop,
    presetName: 'Raccolta / Speciale',
    timestamp: new Date('2026-10-05T20:30:45.000Z'),
    reason: 'completed',
    message: 'Ciao [nome]',
    imageName: 'volantino.png',
    settings: { minDelayMs: 1000 },
    summary: { sent: 1, failed: 1, skipped: 0 },
    donors: [
      { name: 'Danilo', surname: 'Corsi', phone: '393285635342', selected: true, status: 'sent' },
      { name: 'Test', surname: '', phone: '', selected: true, status: 'failed', error: 'timeout' },
    ],
  });

  assert.match(path.basename(folder), /^Raccolta - Speciale_2026-10-05_20-30-45$/);
  assert.equal(fs.existsSync(path.join(folder, 'esito.json')), true);
  assert.equal(fs.existsSync(path.join(folder, 'esito.csv')), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(folder, 'esito.json'), 'utf8')).summary.sent, 1);
  assert.match(fs.readFileSync(path.join(folder, 'esito.csv'), 'utf8'), /Danilo,Corsi,393285635342/);
});
