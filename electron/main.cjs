const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  dialog,
  ipcMain,
  nativeImage,
  shell,
  clipboard,
} = require('electron');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const QRCode = require('qrcode');
const semver = require('semver');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { autoUpdater } = require('electron-updater');

app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.disableHardwareAcceleration();

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
const {
  appendNotification,
  clearAllNotifications,
  deleteNotification,
  loadNotificationState,
  markAllNotificationsRead,
  markNotificationRead,
  notificationUnreadCount,
  saveNotificationState,
  shouldShowAttentionIndicator,
} = require('../sender/notifications');
const { renderTemplate } = require('../sender/template');
const { buildDeveloperReport, buildMailtoUrl, buildEmlContent } = require('../sender/developer-report');
const { SendQueue } = require('../sender/queue');
const { retryAsync } = require('../sender/retry');
const {
  copyPresetAttachment,
  deletePresetAttachment,
  resolvePresetAttachment,
} = require('../sender/preset-attachments');
const {
  findBirthdays,
  formatLocalDateKey,
} = require('../sender/birthdays');
const {
  inspectBirthdaySource,
  loadBirthdaySource,
  resolveBirthdaySource,
} = require('../sender/birthday-source');
const {
  loadBirthdayState,
  markBirthdayPrompted,
  saveBirthdayState,
  shouldPromptBirthday,
} = require('../sender/birthday-state');
const {
  summarizePageSnapshot,
  truncateDiagnosticText,
} = require('../sender/whatsappDiagnostics');
const { handleWindowClose, showWindow } = require('../sender/window-lifecycle');
const packageInfo = require('../package.json');
const APP_VERSION = packageInfo.version || app.getVersion();
const MAX_CONNECTION_ATTEMPTS = 2;
const APP_ICON_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.ico')
  : path.join(__dirname, '..', 'build', 'icon.ico');
const APP_NOTIFICATION_ICON_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'icon-notification.ico')
  : path.join(__dirname, '..', 'build', 'icon-notification.ico');
const APP_DISPLAY_NAME = 'AVIS WhatsApp Sender';

app.setName(APP_DISPLAY_NAME);
app.setPath('userData', path.join(app.getPath('appData'), 'aviswhatsappsender'));

let mainWindow;
let tray;
let client;
let clientReady = false;
let connectionPromise = null;
const diagnosticPages = new WeakSet();
let queue;
let selectedFile = '';
let selectedImagePath = '';
let currentMessage = '';
let settingsPath = '';
let presetsPath = '';
let notificationsPath = '';
let notificationState = { items: [] };
let birthdayStatePath = '';
let birthdayState = {};
let logger = { info() {}, warn() {}, error() {} };
let activeSession;
let resultWritten = false;
let baseTrayImage;
let notificationTrayImage;

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
  notifications: {
    items: [],
    unreadCount: 0,
  },
  birthdays: {
    status: 'not-configured',
    dateKey: '',
    sourcePath: '',
    sourceFileName: '',
    sourceModifiedAt: null,
    lastCheckedAt: null,
    matches: [],
    invalidRows: [],
    pendingCount: 0,
    notificationPending: false,
    sessionPrepared: false,
    error: '',
  },
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

function attachWhatsAppPageDiagnostics(whatsapp, attempt) {
  const page = whatsapp?.pupPage;
  if (!page || diagnosticPages.has(page)) return Boolean(page);

  diagnosticPages.add(page);
  const pageDetails = (details = {}) => ({ attempt, ...details });

  page.on('framenavigated', (frame) => {
    if (frame.parentFrame() !== null) return;
    audit('info', 'whatsapp.browser_navigation', pageDetails({ url: frame.url() }));
  });
  page.on('console', (message) => {
    audit('info', 'whatsapp.browser_console', pageDetails({
      level: message.type(),
      message: truncateDiagnosticText(message.text()),
      location: message.location(),
    }));
  });
  page.on('pageerror', (error) => {
    audit('error', 'whatsapp.browser_page_error', pageDetails(errorDetails(error)));
  });
  page.on('requestfailed', (request) => {
    audit('warn', 'whatsapp.browser_request_failed', pageDetails({
      method: request.method(),
      url: truncateDiagnosticText(request.url(), 500),
      failure: request.failure(),
    }));
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && /whatsapp\.com/i.test(url)) {
      audit('warn', 'whatsapp.browser_http_error', pageDetails({
        status,
        url: truncateDiagnosticText(url, 500),
      }));
    }
  });

  audit('info', 'whatsapp.browser_diagnostics_attached', pageDetails());
  return true;
}

