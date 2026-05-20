const { app, BrowserWindow, shell, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');
const FRONTEND_URL = 'https://code-medha-frontend-sireeshas-projects-fba69901.vercel.app/#/trainer/login';
let mainWindow = null;
let tray = null;
function createSplash() {
  const splash = new BrowserWindow({ width: 480, height: 320, frame: false, alwaysOnTop: true, transparent: true, resizable: false, webPreferences: { nodeIntegration: false } });
  splash.loadFile(path.join(__dirname, 'splash.html'));
  return splash;
}
function createMainWindow() {
  mainWindow = new BrowserWindow({ width: 1366, height: 768, minWidth: 1024, minHeight: 600, title: 'CodeMedha Trainer Panel', icon: path.join(__dirname, 'icons', 'icon.png'), show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, webSecurity: true } });
  mainWindow.loadURL(FRONTEND_URL);
  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.on('closed', () => { mainWindow = null; });
}
function createTray() {
  const iconPath = path.join(__dirname, 'icons', 'tray.png');
  if (!fs.existsSync(iconPath)) return;
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('CodeMedha Trainer Panel');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: 'Open', click: () => mainWindow?.show() }, { type: 'separator' }, { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } }]));
  tray.on('click', () => mainWindow?.show());
}
app.whenReady().then(async () => {
  const splash = createSplash();
  setTimeout(() => { createMainWindow(); createTray(); splash.close(); }, 2000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); } else { app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } }); }