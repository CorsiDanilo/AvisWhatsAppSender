const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const moduleUrl = pathToFileURL(path.join(__dirname, '../gui/src/releaseNotes.mjs')).href;

test('converte le note HTML della release in Markdown visualizzabile', async () => {
  const { normalizeReleaseNotes } = await import(moduleUrl);
  const releaseNotes = '<h3>Fixed</h3><ul><li><strong>Reset della Sessione WhatsApp</strong>: evita interferenze tra tentativi.</li></ul><p>Full Changelog: <a href="https://github.com/CorsiDanilo/AvisWhatsAppSender/blob/main/CHANGELOG.md">https://github.com/CorsiDanilo/AvisWhatsAppSender/blob/main/CHANGELOG.md</a></p>';

  assert.equal(
    normalizeReleaseNotes(releaseNotes),
    '### Fixed\n\n- **Reset della Sessione WhatsApp**: evita interferenze tra tentativi.\n\nFull Changelog: [https://github.com/CorsiDanilo/AvisWhatsAppSender/blob/main/CHANGELOG.md](https://github.com/CorsiDanilo/AvisWhatsAppSender/blob/main/CHANGELOG.md)',
  );
});
