export function toUserError(error, context = 'generic') {
  const raw = typeof error === 'string' ? error : error?.message || String(error || '')
  const message = raw.trim()
  const normalized = message.toLowerCase()

  if (!message) return 'Operazione non riuscita. Riprova.'
  if (/^impossibile|^errore|^attenzione|^nessun |^seleziona /i.test(message)) return message

  if (
    context === 'update' ||
    /update|updater|download|repository|release|electron-updater|github/.test(normalized)
  ) {
    return 'Impossibile verificare o scaricare l’aggiornamento. Controlla la connessione internet e riprova.'
  }

  if (
    context === 'import' ||
    /csv|excel|xlsx|xls|foglio|spreadsheet|parse|column|colonna|file not found|enoent/.test(normalized)
  ) {
    return 'Impossibile leggere il file o il foglio selezionato. Verifica il formato e le colonne.'
  }

  if (/waiting failed|puppeteer|\d+ms exceeded/.test(normalized)) {
    return 'WhatsApp non ha risposto in tempo. Riprova a generare il QR code.'
  }

  if (/smtp|nodemailer|eauth|invalid login|5\.7\.3|5\.7\.9|application-specific|e-mail|email/.test(normalized)) {
    if (/5\.7\.9|application-specific|authentication|invalid login|eauth/.test(normalized)) {
      return 'Gmail ha rifiutato l’autenticazione SMTP. Verifica la password per app e riprova.'
    }
    return 'Invio e-mail non riuscito. Verifica la configurazione Gmail e riprova.'
  }

  if (/auth timeout|auth_failure|authentication|whatsapp|qr code|qrcode|session|browser/.test(normalized)) {
    if (/auth_failure|authentication|non.*autoriz|unauthorized/.test(normalized)) {
      return 'WhatsApp non ha accettato la sessione. Riprova a collegarlo.'
    }
    return 'WhatsApp non ha risposto in tempo. Riprova a generare il QR code.'
  }

  if (/network|fetch|econn|etimedout|timeout|socket/.test(normalized)) {
    return 'Operazione non riuscita per un problema di connessione. Riprova.'
  }

  return 'Operazione non riuscita. Riprova.'
}