async function watchWhatsAppPage(whatsapp, attempt) {
  for (let check = 0; check < 100; check += 1) {
    if (attachWhatsAppPageDiagnostics(whatsapp, attempt)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  audit('warn', 'whatsapp.browser_diagnostics_unavailable', { attempt });
}

async function logWhatsAppPageSnapshot(whatsapp, error, attempt) {
  const page = whatsapp?.pupPage;
  const snapshot = {};
  let browserVersion = '';

  if (page) {
    try {
      snapshot.url = page.url();
      snapshot.title = await page.title();
      Object.assign(snapshot, await page.evaluate(() => ({
        readyState: document.readyState,
        debugVersion: window.Debug?.VERSION || '',
        online: navigator.onLine,
      })));
    } catch (pageError) {
      audit('warn', 'whatsapp.browser_snapshot_failed', {
        attempt,
        error: errorDetails(pageError),
      });
    }
  }

  try {
    browserVersion = await whatsapp?.pupBrowser?.version?.() || '';
  } catch (browserError) {
    audit('warn', 'whatsapp.browser_version_failed', {
      attempt,
      error: errorDetails(browserError),
    });
  }

  audit('error', 'whatsapp.browser_timeout_diagnostic', {
    attempt,
    cause: errorDetails(error),
    browserVersion,
    page: summarizePageSnapshot(snapshot),
  });
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

function notificationErrorBody(error, context = 'generic') {
  const message = String(error?.message || error || '').toLowerCase();
  if (context === 'whatsapp' || /whatsapp|auth|qr|browser|puppeteer|timeout/.test(message)) {
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

function showMainWindow() {
  return showWindow(mainWindow, () => {
    checkBirthdays({ force: true, notify: false }).catch((error) => {
      audit('error', 'birthday.window_open_check_failed', errorDetails(error));
    });
  });
}

function sendBirthdayOpenEvent() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const send = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sender:open-birthdays');
    }
  };
  if (mainWindow.webContents.isLoading()) {
    mainWindow.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

function notifyUser(title, body, options = {}) {
  const notificationRecord = recordNotification(title, body, options);
  if (state.settings.notificationsEnabled !== true) return false;
  if (process.platform !== 'win32' || typeof Notification !== 'function' || !Notification.isSupported()) {
    audit('warn', 'notification.unsupported', { platform: process.platform });
    return false;
  }

  try {
    const nativeNotification = new Notification({
      title: `AVIS WhatsApp Sender — ${title}`,
      body,
      silent: false,
    });
    nativeNotification.on('click', () => {
      markStoredNotificationRead(notificationRecord.id);
      showMainWindow();
      if (options.clickAction === 'open-birthdays') sendBirthdayOpenEvent();
    });
    nativeNotification.show();
    audit('info', 'notification.shown', { title, body });
    return true;
  } catch (error) {
    audit('warn', 'notification.failed', { title, error: errorDetails(error) });
    return false;
  }
}

function syncNotificationState() {
  state.notifications = {
    items: notificationState.items,
    unreadCount: notificationUnreadCount(notificationState),
  };
  updateNotificationIndicators();
}

function getBaseTrayImage() {
  if (!baseTrayImage && fs.existsSync(APP_ICON_PATH)) {
    baseTrayImage = nativeImage.createFromPath(APP_ICON_PATH);
  }
  return baseTrayImage;
}

function getNotificationTrayImage() {
  if (!notificationTrayImage && fs.existsSync(APP_NOTIFICATION_ICON_PATH)) {
    notificationTrayImage = nativeImage.createFromPath(APP_NOTIFICATION_ICON_PATH);
  }
  return notificationTrayImage;
}

function updateNotificationIndicators() {
  if (process.platform !== 'win32') return;
  const hasUnreadNotifications = shouldShowAttentionIndicator(notificationState, state.birthdays);

  if (mainWindow && !mainWindow.isDestroyed() && typeof mainWindow.setIcon === 'function') {
    if (hasUnreadNotifications) {
      const badgeImage = getNotificationTrayImage();
      if (badgeImage && !badgeImage.isEmpty()) mainWindow.setIcon(badgeImage);
    } else {
      const defaultImage = getBaseTrayImage();
      if (defaultImage && !defaultImage.isEmpty()) mainWindow.setIcon(defaultImage);
    }
  }

  if (!tray) return;
  if (hasUnreadNotifications) {
    const badgeImage = getNotificationTrayImage();
    if (badgeImage && !badgeImage.isEmpty()) tray.setImage(badgeImage);
  } else {
    const defaultImage = getBaseTrayImage();
    if (defaultImage && !defaultImage.isEmpty()) tray.setImage(defaultImage);
  }
}

function persistNotificationState() {
  if (notificationsPath) notificationState = saveNotificationState(notificationsPath, notificationState);
  syncNotificationState();
}

function recordNotification(title, body, options = {}) {
  const notificationId = options.id || undefined;
  notificationState = appendNotification(notificationState, {
    id: notificationId,
    title,
    body,
    category: options.category || 'general',
    action: options.clickAction || '',
  });
  persistNotificationState();
  publish();
  return notificationState.items[0];
}

function markStoredNotificationRead(id, read = true) {
  const notification = notificationState.items.find((item) => item.id === id);
  notificationState = markNotificationRead(
    notificationState,
    id,
    read ? new Date().toISOString() : null
  );
  if (notification?.category === 'birthdays') {
    state.birthdays.notificationPending = notificationState.items.some(
      (item) => item.category === 'birthdays' && !item.readAt
    );
  }
  persistNotificationState();
  publish();
  return snapshot();
}

function markAllStoredNotificationsRead() {
  notificationState = markAllNotificationsRead(notificationState);
  state.birthdays.notificationPending = false;
  persistNotificationState();
  publish();
  return snapshot();
}

function clearAllStoredNotifications() {
  notificationState = clearAllNotifications(notificationState);
  state.birthdays.notificationPending = false;
  persistNotificationState();
  publish();
  return snapshot();
}

function deleteStoredNotification(id) {
  notificationState = deleteNotification(notificationState, id);
  state.birthdays.notificationPending = notificationState.items.some(
    (item) => item.category === 'birthdays' && !item.readAt
  );
  persistNotificationState();
  publish();
  return snapshot();
}

function persistBirthdayState(nextState) {
  birthdayState = nextState;
  if (birthdayStatePath) saveBirthdayState(birthdayStatePath, birthdayState);
  return birthdayState;
}

function birthdayStateError(status, dateKey, sourcePath, error) {
  state.birthdays = {
    ...state.birthdays,
    status,
    dateKey,
    sourcePath: sourcePath || '',
    sourceFileName: sourcePath ? path.basename(sourcePath) : '',
    lastCheckedAt: new Date().toISOString(),
    matches: [],
    invalidRows: [],
    pendingCount: 0,
    notificationPending: false,
    sessionPrepared: false,
    error: error?.message || String(error),
  };
  updateNotificationIndicators();
  publish();
  return snapshot();
}

async function checkBirthdays({ force = false, notify = false } = {}) {
  const dateKey = formatLocalDateKey(new Date());
  if (!state.settings.birthdayEnabled) {
    state.birthdays = {
      ...state.birthdays,
      status: 'disabled',
      dateKey,
      notificationPending: false,
      error: '',
    };
    updateNotificationIndicators();
    publish();
    return snapshot();
  }

  if (!force && birthdayState.lastCheckDate === dateKey && state.birthdays.dateKey === dateKey) {
    return snapshot();
  }

  const resolved = resolveBirthdaySource(state.settings.birthdaySourceFilePath);
  if (resolved.errorCode) {
    persistBirthdayState({ ...birthdayState, lastCheckDate: dateKey });
    audit('warn', `birthday.source_${resolved.errorCode}`, { message: resolved.message });
    const status = resolved.errorCode === 'not-configured' ? 'not-configured' : 'error';
    return birthdayStateError(status, dateKey, '', new Error(resolved.message));
  }

  const inspection = await inspectBirthdaySource(resolved.filePath);
  if (inspection.errorCode) {
    persistBirthdayState({ ...birthdayState, lastCheckDate: dateKey });
    audit('warn', 'birthday.source_invalid', { filePath: resolved.filePath, message: inspection.message });
    return birthdayStateError('error', dateKey, resolved.filePath, new Error(inspection.message));
  }

  try {
    const loaded = await loadBirthdaySource(
      resolved.filePath,
      inspection.currentSheet,
      inspection.detectedMapping
    );
    const { matches, invalid } = findBirthdays(loaded.donors, new Date());
    const shouldNotify = notify && matches.length > 0 && shouldPromptBirthday(birthdayState, dateKey);
    const nextState = {
      ...birthdayState,
      lastCheckDate: dateKey,
    };
    if (shouldNotify) Object.assign(nextState, markBirthdayPrompted(nextState, dateKey));
    persistBirthdayState(nextState);

    state.birthdays = {
      status: matches.length > 0 ? 'ready' : 'empty',
      dateKey,
      sourcePath: resolved.filePath,
      sourceFileName: resolved.fileName,
      sourceModifiedAt: loaded.sourceMtimeMs,
      lastCheckedAt: new Date().toISOString(),
      matches,
      invalidRows: [...loaded.invalidRows, ...invalid.filter((donor) => !loaded.invalidRows.includes(donor))],
      pendingCount: matches.length,
      notificationPending: shouldNotify,
      sessionPrepared: birthdayState.lastPreparedDate === dateKey,
      error: '',
    };
    updateNotificationIndicators();
    audit('info', 'birthday.checked', {
      fileName: resolved.fileName,
      matches: matches.length,
      invalidRows: state.birthdays.invalidRows.length,
      dateKey,
    });
    publish();

    if (shouldNotify) {
      notifyUser(
        'Compleanni AVIS',
        `Oggi ci sono ${matches.length} ${matches.length === 1 ? 'donatore' : 'donatori'} da avvisare.`,
        { clickAction: 'open-birthdays', category: 'birthdays' }
      );
    }
    return snapshot();
  } catch (error) {
    persistBirthdayState({ ...birthdayState, lastCheckDate: dateKey });
    audit('error', 'birthday.check_failed', { filePath: resolved.filePath, error: errorDetails(error) });
    return birthdayStateError('error', dateKey, resolved.filePath, error);
  }
}

function dismissBirthdayReminder() {
  state.birthdays.notificationPending = false;
  updateNotificationIndicators();
  publish();
  return snapshot();
}

function toggleBirthdayInhibition() {
  const dateKey = formatLocalDateKey(new Date());
  if (birthdayState.lastPreparedDate === dateKey) {
    // Re-enable
    persistBirthdayState({ ...birthdayState, lastPreparedDate: null });
    state.birthdays.sessionPrepared = false;
  } else {
    // Inhibit
    persistBirthdayState({ ...birthdayState, lastPreparedDate: dateKey });
    state.birthdays.sessionPrepared = true;
    state.birthdays.notificationPending = false;
  }
  updateNotificationIndicators();
  publish();
  return snapshot();
}

async function prepareBirthdaySession() {
  if (state.queue === 'running' || state.queue === 'paused') {
    throw new Error('Non puoi preparare gli auguri durante un invio in corso.');
  }

  const resolved = resolveBirthdaySource(state.settings.birthdaySourceFilePath);
  if (resolved.errorCode) throw new Error(resolved.message);

  const inspection = await inspectBirthdaySource(resolved.filePath);
  if (inspection.errorCode) throw new Error(inspection.message);
  const loaded = await loadBirthdaySource(resolved.filePath, inspection.currentSheet, inspection.detectedMapping);
  const { matches, invalid } = findBirthdays(loaded.donors, new Date());
  if (!matches.length) throw new Error('Non ci sono compleanni da preparare per oggi.');

  selectedFile = resolved.filePath;
  selectedImagePath = '';
  currentMessage = '';
  activeSession = undefined;
  resultWritten = false;
  state.donors = matches;
  state.fileName = resolved.fileName;
  state.filePath = resolved.filePath;
  state.sheetName = inspection.currentSheet || 'CSV';
  state.imageName = '';
  state.imagePath = '';
  state.imageDataUrl = '';
  state.queue = 'idle';
  state.progress = { current: 0, total: matches.length, sent: 0, failed: 0, skipped: 0 };
  state.logs = [];
  state.birthdays = {
    ...state.birthdays,
    status: 'ready',
    dateKey: formatLocalDateKey(new Date()),
    sourcePath: resolved.filePath,
    sourceFileName: resolved.fileName,
    sourceModifiedAt: loaded.sourceMtimeMs,
    matches,
    invalidRows: [...loaded.invalidRows, ...invalid.filter((donor) => !loaded.invalidRows.includes(donor))],
    pendingCount: matches.length,
    notificationPending: false,
    sessionPrepared: true,
    error: '',
  };
  updateNotificationIndicators();
  persistBirthdayState({
    ...birthdayState,
    lastPreparedDate: state.birthdays.dateKey,
  });
  audit('info', 'birthday.session_prepared', { fileName: resolved.fileName, count: matches.length });
  log(`Preparata sessione auguri per ${matches.length} destinatari.`);
  return snapshot();
}

async function selectBirthdaySource() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleziona il file della lista compleanni',
    defaultPath: state.settings.birthdaySourceFilePath || app.getPath('documents'),
    properties: ['openFile'],
    filters: [{ name: 'Liste donatori', extensions: ['csv', 'xlsx', 'xls'] }],
  });
  if (result.canceled || !result.filePaths[0]) return snapshot();
  state.settings = saveSettings(settingsPath, {
    ...state.settings,
    birthdaySourceFilePath: result.filePaths[0],
  });
  state.birthdays = {
    ...state.birthdays,
    status: 'not-checked',
    sourcePath: result.filePaths[0],
    sourceFileName: path.basename(result.filePaths[0]),
    error: '',
  };
  audit('info', 'birthday.source_changed', { sourceFilePath: result.filePaths[0] });
  publish();
  return snapshot();
}

function setStartWithWindows(enabled) {
  const value = Boolean(enabled);
  state.settings = saveSettings(settingsPath, { ...state.settings, startWithWindows: value });
  configureAutoStart(value);
  publish();
  return snapshot();
}

function configureAutoStart(enabled) {
  if (process.platform !== 'win32') return;
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(enabled),
      args: ['--avis-background'],
    });
    audit('info', 'app.autostart_configured', { enabled: Boolean(enabled) });
  } catch (error) {
    audit('warn', 'app.autostart_failed', errorDetails(error));
  }
}

