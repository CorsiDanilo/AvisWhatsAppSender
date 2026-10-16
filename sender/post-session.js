const { exec } = require('node:child_process');
const { maskPhone, redactDiagnosticText } = require('./diagnostics');
const { withTimeout } = require('./send-timeout');
const { buildWhatsAppSendOptions, ensureWhatsAppSendResult } = require('./whatsapp-send-options');

function buildSelfReportMessage({
  sent = 0,
  failed = 0,
  skipped = 0,
  unknown = 0,
  fileName = '',
  presetName = '',
  date = new Date(),
  postSessionAction = 'none',
} = {}) {
  const dateStr = date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const actionLabels = {
    sleep: '💤 Sospensione del PC programmata tra 60 secondi',
    hibernate: '🌙 Ibernazione del PC programmata tra 60 secondi',
    shutdown: '🔌 Spegnimento del PC programmato tra 60 secondi',
  };
  const actionText = actionLabels[postSessionAction] || '';

  const lines = [
    '🩸 *AVIS WhatsApp Sender — Esito Invio*',
    `📅 ${dateStr}`,
    fileName ? `📁 File: ${fileName}` : null,
    presetName ? `📝 Modello: ${presetName}` : null,
    '',
    `✅ Inviati a WhatsApp: *${sent}*`,
    `❌ Falliti: *${failed}*`,
    `⚠️ Saltati (non validi): *${skipped}*`,
    `🔎 Da verificare: *${unknown}*`,
  ];

  if (actionText) {
    lines.push('', actionText);
  }

  return lines.filter((line) => line !== null).join('\n');
}

