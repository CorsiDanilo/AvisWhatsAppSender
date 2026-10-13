const fs = require('node:fs');
const path = require('node:path');

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n, len = 2) {
  return String(n).padStart(len, '0');
}

function dateFile(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatLocalTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ms = pad(date.getMilliseconds(), 3);

  const tzOffset = -date.getTimezoneOffset();
  const sign = tzOffset >= 0 ? '+' : '-';
  const tzHours = pad(Math.floor(Math.abs(tzOffset) / 60));
  const tzMinutes = pad(Math.abs(tzOffset) % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}${sign}${tzHours}:${tzMinutes}`;
}

function parseLocalDateFile(fileName) {
  const match = /^(\d{4})-(\d{2})-(\d{2})\.log$/.exec(fileName);
  if (!match) return NaN;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return NaN;
  }
  return date.getTime();
}

function pruneLogs(logDir, now = new Date(), retentionDays = 30) {
  fs.mkdirSync(logDir, { recursive: true });
  const cutoff = now.getTime() - retentionDays * DAY_MS;
  for (const file of fs.readdirSync(logDir)) {
    const timestamp = parseLocalDateFile(file);
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
    fs.appendFileSync(
      path.join(logDir, `${dateFile(timestamp)}.log`),
      `${formatLocalTimestamp(timestamp)} [${level}] ${event}${suffix}\n`,
      'utf8'
    );
  }

  return {
    info: (event, details) => write('INFO', event, details),
    warn: (event, details) => write('WARN', event, details),
    error: (event, details) => write('ERROR', event, details),
  };
}

module.exports = { createLogger, pruneLogs, dateFile, formatLocalTimestamp, parseLocalDateFile };
