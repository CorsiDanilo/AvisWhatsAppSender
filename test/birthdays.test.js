const assert = require('node:assert/strict');
const test = require('node:test');

const {
  birthdayDonorKey,
  findBirthdays,
  formatLocalDateKey,
  hasPendingBirthdays,
  isBirthdayOnDate,
  parseBirthdayDate,
} = require('../sender/birthdays');

test('parses Italian birthday dates without using UTC conversion', () => {
  assert.deepEqual(parseBirthdayDate('14/02/1997'), { day: 14, month: 2, year: 1997 });
  assert.deepEqual(parseBirthdayDate(' 01/12/1980 '), { day: 1, month: 12, year: 1980 });
  assert.deepEqual(parseBirthdayDate('1997-02-14'), { day: 14, month: 2, year: 1997 });
  assert.deepEqual(parseBirthdayDate(new Date(1997, 1, 14)), { day: 14, month: 2, year: 1997 });
});

test('rejects impossible and incomplete birthday dates', () => {
  assert.equal(parseBirthdayDate('31/02/1997'), null);
  assert.equal(parseBirthdayDate('14/13/1997'), null);
  assert.equal(parseBirthdayDate('14/02'), null);
  assert.equal(parseBirthdayDate(''), null);
});

test('matches birthdays by local day and month', () => {
  const birthday = parseBirthdayDate('14/02/1997');
  const date = new Date(2026, 1, 14, 23, 59, 59);

  assert.equal(formatLocalDateKey(date), '2026-02-14');
  assert.equal(isBirthdayOnDate(birthday, date), true);
  assert.equal(isBirthdayOnDate(birthday, new Date(2026, 1, 15)), false);
});

test('treats 29 February as 28 February in non-leap years', () => {
  const birthday = parseBirthdayDate('29/02/2000');

  assert.equal(isBirthdayOnDate(birthday, new Date(2026, 1, 28)), true);
  assert.equal(isBirthdayOnDate(birthday, new Date(2028, 1, 28)), false);
  assert.equal(isBirthdayOnDate(birthday, new Date(2028, 1, 29)), true);
});

test('finds matches and reports invalid populated dates', () => {
  const donors = [
    { name: 'Danilo', surname: 'Corsi', phone: '393331234567', customFields: { DATADINASCITA: '14/02/1997' } },
    { name: 'Maria', surname: 'Rossi', phone: '393331234568', customFields: { DATADINASCITA: '15/02/1980' } },
    { name: 'Luca', surname: 'Bianchi', phone: '393331234569', customFields: { DATADINASCITA: '31/02/1980' } },
    { name: 'Senza', surname: 'Data', phone: '393331234570', customFields: {} },
  ];

  const result = findBirthdays(donors, new Date(2026, 1, 14));

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].name, 'Danilo');
  assert.equal(result.invalid.length, 1);
  assert.equal(result.invalid[0].name, 'Luca');
  assert.equal(birthdayDonorKey(result.matches[0]), '393331234567:danilo corsi');
});

test('keeps the birthday indicator visible until the birthday session is prepared', () => {
  assert.equal(hasPendingBirthdays({ pendingCount: 0, sessionPrepared: false }), false);
  assert.equal(hasPendingBirthdays({ pendingCount: 1, sessionPrepared: false }), true);
  assert.equal(hasPendingBirthdays({ pendingCount: 1, sessionPrepared: true }), false);
});
