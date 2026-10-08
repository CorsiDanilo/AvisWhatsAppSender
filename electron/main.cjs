const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const QRCode = require('qrcode');
const semver = require('semver');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { autoUpdater } = require('electron-updater');

const {
  createManualDonor,
  inspectFile,
  parseWithMapping,
  updateDonor,
} = require('../sender/data');
const { createImagePayload, inspectImage } = require('../sender/media');
const { createLogger } = require('../sender/logger');
const { deletePreset, loadPresets, upsertPreset } = require('../sender/presets');
const { writeSessionResult } = require('../sender/results');
const { DEFAULT_SETTINGS, loadSettings, saveSettings } = require('../sender/settings');
const { renderTemplate } = require('../sender/template');
const { SendQueue } = require('../sender/queue');
const { retryAsync } = require('../sender/retry');
const packageInfo = require('../package.json');
const APP_VERSION = packageInfo.version || app.getVersion();

let mainWindow;
let client;
let clientReady = false;
let connectionPromise = null;
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
  filePath: '',
  sheetName: '',
  imageName: '',
  imagePath: '',
  imageDataUrl: '',
  settings: { ...DEFAULT_SETTINGS },
  presets: [],
  defaultOutputDir: '',
  defaultLogDir: '',
  userDataDir: '',
  lastOutcomeDir: '',
  updater: {
    status: 'idle',
    currentVersion: APP_VERSION,
    availableVersion: '',
    releaseNotes: '',
    releaseDate: '',
    progress: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
    error: '',
    lastChecked: null,
  },
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

function killStaleSessionBrowser() {
  if (process.platform === 'win32') {
    try {
      const psScript = 'Get-CimInstance Win32_Process -Filter "Name = \'chrome.exe\'" | Where-Object { $_.CommandLine -like "*whatsapp-session*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }';
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
        windowsHide: true,
        stdio: 'ignore',
        timeout: 5000,
      });
    } catch (err) {
      audit('warn', 'whatsapp.kill_stale_warning', errorDetails(err));
    }
  }

  try {
    const sessionDir = path.join(app.getPath('userData'), 'whatsapp-session', 'session');
    const lockFile = path.join(sessionDir, 'lockfile');
    if (fs.existsSync(lockFile)) {
      fs.unlinkSync(lockFile);
    }
  } catch {}
}

async function destroyClient() {
  if (client) {
    const toDestroy = client;
    client = null;
    clientReady = false;
    try {
      await toDestroy.destroy();
    } catch (err) {
      audit('warn', 'whatsapp.destroy_warning', errorDetails(err));
    }
  }
  killStaleSessionBrowser();
}

function createClient() {
  if (client) return client;

  let executablePath = undefined;
  if (app.isPackaged) {
    executablePath = path.join(process.resourcesPath, 'browser', 'chrome.exe');
  }

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(app.getPath('userData'), 'whatsapp-session'),
    }),
    authTimeoutMs: 60000,
    qrMaxRetries: 3,
    puppeteer: {
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
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
  if (state.connection === 'connecting' || state.connection === 'ready' || state.connection === 'authenticated') {
    return snapshot();
  }
  if (connectionPromise) return connectionPromise;
  return startClientConnection('whatsapp.connecting', 'whatsapp.connect_failed');
}

async function reconnectClient() {
  if (connectionPromise) return connectionPromise;
  log('Rigenerazione del codice QR e riconnessione a WhatsApp...');
  return startClientConnection('whatsapp.reconnecting', 'whatsapp.reconnect_failed');
}

