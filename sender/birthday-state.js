const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_BIRTHDAY_STATE = Object.freeze({
  lastPromptDate: '',
  lastCheckDate: '',
  lastPreparedDate: '',
});

function normalizeBirthdayState(state = {}) {
  return {
    lastPromptDate: typeof state.lastPromptDate === 'string' ? state.lastPromptDate : '',
    lastCheckDate: typeof state.lastCheckDate === 'string' ? state.lastCheckDate : '',
    lastPreparedDate: typeof state.lastPreparedDate === 'string' ? state.lastPreparedDate : '',
  };
}

function loadBirthdayState(filePath) {
  try {
    return normalizeBirthdayState(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return { ...DEFAULT_BIRTHDAY_STATE };
  }
}

function saveBirthdayState(filePath, state) {
  const normalized = normalizeBirthdayState(state);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  return normalized;
}

function shouldPromptBirthday(state, dateKey) {
  return Boolean(dateKey) && normalizeBirthdayState(state).lastPromptDate !== dateKey;
}

function markBirthdayPrompted(state, dateKey) {
  return normalizeBirthdayState({ ...state, lastPromptDate: dateKey });
}

module.exports = {
  DEFAULT_BIRTHDAY_STATE,
  loadBirthdayState,
  markBirthdayPrompted,
  normalizeBirthdayState,
  saveBirthdayState,
  shouldPromptBirthday,
};
