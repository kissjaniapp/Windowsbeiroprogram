'use strict';
const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('googleSync', {
  getStatus: () => ipcRenderer.invoke('google-sync:status'),
  enqueue: (event) => ipcRenderer.invoke('google-sync:enqueue', event),
  retry: () => ipcRenderer.invoke('google-sync:retry')
});

contextBridge.exposeInMainWorld('arduinoWifi', {
  status: () => ipcRenderer.invoke('arduino-wifi:status')
});

contextBridge.exposeInMainWorld('arduinoSensor', {
  get: (path) => ipcRenderer.invoke('arduino-sensor:get', path)
});
