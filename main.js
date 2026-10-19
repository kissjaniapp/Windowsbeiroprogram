const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();

let win;
let openTimer = null;

function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1100,
    height: 820,
    minWidth: 420,
    minHeight: 600,
    title: 'Eredmény beíró',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0f0f1a',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false }
  });
  win.loadFile(path.join(__dirname, 'index.html'));

  // A JPEG képek mentése kérdezés nélkül a Letöltések\Eredmeny-beiro mappába
  win.webContents.session.on('will-download', (event, item) => {
    const dir = path.join(app.getPath('downloads'), 'Eredmeny-beiro');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    const file = path.join(dir, item.getFilename());
    item.setSavePath(file);
    item.once('done', (e, state) => {
      if (state !== 'completed') return;
      clearTimeout(openTimer);
      openTimer = setTimeout(() => shell.openPath(dir), 1200);
    });
  });

  // külső linkek a böngészőben nyíljanak
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
