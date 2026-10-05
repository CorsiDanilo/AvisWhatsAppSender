const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('whatsappSender', {
  selectCsv: () => ipcRenderer.invoke('sender:select-csv'),
  selectImage: () => ipcRenderer.invoke('sender:select-image'),
  clearImage: () => ipcRenderer.invoke('sender:clear-image'),
  connect: () => ipcRenderer.invoke('sender:connect'),
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
  onState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on('sender:state', handler);
    return () => ipcRenderer.removeListener('sender:state', handler);
  },
});
