const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const exePath = puppeteer.executablePath();
const browserDir = path.dirname(exePath);
const destDir = path.join(__dirname, '..', 'resources', 'browser');

console.log('--- Configurazione Bundle Chromium ---');
console.log('Sorgente Chromium:', browserDir);
console.log('Destinazione Bundle:', destDir);

if (fs.existsSync(destDir)) {
    console.log('Rimozione vecchia cartella...');
    fs.rmSync(destDir, { recursive: true, force: true });
}

fs.mkdirSync(path.dirname(destDir), { recursive: true });
console.log('Copia in corso (potrebbe richiedere qualche secondo)...');
fs.cpSync(browserDir, destDir, { recursive: true });

console.log("Copia completata. Il browser locale è pronto per essere impacchettato nell'installer.");
