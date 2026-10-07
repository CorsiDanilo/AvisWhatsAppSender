const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatsappSender', {
  inspectCsv: () => ipcRenderer.invoke('sender:inspect-csv'),
  inspectCsvSheet: (filePath, sheetName) => ipcRenderer.invoke('sender:inspect-csv-sheet', filePath, sheetName),
  loadCsvMapped: (filePath, sheetName, mapping) => ipcRenderer.invoke('sender:load-csv-mapped', filePath, sheetName, mapping),
  selectImage: () => ipcRenderer.invoke('sender:select-image'),
  clearImage: () => ipcRenderer.invoke('sender:clear-image'),
  connect: () => ipcRenderer.invoke('sender:connect'),
  reconnect: () => ipcRenderer.invoke('sender:reconnect'),
  start: (options) => ipcRenderer.invoke('sender:start', options),
  pause: () => ipcRenderer.invoke('sender:pause'),
  resume: () => ipcRenderer.invoke('sender:resume'),
  stop: () => ipcRenderer.invoke('sender:stop'),
  setSelection: (index, selected) => ipcRenderer.invoke('sender:set-selection', index, selected),
  setAllSelected: (selected) => ipcRenderer.invoke('sender:set-all-selected', selected),
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
  openUserDataDir: () => ipcRenderer.invoke('sender:open-user-data-dir'),
  openPath: (targetPath) => ipcRenderer.invoke('sender:open-path', targetPath),
  showItemInFolder: (filePath) => ipcRenderer.invoke('sender:show-item', filePath),
  onState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on('sender:state', handler);
    return () => ipcRenderer.removeListener('sender:state', handler);
  },
});
