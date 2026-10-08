const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  DEFAULT_BIRTHDAY_STATE,
  loadBirthdayState,
  markBirthdayPrompted,
  saveBirthdayState,
  shouldPromptBirthday,
} = require('../sender/birthday-state');

test('loads a safe default state when the file is missing or corrupted', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-birthday-state-'));
  const filePath = path.join(directory, 'birthday-state.json');
  try {
    assert.deepEqual(loadBirthdayState(filePath), DEFAULT_BIRTHDAY_STATE);
    fs.writeFileSync(filePath, '{bad json', 'utf8');
    assert.deepEqual(loadBirthdayState(filePath), DEFAULT_BIRTHDAY_STATE);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('allows one automatic prompt per local date and keeps manual checks available', () => {
  const initial = { ...DEFAULT_BIRTHDAY_STATE };
  assert.equal(shouldPromptBirthday(initial, '2026-02-14'), true);

  const prompted = markBirthdayPrompted(initial, '2026-02-14');
  assert.equal(shouldPromptBirthday(prompted, '2026-02-14'), false);
  assert.equal(shouldPromptBirthday(prompted, '2026-02-15'), true);
  assert.equal(prompted.lastPromptDate, '2026-02-14');
});

test('saves normalized birthday state without dropping unrelated fields', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-birthday-state-'));
  const filePath = path.join(directory, 'birthday-state.json');
  try {
    const saved = saveBirthdayState(filePath, {
      lastPromptDate: '2026-02-14',
      lastCheckDate: '2026-02-14',
      lastPreparedDate: '2026-02-14',
    });
    assert.deepEqual(loadBirthdayState(filePath), saved);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
