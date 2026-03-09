// ═══════════════════════════════════════════════════════════
//  SANVII PRELOAD — Safe IPC bridge
//  This runs in renderer context but has access to Node APIs
// ═══════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  hideWindow:   () => ipcRenderer.send('hide-window'),
  showWindow:   () => ipcRenderer.send('show-window'),

  // Open links in real browser (not in Electron window)
  openExternal: (url) => ipcRenderer.send('open-external', url),

  // Drag window
  dragWindow: (deltaX, deltaY) => ipcRenderer.send('drag-window', { deltaX, deltaY }),

  // Check if running in Electron
  isElectron: true,

  // Platform info
  platform: process.platform
});