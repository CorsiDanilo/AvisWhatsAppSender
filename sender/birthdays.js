const XLSX = require('xlsx');

const BIRTH_DATE_KEYS = new Set(['datadinascita', 'nascita', 'birthdate', 'dob']);

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function validDayMonth(day, month) {
  return Number.isInteger(day)
    && Number.isInteger(month)
    && month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth(month, 2000);
}

function parseExcelSerial(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  if (serial < 10000 || serial > 65000) return null;
  try {
    const parsed = XLSX.SSF.parse_date_code(serial);
    if (parsed && validDayMonth(parsed.d, parsed.m)) {
      return { day: parsed.d, month: parsed.m };
    }
  } catch {}
  return null;
}

function parseBirthdayDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { day: value.getDate(), month: value.getMonth() + 1 };
  }

  if (typeof value === 'number') {
    const fromSerial = parseExcelSerial(value);
    if (fromSerial) return fromSerial;
  }

  const raw = String(value ?? '').trim();
  if (!raw) return null;

  if (/^\d{5}(?:\.\d+)?$/.test(raw)) {
    const fromSerial = parseExcelSerial(Number(raw));
    if (fromSerial) return fromSerial;
  }

  let match = raw.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})$/);
  if (match) {
    const month = Number(match[2]);
    const day = Number(match[3]);
    return validDayMonth(day, month) ? { day, month } : null;
  }

  match = raw.match(/^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{4}|\d{2}))?$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    return validDayMonth(day, month) ? { day, month } : null;
  }

  return null;
}

function formatLocalDateKey(date) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isBirthdayOnDate(birthday, date) {
  if (!birthday || !(date instanceof Date) || Number.isNaN(date.getTime())) return false;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  if (birthday.month === 2 && birthday.day === 29 && !isLeapYear(date.getFullYear())) {
    return month === 2 && day === 28;
  }
  return birthday.month === month && birthday.day === day;
}

function normalizeKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getBirthdayValue(donor = {}) {
  if (donor.birthDate !== undefined && donor.birthDate !== null) return donor.birthDate;
  const customFields = donor.customFields || {};
  const entry = Object.entries(customFields).find(([key]) => BIRTH_DATE_KEYS.has(normalizeKey(key)));
  return entry ? entry[1] : '';
}

function findBirthdays(donors = [], date = new Date()) {
  const matches = [];
  const invalid = [];

  for (const donor of donors) {
    const rawBirthday = getBirthdayValue(donor);
    if (!String(rawBirthday ?? '').trim()) continue;

    const birthday = parseBirthdayDate(rawBirthday);
    if (!birthday) {
      invalid.push(donor);
      continue;
    }

    if (isBirthdayOnDate(birthday, date)) matches.push(donor);
  }

  return { matches, invalid };
}

function birthdayDonorKey(donor = {}) {
  const phone = String(donor.phone || donor.rawPhone || '').trim();
  const name = [donor.name, donor.surname]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toLowerCase();
  return `${phone}:${name}`;
}

function hasPendingBirthdays(birthdays = {}) {
  return Number(birthdays.pendingCount) > 0 && birthdays.sessionPrepared !== true;
}

module.exports = {
  birthdayDonorKey,
  findBirthdays,
  formatLocalDateKey,
  hasPendingBirthdays,
  isBirthdayOnDate,
  parseBirthdayDate,
};