function createPostSessionManager({
  log = () => {},
  logError = () => {},
  audit = () => {},
  notifyUser = () => {},
  publish = () => {},
  getState = () => ({}),
  getClient = () => null,
  emailNotifier = null,
  isReady = () => getState().connection === 'ready',
  reportSendTimeoutMs = 45000,
  execCommand = exec,
  countdownSeconds = 60,
} = {}) {
  let timer = null;
  let interval = null;

  async function sendSessionReports({ sent, failed, skipped, unknown = 0, activeSession }) {
    const reportState = getState();
    const configuredRecipients = Array.isArray(activeSession?.reportRecipients)
      ? activeSession.reportRecipients
      : (reportState.settings?.reportRecipients || []);
    const activeRecipients = configuredRecipients.filter((recipient) => recipient && recipient.enabled !== false && recipient.phone);
    const configuredEmailRecipients = Array.isArray(activeSession?.reportEmailRecipients)
      ? activeSession.reportEmailRecipients
      : (reportState.settings?.reportEmailRecipients || []);
    const activeEmailRecipients = configuredEmailRecipients
      .filter((recipient) => recipient && recipient.enabled !== false && recipient.email)
      .map((recipient) => recipient.email);
    const configuredMode = activeSession?.reportDeliveryMode || reportState.settings?.reportDeliveryMode;
    const reportDeliveryMode = ['none', 'whatsapp', 'email', 'both'].includes(configuredMode)
      ? configuredMode
      : (activeRecipients.length > 0 ? 'whatsapp' : 'none');

    if (reportDeliveryMode === 'none') return;

    if (reportDeliveryMode === 'email' || reportDeliveryMode === 'both') {
      if (!emailNotifier || typeof emailNotifier.sendReport !== 'function') {
        log('Impossibile inviare il riepilogo e-mail: servizio e-mail non disponibile.');
      } else if (activeEmailRecipients.length === 0) {
        log('Riepilogo e-mail non inviato: nessun destinatario attivo configurato.');
      } else {
        try {
          await emailNotifier.sendReport({
            recipients: activeEmailRecipients,
            text: buildSelfReportMessage({
              sent,
              failed,
              skipped,
              unknown,
              fileName: reportState.fileName || '',
              presetName: activeSession?.presetName || '',
              date: new Date(),
              postSessionAction: activeSession?.postSessionAction || 'none',
            }),
          });
          log(`Riepilogo inviato via e-mail a ${activeEmailRecipients.length} destinatario/i.`);
          audit('info', 'post_session.email_report_sent', { recipients: activeEmailRecipients.length, sent, failed, skipped, unknown });
        } catch (error) {
          logError('post_session.email_report_failed', error, { recipients: activeEmailRecipients.length });
          log(`Invio riepilogo e-mail non riuscito: ${redactDiagnosticText(error.message || error)}`);
        }
      }
    }

    if (reportDeliveryMode === 'email') return;

    const client = getClient();
    if (!client) {
      log('Impossibile inviare il riepilogo: client WhatsApp non disponibile.');
      return;
    }

    const currentState = getState();
    if (!isReady()) {
      log('Riepilogo non inviato: WhatsApp non è pronto.');
      audit('warn', 'post_session.report_skipped_not_ready', { connection: currentState.connection });
      return;
    }
    if (activeRecipients.length === 0) {
      return;
    }

    const text = buildSelfReportMessage({
      sent,
      failed,
      skipped,
      unknown,
      fileName: currentState.fileName || '',
      presetName: activeSession?.presetName || '',
      date: new Date(),
      postSessionAction: activeSession?.postSessionAction || 'none',
    });

    for (const recipient of activeRecipients) {
      const cleanPhone = String(recipient.phone).replace(/\D/g, '');
      if (!cleanPhone) continue;
      const chatId = `${cleanPhone}@c.us`;
      try {
        const result = await withTimeout(
          () => client.sendMessage(chatId, text, buildWhatsAppSendOptions()),
          reportSendTimeoutMs,
          'postSession.sendMessage',
        );
        ensureWhatsAppSendResult(result);
        log(`Riepilogo inviato a WhatsApp per: ${recipient.label || 'Destinatario'} (${maskPhone(cleanPhone)}).`);
        audit('info', 'post_session.report_sent', {
          recipient: maskPhone(cleanPhone),
          label: recipient.label,
          sent,
          failed,
          skipped,
          unknown,
        });
      } catch (error) {
        logError('post_session.report_failed', error, { recipient: maskPhone(cleanPhone), label: recipient.label });
        if (error?.code === 'SEND_TIMEOUT') {
          audit('warn', 'post_session.report_uncertain', {
            recipient: maskPhone(cleanPhone),
            label: recipient.label,
          });
        }
        log(`Invio riepilogo non riuscito al destinatario ${maskPhone(cleanPhone)}: ${redactDiagnosticText(error.message || error)}`);
      }
    }
  }

  async function sendSelfReport(args) {
    return sendSessionReports(args);
  }

  function cancelAction() {
    const currentState = getState();
    const hadAction = Boolean(timer || interval || currentState.postSessionCountdown);

    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (interval) {
      clearInterval(interval);
      interval = null;
    }

    currentState.postSessionCountdown = null;

    if (hadAction) {
      log('Azione di spegnimento/sospensione annullata dall’utente.');
      notifyUser('Azione annullata', 'Lo spegnimento o sospensione del PC è stata annullata.');
      audit('info', 'post_session.action_cancelled');
      publish();
      return true;
    }
    publish();
    return false;
  }

  function scheduleAction(action) {
    if (!['sleep', 'hibernate', 'shutdown'].includes(action)) return;

    cancelAction();

    const currentState = getState();
    let secondsLeft = countdownSeconds;
    currentState.postSessionCountdown = { action, secondsLeft };
    publish();

    const actionNames = {
      sleep: 'sospensione',
      hibernate: 'ibernazione',
      shutdown: 'spegnimento',
    };
    const actionLabel = actionNames[action] || action;
    log(`Azione programmata al termine: ${actionLabel}. Il PC entrerà in stato di ${actionLabel} tra ${secondsLeft} secondi.`);
    notifyUser('Azione post-invio programmata', `Il PC entrerà in stato di ${actionLabel} tra ${secondsLeft} secondi. Puoi annullare dalla schermata.`);

    interval = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0) {
        currentState.postSessionCountdown = { action, secondsLeft };
        publish();
      } else {
        if (interval) clearInterval(interval);
        interval = null;
      }
    }, 1000);

    timer = setTimeout(() => {
      currentState.postSessionCountdown = null;
      publish();
      executeAction(action);
    }, countdownSeconds * 1000);
  }

  function executeAction(action) {
    log(`Esecuzione azione di sistema: ${action}...`);
    audit('info', 'post_session.executing_action', { action });

    if (process.platform !== 'win32') {
      log(`Azione "${action}" non supportata su questo sistema operativo (${process.platform}).`);
      return;
    }

    if (action === 'shutdown') {
      execCommand('shutdown /s /t 0 /f', (err) => {
        if (err) logError('post_session.shutdown_failed', err);
      });
    } else if (action === 'hibernate') {
      execCommand('shutdown /h', (err) => {
        if (err) {
          logError('post_session.hibernate_failed', err);
          log('Ibernazione non riuscita. Verificare se l’ibernazione è abilitata in Windows.');
        }
      });
    } else if (action === 'sleep') {
      const psCmd = 'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState([System.Windows.Forms.PowerState]::Suspend, $false, $false)"';
      execCommand(psCmd, (err) => {
        if (err) logError('post_session.sleep_failed', err);
      });
    }
  }

  return {
    sendSelfReport,
    sendSessionReports,
    scheduleAction,
    cancelAction,
    executeAction,
  };
}

module.exports = {
  buildSelfReportMessage,
  createPostSessionManager,
};
