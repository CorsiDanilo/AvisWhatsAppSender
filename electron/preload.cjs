const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatsappSender', {
  inspectCsv: () => ipcRenderer.invoke('sender:inspect-csv'),
  inspectCsvSheet: (filePath, sheetName) => ipcRenderer.invoke('sender:inspect-csv-sheet', filePath, sheetName),
  loadCsvMapped: (filePath, sheetName, mapping) => ipcRenderer.invoke('sender:load-csv-mapped', filePath, sheetName, mapping),
  selectImage: () => ipcRenderer.invoke('sender:select-image'),
  clearImage: () => ipcRenderer.invoke('sender:clear-image'),
  selectPresetAttachment: () => ipcRenderer.invoke('sender:select-preset-attachment'),
  loadPresetAttachment: (attachment) => ipcRenderer.invoke('sender:load-preset-attachment', attachment),
  connect: () => ipcRenderer.invoke('sender:connect'),
  reconnect: () => ipcRenderer.invoke('sender:reconnect'),
  start: (options) => ipcRenderer.invoke('sender:start', options),
  pause: () => ipcRenderer.invoke('sender:pause'),
  resume: () => ipcRenderer.invoke('sender:resume'),
  stop: () => ipcRenderer.invoke('sender:stop'),
  setSelection: (index, selected) => ipcRenderer.invoke('sender:set-selection', index, selected),
  setAllSelected: (selected) => ipcRenderer.invoke('sender:set-all-selected', selected),
  updateDonor: (index, patch) => ipcRenderer.invoke('sender:update-donor', index, patch),
  addDonor: (input, customFieldKeys) => ipcRenderer.invoke('sender:add-donor', input, customFieldKeys),
  saveSettings: (settings) => ipcRenderer.invoke('sender:save-settings', settings),
  savePreset: (preset) => ipcRenderer.invoke('sender:save-preset', preset),
  deletePreset: (name) => ipcRenderer.invoke('sender:delete-preset', name),
  reset: () => ipcRenderer.invoke('sender:reset'),
  getState: () => ipcRenderer.invoke('sender:get-state'),
  selectOutputDir: () => ipcRenderer.invoke('sender:select-output-dir'),
  resetOutputDir: () => ipcRenderer.invoke('sender:reset-output-dir'),
  selectLogsDir: () => ipcRenderer.invoke('sender:select-logs-dir'),
  resetLogsDir: () => ipcRenderer.invoke('sender:reset-logs-dir'),
  openOutputDir: () => ipcRenderer.invoke('sender:open-output-dir'),
  openLastOutcome: () => ipcRenderer.invoke('sender:open-last-outcome'),
  openLogsDir: () => ipcRenderer.invoke('sender:open-logs-dir'),
  sendDeveloperReport: (errorContext) => ipcRenderer.invoke('sender:send-developer-report', errorContext),
  openUserDataDir: () => ipcRenderer.invoke('sender:open-user-data-dir'),
  openPath: (targetPath) => ipcRenderer.invoke('sender:open-path', targetPath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('sender:show-item', filePath),
  checkForUpdates: () => ipcRenderer.invoke('sender:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('sender:download-update'),
  installUpdate: () => ipcRenderer.invoke('sender:install-update'),
  checkBirthdays: (options = {}) => ipcRenderer.invoke('sender:check-birthdays', options),
  dismissBirthdayReminder: () => ipcRenderer.invoke('sender:dismiss-birthday-reminder'),
  toggleBirthdayInhibition: () => ipcRenderer.invoke('sender:toggle-birthday-inhibition'),
  prepareBirthdaySession: () => ipcRenderer.invoke('sender:prepare-birthday-session'),
  selectBirthdaySource: () => ipcRenderer.invoke('sender:select-birthday-source'),
  openBirthdays: () => ipcRenderer.invoke('sender:open-birthdays'),
  setStartWithWindows: (enabled) => ipcRenderer.invoke('sender:set-start-with-windows', enabled),
  setNotificationRead: (id, read) => ipcRenderer.invoke('sender:set-notification-read', id, read),
  markAllNotificationsRead: () => ipcRenderer.invoke('sender:mark-all-notifications-read'),
  clearAllNotifications: () => ipcRenderer.invoke('sender:clear-all-notifications'),
  deleteNotification: (id) => ipcRenderer.invoke('sender:delete-notification', id),
  onState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on('sender:state', handler);
    return () => ipcRenderer.removeListener('sender:state', handler);
  },
  onOpenBirthdays: (listener) => {
    const handler = () => listener();
    ipcRenderer.on('sender:open-birthdays', handler);
    return () => ipcRenderer.removeListener('sender:open-birthdays', handler);
  },
});
