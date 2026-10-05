const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createLogger, pruneLogs } = require('../sender/logger');

test('writes structured events to a daily log file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-logs-'));
  const now = new Date('2026-10-05T10:30:00.000Z');
  const logger = createLogger(dir, () => now);

  logger.info('app.started', { version: '1.0.0' });
  logger.error('queue.failed', { error: 'timeout' });

  const file = path.join(dir, '2026-10-05.log');
  const content = fs.readFileSync(file, 'utf8');
  assert.match(content, /\[INFO\] app\.started/);
  assert.match(content, /\[ERROR\] queue\.failed/);
  assert.match(content, /"version":"1\.0\.0"/);
});

test('removes only logs older than the retention window', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-logs-'));
  fs.writeFileSync(path.join(dir, '2026-09-01.log'), 'old');
  fs.writeFileSync(path.join(dir, '2026-10-01.log'), 'recent');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'keep');

  pruneLogs(dir, new Date('2026-10-05T10:30:00.000Z'), 30);

  assert.equal(fs.existsSync(path.join(dir, '2026-09-01.log')), false);
  assert.equal(fs.existsSync(path.join(dir, '2026-10-01.log')), true);
  assert.equal(fs.existsSync(path.join(dir, 'notes.txt')), true);
});
