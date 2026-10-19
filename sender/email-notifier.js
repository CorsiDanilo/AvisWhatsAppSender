const nodemailer = require('nodemailer');

function createEmailNotifier({
  createTransport = nodemailer.createTransport,
  getConfig = () => ({}),
  getPassword = () => '',
} = {}) {
  function transport() {
    const config = getConfig();
    const password = getPassword('gmail');
    if (!config.gmailAddress || !password) {
      throw new Error('Notifiche e-mail non configurate.');
    }
    return {
      config,
      sender: createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: config.gmailAddress, pass: password },
      }),
    };
  }

  async function sendEmergency({ reason, summary = {}, shutdownInSeconds, attachments = [] }) {
    const { config, sender } = transport();
    const recipients = (config.emailRecipients || []).filter((recipient) => recipient.enabled !== false).map((recipient) => recipient.email);
    if (recipients.length === 0) throw new Error('Nessun destinatario e-mail di emergenza configurato.');
    return sender.sendMail({
      from: config.gmailAddress,
      to: recipients,
      subject: 'AVIS WhatsApp Sender — Emergenza: spegnimento programmato',
      text: [
        `Causa: ${reason}`,
        `Inviati: ${summary.sent || 0}`,
        `Falliti: ${summary.failed || 0}`,
        `Totale: ${summary.total || 0}`,
        `Spegnimento PC programmato tra ${Math.ceil(shutdownInSeconds / 60)} minuti.`,
      ].join('\n'),
      attachments,
    });
  }

  async function sendDeveloperLog({ to, subject, text, attachmentName, attachmentContent }) {
    const { config, sender } = transport();
    return sender.sendMail({
      from: config.gmailAddress,
      to: [to],
      subject,
      text,
      attachments: [{ filename: attachmentName, content: attachmentContent }],
    });
  }

  async function sendReport({ recipients, text, subject, attachments = [] }) {
    const { config, sender } = transport();
    const to = Array.isArray(recipients)
      ? recipients.filter((recipient) => typeof recipient === 'string' && recipient.trim())
      : [];
    if (to.length === 0) throw new Error('Nessun destinatario e-mail per il report configurato.');
    return sender.sendMail({
      from: config.gmailAddress,
      to,
      subject: subject || 'AVIS WhatsApp Sender â€” Esito invio',
      text,
      attachments,
    });
  }

  return { sendEmergency, sendDeveloperLog, sendReport };
}

module.exports = { createEmailNotifier };
