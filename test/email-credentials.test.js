const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createEmailCredentialsStore } = require('../sender/email-credentials');

test('cifra e rilegge la password Gmail senza salvarla in chiaro', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-email-'));
  const filePath = path.join(directory, 'email-secret.json');
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${value}`),
    decryptString: (value) => value.toString().replace('encrypted:', ''),
  };
  try {
    const store = createEmailCredentialsStore({ filePath, safeStorage });
    store.save('abcd efgh ijkl mnop', 'gmail');

    assert.equal(store.load('gmail'), 'abcdefghijklmnop');
    assert.equal(store.load('outlook'), '');
    assert.ok(!fs.readFileSync(filePath, 'utf8').includes('abcd efgh'));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('ignora le credenziali del provider Outlook rimosso', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-email-providers-'));
  const filePath = path.join(directory, 'email-secret.json');
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${value}`),
    decryptString: (value) => value.toString().replace('encrypted:', ''),
  };
  try {
    const store = createEmailCredentialsStore({ filePath, safeStorage });
    store.save('gmail-secret', 'gmail');
    store.save('outlook-secret', 'outlook');

    assert.equal(store.load('gmail'), 'gmail-secret');
    assert.equal(store.load('outlook'), '');
    assert.deepEqual(store.configuredProviders(), { gmail: true });
    assert.doesNotMatch(fs.readFileSync(filePath, 'utf8'), /outlook/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('cancella la credenziale Gmail salvata', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'avis-email-clear-'));
  const filePath = path.join(directory, 'email-secret.json');
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${value}`),
    decryptString: (value) => value.toString().replace('encrypted:', ''),
  };
  try {
    const store = createEmailCredentialsStore({ filePath, safeStorage });
    store.save('gmail-secret', 'gmail');
    store.clear('gmail');

    assert.equal(store.load('gmail'), '');
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('rifiuta il salvataggio se la cifratura Windows non è disponibile', () => {
  const store = createEmailCredentialsStore({
    filePath: path.join(os.tmpdir(), 'unused-email-secret.json'),
    safeStorage: { isEncryptionAvailable: () => false },
  });

  assert.throws(() => store.save('password'), /cifratura/i);
});
