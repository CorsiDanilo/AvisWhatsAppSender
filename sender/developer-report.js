function buildDeveloperReport({
  appVersion = '1.2.0',
  osDetails = 'Windows',
  connection = 'non connesso',
  errorContext = '',
  todayLogContent = '',
  todayDate = new Date().toISOString().slice(0, 10),
  nowDate = new Date(),
} = {}) {
  const fullLog = (todayLogContent && typeof todayLogContent === 'string' && todayLogContent.trim())
    ? todayLogContent.trim()
    : '(Nessun evento registrato nel file di log di oggi)';

  const subject = errorContext
    ? `[AVIS WhatsApp Sender v${appVersion}] Segnalazione Errore`
    : `[AVIS WhatsApp Sender v${appVersion}] Log e Segnalazione (${todayDate})`;

  const dateFormatted = typeof nowDate.toLocaleString === 'function'
    ? nowDate.toLocaleString('it-IT')
    : String(nowDate);

  const attachmentName = `log_${todayDate}.txt`;

  const sysInfo = [
    `=== DETTAGLI SISTEMA ===`,
    `Applicazione: AVIS WhatsApp Sender v${appVersion}`,
    `Sistema Operativo: ${osDetails}`,
    `Data e ora: ${dateFormatted}`,
    `Stato Connessione WhatsApp: ${connection}`,
    errorContext ? `\n=== ERRORE RISCONTRATO ===\n${errorContext}` : '',
  ].filter(Boolean).join('\n');

  // Include the ENTIRE log in the reportText so that the clipboard contains all of it
  const reportText = `${sysInfo}\n\n=== LOG COMPLETO DELLA GIORNATA (${attachmentName}) ===\n${fullLog}\n\n========================\nNota per l'operatore: il file ${attachmentName} è stato allegato a questa email ed è salvato sul tuo computer nella cartella dei log.`;

  return {
    subject,
    reportText,
    attachmentName,
    fullLog,
  };
}

function buildEmlContent({
  to = 'danilo.corsi@outlook.it',
  subject = '',
  body = '',
  attachmentName = 'log.txt',
  attachmentContent = '',
} = {}) {
  const boundary = `----=_Part_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
  const base64Content = Buffer.from(attachmentContent || '', 'utf8').toString('base64');
  const chunks = base64Content ? (base64Content.match(/.{1,76}/g) || []).join('\r\n') : '';

  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;

  const lines = [
    'X-Unsent: 1',
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    '',
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8; name="${attachmentName}"`,
    `Content-Disposition: attachment; filename="${attachmentName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    chunks,
    `--${boundary}--`,
    '',
  ];

  return lines.join('\r\n');
}

function buildMailtoUrl({
  to = 'danilo.corsi@outlook.it',
  subject = '',
  body = '',
  maxBodyLength = 1500,
} = {}) {
  let mailtoBody = body;
  if (mailtoBody.length > maxBodyLength) {
    mailtoBody = `${body.slice(0, maxBodyLength)}\n\n... [Log completo copiato negli appunti e consultabile nel file allegato]`;
  }

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailtoBody)}`;
}

module.exports = {
  buildDeveloperReport,
  buildEmlContent,
  buildMailtoUrl,
};