function startClientConnection(startEvent, failureEvent) {
  if (connectionPromise) return connectionPromise;

  connectionPromise = retryAsync(async (attempt) => {
    await destroyClient();
    setConnection('connecting', '');
    audit('info', startEvent, { attempt });
    const whatsapp = createClient();
    await whatsapp.initialize();
    return snapshot();
  }, {
    attempts: 3,
    delayMs: 1500,
    onRetry: async (error, nextAttempt) => {
      log(`Connessione WhatsApp: nuovo tentativo ${nextAttempt}/3...`);
      audit('warn', 'whatsapp.retry', {
        attempt: nextAttempt,
        error: errorDetails(error),
      });
    },
  })
    .catch(async (error) => {
      setConnection('error');
      logError(failureEvent, error);
      await destroyClient();
      throw error;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
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

function getEffectiveOutputDir() {
  return state.settings.outputDir?.trim() || path.join(app.getPath('desktop'), 'AVIS WhatsApp Sender');
}

function getEffectiveLogDir() {
  return state.settings.logDir?.trim() || path.join(app.getPath('userData'), 'logs');
}

function writeOutcome(reason, summary) {
  if (!activeSession || resultWritten) return;
  try {
    const baseDir = getEffectiveOutputDir();
    const folder = writeSessionResult({
      desktopDir: baseDir,
      outputDir: baseDir,
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
    state.lastOutcomeDir = folder;
    audit('info', 'session.result_saved', { folder, reason });
    log(`Esito salvato in: ${folder}`);
    publish();
  } catch (error) {
    logError('session.result_save_failed', error, { reason });
  }
}

async function inspectCsv() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleziona la lista destinatari',
    properties: ['openFile'],
    filters: [{ name: 'File destinatari', extensions: ['csv', 'xlsx', 'xls'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  log(`Apertura file destinatari: ${path.basename(filePath)}...`);
  audit('info', 'recipients.file_inspecting', { filePath });
  const inspection = await inspectFile(filePath);
  log(`File analizzato: fogli [${inspection.sheets.join(', ')}], colonne trovate: [${inspection.headers.join(', ')}]`);
  audit('info', 'recipients.file_inspected', {
    filePath,
    currentSheet: inspection.currentSheet,
    headers: inspection.headers,
    detectedMapping: inspection.detectedMapping,
  });
  return { filePath, inspection };
}

async function inspectCsvSheet(filePath, sheetName) {
  log(`Analisi foglio "${sheetName}" del file ${path.basename(filePath)}...`);
  const inspection = await inspectFile(filePath, sheetName);
  log(`Foglio analizzato: ${inspection.headers.length} colonne trovate.`);
  return { filePath, inspection };
}

async function loadCsvMapped(filePath, sheetName, mapping) {
  state.filePath = filePath;
  state.fileName = path.basename(filePath);
  state.sheetName = sheetName || 'CSV';
  state.donors = await parseWithMapping(filePath, sheetName, mapping);
  state.progress = { current: 0, total: state.donors.length, sent: 0, failed: 0, skipped: 0 };
  state.logs = [];
  log(`Caricati ${state.donors.length} destinatari da ${state.fileName}.`);
  audit('info', 'recipients.loaded', { fileName: state.fileName, count: state.donors.length, mapping });
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
  state.imagePath = imagePath;
  state.imageName = path.basename(imagePath);
  state.imageDataUrl = `data:${inspection.mimeType};base64,${fs.readFileSync(imagePath, 'base64')}`;
  log(`Immagine allegata: ${state.imageName}.`);
  audit('info', 'image.selected', { fileName: state.imageName, size: inspection.size });
  return snapshot();
}

function clearImage() {
  selectedImagePath = '';
  state.imagePath = '';
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

function ensureRecipientEditingAllowed() {
  if (state.queue === 'running' || state.queue === 'paused') {
    throw new Error('Non puoi modificare i destinatari durante l’invio.');
  }
}

function updateDonorAt(index, patch) {
  ensureRecipientEditingAllowed();
  if (!Number.isInteger(index) || !state.donors[index]) {
    throw new Error('Destinatario non trovato.');
  }

  state.donors[index] = updateDonor(state.donors[index], patch);
  audit('info', 'donor.updated', { index, fields: Object.keys(patch || {}) });
  publish();
  return snapshot();
}

function addDonor(input, customFieldKeys = []) {
  ensureRecipientEditingAllowed();
  const donor = createManualDonor(input, customFieldKeys);
  state.donors = [...state.donors, donor];
  state.progress.total = state.donors.length;
  audit('info', 'donor.added', { index: state.donors.length - 1 });
  publish();
  return snapshot();
}

function saveRhythm(options = {}) {
  if (!settingsPath) throw new Error('Percorso impostazioni non disponibile.');
  state.settings = saveSettings(settingsPath, { ...state.settings, ...options });
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
  state.filePath = '';
  state.sheetName = '';
  state.imageName = '';
  state.imagePath = '';
  state.imageDataUrl = '';
  state.queue = 'idle';
  state.progress = { current: 0, total: 0, sent: 0, failed: 0, skipped: 0 };
  state.logs = [];
  state.lastOutcomeDir = '';
  audit('info', 'session.reset');
  log('Interfaccia resettata. WhatsApp e impostazioni sono rimasti collegati.');
  return snapshot();
}

async function selectOutputDir() {
  const current = getEffectiveOutputDir();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleziona la cartella dove salvare gli esiti',
    defaultPath: current,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return snapshot();
  const newDir = result.filePaths[0];
  state.settings = saveSettings(settingsPath, { ...state.settings, outputDir: newDir });
  log(`Cartella esiti impostata su: ${newDir}`);
  audit('info', 'settings.output_dir_changed', { outputDir: newDir });
  publish();
  return snapshot();
}

async function resetOutputDir() {
  state.settings = saveSettings(settingsPath, { ...state.settings, outputDir: '' });
  log('Cartella esiti reimpostata sul Desktop predefinito.');
  audit('info', 'settings.output_dir_reset');
  publish();
  return snapshot();
}

async function selectLogsDir() {
  const current = getEffectiveLogDir();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleziona la cartella dove salvare i log',
    defaultPath: current,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return snapshot();
  const newDir = result.filePaths[0];
  state.settings = saveSettings(settingsPath, { ...state.settings, logDir: newDir });
  logger = createLogger(newDir);
  log(`Cartella log impostata su: ${newDir}`);
  audit('info', 'settings.log_dir_changed', { logDir: newDir });
  publish();
  return snapshot();
}

async function resetLogsDir() {
  state.settings = saveSettings(settingsPath, { ...state.settings, logDir: '' });
  const defaultDir = path.join(app.getPath('userData'), 'logs');
  logger = createLogger(defaultDir);
  log('Cartella log reimpostata sul percorso predefinito.');
  audit('info', 'settings.log_dir_reset');
  publish();
  return snapshot();
}

async function openPathInExplorer(targetPath) {
  if (!targetPath) return false;
  try {
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
  } catch {}
  const errorMessage = await shell.openPath(targetPath);
  if (errorMessage) {
    logError('explorer.open_path_failed', new Error(errorMessage), { targetPath });
    return false;
  }
  return true;
}

async function showItemInExplorer(filePath) {
  if (!filePath) return false;
  if (!fs.existsSync(filePath)) {
    logError('explorer.file_not_found', new Error(`File non trovato: ${filePath}`), { filePath });
    return false;
  }
  shell.showItemInFolder(filePath);
  return true;
}

async function openOutputDir() {
  return openPathInExplorer(getEffectiveOutputDir());
}

async function openLastOutcomeDir() {
  if (state.lastOutcomeDir) {
    return openPathInExplorer(state.lastOutcomeDir);
  }
  return openOutputDir();
}

async function openLogsDir() {
  return openPathInExplorer(getEffectiveLogDir());
}

async function openUserDataDir() {
  return openPathInExplorer(app.getPath('userData'));
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
  state.settings = saveSettings(settingsPath, { ...state.settings, ...options });
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
    minDelayMs: optionNumber(options.minDelayMs, 20000, 0, 10 * 60 * 1000),
    maxDelayMs: optionNumber(options.maxDelayMs, 40000, 0, 10 * 60 * 1000),
    pauseAfter: optionNumber(options.pauseAfter, 35, 0, 1000),
    pauseMs: optionNumber(options.pauseMs, 15 * 60 * 1000, 0, 60 * 60 * 1000),
  });
  state.progress = { current: 0, total: selectedDonors.length, sent: 0, failed: 0, skipped: 0 };
  attachQueueListeners();
  log('Coda avviata.');
  queue.start();
  return snapshot();
}

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');
  mainWindow = new BrowserWindow({
    title: 'AVIS WhatsApp Sender',
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    audit('info', 'window.ready_to_show');
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    audit('info', 'window.did_finish_load');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    audit('error', 'window.did_fail_load', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('console-message', (event) => {
    audit('info', 'window.console', {
      level: event?.level,
      message: event?.message,
      line: event?.lineNumber,
      sourceId: event?.sourceId,
    });
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    const htmlPath = path.join(__dirname, '..', 'gui', 'dist', 'index.html');
    mainWindow.loadFile(htmlPath).catch((err) => {
      audit('error', 'window.load_file_failed', { error: err?.message, htmlPath });
    });
  }
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

registerHandler('sender:inspect-csv', inspectCsv);
registerHandler('sender:inspect-csv-sheet', (filePath, sheetName) => inspectCsvSheet(filePath, sheetName));
registerHandler('sender:load-csv-mapped', (filePath, sheetName, mapping) => loadCsvMapped(filePath, sheetName, mapping));
registerHandler('sender:select-image', selectImage);
registerHandler('sender:clear-image', clearImage);
registerHandler('sender:connect', connectClient);
registerHandler('sender:reconnect', reconnectClient);
registerHandler('sender:get-state', () => snapshot());
registerHandler('sender:start', (options) => startQueue(options));
registerHandler('sender:set-selection', (index, selected) => setDonorSelection(index, selected));
registerHandler('sender:set-all-selected', (selected) => setAllDonorsSelected(selected));
registerHandler('sender:update-donor', (index, patch) => updateDonorAt(index, patch));
registerHandler('sender:add-donor', (input, customFieldKeys) => addDonor(input, customFieldKeys));
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
registerHandler('sender:select-output-dir', selectOutputDir);
registerHandler('sender:reset-output-dir', resetOutputDir);
registerHandler('sender:select-logs-dir', selectLogsDir);
registerHandler('sender:reset-logs-dir', resetLogsDir);
registerHandler('sender:open-output-dir', openOutputDir);
registerHandler('sender:open-last-outcome', openLastOutcomeDir);
registerHandler('sender:open-logs-dir', openLogsDir);
registerHandler('sender:open-user-data-dir', openUserDataDir);
registerHandler('sender:open-path', (targetPath) => openPathInExplorer(targetPath));
registerHandler('sender:show-item', (filePath) => showItemInExplorer(filePath));
registerHandler('sender:check-for-updates', () => checkForUpdatesManual());
registerHandler('sender:download-update', () => downloadUpdateManual());
registerHandler('sender:install-update', () => installUpdateNow());

function initUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = {
    info(msg) { audit('info', 'updater.info', { msg: String(msg) }); },
    warn(msg) { audit('warn', 'updater.warn', { msg: String(msg) }); },
    error(msg) { audit('error', 'updater.error', { msg: String(msg) }); },
  };
  if (!app.isPackaged) {
    autoUpdater.forceDevUpdateConfig = true;
    if (autoUpdater.currentVersion && autoUpdater.currentVersion.constructor) {
      const InternalSemVer = autoUpdater.currentVersion.constructor;
      autoUpdater.currentVersion = new InternalSemVer(APP_VERSION);
    }
    const parentDevConfig = path.join(__dirname, '..', 'dev-app-update.yml');
    const localDevConfig = path.join(__dirname, 'dev-app-update.yml');
    if (fs.existsSync(localDevConfig)) {
      autoUpdater.updateConfigPath = localDevConfig;
    } else if (fs.existsSync(parentDevConfig)) {
      autoUpdater.updateConfigPath = parentDevConfig;
    }
  }

  autoUpdater.on('checking-for-update', () => {
    state.updater.status = 'checking';
    state.updater.error = '';
    publish();
  });

  autoUpdater.on('update-available', (info) => {
    state.updater.status = 'available';
    state.updater.availableVersion = info?.version || '';
    state.updater.releaseNotes = typeof info?.releaseNotes === 'string'
      ? info.releaseNotes
      : (Array.isArray(info?.releaseNotes) ? info.releaseNotes.map((n) => n?.note || '').join('\n') : '');
    state.updater.releaseDate = info?.releaseDate || '';
    state.updater.lastChecked = new Date().toISOString();
    state.updater.error = '';
    log(`Nuovo aggiornamento disponibile: v${info?.version}`);
    publish();
  });

  autoUpdater.on('update-not-available', (info) => {
    state.updater.status = 'not-available';
    state.updater.availableVersion = info?.version || state.updater.currentVersion;
    state.updater.lastChecked = new Date().toISOString();
    state.updater.error = '';
    publish();
  });

  autoUpdater.on('error', (err) => {
    state.updater.status = 'error';
    state.updater.error = err?.message || 'Errore durante la verifica o il download dell\'aggiornamento';
    state.updater.lastChecked = new Date().toISOString();
    audit('error', 'updater.error', { error: err?.message || String(err) });
    publish();
  });

  autoUpdater.on('download-progress', (progressObj) => {
    state.updater.status = 'downloading';
    state.updater.progress = Math.round(progressObj.percent || 0);
    state.updater.bytesPerSecond = Math.round(progressObj.bytesPerSecond || 0);
    state.updater.transferred = Math.round(progressObj.transferred || 0);
    state.updater.total = Math.round(progressObj.total || 0);
    publish();
  });

  autoUpdater.on('update-downloaded', (info) => {
    state.updater.status = 'downloaded';
    state.updater.progress = 100;
    state.updater.availableVersion = info?.version || state.updater.availableVersion;
    log(`Aggiornamento v${state.updater.availableVersion} scaricato. Pronto per l'installazione.`);
    publish();
  });

  // Avvio controllo automatico silente dopo 3.5s dall'apertura della finestra.
  // Posizionato qui per garantire che tutti i listener siano già registrati prima del primo evento.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      audit('warn', 'updater.startup_check_failed', { error: err?.message || String(err) });
    });
  }, 3500);
}

async function checkForUpdatesManual() {
  state.updater.status = 'checking';
  state.updater.error = '';
  publish();
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    state.updater.status = 'error';
    state.updater.error = err.message || 'Impossibile verificare gli aggiornamenti al momento';
    publish();
  }
  return snapshot();
}

async function downloadUpdateManual() {
  if (state.updater.status !== 'available') {
    audit('warn', 'updater.download_skipped', { reason: 'status not available', status: state.updater.status });
    return snapshot();
  }
  state.updater.status = 'downloading';
  state.updater.progress = 0;
  publish();
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    state.updater.status = 'error';
    state.updater.error = err.message || 'Errore durante il download dell\'aggiornamento';
    publish();
  }
  return snapshot();
}

function installUpdateNow() {
  if (state.updater.status === 'downloaded') {
    autoUpdater.quitAndInstall(false, true);
  }
}

app.whenReady().then(() => {
  killStaleSessionBrowser();
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  presetsPath = path.join(app.getPath('userData'), 'presets.json');
  state.settings = loadSettings(settingsPath);
  state.presets = loadPresets(presetsPath);
  state.defaultOutputDir = path.join(app.getPath('desktop'), 'AVIS WhatsApp Sender');
  state.defaultLogDir = path.join(app.getPath('userData'), 'logs');
  state.userDataDir = app.getPath('userData');
  logger = createLogger(getEffectiveLogDir());
  audit('info', 'app.started', {
    settingsPath,
    presetsPath,
    outputDir: getEffectiveOutputDir(),
    logDir: getEffectiveLogDir(),
  });
  createWindow();
  initUpdater();
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

let isQuitting = false;
app.on('before-quit', (e) => {
  if (isQuitting) return;
  queue?.stop();
  if (client) {
    e.preventDefault();
    isQuitting = true;
    destroyClient().finally(() => {
      app.quit();
    });
    setTimeout(() => {
      killStaleSessionBrowser();
      app.quit();
    }, 3000);
  } else {
    killStaleSessionBrowser();
  }
});
