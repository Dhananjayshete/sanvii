// ═══════════════════════════════════════════════════════════
//  SANVII ELECTRON MAIN PROCESS
//  ✅ Sits on DESKTOP only — not above other apps
//  ✅ Small size (100x130) — just the avatar
//  ✅ Right-click to close
//  ✅ Transparent background
//  ✅ Mic permission auto-granted
// ═══════════════════════════════════════════════════════════

const { app, BrowserWindow, Menu, screen, ipcMain, shell } = require('electron');
const path = require('path');

let mainWindow    = null;
let serverProcess = null;

// ── Prevent multiple instances ────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

// ── Start backend server ──────────────────────────────────
function startServer() {
  const serverPath = path.join(__dirname, '../server/server.js');
  serverProcess = require('child_process').fork(serverPath, [], {
    env: { ...process.env },
    silent: false
  });
  serverProcess.on('error', err => console.error('Server error:', err));
  serverProcess.on('exit', code => console.log('Server exited:', code));
}

// ── Create window ─────────────────────────────────────────
function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  // ✅ Small size — just avatar visible
  const WIN_W = 120;
  const WIN_H = 150;

  mainWindow = new BrowserWindow({
    width:           WIN_W,
    height:          WIN_H,
    x:               sw - WIN_W - 10,   // bottom-right corner
    y:               sh - WIN_H - 8,    // just above taskbar
    frame:           false,
    transparent:     true,              // ✅ no background
    alwaysOnTop:     false,             // ✅ NOT above other apps
    skipTaskbar:     true,              // not in taskbar
    resizable:       false,
    hasShadow:       false,
    focusable:       true,
    type:            'desktop',         // ✅ desktop level — stays behind apps
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload:          path.join(__dirname, 'preload.js'),
      webSecurity:      false
    }
  });

  // ✅ Set window level to desktop (behind all apps, on desktop)
  mainWindow.setAlwaysOnTop(false);

  // ✅ Grant mic permission automatically
  mainWindow.webContents.session.setPermissionRequestHandler(
    (wc, permission, callback) => {
      callback(['media', 'microphone', 'audioCapture'].includes(permission));
    }
  );
  mainWindow.webContents.session.setPermissionCheckHandler(
    (wc, permission) => ['media', 'microphone', 'audioCapture'].includes(permission)
  );

  // Load app
  const isDev = !app.isPackaged;
  if (isDev) {
    loadWithRetry(mainWindow, 'http://localhost:4200', 0);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/sanvii/browser/index.html'));
  }

  // ✅ Right-click → close menu
  mainWindow.webContents.on('context-menu', () => {
    const menu = Menu.buildFromTemplate([
      {
        label: '💬 Open Chat',
        click: () => {
          // Expand window to full chat size when clicked
          const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
          mainWindow.setBounds({
            x:      sw - 420 - 10,
            y:      sh - 680 - 8,
            width:  420,
            height: 680
          });
        }
      },
      {
        label: '🤏 Minimize to Avatar',
        click: () => {
          const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
          mainWindow.setBounds({
            x:      sw - 120 - 10,
            y:      sh - 150 - 8,
            width:  120,
            height: 150
          });
        }
      },
      { type: 'separator' },
      {
        label: '❌ Close Sanvii',
        click: () => app.quit()
      }
    ]);
    menu.popup({ window: mainWindow });
  });

  // Open links in real browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// Retry until ng serve is ready
function loadWithRetry(win, url, attempts) {
  if (!win || win.isDestroyed()) return;
  const http = require('http');
  http.get(url, () => {
    if (!win.isDestroyed()) win.loadURL(url);
  }).on('error', () => {
    if (attempts < 40) setTimeout(() => loadWithRetry(win, url, attempts + 1), 1000);
  });
}

// ── IPC handlers ──────────────────────────────────────────
ipcMain.on('open-external', (_, url) => shell.openExternal(url));
ipcMain.on('quit-app',      () => app.quit());

// Expand to full chat
ipcMain.on('expand-chat', () => {
  if (!mainWindow) return;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow.setBounds({ x: sw - 420 - 10, y: sh - 680 - 8, width: 420, height: 680 });
  mainWindow.setAlwaysOnTop(true, 'floating'); // bring to front when chat opens
});

// Shrink back to avatar
ipcMain.on('shrink-avatar', () => {
  if (!mainWindow) return;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow.setBounds({ x: sw - 120 - 10, y: sh - 150 - 8, width: 120, height: 150 });
  mainWindow.setAlwaysOnTop(false); // go back to desktop level
});

ipcMain.on('drag-window', (event, { deltaX, deltaY }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(x + deltaX, y + deltaY);
});

// ── App lifecycle ─────────────────────────────────────────
app.whenReady().then(() => {
  startServer();
  setTimeout(createWindow, 1500);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (serverProcess) serverProcess.kill();
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show();
  }
});