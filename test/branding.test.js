const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('il build Windows genera tutte le icone dal logo AVIS canonico', () => {
  const packageInfo = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  console.log('DEBUG_PACKAGE_JSON_PATH:', path.join(root, 'package.json'));
  console.log('DEBUG_SCRIPTS:', packageInfo.scripts);
  const logoPath = path.join(root, 'gui', 'src', 'assets', 'avis-logo.png');

  assert.ok(fs.existsSync(logoPath), 'il logo AVIS deve essere disponibile tra gli asset della GUI');
  assert.match(
    packageInfo.scripts['prebuild:win'],
    /node scripts\/make-icon\.js gui\/src\/assets\/avis-logo\.png/,
    'il packaging deve rigenerare le icone dal logo AVIS'
  );
  assert.equal(packageInfo.build.win.icon, 'build/icon.ico');
  assert.equal(packageInfo.build.nsis.installerIcon, 'build/icon.ico');
  assert.equal(packageInfo.build.nsis.uninstallerIcon, 'build/icon.ico');
});

test('genera un\'icona AVIS distinta con pallino per gli avvisi Windows', () => {
  const logoPath = path.join(root, 'gui', 'src', 'assets', 'avis-logo.png');
  const badgeIconPath = path.join(root, 'build', 'icon-notification.ico');
  const resourceBadgeIconPath = path.join(root, 'resources', 'icon-notification.ico');
  const overlayPngPath = path.join(root, 'build', 'icon-overlay.png');
  const resourceOverlayPngPath = path.join(root, 'resources', 'icon-overlay.png');
  const result = spawnSync(process.execPath, ['scripts/make-icon.js', logoPath], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stedrr || result.stdout);
  assert.ok(fs.existsSync(badgeIconPath), 'il build deve produrre l\'icona con pallino');
  assert.ok(fs.existsSync(resourceBadgeIconPath), 'l\'icona con pallino deve essere copiata nelle risorse');
  assert.ok(fs.existsSync(overlayPngPath), 'il build deve produrre l\'overlay per la taskbar');
  assert.ok(fs.existsSync(resourceOverlayPngPath), 'l\'overlay deve essere copiato nelle risorse');
  assert.notEqual(
    fs.readFileSync(path.join(root, 'build', 'icon.ico')).toString('base64'),
    fs.readFileSync(badgeIconPath).toString('base64'),
    'l\'icona con pallino deve essere distinta dall\'icona AVIS standard'
  );
});