function openBirthdayCenter() {
  showMainWindow();
  sendBirthdayOpenEvent();
  return snapshot();
}

function setStoredNotificationRead(id, read) {
  const notification = notificationState.items.find((item) => item.id === id);
  if (!notification) return snapshot();
  return markStoredNotificationRead(id, read !== false);
}

function notificationContextForChannel(channel) {
  if (/csv|donor|recipient/i.test(channel)) return 'import';
  if (/connect|whatsapp/i.test(channel)) return 'whatsapp';
  if (/update/i.test(channel)) return 'update';
  return 'generic';
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
    authTimeoutMs: 30000,
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
      const shouldNotify = state.connection !== 'qr';
      setConnection('qr', await QRCode.toDataURL(qr));
      log('QR pronto: scansiona il codice con WhatsApp.');
      if (shouldNotify) notifyUser('QR pronto', 'Il codice QR di WhatsApp è pronto per essere scansionato.');
    } catch (error) {
      setConnection('error');
      log(`Impossibile creare il QR: ${error.message}`);
      notifyUser('Errore WhatsApp', notificationErrorBody(error, 'whatsapp'));
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
    notifyUser('WhatsApp collegato', 'WhatsApp è collegato e pronto per l’invio dei messaggi.');
    log('WhatsApp pronto per l’invio.');
  });
  client.on('auth_failure', (message) => {
    clientReady = false;
    setConnection('error');
    logError('whatsapp.auth_failure', new Error(message));
    notifyUser('Errore WhatsApp', notificationErrorBody(message, 'whatsapp'));
  });
  client.on('disconnected', (reason) => {
    const wasReady = state.connection === 'ready';
    clientReady = false;
    setConnection('disconnected');
    log(`WhatsApp disconnesso: ${reason}`);
    audit('warn', 'whatsapp.disconnected', { reason: String(reason) });
    if (wasReady) notifyUser('WhatsApp disconnesso', 'La sessione WhatsApp è stata disconnessa.');
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
  let lastAttempt = 0;

  connectionPromise = retryAsync(async (attempt) => {
    lastAttempt = attempt;
    await destroyClient();
    setConnection('connecting', '');
    audit('info', startEvent, { attempt });
    const whatsapp = createClient();
    watchWhatsAppPage(whatsapp, attempt).catch((error) => {
      audit('warn', 'whatsapp.browser_diagnostics_failed', {
        attempt,
        error: errorDetails(error),
      });
    });
    await whatsapp.initialize();
    return snapshot();
  }, {
    attempts: MAX_CONNECTION_ATTEMPTS,
    delayMs: 1500,
    onRetry: async (error, nextAttempt) => {
      await logWhatsAppPageSnapshot(client, error, nextAttempt - 1);
      log(`Connessione WhatsApp: nuovo tentativo ${nextAttempt}/${MAX_CONNECTION_ATTEMPTS}...`);
      audit('warn', 'whatsapp.retry', {
        attempt: nextAttempt,
        error: errorDetails(error),
      });
    },
  })
    .catch(async (error) => {
      await logWhatsAppPageSnapshot(client, error, lastAttempt);
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
    notifyUser('Invio completato', `${sent} inviati, ${failed} falliti, ${skipped} saltati.`);
    writeOutcome('completed', { sent, failed, skipped });
  });
  queue.on('stopped', () => {
    log('Coda fermata dall’operatore.');
    notifyUser('Invio interrotto', 'L’invio dei messaggi è stato interrotto.');
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
  notifyUser('Importazione completata', `${state.donors.length} destinatari importati da ${state.fileName}.`);
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
  return loadImageFromPath(imagePath);
}

function loadImageFromPath(imagePath) {
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

async function selectPresetAttachment() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleziona l’allegato del preset',
    properties: ['openFile'],
    filters: [{ name: 'Immagini', extensions: ['jpg', 'jpeg', 'png'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;

  const imagePath = result.filePaths[0];
  const inspection = inspectImage(imagePath);
  if (!inspection.valid) throw new Error(inspection.reason);
  return { sourcePath: imagePath, fileName: path.basename(imagePath) };
}

function loadPresetAttachment(attachment) {
  if (!attachment) return clearImage();
  const imagePath = resolvePresetAttachment(app.getPath('userData'), attachment);
  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error(`L’allegato del preset "${attachment.fileName || 'senza nome'}" non è disponibile.`);
  }
  return loadImageFromPath(imagePath);
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
  const previousPreset = state.presets.find((item) => item.name === preset.name);
  const sourcePath = String(preset.attachmentSourcePath || '').trim();
  const payload = { ...preset };
  delete payload.attachmentSourcePath;
  if (sourcePath) payload.attachment = copyPresetAttachment(sourcePath, app.getPath('userData'));
  const nextPresets = upsertPreset(presetsPath, payload);
  const savedPreset = nextPresets.find((item) => item.name === payload.name);
  if (previousPreset?.attachment && previousPreset.attachment.relativePath !== savedPreset?.attachment?.relativePath) {
    deletePresetAttachment(app.getPath('userData'), previousPreset.attachment);
  }
  state.presets = nextPresets;
  audit('info', 'preset.saved', { name: preset.name });
  publish();
  return snapshot();
}

function removePreset(name) {
  if (!presetsPath) throw new Error('Percorso preset non disponibile.');
  const removedPreset = state.presets.find((item) => item.name === name);
  state.presets = deletePreset(presetsPath, name);
  if (removedPreset?.attachment) deletePresetAttachment(app.getPath('userData'), removedPreset.attachment);
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

async function sendDeveloperReport(errorContext = '') {
  const devEmail = 'danilo.corsi@outlook.it';
  const appVersion = app.getVersion ? app.getVersion() : '1.0.0';
  const logDir = getEffectiveLogDir();
  const today = new Date().toISOString().slice(0, 10);
  const logPath = path.join(logDir, `${today}.log`);
  const txtPath = path.join(logDir, `log_${today}.txt`);
  const emlPath = path.join(logDir, `segnalazione_${today}.eml`);

  let todayLogContent = '';
  let logFileFound = false;

  if (fs.existsSync(logPath)) {
    logFileFound = true;
    try {
      todayLogContent = fs.readFileSync(logPath, 'utf8');
    } catch (err) {
      todayLogContent = `Impossibile leggere il file di log: ${err.message}`;
    }
  }

  // Assicura che la cartella dei log esista
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (err) {
    logError('log_dir.create_failed', err);
  }

  // Scrivi il file .txt con l'intero contenuto del log
  try {
    fs.writeFileSync(txtPath, todayLogContent || '(Nessun evento registrato nel file di log di oggi)', 'utf8');
  } catch (err) {
    logError('txt_log.write_failed', err);
  }

  const { subject, reportText, attachmentName } = buildDeveloperReport({
    appVersion,
    osDetails: `Windows (${os.release()} - ${os.arch()})`,
    connection: state.connection || 'non connesso',
    errorContext,
    todayLogContent,
    todayDate: today,
  });

  // Copia tutto il log e il report negli appunti
  try {
    clipboard.writeText(reportText);
  } catch (err) {
    logError('clipboard.copy_failed', err);
  }

  // Genera il file .eml con il file .txt allegato come allegato MIME
  let emlOpened = false;
  try {
    const emlContent = buildEmlContent({
      to: devEmail,
      subject,
      body: reportText,
      attachmentName,
      attachmentContent: todayLogContent || '(Nessun evento registrato nel file di log di oggi)',
    });
    fs.writeFileSync(emlPath, emlContent, 'utf8');
    const openErr = await shell.openPath(emlPath);
    if (!openErr) {
      emlOpened = true;
    }
  } catch (err) {
    logError('eml.open_failed', err);
  }

  // Se l'apertura .eml non è riuscita, apri il fallback mailto:
  if (!emlOpened) {
    const mailtoUrl = buildMailtoUrl({
      to: devEmail,
      subject,
      body: reportText,
      maxBodyLength: 1500,
    });
    try {
      await shell.openExternal(mailtoUrl);
    } catch (err) {
      logError('mail.open_failed', err);
    }
  }

  // Evidenzia sempre il file .txt nella cartella dei log
  try {
    if (fs.existsSync(txtPath)) {
      shell.showItemInFolder(txtPath);
    } else {
      shell.openPath(logDir);
    }
  } catch (err) {
    logError('shell.show_log_failed', err);
  }

  audit('info', 'developer_report.prepared', {
    hasError: Boolean(errorContext),
    logFileFound,
    logPath,
    txtPath,
    emlOpened,
  });

  return {
    success: true,
    email: devEmail,
    logPath: txtPath,
    copiedToClipboard: true,
  };
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
  notifyUser('Invio avviato', `${selectedDonors.length} destinatari in coda.`);
  queue.start();
  return snapshot();
}

function createTray() {
  if (tray) return tray;
  if (!fs.existsSync(APP_ICON_PATH)) {
    audit('warn', 'tray.icon_missing', { iconPath: APP_ICON_PATH });
    return null;
  }

  tray = new Tray(getBaseTrayImage());
  tray.setToolTip('AVIS WhatsApp Sender');
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Apri AVIS Sender',
      click: () => {
        audit('info', 'tray.open_clicked');
        showMainWindow();
      },
    },
    { type: 'separator' },
    {
      label: 'Esci',
      click: () => {
        audit('info', 'tray.quit_clicked');
        requestQuit();
      },
    },
  ]));
  tray.on('click', () => {
    audit('info', 'tray.icon_clicked');
    showMainWindow();
  });
  updateNotificationIndicators();
  return tray;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'AVIS WhatsApp Sender',
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 650,
    icon: fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (fs.existsSync(APP_ICON_PATH) && typeof mainWindow.setIcon === 'function') {
    mainWindow.setIcon(APP_ICON_PATH);
  }
  updateNotificationIndicators();

  mainWindow.once('ready-to-show', () => {
    audit('info', 'window.ready_to_show');
    if (process.argv.includes('--avis-background')) {
      mainWindow.hide();
    } else {
      showMainWindow();
    }
  });

  mainWindow.on('close', (event) => {
    handleWindowClose(event, {
      isQuitting,
      hideWindow: () => mainWindow.hide(),
      audit: (eventName) => audit('info', eventName),
    });
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
      notifyUser('Operazione non riuscita', notificationErrorBody(error, notificationContextForChannel(channel)));
      throw error;
    }
  });
}

registerHandler('sender:inspect-csv', inspectCsv);
registerHandler('sender:inspect-csv-sheet', (filePath, sheetName) => inspectCsvSheet(filePath, sheetName));
registerHandler('sender:load-csv-mapped', (filePath, sheetName, mapping) => loadCsvMapped(filePath, sheetName, mapping));
registerHandler('sender:select-image', selectImage);
registerHandler('sender:clear-image', clearImage);
registerHandler('sender:select-preset-attachment', selectPresetAttachment);
registerHandler('sender:load-preset-attachment', (attachment) => loadPresetAttachment(attachment));
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
registerHandler('sender:send-developer-report', (errorContext) => sendDeveloperReport(errorContext));
registerHandler('sender:open-user-data-dir', openUserDataDir);
registerHandler('sender:open-path', (targetPath) => openPathInExplorer(targetPath));
registerHandler('sender:show-item', (filePath) => showItemInExplorer(filePath));
registerHandler('sender:check-for-updates', () => checkForUpdatesManual());
registerHandler('sender:download-update', () => downloadUpdateManual());
registerHandler('sender:install-update', () => installUpdateNow());
registerHandler('sender:check-birthdays', (options) => checkBirthdays(options));
registerHandler('sender:dismiss-birthday-reminder', () => dismissBirthdayReminder());
registerHandler('sender:toggle-birthday-inhibition', () => toggleBirthdayInhibition());
registerHandler('sender:prepare-birthday-session', () => prepareBirthdaySession());
registerHandler('sender:select-birthday-source', () => selectBirthdaySource());
registerHandler('sender:open-birthdays', () => openBirthdayCenter());
registerHandler('sender:set-start-with-windows', (enabled) => setStartWithWindows(enabled));
registerHandler('sender:set-notification-read', (id, read) => setStoredNotificationRead(id, read));
registerHandler('sender:mark-all-notifications-read', () => markAllStoredNotificationsRead());
registerHandler('sender:clear-all-notifications', () => clearAllStoredNotifications());
registerHandler('sender:delete-notification', (id) => deleteStoredNotification(id));

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
    notifyUser('Aggiornamento disponibile', `È disponibile la versione ${info?.version || 'nuova'} dell’applicazione.`);
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
    notifyUser('Errore aggiornamento', notificationErrorBody(err, 'update'));
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
    notifyUser('Aggiornamento scaricato', 'L’aggiornamento è pronto per essere installato riavviando l’applicazione.');
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
  if (process.platform === 'win32') {
    app.setAppUserModelId('it.avis.whatsappsender');
  }
  killStaleSessionBrowser();
  settingsPath = path.join(app.getPath('userData'), 'settings.json');
  presetsPath = path.join(app.getPath('userData'), 'presets.json');
  notificationsPath = path.join(app.getPath('userData'), 'notifications.json');
  notificationState = loadNotificationState(notificationsPath);
  syncNotificationState();
  birthdayStatePath = path.join(app.getPath('userData'), 'birthday-state.json');
  birthdayState = loadBirthdayState(birthdayStatePath);
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
  createTray();
  configureAutoStart(state.settings.startWithWindows);
  initUpdater();
  connectClient().catch((err) => audit('error', 'whatsapp.startup_connect_failed', errorDetails(err)));
  publish();
  checkBirthdays({ notify: true }).catch((error) => {
    audit('error', 'birthday.startup_check_failed', errorDetails(error));
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  audit('info', 'app.windows_closed');
  if (process.platform !== 'darwin' && !tray) app.quit();
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

function requestQuit() {
  if (isQuitting) return;
  isQuitting = true;
  audit('info', 'app.quit_requested');
  queue?.stop();
  const forceQuitTimer = setTimeout(() => {
    audit('warn', 'app.quit_forced_after_timeout');
    killStaleSessionBrowser();
    app.exit(0);
  }, 3000);

  destroyClient().finally(() => {
    clearTimeout(forceQuitTimer);
    audit('info', 'app.quit_completed');
    app.quit();
  });
}

app.on('before-quit', (e) => {
  if (isQuitting) return;
  e.preventDefault();
  requestQuit();
});
