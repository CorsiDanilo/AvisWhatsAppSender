const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDeveloperReport, buildMailtoUrl, buildEmlContent } = require('../sender/developer-report');

test('buildDeveloperReport genera oggetto e report coerenti copiando tutto il log', () => {
  const fullLog = 'log riga 1\nlog riga 2\nlog riga 3\nlog riga 100';
  const result = buildDeveloperReport({
    appVersion: '1.0.0',
    osDetails: 'Windows 10',
    connection: 'ready',
    todayDate: '2026-10-08',
    todayLogContent: fullLog,
  });

  assert.match(result.subject, /\[AVIS WhatsApp Sender v1\.0\.0\] Log e Segnalazione \(2026-10-08\)/);
  assert.match(result.reportText, /AVIS WhatsApp Sender v1\.0\.0/);
  assert.match(result.reportText, /Stato Connessione WhatsApp: ready/);
  // Assicura che TUTTO il log sia presente nel testo del report copiato
  assert.match(result.reportText, /log riga 1\nlog riga 2\nlog riga 3\nlog riga 100/);
  assert.equal(result.attachmentName, 'log_2026-10-08.txt');
});

test('buildDeveloperReport include il dettaglio errore se fornito', () => {
  const result = buildDeveloperReport({
    appVersion: '1.0.0',
    osDetails: 'Windows 11',
    connection: 'disconnected',
    errorContext: 'Puppeteer timeout 30000ms',
    todayDate: '2026-10-08',
  });

  assert.match(result.subject, /Segnalazione Errore/);
  assert.match(result.reportText, /=== ERRORE RISCONTRATO ===/);
  assert.match(result.reportText, /Puppeteer timeout 30000ms/);
});

test('buildEmlContent genera un file EML con bozza X-Unsent e file .txt allegato in base64', () => {
  const eml = buildEmlContent({
    to: 'danilo.corsi@outlook.it',
    subject: 'Segnalazione con allegato',
    body: 'Ecco i dettagli del problema.',
    attachmentName: 'log_2026-10-08.txt',
    attachmentContent: '2026-10-08 INFO app.started\n2026-10-08 ERROR crash',
  });

  assert.match(eml, /^X-Unsent: 1/);
  assert.match(eml, /To: danilo\.corsi@outlook\.it/);
  assert.match(eml, /Content-Type: multipart\/mixed;/);
  assert.match(eml, /name="log_2026-10-08\.txt"/);
  assert.match(eml, /filename="log_2026-10-08\.txt"/);
  assert.match(eml, /Content-Transfer-Encoding: base64/);

  // Verifica che il base64 decodificato corrisponda all'allegato
  const base64Expected = Buffer.from('2026-10-08 INFO app.started\n2026-10-08 ERROR crash', 'utf8').toString('base64');
  assert.ok(eml.includes(base64Expected));
});

test('buildMailtoUrl costruisce URL mailto valido e rispetta il limite massimo di lunghezza', () => {
  const longText = 'A'.repeat(3000);
  const url = buildMailtoUrl({
    to: 'danilo.corsi@outlook.it',
    subject: 'Test Subject',
    body: longText,
    maxBodyLength: 1000,
  });

  assert.match(url, /^mailto:danilo\.corsi%40outlook\.it\?subject=Test%20Subject&body=/);
  const bodyPart = decodeURIComponent(url.split('&body=')[1]);
  assert.ok(bodyPart.length < 2000);
  assert.match(bodyPart, /Log completo copiato negli appunti/);
});
