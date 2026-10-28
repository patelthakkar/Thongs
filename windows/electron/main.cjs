'use strict';

// Thongs Local — Windows desktop shell.
//
// One local JSON library, no account, no network. This process owns the app
// windows, the tray icon, the global Quick Entry shortcut, and every read and
// write of the library file. The renderer talks to it only through the bridge
// in preload.cjs.

const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  nativeImage,
  shell
} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { mergeLibraries } = require('./merge.cjs');

const APP_NAME = 'Thongs Local';
const QUICK_ENTRY_WIDTH = 520;
const QUICK_ENTRY_HEIGHT = 196;
const QUICK_ENTRY_MIN_HEIGHT = 170;
const QUICK_ENTRY_MAX_HEIGHT = 620;
const MAX_TITLE_LENGTH = 2000;
const MAX_SHORTCUT_LENGTH = 80;
const MAX_CLIPBOARD_LENGTH = 2_000_000;
const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
const DEFAULT_QUICK_ACCELERATOR = 'Control+Space';

const dataRoot = process.env.THONGS_LOCAL_DATA_DIR || path.join(app.getPath('appData'), APP_NAME);
app.setPath('userData', dataRoot);

const libraryPath = path.join(dataRoot, 'library.json');
const preferencesPath = path.join(dataRoot, 'preferences.json');
const rendererPath = path.join(__dirname, '../dist/index.html');
const iconPath = path.join(__dirname, '../build/icon.png');

let mainWindow = null;
let quickWindow = null;
let tray = null;
let quitting = false;
let quickAccelerator = DEFAULT_QUICK_ACCELERATOR;
let prefs = {};
let saveChain = Promise.resolve();
let preserveCorruptOriginal = false;

const windows = new Set();
// Last library each window loaded or saved, used as the base of the three-way
// merge when several windows save at once.
const libraryBases = new Map();

try {
  prefs = JSON.parse(fs.readFileSync(preferencesPath, 'utf8')) || {};
} catch {
  // First run, or preferences were removed. Defaults apply.
}

function savePreferences(patch) {
  prefs = { ...prefs, ...patch };
  try {
    fs.mkdirSync(dataRoot, { recursive: true });
    fs.writeFileSync(preferencesPath, JSON.stringify(prefs, null, 2));
  } catch {
    // Preferences are convenient but not required to run.
  }
}

