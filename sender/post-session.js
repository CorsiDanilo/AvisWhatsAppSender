const { exec } = require('node:child_process');

function buildSelfReportMessage({
  sent = 0,
  failed = 0,
  skipped = 0,
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
    `✅ Inviati con successo: *${sent}*`,
    `❌ Falliti: *${failed}*`,
    `⚠️ Saltati (non validi): *${skipped}*`,
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
  execCommand = exec,
  countdownSeconds = 60,
} = {}) {
  let timer = null;
  let interval = null;

  async function sendSessionReports({ sent, failed, skipped, activeSession }) {
    const client = getClient();
    if (!client) {
      log('Impossibile inviare il riepilogo: client WhatsApp non disponibile.');
      return;
    }

    const currentState = getState();
    const configuredRecipients = Array.isArray(activeSession?.reportRecipients)
      ? activeSession.reportRecipients
      : (currentState.settings?.reportRecipients || []);

    const activeRecipients = configuredRecipients.filter((r) => r && r.enabled !== false && r.phone);

    if (activeRecipients.length === 0) {
      return;
    }

    const text = buildSelfReportMessage({
      sent,
      failed,
      skipped,
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
        await client.sendMessage(chatId, text);
        log(`Riepilogo inviato su WhatsApp a: ${recipient.label || 'Destinatario'} (${cleanPhone}).`);
        audit('info', 'post_session.report_sent', { recipient: chatId, label: recipient.label, sent, failed, skipped });
      } catch (error) {
        logError('post_session.report_failed', error, { recipient: chatId, label: recipient.label });
        log(`Invio riepilogo non riuscito a ${recipient.label || cleanPhone}: ${error.message || error}`);
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
