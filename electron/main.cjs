const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const { readDonors } = require('../sender/data');
const { createImagePayload, inspectImage } = require('../sender/media');
const { createLogger } = require('../sender/logger');
const { deletePreset, loadPresets, upsertPreset } = require('../sender/presets');
const { writeSessionResult } = require('../sender/results');
const { DEFAULT_SETTINGS, loadSettings, saveSettings } = require('../sender/settings');
const { renderTemplate } = require('../sender/template');
const { SendQueue } = require('../sender/queue');

let mainWindow;
let client;
let clientReady = false;
let queue;
let selectedFile = '';
let selectedImagePath = '';
let currentMessage = '';
let settingsPath = '';
let presetsPath = '';
let logger = { info() {}, warn() {}, error() {} };
let activeSession;
let resultWritten = false;

const state = {
  connection: 'disconnected',
  qrDataUrl: '',
  donors: [],
  queue: 'idle',
  progress: { current: 0, total: 0, sent: 0, failed: 0, skipped: 0 },
  logs: [],
  fileName: '',
  imageName: '',
  imageDataUrl: '',
  settings: { ...DEFAULT_SETTINGS },
  presets: [],
};

function audit(level, event, details) {
  try {
    logger[level](event, details);
  } catch (error) {
    console.error('Unable to write diagnostic log:', error);
  }
}

function errorDetails(error) {
  return { error: error?.stack || error?.message || String(error) };
}

function snapshot() {
  return JSON.parse(JSON.stringify(state));
}

function publish() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sender:state', snapshot());
  }
}

function log(message) {
  state.logs = [...state.logs, `[${new Date().toLocaleTimeString('it-IT')}] ${message}`].slice(-200);
  audit('info', 'ui.message', { message });
  publish();
}

function logError(message, error, details = {}) {
  state.logs = [...state.logs, `[${new Date().toLocaleTimeString('it-IT')}] ERRORE: ${message}`].slice(-200);
  audit('error', message, { ...details, ...errorDetails(error) });
  publish();
}

function setConnection(connection, qrDataUrl = '') {
  state.connection = connection;
  state.qrDataUrl = qrDataUrl;
  publish();
}

function createClient() {
  if (client) return client;

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(app.getPath('userData'), 'whatsapp-session'),
    }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', async (qr) => {
    try {
      setConnection('qr', await QRCode.toDataURL(qr));
      log('QR pronto: scansiona il codice con WhatsApp.');
    } catch (error) {
      setConnection('error');
      log(`Impossibile creare il QR: ${error.message}`);
    }
  });
  client.on('authenticated', () => {
    setConnection('authenticated');
    log('WhatsApp autenticato.');
    audit('info', 'whatsapp.authenticated');
  });
  client.on('ready', () => {
    clientReady = true;
    setConnection('ready');
    log('WhatsApp pronto per l’invio.');
  });
  client.on('auth_failure', (message) => {
    clientReady = false;
    setConnection('error');
    logError('whatsapp.auth_failure', new Error(message));
  });
  client.on('disconnected', (reason) => {
    clientReady = false;
    setConnection('disconnected');
    log(`WhatsApp disconnesso: ${reason}`);
    audit('warn', 'whatsapp.disconnected', { reason: String(reason) });
  });

  return client;
}

async function connectClient() {
  try {
    const whatsapp = createClient();
    if (state.connection === 'disconnected' || state.connection === 'error') {
      setConnection('connecting');
      audit('info', 'whatsapp.connecting');
      await whatsapp.initialize();
    }
    return snapshot();
  } catch (error) {
    setConnection('error');
    logError('whatsapp.connect_failed', error);
    throw error;
  }
}

function optionNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(number)));
}

async function sendToDonor(donor, message, imagePath) {
  const chatId = `${donor.phone}@c.us`;
  try {
    const chat = await client.getChatById(chatId);
    await chat.sendStateTyping();
    await new Promise((resolve) => setTimeout(resolve, Math.min(4000, Math.max(1000, message.length * 25))));
  } catch {
    // Some valid numbers do not have a retrievable chat until the first message.
  }
  if (imagePath) {
    const payload = createImagePayload(imagePath, message, MessageMedia);
    await client.sendMessage(chatId, payload.media, payload.options);
  } else {
    await client.sendMessage(chatId, message);
  }
}

