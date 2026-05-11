'use strict';

// electron/main.js — Standby menu-bar app.
// Manages the embedded Node server and exposes controls via the macOS tray.

const { app, Tray, Menu, nativeImage, BrowserWindow, clipboard } = require('electron');
const { fork, exec } = require('child_process');
const path  = require('path');
const fs    = require('fs');

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT        = path.join(__dirname, '..');
const SERVER_MAIN = path.join(ROOT, 'server', 'index.js');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const ICON_PATH   = path.join(__dirname, 'assets', 'tray-icon.png');

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadPort() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).port || 3000; }
  catch { return 3000; }
}

// ── State ─────────────────────────────────────────────────────────────────────

let tray        = null;
let serverProc  = null;
let serverReady = false;
let serverError = null;   // set when the server fails to start (e.g. port in use)
let consoleWin  = null;

// ── Server lifecycle ──────────────────────────────────────────────────────────

function startServer() {
  if (serverProc) { return; }
  serverError = null;

  serverProc = fork(SERVER_MAIN, [], {
    env: { ...process.env },
    silent: false,
  });

  // Listen for structured messages from the server process.
  serverProc.on('message', (msg) => {
    if (msg?.type === 'ready') {
      serverReady = true;
      serverError = null;
      rebuildMenu();
    } else if (msg?.type === 'error' && msg.code === 'EADDRINUSE') {
      serverError = `⚠ Port ${msg.port} in use`;
      serverReady = false;
      rebuildMenu();
    }
  });

  serverProc.on('error', (err) => {
    process.stderr.write(`[standby] Server error: ${err.message}\n`);
    serverReady = false;
    serverProc  = null;
    rebuildMenu();
  });

  serverProc.on('exit', (code) => {
    process.stdout.write(`[standby] Server exited with code ${code}\n`);
    serverReady = false;
    serverProc  = null;
    rebuildMenu();
  });
}

function stopServer(onStopped) {
  const cb = typeof onStopped === 'function' ? onStopped : null;
  if (!serverProc) {
    if (cb) { cb(); }
    return;
  }
  const proc = serverProc;
  serverProc  = null;
  serverReady = false;
  rebuildMenu();
  // Register exit listener BEFORE sending signal so we never miss the event.
  if (cb) { proc.once('exit', cb); }
  proc.kill('SIGTERM');
}

// ── Console window ────────────────────────────────────────────────────────────

function openConsole() {
  if (consoleWin && !consoleWin.isDestroyed()) {
    consoleWin.focus();
    return;
  }
  const port = loadPort();
  consoleWin = new BrowserWindow({
    width: 1200,
    height: 750,
    minWidth: 700,
    minHeight: 400,
    title: 'Standby Console',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#07070f',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    show: false,
  });
  consoleWin.loadURL(`http://localhost:${port}/console.html`);

  // Inject styles so the header acts as the drag handle and clears the traffic lights
  consoleWin.webContents.on('did-finish-load', () => {
    consoleWin.webContents.insertCSS(`
      header {
        -webkit-app-region: drag;
        padding-left: 80px !important;
      }
      header * {
        -webkit-app-region: no-drag;
      }
    `);
  });

  consoleWin.once('ready-to-show', () => consoleWin.show());
  consoleWin.on('closed', () => { consoleWin = null; });
}

// ── Tray menu ─────────────────────────────────────────────────────────────────

function forceRestartServer(port) {
  // Kill whatever is holding the port, then start fresh.
  exec(`lsof -ti :${port} | xargs kill -9`, () => {
    stopServer(() => startServer());
  });
}

function rebuildMenu() {
  if (!tray) { return; }

  const port = loadPort();
  const statusLine = serverReady
    ? `● Running on port ${port}`
    : serverError
      ? serverError
      : (serverProc ? '◌ Starting…' : '○ Stopped');

  const items = [
    { label: 'Standby',    enabled: false },
    { label: statusLine,   enabled: false },
    { type: 'separator' },
    {
      label:   'Open Console',
      enabled: serverReady,
      click:   openConsole,
    },
    {
      label:   'Copy Performer URL',
      enabled: serverReady,
      click:   () => clipboard.writeText(`http://localhost:${port}/`),
    },
    { type: 'separator' },
    {
      label: serverReady || serverProc ? 'Restart Server' : 'Start Server',
      click: () => { stopServer(() => startServer()); },
    },
  ];

  // Show a "Force Restart" option when the port is already in use.
  if (serverError) {
    items.push({
      label: `Force Restart (kill port ${port})`,
      click: () => forceRestartServer(port),
    });
  }

  items.push(
    { type: 'separator' },
    {
      label:        'Quit Standby',
      accelerator:  'CmdOrCtrl+Q',
      click:        () => { stopServer(); app.quit(); },
    },
  );

  tray.setContextMenu(Menu.buildFromTemplate(items));
}

// ── App bootstrap ─────────────────────────────────────────────────────────────

// Single-instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    openConsole();
  });
}

// Hide from Dock — this is a menu-bar-only app
app.dock?.hide();

app.whenReady().then(() => {
  // Load tray icon (template image = macOS auto-adjusts for light/dark mode)
  let icon = nativeImage.createEmpty();
  if (fs.existsSync(ICON_PATH)) {
    // Load both resolutions so Retina displays use the @2x version automatically.
    const icon2x = path.join(__dirname, 'assets', 'tray-icon@2x.png');
    icon = nativeImage.createFromPath(ICON_PATH);
    if (fs.existsSync(icon2x)) {
      icon.addRepresentation({ scaleFactor: 2, dataURL: nativeImage.createFromPath(icon2x).toDataURL() });
    }
    // Not a template image — we want the brand orange to show in the menu bar.
  }

  tray = new Tray(icon);
  tray.setToolTip('Standby');
  rebuildMenu();

  // Auto-start server on launch
  startServer();
});

app.on('window-all-closed', () => {
  // Don't quit when the console window is closed — stay in menu bar
});

app.on('before-quit', () => stopServer());
