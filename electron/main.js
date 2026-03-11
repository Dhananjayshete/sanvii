// ═══════════════════════════════════════════════════════════
//  SANVII ELECTRON MAIN PROCESS — FINAL
//  ✅ Always visible on desktop — never disappears
//  ✅ Goes BEHIND other apps automatically
//  ✅ Right-click to open chat or close
//  ✅ Transparent background
//  ✅ Mic permission auto-granted
// ═══════════════════════════════════════════════════════════

const { app, BrowserWindow, Menu, screen, ipcMain, shell } = require('electron');
const path = require('path');

let mainWindow    = null;
let serverProcess = null;
let isChatOpen    = false;

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
  serverProcess.on('exit',  code => console.log('Server exited:', code));
}

// ── Create window ─────────────────────────────────────────
function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  const WIN_W = 120;
  const WIN_H = 150;

  mainWindow = new BrowserWindow({
    width:       WIN_W,
    height:      WIN_H,
    x:           sw - WIN_W - 10,
    y:           sh - WIN_H - 8,
    frame:       false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable:   false,
    hasShadow:   false,
    focusable:   true,
    show:        false,
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload:          path.join(__dirname, 'preload.js'),
      webSecurity:      false
    }
  });

  // ✅ Show after content loads — without stealing focus
  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.showInactive();
    mainWindow.setAlwaysOnTop(false);
    mainWindow.blur();
  });

  // ✅ KEY FIX: When window loses focus (user clicks another app)
  // — if chat is closed, keep avatar visible but behind other apps
  // — this stops it from disappearing when switching windows
  mainWindow.on('blur', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!isChatOpen) {
      // Stay visible but go behind everything
      mainWindow.setAlwaysOnTop(false);
    }
  });

  // ✅ KEY FIX: Prevent window from being hidden when desktop is clicked
  // Windows tries to hide non-taskbar windows — we fight back
  mainWindow.on('hide', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // Immediately show again — never let it disappear
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        mainWindow.showInactive();
        mainWindow.blur();
      }
    }, 100);
  });

  // ✅ Grant mic permission automatically
  mainWindow.webContents.session.setPermissionRequestHandler(
    (wc, permission, callback) => {
      callback(['media', 'microphone', 'audioCapture'].includes(permission));
    }
  );
  mainWindow.webContents.session.setPermissionCheckHandler(
    (wc, permission) => ['media', 'microphone', 'audioCapture'].includes(permission)
  );

  // ── Load app ──────────────────────────────────────────────
  const isDev = !app.isPackaged;
  if (isDev) {
    loadWithRetry(mainWindow, 'http://localhost:4200', 0);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../dist/sanvii/browser/index.html')
    );
  }

  // ✅ Right-click → context menu
  mainWindow.webContents.on('context-menu', () => {
    const menu = Menu.buildFromTemplate([
      {
        label: '💬 Open Chat',
        click: () => {
          isChatOpen = true;
          const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
          mainWindow.setBounds({ x: sw - 420 - 10, y: sh - 680 - 8, width: 420, height: 680 });
          mainWindow.setAlwaysOnTop(true, 'floating');
          mainWindow.focus();
        }
      },
      {
        label: '🤏 Minimize to Avatar',
        click: () => {
          isChatOpen = false;
          const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
          mainWindow.setBounds({ x: sw - 120 - 10, y: sh - 150 - 8, width: 120, height: 150 });
          mainWindow.setAlwaysOnTop(false);
          mainWindow.blur();
        }
      },
      { type: 'separator' },
      { label: '❌ Close Sanvii', click: () => app.quit() }
    ]);
    menu.popup({ window: mainWindow });
  });

  // ✅ Always open links in real browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = isDev ? 'http://localhost:4200' : 'file://';
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Retry until ng serve is ready ────────────────────────
function loadWithRetry(win, url, attempts) {
  if (!win || win.isDestroyed()) return;
  const http = require('http');
  const req  = http.get(url, () => {
    if (!win.isDestroyed()) win.loadURL(url);
  });
  req.on('error', () => {
    if (attempts < 40) setTimeout(() => loadWithRetry(win, url, attempts + 1), 1000);
    else console.error('❌ Could not connect to ng serve after 40 attempts.');
  });
  req.end();
}

// ── IPC handlers ─────────────────────────────────────────
ipcMain.on('open-external', (_, url) => shell.openExternal(url));
ipcMain.on('quit-app',      ()       => app.quit());

ipcMain.on('expand-chat', () => {
  if (!mainWindow) return;
  isChatOpen = true;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow.setBounds({ x: sw - 420 - 10, y: sh - 680 - 8, width: 420, height: 680 });
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.focus();
});

ipcMain.on('shrink-avatar', () => {
  if (!mainWindow) return;
  isChatOpen = false;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow.setBounds({ x: sw - 120 - 10, y: sh - 150 - 8, width: 120, height: 150 });
  mainWindow.setAlwaysOnTop(false);
  mainWindow.blur();
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
    if (!mainWindow.isVisible()) mainWindow.showInactive();
  }
});