function attachQueueListeners() {
  queue.on('state', (value) => {
    state.queue = value;
    publish();
  });
  queue.on('log', log);
  queue.on('progress', (progress) => {
    state.progress = progress;
    publish();
  });
  queue.on('item', ({ donor }) => {
    const index = state.donors.findIndex((item) => item.phone === donor.phone && item.name === donor.name);
    if (index >= 0) state.donors[index] = { ...donor };
    publish();
  });
  queue.on('error', ({ donor, error }) => logError('queue.send_failed', error, { donor: donor.name || 'Senza nome' }));
  queue.on('completed', ({ sent, failed, skipped }) => {
    log(`Coda completata: ${sent} inviati, ${failed} falliti, ${skipped} saltati.`);
    writeOutcome('completed', { sent, failed, skipped });
  });
  queue.on('stopped', () => {
    log('Coda fermata dall’operatore.');
    writeOutcome('stopped', { ...state.progress });
  });
}

function writeOutcome(reason, summary) {
  if (!activeSession || resultWritten) return;
  try {
    const folder = writeSessionResult({
      desktopDir: path.join(app.getPath('desktop'), 'AVIS WhatsApp Sender'),
      presetName: activeSession.presetName,
      timestamp: new Date(activeSession.startedAt),
      startedAt: activeSession.startedAt,
      endedAt: new Date().toISOString(),
      reason,
      message: activeSession.message,
      imageName: activeSession.imageName,
      settings: activeSession.settings,
      summary,
      donors: state.donors,
    });
    resultWritten = true;
    audit('info', 'session.result_saved', { folder, reason });
    log(`Esito salvato in: ${folder}`);
  } catch (error) {
    logError('session.result_save_failed', error, { reason });
  }
}

async function selectCsv() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleziona la lista destinatari',
    properties: ['openFile'],
    filters: [{ name: 'File destinatari', extensions: ['csv', 'xlsx', 'xls'] }],
  });
  if (result.canceled || !result.filePaths[0]) return snapshot();

  selectedFile = result.filePaths[0];
  state.donors = await readDonors(selectedFile);
  state.fileName = path.basename(selectedFile);
  state.progress = { current: 0, total: state.donors.length, sent: 0, failed: 0, skipped: 0 };
  state.logs = [];
  log(`Caricati ${state.donors.length} destinatari da ${state.fileName}.`);
  audit('info', 'recipients.loaded', { fileName: state.fileName, count: state.donors.length });
  return snapshot();
}

async function selectImage() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleziona l’immagine da allegare',
    properties: ['openFile'],
    filters: [{ name: 'Immagini', extensions: ['jpg', 'jpeg', 'png'] }],
  });
  if (result.canceled || !result.filePaths[0]) return snapshot();

  const imagePath = result.filePaths[0];
  const inspection = inspectImage(imagePath);
  if (!inspection.valid) throw new Error(inspection.reason);

  selectedImagePath = imagePath;
  state.imageName = path.basename(imagePath);
  state.imageDataUrl = `data:${inspection.mimeType};base64,${fs.readFileSync(imagePath, 'base64')}`;
  log(`Immagine allegata: ${state.imageName}.`);
  audit('info', 'image.selected', { fileName: state.imageName, size: inspection.size });
  return snapshot();
}

function clearImage() {
  selectedImagePath = '';
  state.imageName = '';
  state.imageDataUrl = '';
  log('Allegato rimosso.');
  audit('info', 'image.cleared');
  return snapshot();
}

function setDonorSelection(index, selected) {
  if (!Number.isInteger(index) || !state.donors[index]) return snapshot();
  state.donors[index].selected = Boolean(selected);
  audit('info', 'donor.selection_changed', { index, selected: Boolean(selected) });
  publish();
  return snapshot();
}

function setAllDonorsSelected(selected) {
  const value = Boolean(selected);
  state.donors = state.donors.map((donor) => ({ ...donor, selected: value }));
  audit('info', 'donor.selection_all_changed', { selected: value, count: state.donors.length });
  publish();
  return snapshot();
}

function saveRhythm(options = {}) {
  if (!settingsPath) throw new Error('Percorso impostazioni non disponibile.');
  state.settings = saveSettings(settingsPath, options);
  log('Ritmo di invio salvato.');
  audit('info', 'settings.saved', state.settings);
  return snapshot();
}

function savePreset(preset = {}) {
  if (!presetsPath) throw new Error('Percorso preset non disponibile.');
  state.presets = upsertPreset(presetsPath, preset);
  audit('info', 'preset.saved', { name: preset.name });
  publish();
  return snapshot();
}

function removePreset(name) {
  if (!presetsPath) throw new Error('Percorso preset non disponibile.');
  state.presets = deletePreset(presetsPath, name);
  audit('info', 'preset.deleted', { name });
  publish();
  return snapshot();
}

