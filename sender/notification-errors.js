function notificationContextForChannel(channel = '') {
  if (/email|mail|developer-report/i.test(channel)) return 'email';
  if (/csv|donor|recipient/i.test(channel)) return 'import';
  if (/connect|whatsapp/i.test(channel)) return 'whatsapp';
  if (/update/i.test(channel)) return 'update';
  return 'generic';
}

function notificationErrorBody(error, context = 'generic') {
  const message = String(error?.message || error || '').toLowerCase();

  if (context === 'email' || /smtp|nodemailer|eauth|email|mail/.test(message)) {
    if (/534|535|authentication|invalid login|eauth|auth login/.test(message)) {
      return 'Autenticazione Gmail rifiutata. Verifica l’indirizzo e la password per app e riprova.';
    }
    return 'Invio e-mail non riuscito. Verifica la configurazione Gmail e riprova.';
  }
  if (context === 'whatsapp' || /whatsapp|qr|browser|puppeteer|timeout/.test(message)) {
    return 'WhatsApp non ha risposto correttamente. Controlla la connessione e riprova a generare il QR code.';
  }
  if (context === 'import' || /csv|excel|xlsx|xls|foglio|file|colonna|parse|enoent/.test(message)) {
    return 'Impossibile importare i dati. Verifica il file e le colonne selezionate.';
  }
  if (context === 'update' || /update|updater|download|repository|release/.test(message)) {
    return 'Impossibile completare l’aggiornamento. Controlla la connessione internet e riprova.';
  }
  return 'Si è verificato un errore. Controlla l’applicazione e riprova.';
}

module.exports = { notificationContextForChannel, notificationErrorBody };
