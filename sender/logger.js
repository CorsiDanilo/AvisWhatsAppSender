const fs = require('node:fs');
const path = require('node:path');

const DAY_MS = 24 * 60 * 60 * 1000;

function dateFile(date) {
  return date.toISOString().slice(0, 10);
}

function pruneLogs(logDir, now = new Date(), retentionDays = 30) {
  fs.mkdirSync(logDir, { recursive: true });
  const cutoff = now.getTime() - retentionDays * DAY_MS;
  for (const file of fs.readdirSync(logDir)) {
    const match = /^(\d{4}-\d{2}-\d{2})\.log$/.exec(file);
    if (!match) continue;
    const timestamp = Date.parse(`${match[1]}T00:00:00.000Z`);
    if (Number.isFinite(timestamp) && timestamp < cutoff) {
      fs.rmSync(path.join(logDir, file), { force: true });
    }
  }
}

function createLogger(logDir, now = () => new Date(), retentionDays = 30) {
  fs.mkdirSync(logDir, { recursive: true });
  pruneLogs(logDir, now(), retentionDays);

  function write(level, event, details) {
    const timestamp = now();
    pruneLogs(logDir, timestamp, retentionDays);
    const suffix = details === undefined ? '' : ` ${JSON.stringify(details)}`;
    fs.appendFileSync(path.join(logDir, `${dateFile(timestamp)}.log`), `${timestamp.toISOString()} [${level}] ${event}${suffix}\n`, 'utf8');
  }

  return {
    info: (event, details) => write('INFO', event, details),
    warn: (event, details) => write('WARN', event, details),
    error: (event, details) => write('ERROR', event, details),
  };
}

module.exports = { createLogger, pruneLogs };
