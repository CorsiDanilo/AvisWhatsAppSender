const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createLogger, dateFile, formatLocalTimestamp } = require('../sender/logger');

test('dateFile formatta la data locale come YYYY-MM-DD', () => {
  const d = new Date(2026, 9, 13, 16, 52, 11); // 13 Ottobre 2026 (mesi 0-indexed: 9 = Ottobre)
  assert.equal(dateFile(d), '2026-10-13');
});

test('formatLocalTimestamp include ora locale, millisecondi e offset di fuso orario', () => {
  const d = new Date(2026, 9, 13, 16, 52, 11, 45);
  const formatted = formatLocalTimestamp(d);
  
  // Deve iniziare con 2026-10-13T16:52:11.045
  assert.match(formatted, /^2026-10-13T16:52:11\.045[+-]\d{2}:\d{2}$/);
  
  // La stringa prodotta deve essere parsabile da Date senza perdere l'istante nel tempo
  const parsed = new Date(formatted);
  assert.equal(parsed.getTime(), d.getTime());
});

test('createLogger scrive eventi con ora locale nel file del giorno ed esegue append', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-logger-test-'));
  try {
    const fixedDate = new Date(2026, 9, 13, 16, 52, 0);
    const logger = createLogger(tmpDir, () => fixedDate);

    logger.info('test.event_1', { foo: 'bar' });
    logger.warn('test.event_2', { error: 'something' });

    const logFile = path.join(tmpDir, '2026-10-13.log');
    assert.ok(fs.existsSync(logFile));

    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 2);

    assert.ok(lines[0].includes('[INFO] test.event_1 {"foo":"bar"}'));
    assert.ok(lines[0].startsWith('2026-10-13T16:52:00.000'));
    assert.ok(lines[1].includes('[WARN] test.event_2 {"error":"something"}'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('pruneLogs interpreta i nomi dei file nel fuso locale', () => {
  const script = `
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const { pruneLogs } = require(${JSON.stringify(path.resolve(__dirname, '../sender/logger.js'))});
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-logger-prune-'));
    fs.writeFileSync(path.join(dir, '2026-09-13.log'), 'keep');
    pruneLogs(dir, new Date(2026, 9, 13, 0, 0, 0), 30);
    process.stdout.write(String(fs.existsSync(path.join(dir, '2026-09-13.log'))));
    fs.rmSync(dir, { recursive: true, force: true });
  `;
  const retained = execFileSync(process.execPath, ['-e', script], {
    env: { ...process.env, TZ: 'America/New_York' },
    encoding: 'utf8',
  });

  assert.equal(retained, 'true');
});
