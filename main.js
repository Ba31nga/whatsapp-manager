const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Optional: Create logs folder if not exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'js', 'preload.js'), // for secure ipcRenderer use
      nodeIntegration: true, // if needed, otherwise better to use preload
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'), // Optional icon
    autoHideMenuBar: true,
  });

  win.loadFile('index.html');

  // Optional: Open DevTools
  // win.webContents.openDevTools();
}

// Electron lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Optional: IPC handlers (e.g., for logs or Excel access)
ipcMain.handle('log-json', async (_event, logData) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(logsDir, `log-${timestamp}.json`);
  fs.writeFileSync(filename, JSON.stringify(logData, null, 2));
  return { success: true, filename };
});