// ---------------------------------------------------------------------------
// Windows and tray
// ---------------------------------------------------------------------------

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray && !tray.isDestroyed()) return tray;
  let image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) return null;
  image = image.resize({ width: 16, height: 16, quality: 'best' });
  try {
    tray = new Tray(image);
  } catch {
    return null;
  }
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Thongs Local', click: showMainWindow },
      { label: 'Quick Entry', click: openQuickEntry },
      { type: 'separator' },
      {
        label: 'Quit Thongs Local',
        click: () => {
          quitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on('click', showMainWindow);
  tray.on('double-click', showMainWindow);
  return tray;
}

function destroyTray() {
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
}

function askCloseToTaskbar(win) {
  return dialog
    .showMessageBox(win, {
      type: 'question',
      buttons: ['Yes', 'No'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: APP_NAME,
      message: 'Close to taskbar? (Necessary for quick entry)',
      detail:
        'Keep Thongs Local running in the taskbar so Quick Entry stays available after you close the window. You can change this later in Settings.',
      checkboxLabel: 'Remember my choice',
      checkboxChecked: true
    })
    .then(({ response, checkboxChecked }) => {
      if (win.isDestroyed()) return;
      const closeToTaskbar = response === 0;
      savePreferences(
        checkboxChecked
          ? { closeToTaskbar, askedCloseToTaskbar: true }
          : { closeToTaskbar }
      );
      if (closeToTaskbar) {
        if (!createTray()) {
          quitting = true;
          win.webContents.send('command', 'flush-and-close');
          return;
        }
        win.pendingHide = true;
        win.webContents.send('command', 'flush-and-close');
        return;
      }
      quitting = true;
      win.webContents.send('command', 'flush-and-close');
    });
}

// ---------------------------------------------------------------------------
// Quick Entry
// ---------------------------------------------------------------------------

function openQuickEntry() {
  if (quickWindow && !quickWindow.isDestroyed()) {
    quickWindow.show();
    quickWindow.focus();
    return;
  }
  quickWindow = new BrowserWindow({
    width: QUICK_ENTRY_WIDTH,
    height: QUICK_ENTRY_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: 'Quick Entry',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  quickWindow.loadFile(rendererPath, { query: { quick: '1' } });
  quickWindow.once('ready-to-show', () => {
    quickWindow?.show();
    quickWindow?.focus();
  });
  quickWindow.on('closed', () => {
    quickWindow = null;
  });
}

function configureQuickEntry(enabled, nextAccelerator = quickAccelerator) {
  if (
    !nextAccelerator ||
    typeof nextAccelerator !== 'string' ||
    nextAccelerator.length > MAX_SHORTCUT_LENGTH
  ) {
    return { ok: false, error: 'Invalid Quick Entry shortcut.' };
  }
  if (!enabled) {
    if (globalShortcut.isRegistered(quickAccelerator)) globalShortcut.unregister(quickAccelerator);
    return { ok: true, accelerator: nextAccelerator };
  }
  if (
    nextAccelerator === quickAccelerator &&
    globalShortcut.isRegistered(quickAccelerator)
  ) {
    return { ok: true, accelerator: quickAccelerator };
  }
  const previous = quickAccelerator;
  if (globalShortcut.isRegistered(previous)) globalShortcut.unregister(previous);
  if (!globalShortcut.register(nextAccelerator, openQuickEntry)) {
    if (previous && previous !== nextAccelerator && !globalShortcut.isRegistered(previous)) {
      globalShortcut.register(previous, openQuickEntry);
    }
    return { ok: false, error: 'That shortcut is already in use by another application.' };
  }
  quickAccelerator = nextAccelerator;
  return { ok: true, accelerator: quickAccelerator };
}

// ---------------------------------------------------------------------------
// Library file
// ---------------------------------------------------------------------------

function readLibrary() {
  if (!fs.existsSync(libraryPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
  } catch (error) {
    const backupPath = `${libraryPath}.backup`;
    if (fs.existsSync(backupPath)) {
      try {
        const recovered = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        preserveCorruptOriginal = true;
        dialog.showErrorBox(
          'Library recovered',
          'The last library file could not be read. A previous backup has been loaded. Export a backup before continuing.'
        );
        return recovered;
      } catch {
        // Fall through to the unrecoverable error below.
      }
    }
    dialog.showErrorBox(
      'Unable to read library',
      `Your library is not readable. The file has NOT been overwritten. Quit and restore a backup at: ${libraryPath}`
    );
    throw error;
  }
}

function validLibrary(library) {
  return (
    library &&
    library.version === 1 &&
    Array.isArray(library.tasks) &&
    Array.isArray(library.projects) &&
    Array.isArray(library.areas) &&
    Array.isArray(library.tags)
  );
}

async function writeLibrary(library) {
  const payload = JSON.stringify(library, null, 2);
  await fs.promises.mkdir(dataRoot, { recursive: true });
  if (fs.existsSync(libraryPath)) {
    if (preserveCorruptOriginal) {
      await fs.promises.copyFile(libraryPath, `${libraryPath}.corrupt-${Date.now()}`);
      preserveCorruptOriginal = false;
    } else {
      await fs.promises.copyFile(libraryPath, `${libraryPath}.backup`);
    }
  }
  await fs.promises.writeFile(`${libraryPath}.tmp`, payload, 'utf8');
  await fs.promises.rename(`${libraryPath}.tmp`, libraryPath);
  configureQuickEntry(
    library.settings?.quickEnabled !== false,
    library.settings?.quickShortcut || quickAccelerator
  );
}

function persistLibrary(library) {
  const operation = saveChain.then(() => writeLibrary(library));
  saveChain = operation.catch(() => {});
  return operation;
}

function broadcastLibrary(library, except = null) {
  for (const win of windows) {
    if (win === except || win.isDestroyed()) continue;
    win.webContents.send('library:changed', library);
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------

ipcMain.handle('library:load', event => {
  const library = readLibrary();
  if (library) {
    libraryBases.set(event.sender.id, library);
    event.sender.once('destroyed', () => libraryBases.delete(event.sender.id));
  }
  return library;
});

ipcMain.handle('library:save', (event, library) => {
  if (!validLibrary(library)) throw new Error('Invalid library');
  const current = readLibrary();
  const base = libraryBases.get(event.sender.id) || (current && current.tasks ? current : library);
  const merged = current && current.version === 1 ? mergeLibraries(base, current, library) : library;
  if (!validLibrary(merged)) throw new Error('Invalid merged library');
  return persistLibrary(merged).then(() => {
    libraryBases.set(event.sender.id, merged);
    broadcastLibrary(merged, event.sender);
    return merged;
  });
});

ipcMain.handle('quick:add', (event, payload) => {
  const task = payload?.task;
  if (
    !task ||
    typeof task.title !== 'string' ||
    !task.title.trim() ||
    task.title.length > MAX_TITLE_LENGTH ||
    typeof task.id !== 'string'
  ) {
    throw new Error('Invalid to-do');
  }
  const operation = saveChain.then(async () => {
    let library = readLibrary();
    if (!library) library = payload.base;
    if (!validLibrary(library)) throw new Error('Invalid library');
    if (library.tasks.some(item => item.id === task.id)) return true;
    const extraTags = (Array.isArray(payload.base?.tags) ? payload.base.tags : []).filter(
      tag => typeof tag === 'string' && tag.trim()
    );
    const updated = {
      ...library,
      tags: [...new Set([...library.tags, ...extraTags])],
      tasks: [...library.tasks, { ...task, title: task.title.trim() }],
      updatedAt: new Date().toISOString()
    };
    await writeLibrary(updated);
    broadcastLibrary(updated);
    return true;
  });
  saveChain = operation.catch(() => {});
  return operation;
});

ipcMain.handle('quick:close', event => {
  const target = BrowserWindow.fromWebContents(event.sender);
  if (target && target === quickWindow) {
    target.allowClose = true;
    target.close();
  }
  return true;
});

ipcMain.handle('quick:resize', (event, height) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  if (target && target === quickWindow) {
    const bounded = Math.max(
      QUICK_ENTRY_MIN_HEIGHT,
      Math.min(QUICK_ENTRY_MAX_HEIGHT, Math.round(Number(height) || QUICK_ENTRY_HEIGHT))
    );
    const [x, y] = target.getPosition();
    target.setBounds({ x, y, width: QUICK_ENTRY_WIDTH, height: bounded });
  }
  return true;
});

ipcMain.handle('app:open-quick-entry', () => {
  openQuickEntry();
  return true;
});

ipcMain.handle('app:preferences', (_, settings) => {
  if (typeof settings?.quickEnabled !== 'boolean') throw new Error('Invalid shortcut preference');
  if (
    settings.quickShortcut !== undefined &&
    (typeof settings.quickShortcut !== 'string' ||
      settings.quickShortcut.length > MAX_SHORTCUT_LENGTH)
  ) {
    throw new Error('Invalid Quick Entry shortcut');
  }
  return configureQuickEntry(
    settings.quickEnabled,
    settings.quickShortcut || quickAccelerator
  );
});

ipcMain.handle('library:export', async (event, library) => {
  const parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const { canceled, filePath } = await dialog.showSaveDialog(parent, {
    defaultPath: `Thongs-Backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'Thongs Local backup', extensions: ['json'] }]
  });
  if (!canceled && filePath) {
    await fs.promises.writeFile(filePath, JSON.stringify(library, null, 2));
    return true;
  }
  return false;
});

ipcMain.handle('library:import', async event => {
  const parent = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  const { canceled, filePaths } = await dialog.showOpenDialog(parent, {
    filters: [{ name: 'Thongs Local backup', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return null;
  const stat = await fs.promises.stat(filePaths[0]);
  if (stat.size > MAX_IMPORT_BYTES) throw new Error('Backup is too large');
  return JSON.parse(await fs.promises.readFile(filePaths[0], 'utf8'));
});

ipcMain.handle('window:action', (event, action) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  if (!target) return;
  if (action === 'minimize') target.minimize();
  if (action === 'maximize') {
    if (target.isMaximized()) target.unmaximize();
    else target.maximize();
  }
  if (action === 'close') target.close();
});

ipcMain.handle('app:open-window', (_, requested = 'inbox') => {
  const view = typeof requested === 'string' && /^[\w-]{1,80}$/.test(requested) ? requested : 'inbox';
  createWindow({ view });
  return true;
});

ipcMain.handle('app:info', () => ({
  platform: process.platform,
  version: app.getVersion(),
  dataPath: libraryPath
}));

ipcMain.handle('app:open-data', () => shell.openPath(dataRoot));

ipcMain.handle('app:copy-text', (_, text) => {
  if (typeof text !== 'string' || text.length > MAX_CLIPBOARD_LENGTH) {
    throw new Error('Invalid clipboard text');
  }
  clipboard.writeText(text);
  return true;
});

ipcMain.handle('app:close-to-taskbar', () => ({
  value: prefs.closeToTaskbar === true,
  asked: prefs.askedCloseToTaskbar === true
}));

ipcMain.handle('app:set-close-to-taskbar', (_, value) => {
  if (typeof value !== 'boolean') throw new Error('Invalid close preference');
  savePreferences({ closeToTaskbar: value, askedCloseToTaskbar: true });
  if (value) createTray();
  else destroyTray();
  return { value, asked: true };
});

ipcMain.handle('app:quit-ready', async event => {
  await saveChain;
  const target = BrowserWindow.fromWebContents(event.sender);
  if (target) {
    if (quitting) {
      target.allowClose = true;
      target.close();
    } else if (target.pendingHide) {
      target.pendingHide = false;
      target.hide();
      createTray();
      return true;
    } else {
      target.allowClose = true;
      target.close();
    }
  }
  // A deferred renderer flush cancels Electron's first quit attempt, so resume
  // it explicitly once the window is closed.
  if (quitting) app.quit();
  return true;
});

// ---------------------------------------------------------------------------
// Application menu
// ---------------------------------------------------------------------------

function command(name, target = BrowserWindow.getFocusedWindow() || mainWindow) {
  target?.webContents.send('command', name);
}

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'New To-Do', accelerator: 'CmdOrCtrl+N', click: () => command('new-task') },
        {
          label: 'New Project…',
          accelerator: 'CmdOrCtrl+Alt+N',
          click: () => command('new-project')
        },
        { label: 'New Area…', click: () => command('new-area') },
        {
          label: 'New Heading…',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => command('new-heading')
        },
        { type: 'separator' },
        { label: 'Quick Entry', click: openQuickEntry },
        { label: 'New Window', click: () => command('new-window') },
        { type: 'separator' },
        { label: 'Export Backup…', click: () => command('export') },
        { label: 'Import Backup…', click: () => command('import') },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => command('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => command('redo') },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        ...['Inbox', 'Today', 'Upcoming', 'Anytime', 'Someday', 'Logbook', 'Trash'].map(
          (label, index) => ({
            label,
            accelerator: `CmdOrCtrl+${index + 1}`,
            click: () => command(label.toLowerCase())
          })
        ),
        { type: 'separator' },
        { label: 'Tomorrow', click: () => command('tomorrow') },
        { label: 'All Projects', click: () => command('projects') },
        { label: 'Logged Projects', click: () => command('logged-projects') },
        { label: 'Repeating', click: () => command('repeating') },
        { label: 'Deadlines', click: () => command('deadlines') },
        { type: 'separator' },
        { label: 'Quick Find', accelerator: 'CmdOrCtrl+F', click: () => command('search') },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+/',
          click: () => command('sidebar')
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(process.env.THONGS_LOCAL_TEST ? [{ role: 'toggleDevTools' }] : [])
      ]
    },
    {
      label: 'Items',
      submenu: [
        { label: 'When…', accelerator: 'CmdOrCtrl+S', click: () => command('when') },
        {
          label: 'Move…',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => command('move')
        },
        { label: 'Complete', accelerator: 'CmdOrCtrl+K', click: () => command('complete') },
        {
          label: 'Move to Trash',
          accelerator: 'CmdOrCtrl+Backspace',
          click: () => command('delete')
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Keyboard Shortcuts', click: () => command('help') },
        { label: 'About Thongs Local', click: () => command('about') }
      ]
    }
  ]);
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

function createWindow({ view = '' } = {}) {
  const isMain = !mainWindow;
  const win = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 400,
    minHeight: 460,
    title: APP_NAME,
    backgroundColor: '#ffffff',
    icon: iconPath,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  if (isMain) mainWindow = win;
  windows.add(win);

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });

  win.loadFile(rendererPath, view ? { query: { view } } : undefined);

  // The menu bar stays hidden; its accelerators still work. Alt reveals it.
  win.setAutoHideMenuBar(true);
  win.setMenuBarVisibility(false);

  win.on('close', event => {
    if (win.allowClose) return;
    event.preventDefault();
    if (quitting || win !== mainWindow) {
      win.webContents.send('command', 'flush-and-close');
      return;
    }
    if (!prefs.askedCloseToTaskbar) {
      void askCloseToTaskbar(win);
      return;
    }
    if (prefs.closeToTaskbar === true) {
      if (!createTray()) {
        quitting = true;
        win.webContents.send('command', 'flush-and-close');
        return;
      }
      win.pendingHide = true;
      win.webContents.send('command', 'flush-and-close');
      return;
    }
    quitting = true;
    win.webContents.send('command', 'flush-and-close');
  });

  win.on('closed', () => {
    windows.delete(win);
    if (win === mainWindow) mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.whenReady().then(() => {
    createWindow();
    Menu.setApplicationMenu(buildMenu());

    let stored = null;
    try {
      stored = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
    } catch {
      // No library yet.
    }
    if (
      typeof stored?.settings?.quickShortcut === 'string' &&
      stored.settings.quickShortcut.length <= MAX_SHORTCUT_LENGTH
    ) {
      quickAccelerator = stored.settings.quickShortcut;
    }
    configureQuickEntry(stored?.settings?.quickEnabled !== false);
    if (prefs.closeToTaskbar === true) createTray();
  });

  app.on('window-all-closed', () => {
    if (quitting || prefs.closeToTaskbar !== true) app.quit();
    else createTray();
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
}
