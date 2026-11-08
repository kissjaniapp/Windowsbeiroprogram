'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('googleSync', {
  getStatus: () => ipcRenderer.invoke('google-sync:status'),
  saveConfig: (settings) => ipcRenderer.invoke('google-sync:config', settings),
  enqueue: (event) => ipcRenderer.invoke('google-sync:enqueue', event),
  retry: () => ipcRenderer.invoke('google-sync:retry')
});
