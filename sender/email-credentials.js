const fs = require('node:fs');
const path = require('node:path');

function createEmailCredentialsStore({ filePath, safeStorage, fileSystem = fs } = {}) {
  if (!filePath) throw new TypeError('filePath è obbligatorio.');

  const providers = ['gmail'];
  const normalizeProvider = (provider) => providers.includes(provider) ? provider : '';

  function requireEncryption() {
    if (!safeStorage?.isEncryptionAvailable?.()) {
      throw new Error('La cifratura Windows non è disponibile: impossibile salvare la password per app.');
    }
  }

  function readRecords() {
    try {
      const parsed = JSON.parse(fileSystem.readFileSync(filePath, 'utf8'));
      if (parsed?.providers && typeof parsed.providers === 'object') {
        return parsed.providers.gmail ? { gmail: parsed.providers.gmail } : {};
      }
      // Legacy format stored one Gmail secret at the root.
      if (parsed?.secret) return { gmail: { secret: parsed.secret } };
    } catch {}
    return {};
  }

  return {
    save(password, provider = 'gmail') {
      requireEncryption();
      // Google displays app passwords in four-character groups; spaces are presentation-only.
      const normalizedPassword = String(password || '').replace(/\s+/g, '');
      const encrypted = safeStorage.encryptString(normalizedPassword);
      fileSystem.mkdirSync(path.dirname(filePath), { recursive: true });
      const records = readRecords();
      const normalizedProvider = normalizeProvider(provider);
      if (!normalizedProvider) return;
      records[normalizedProvider] = { secret: encrypted.toString('base64') };
      fileSystem.writeFileSync(filePath, JSON.stringify({ providers: records }), 'utf8');
    },
    load(provider = 'gmail') {
      try {
        requireEncryption();
        const normalizedProvider = normalizeProvider(provider);
        if (!normalizedProvider) return '';
        const record = readRecords()[normalizedProvider] || {};
        const { secret } = record;
        return secret ? safeStorage.decryptString(Buffer.from(secret, 'base64')) : '';
      } catch {
        return '';
      }
    },
    configuredProviders() {
      return Object.fromEntries(providers.map((provider) => [provider, Boolean(this.load(provider))]));
    },
    clear(provider) {
      if (!provider) {
        try { fileSystem.rmSync(filePath, { force: true }); } catch {}
        return;
      }
      const records = readRecords();
      const normalizedProvider = normalizeProvider(provider);
      if (!normalizedProvider) return;
      delete records[normalizedProvider];
      if (Object.keys(records).length === 0) {
        try { fileSystem.rmSync(filePath, { force: true }); } catch {}
      } else {
        fileSystem.writeFileSync(filePath, JSON.stringify({ providers: records }), 'utf8');
      }
    },
  };
}

module.exports = { createEmailCredentialsStore };
