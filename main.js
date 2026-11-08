const { app, BrowserWindow, Menu, shell, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { createGoogleSync } = require('./google-sync');

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();

let win;
let openTimer = null;
let googleSync = null;

function initGoogleSync() {
  googleSync = createGoogleSync({
    dataDir: app.getPath('userData'),
    encryptKey: secret => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('A Windows titkosított kulcstárolása nem érhető el.');
      }
      return safeStorage.encryptString(secret).toString('base64');
    },
    decryptKey: stored => safeStorage.decryptString(Buffer.from(stored, 'base64'))
  });
  // A beállításokat a GitHub Actions a Windows EXE-be csomagolja,
  // így a verseny helyszínén semmilyen URL-t vagy kulcsot nem kell megadni.
  const bundled = path.join(__dirname, 'embedded-google-config.json');
  if (fs.existsSync(bundled)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(bundled, 'utf8'));
      googleSync.saveConfig({url: cfg.url, key: cfg.key});
    } catch (err) {
      console.error('A beépített Google-beállítások nem olvashatók:', err.message);
    }
  }
  ipcMain.handle('google-sync:status', () => googleSync.getStatus());
  ipcMain.handle('google-sync:enqueue', (_event, event) => googleSync.enqueue(event));
  ipcMain.handle('google-sync:retry', () => googleSync.flush());

  // Az Arduino helyi Wi-Fi-jén lehet internet nélkül dolgozni.
  // A távoli Google-végpontot az online jelzőtől függetlenül próbáljuk elérni.
  setInterval(() => { void googleSync.flush(); }, 15000).unref();
  void googleSync.flush(); // újraindítás után is megmaradt versenyek
}

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, spellcheck: false
    }
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

  // Külső linkek csak a rendszer böngészőjében nyílnak meg.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});
app.whenReady().then(() => {
  initGoogleSync();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