function resetSession() {
  queue?.stop();
  queue = undefined;
  activeSession = undefined;
  resultWritten = false;
  selectedFile = '';
  selectedImagePath = '';
  currentMessage = '';
  state.donors = [];
  state.fileName = '';
  state.imageName = '';
  state.imageDataUrl = '';
  state.queue = 'idle';
  state.progress = { current: 0, total: 0, sent: 0, failed: 0, skipped: 0 };
  state.logs = [];
  audit('info', 'session.reset');
  log('Interfaccia resettata. WhatsApp e impostazioni sono rimasti collegati.');
  return snapshot();
}

async function startQueue(options = {}) {
  if (!clientReady) throw new Error('WhatsApp non è ancora pronto.');
  if (!state.donors.length) throw new Error('Carica prima un file CSV.');
  currentMessage = String(options.message || '').trim();
  if (!currentMessage) throw new Error('Inserisci un messaggio.');
  if (selectedImagePath && !inspectImage(selectedImagePath).valid) {
    throw new Error('L’immagine selezionata non è più disponibile.');
  }
  const imagePath = selectedImagePath;
  const selectedDonors = state.donors.filter((donor) => donor.selected !== false);
  if (!selectedDonors.length) throw new Error('Seleziona almeno un destinatario.');
  state.settings = saveSettings(settingsPath, options);
  activeSession = {
    presetName: String(options.presetName || 'Senza preset').trim() || 'Senza preset',
    message: currentMessage,
    imageName: state.imageName,
    settings: state.settings,
    startedAt: new Date().toISOString(),
  };
  resultWritten = false;
  audit('info', 'queue.start_requested', { selectedCount: selectedDonors.length, hasImage: Boolean(imagePath) });

  queue = new SendQueue({
    items: selectedDonors,
    render: (donor) => renderTemplate(currentMessage, donor),
    send: (donor, text) => sendToDonor(donor, text, imagePath),
    minDelayMs: optionNumber(options.minDelayMs, 15000, 0, 10 * 60 * 1000),
    maxDelayMs: optionNumber(options.maxDelayMs, 35000, 0, 10 * 60 * 1000),
    pauseAfter: optionNumber(options.pauseAfter, 40, 0, 1000),
    pauseMs: optionNumber(options.pauseMs, 15 * 60 * 1000, 0, 60 * 60 * 1000),
  });
  state.progress = { current: 0, total: selectedDonors.length, sent: 0, failed: 0, skipped: 0 };
  attachQueueListeners();
  log('Coda avviata.');
  queue.start();
  return snapshot();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, '..', 'gui', 'dist', 'index.html'));
}

function registerHandler(channel, handler) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      logError(`ipc.${channel}.failed`, error);
      throw error;
    }
  });
}

registerHandler('sender:select-csv', selectCsv);
registerHandler('sender:select-image', selectImage);
registerHandler('sender:clear-image', clearImage);
registerHandler('sender:connect', connectClient);
registerHandler('sender:get-state', () => snapshot());
registerHandler('sender:start', (options) => startQueue(options));
registerHandler('sender:set-selection', (index, selected) => setDonorSelection(index, selected));
registerHandler('sender:set-all-selected', (selected) => setAllDonorsSelected(selected));
registerHandler('sender:save-settings', (options) => saveRhythm(options));
registerHandler('sender:save-preset', (preset) => savePreset(preset));
registerHandler('sender:delete-preset', (name) => removePreset(name));
registerHandler('sender:reset', () => resetSession());
registerHandler('sender:pause', () => {
  queue?.pause();
  audit('info', 'queue.paused');
  return snapshot();
});
registerHandler('sender:resume', () => {
  queue?.resume();
  audit('info', 'queue.resumed');
  return snapshot();
});
registerHandler('sender:stop', () => {
  queue?.stop();
  audit('info', 'queue.stopped');
  return snapshot();
});

app.whenReady().then(() => {
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  presetsPath = path.join(app.getPath('userData'), 'presets.json');
  state.settings = loadSettings(settingsPath);
  state.presets = loadPresets(presetsPath);
  logger = createLogger(path.join(app.getPath('userData'), 'logs'));
  audit('info', 'app.started', { settingsPath, presetsPath });
  createWindow();
  publish();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  audit('info', 'app.windows_closed');
  if (process.platform !== 'darwin') app.quit();
});

app.on('render-process-gone', (_event, _webContents, details) => {
  audit('error', 'electron.render_process_gone', details);
});

app.on('child-process-gone', (_event, details) => {
  audit('error', 'electron.child_process_gone', details);
});

process.on('uncaughtException', (error) => {
  audit('error', 'process.uncaught_exception', errorDetails(error));
});

process.on('unhandledRejection', (reason) => {
  audit('error', 'process.unhandled_rejection', errorDetails(reason));
});

app.on('before-quit', async () => {
  queue?.stop();
  if (client) await client.destroy().catch(() => {});
});
