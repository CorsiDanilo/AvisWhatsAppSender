const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { outcomeEmailAttachments, safeName, timestampName, writeSessionResult } = require('../sender/results');

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'avis-results-test-'));
}

test('safeName e timestampName producono nomi filesystem stabili', () => {
  assert.equal(safeName('  Preset: prova/uno?  '), 'Preset- prova-uno-');
  assert.equal(safeName(''), 'Senza preset');
  assert.equal(timestampName(new Date('2026-10-13T14:52:11.000Z')), '2026-10-13_14-52-11');
});

test('writeSessionResult salva JSON, CSV completo e CSV dei problemi inclusi gli unknown', () => {
  const directory = temporaryDirectory();
  try {
    const folder = writeSessionResult({
      outputDir: directory,
      presetName: 'Prova/Donatori',
      timestamp: new Date('2026-10-13T14:52:11.000Z'),
      startedAt: '2026-10-13T14:00:00.000Z',
      endedAt: '2026-10-13T15:00:00.000Z',
      reason: 'completed',
      message: 'Ciao, [nome]',
      imageName: 'test.png',
      attachments: [{ name: 'test.png', type: 'image', size: 100 }],
      attachmentPosition: 'first',
      settings: { minDelayMs: 1 },
      summary: { sent: 1, failed: 1, skipped: 1, unknown: 1 },
      donors: [
        { name: 'Nome', surname: 'Cognome', phone: '393331234567', selected: true, status: 'sent', customFields: { Note: 'ok' } },
        { name: 'Nome Fallito', surname: 'Cognome Fallito', phone: '393409876543', selected: false, status: 'failed', error: 'errore, "test"', customFields: { Note: 'no' } },
        { name: 'Nome Saltato', surname: 'Cognome Saltato', phone: '393281112233', selected: true, status: 'skipped', reason: 'Numero non valido', customFields: {} },
        { name: 'Nome Sconosciuto', surname: 'Cognome Sconosciuto', phone: '393221112233', selected: true, status: 'unknown', error: 'Timeout', customFields: {} },
      ],
    });

    const result = JSON.parse(fs.readFileSync(path.join(folder, 'esito.json'), 'utf8'));
    assert.equal(result.presetName, 'Prova-Donatori');
    assert.equal(result.summary.unknown, 1);
    assert.deepEqual(result.attachments, [{ name: 'test.png', type: 'image', size: 100 }]);
    assert.equal(result.attachmentPosition, 'first');
    const csv = fs.readFileSync(path.join(folder, 'esito.csv'), 'utf8');
    assert.match(csv, /Nome/);
    assert.match(csv, /"errore, ""test"""/);
    const failedCsv = fs.readFileSync(path.join(folder, 'esito_falliti.csv'), 'utf8');
    assert.match(failedCsv, /failed/);
    assert.match(failedCsv, /skipped/);
    assert.match(failedCsv, /unknown/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('writeSessionResult richiede una cartella di output', () => {
  assert.throws(() => writeSessionResult({ presetName: 'Test', donors: [] }), /Cartella di output/);
});

test('outcomeEmailAttachments include il CSV completo e quello dei soli problemi quando disponibili', () => {
  const directory = temporaryDirectory();
  try {
    fs.writeFileSync(path.join(directory, 'esito.csv'), 'completo', 'utf8');
    fs.writeFileSync(path.join(directory, 'esito_falliti.csv'), 'problemi', 'utf8');

    assert.deepEqual(outcomeEmailAttachments(directory), [
      { filename: 'esito_falliti.csv', path: path.join(directory, 'esito_falliti.csv') },
      { filename: 'esito.csv', path: path.join(directory, 'esito.csv') },
    ]);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('writeSessionResult conserva i valori falsy dei campi personalizzati', () => {
  const directory = temporaryDirectory();
  try {
    const folder = writeSessionResult({
      outputDir: directory,
      presetName: 'Valori falsy',
      timestamp: new Date('2026-10-13T14:52:11.000Z'),
      donors: [
        {
          name: 'Nome',
          surname: 'Cognome',
          phone: '393331234567',
          selected: true,
          status: 'sent',
          customFields: { Donazioni: 0, Consenso: false },
        },
      ],
    });

    const csv = fs.readFileSync(path.join(folder, 'esito.csv'), 'utf8');
    assert.match(csv, /Nome,Cognome,393331234567,Sì,sent,,0,false/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
