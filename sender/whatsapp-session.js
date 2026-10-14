const { retryAsync } = require('./retry');

function createWhatsAppSessionController({
  createClient,
  renderQr = async (qr) => qr,
  destroyClient = async (client) => client?.destroy?.(),
  retry = retryAsync,
  retryOptions = {},
  setConnection = () => {},
  pauseQueue = () => {},
  audit = () => {},
  log = () => {},
  notify = () => {},
  onClientCreated = () => {},
  onFailure = () => {},
} = {}) {
  if (typeof createClient !== 'function') throw new TypeError('createClient deve essere una funzione.');

  let client = null;
  let clientReady = false;
  let connection = 'disconnected';
  let qrDataUrl = '';
  let connectionPromise = null;
  let connectionGeneration = 0;
  let sessionResetter = async () => {};

  function snapshot() {
    return { connection, qrDataUrl, clientReady };
  }

  function transition(nextConnection, nextQrDataUrl = '') {
    connection = nextConnection;
    qrDataUrl = nextQrDataUrl;
    setConnection(nextConnection, nextQrDataUrl);
  }

  function pauseForConnection(reason) {
    pauseQueue(reason);
    audit('warn', 'queue.auto_paused_on_connection_issue', { reason });
  }

  function current(candidate) {
    return client === candidate;
  }

  function attachClientEvents(candidate) {
    candidate.on('qr', async (qr) => {
      if (!current(candidate)) return;
      if (connection === 'qr') return;
      try {
        transition('qr', await renderQr(qr));
        pauseForConnection('qr');
        log('QR pronto: scansiona il codice con WhatsApp.');
        notify('QR pronto', 'Il codice QR di WhatsApp è pronto per essere scansionato.');
      } catch (error) {
        transition('error');
        pauseForConnection('qr-generation-error');
        audit('error', 'whatsapp.qr_generation_failed', { error: error?.message || String(error) });
        log(`Impossibile creare il QR: ${error?.message || error}`);
        notify('Errore WhatsApp', 'Impossibile generare il codice QR.');
      }
    });

    candidate.on('authenticated', () => {
      if (!current(candidate)) return;
      transition('authenticated');
      log('WhatsApp autenticato.');
      audit('info', 'whatsapp.authenticated');
    });

    candidate.on('ready', () => {
      if (!current(candidate)) return;
      clientReady = true;
      transition('ready');
      log('WhatsApp pronto per l’invio.');
      audit('info', 'whatsapp.ready');
      notify('WhatsApp collegato', 'WhatsApp è collegato e pronto per l’invio dei messaggi.');
    });

    candidate.on('auth_failure', (message) => {
      if (!current(candidate)) return;
      clientReady = false;
      transition('error');
      audit('error', 'whatsapp.auth_failure', { message: String(message) });
      pauseForConnection('auth-failure');
      notify('Errore WhatsApp', 'La sessione WhatsApp non è stata autenticata.');
    });

    candidate.on('disconnected', async (reason) => {
      if (!current(candidate)) return;
      const reasonStr = String(reason || '');
      const isQrRetriesReached = /max.*qr.*retries/i.test(reasonStr);

      if (isQrRetriesReached) {
        client = null;
        clientReady = false;
        transition('qr_expired', qrDataUrl);
        audit('info', 'whatsapp.qr_expired', { reason: reasonStr });
        pauseForConnection('qr_expired');
        log('Codice QR scaduto per inattività. Clicca su "Ricarica codice QR" per generarne uno nuovo.');
        try {
          await destroyClient(candidate);
        } catch (error) {
          audit('warn', 'whatsapp.destroy_warning', { error: error?.message || String(error) });
        }
        return;
      }

      const wasDisconnected = connection === 'disconnected';
      clientReady = false;
      transition('disconnected');
      audit('warn', 'whatsapp.disconnected', { reason: reasonStr });
      pauseForConnection(`disconnected:${reasonStr}`);
      if (!wasDisconnected) {
        notify('WhatsApp disconnesso', 'La sessione WhatsApp è stata disconnessa.');
      }
      if (/logout/i.test(reasonStr)) {
        try {
          await sessionResetter();
          audit('info', 'whatsapp.session_cleared_on_logout');
          log('Sessione WhatsApp rimossa a seguito di disconnessione (logout).');
        } catch (error) {
          audit('warn', 'whatsapp.session_clear_on_logout_failed', { error: error?.message || String(error) });
        }
      }
    });
  }

  async function destroyCurrent() {
    const toDestroy = client;
    client = null;
    clientReady = false;
    if (!toDestroy) return;
    try {
      await destroyClient(toDestroy);
    } catch (error) {
      audit('warn', 'whatsapp.destroy_warning', { error: error?.message || String(error) });
    }
  }

  function startConnection(startEvent = 'whatsapp.connecting', failureEvent = 'whatsapp.connect_failed') {
    if (connectionPromise) return connectionPromise;
    pauseForConnection(`connection:${startEvent}`);
    const generation = ++connectionGeneration;
    const isCurrent = () => generation === connectionGeneration;
    let lastAttempt = 0;

    const promise = retry(async (attempt) => {
      if (!isCurrent()) throw new Error('Tentativo di connessione annullato');
      lastAttempt = attempt;
      await destroyCurrent();
      if (!isCurrent()) throw new Error('Tentativo di connessione annullato');
      transition('connecting');
      audit('info', startEvent, { attempt });
      const nextClient = createClient();
      client = nextClient;
      attachClientEvents(nextClient);
      onClientCreated(nextClient, attempt);
      await nextClient.initialize();
      if (!isCurrent()) throw new Error('Tentativo di connessione annullato');
      return snapshot();
    }, {
      attempts: 2,
      delayMs: 1500,
      ...retryOptions,
      shouldRetry: () => isCurrent(),
      onRetry: async (error, nextAttempt) => {
        if (!isCurrent()) return;
        audit('warn', 'whatsapp.retry', {
          attempt: nextAttempt,
          error: error?.message || String(error),
        });
        log(`Connessione WhatsApp: nuovo tentativo ${nextAttempt}...`);
      },
    })
      .catch(async (error) => {
        if (!isCurrent()) return snapshot();
        transition('error');
        audit('error', failureEvent, {
          attempt: lastAttempt,
          error: error?.message || String(error),
        });
        await onFailure(error, lastAttempt, failureEvent);
        await destroyCurrent();
        throw error;
      })
      .finally(() => {
        if (connectionPromise === promise) connectionPromise = null;
      });

    connectionPromise = promise;
    return promise;
  }

  async function connect() {
    if (['connecting', 'authenticated', 'ready'].includes(connection)) return snapshot();
    return startConnection('whatsapp.connecting', 'whatsapp.connect_failed');
  }

  async function reconnect() {
    return startConnection('whatsapp.reconnecting', 'whatsapp.reconnect_failed');
  }

  async function reset({ reconnectAfter = true } = {}) {
    pauseForConnection('connection:whatsapp.resetting');
    connectionGeneration += 1;
    connectionPromise = null;
    await destroyCurrent();
    await sessionResetter();
    transition('disconnected');
    if (reconnectAfter) return reconnect();
    return snapshot();
  }

  function ensureReady() {
    if (!client || !clientReady || connection !== 'ready') {
      const error = new Error('WhatsApp non è pronto per l’invio.');
      error.code = 'WHATSAPP_NOT_READY';
      throw error;
    }
  }

  return {
    attachClientEvents,
    connect,
    reconnect,
    reset,
    setSessionResetter: (resetter) => { sessionResetter = resetter; },
    destroy: destroyCurrent,
    ensureReady,
    getClient: () => client,
    isReady: () => Boolean(client && clientReady && connection === 'ready'),
    snapshot,
  };
}

module.exports = { createWhatsAppSessionController };
