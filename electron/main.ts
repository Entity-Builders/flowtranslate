import { app, BrowserWindow, ipcMain, clipboard } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

log.transports.file.level = 'info';
autoUpdater.logger = log;
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Injected at build time by vite.config.ts
declare const __GH_TOKEN__: string;

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..');

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let win: BrowserWindow | null;
let isQuitting = false;

app.on('before-quit', () => {
  isQuitting = true;
});

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  });

  // Hide instead of close on macOS so the app can be re-opened from dock
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win?.hide();
    }
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win) {
    win.show();
  } else {
    createWindow();
  }
});

app.whenReady().then(() => {
  // IPC: Copy text to clipboard
  ipcMain.handle('clipboard:write', (_event, text: string) => {
    clipboard.writeText(text);
    return { success: true };
  });

  // IPC: Get app version
  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  // IPC: Manually check for updates
  ipcMain.handle('app:check-for-updates', async () => {
    try {
      await autoUpdater.checkForUpdatesAndNotify();
      return { success: true };
    } catch (error: unknown) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  createWindow();

  // Configure updater for private GitHub repo
  // __GH_TOKEN__ is injected at build time via vite.config.ts define
  const ghToken = typeof __GH_TOKEN__ !== 'undefined' ? __GH_TOKEN__ : '';
  if (ghToken) {
    log.info('Configuring auto-updater with GitHub token for private repo');
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'juanobrach',
      repo: 'entity-builders',
      private: true,
      token: ghToken,
    });
  } else {
    log.warn('No GH_TOKEN found — auto-updates from private repo will fail');
  }

  // Check for updates on launch
  autoUpdater.checkForUpdatesAndNotify();
});

// Update logic
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available.', info);
  win?.webContents.send('update-available');
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available.', info);
  win?.webContents.send('update-not-available');
});

autoUpdater.on('error', (err) => {
  log.error('Error in auto-updater. ' + err);
  win?.webContents.send('update-error', err?.message || 'Unknown error');
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = 'Download speed: ' + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message =
    log_message +
    ' (' +
    progressObj.transferred +
    '/' +
    progressObj.total +
    ')';
  log.info(log_message);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded', info);
  win?.webContents.send('update-downloaded', info);
});

ipcMain.on('restart-app', () => {
  isQuitting = true;
  autoUpdater.quitAndInstall();
});
