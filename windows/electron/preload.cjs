'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// The only bridge between the renderer and the main process. Each method maps
// to one ipcMain handler in main.cjs; nothing else is exposed.
contextBridge.exposeInMainWorld('desktop', {
  load: () => ipcRenderer.invoke('library:load'),
  save: library => ipcRenderer.invoke('library:save', library),
  export: library => ipcRenderer.invoke('library:export', library),
  import: () => ipcRenderer.invoke('library:import'),
  window: action => ipcRenderer.invoke('window:action', action),
  info: () => ipcRenderer.invoke('app:info'),
  preferences: settings => ipcRenderer.invoke('app:preferences', settings),
  openData: () => ipcRenderer.invoke('app:open-data'),
  copyText: text => ipcRenderer.invoke('app:copy-text', text),
  openWindow: view => ipcRenderer.invoke('app:open-window', view),
  openQuickEntry: () => ipcRenderer.invoke('app:open-quick-entry'),
  addQuickTask: (task, base) => ipcRenderer.invoke('quick:add', { task, base }),
  closeQuick: () => ipcRenderer.invoke('quick:close'),
  resizeQuick: height => ipcRenderer.invoke('quick:resize', height),
  getCloseToTaskbar: () => ipcRenderer.invoke('app:close-to-taskbar'),
  setCloseToTaskbar: value => ipcRenderer.invoke('app:set-close-to-taskbar', value),
  onLibraryChanged: handler => {
    const listener = (_, library) => handler(library);
    ipcRenderer.on('library:changed', listener);
    return () => ipcRenderer.removeListener('library:changed', listener);
  },
  quitReady: () => ipcRenderer.invoke('app:quit-ready'),
  onCommand: handler => {
    const listener = (_, command) => handler(command);
    ipcRenderer.on('command', listener);
    return () => ipcRenderer.removeListener('command', listener);
  }
});

// The renderer is a prebuilt bundle and has no control for the Windows tray
// preference. Mount one in the Quick Entry pane of Settings and keep it in
// sync across React re-renders, without rebuilding the renderer.
if (!location.search.includes('quick=1')) {
  const install = () => {
    const PANE_SELECTOR = '.nib-pane[data-pane="QuickEntry"]';
    const ROW_ATTRIBUTE = 'data-thongs-close-taskbar';
    const PANE_HEIGHT = 296;

    let queued = false;

    function apply() {
      const pane = document.querySelector(PANE_SELECTOR);
      if (!pane) return;
      const viewport = pane.parentElement;
      if (!viewport) return;

      if (!pane.querySelector(`[${ROW_ATTRIBUTE}]`)) {
        const row = document.createElement('label');
        row.setAttribute(ROW_ATTRIBUTE, '');
        row.className = 'nib-control nib-checkbox';
        row.style.cssText = 'left:27px;top:246px;width:460px;height:18px;font-size:13px';

        const box = document.createElement('input');
        box.type = 'checkbox';
        box.setAttribute('aria-label', 'Exit to taskbar');

        const text = document.createElement('span');
        text.textContent = 'Exit to taskbar';

        row.append(box, text);

        const note = document.createElement('div');
        note.className = 'nib-control nib-text';
        note.style.cssText =
          'left:47px;top:268px;width:454px;font-size:11px;color:var(--muted);line-height:1.35';
        note.textContent = 'Keeps Quick Entry available after you close the window.';

        pane.append(row, note);

        box.addEventListener('change', async () => {
          const next = box.checked;
          try {
            await ipcRenderer.invoke('app:set-close-to-taskbar', next);
          } catch {
            box.checked = !next;
          }
        });

        ipcRenderer
          .invoke('app:close-to-taskbar')
          .then(state => {
            box.checked = state.value === true;
          })
          .catch(() => {});
      }

      if (pane.style.height !== `${PANE_HEIGHT}px`) pane.style.height = `${PANE_HEIGHT}px`;
      const scale = Math.min(1, viewport.clientWidth / 528) || 1;
      const target = `${Math.round(PANE_HEIGHT * scale)}px`;
      if (viewport.style.height !== target) viewport.style.height = target;
    }

    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        apply();
      });
    };

    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    // React can replace the pane without a matching mutation, so re-check.
    setInterval(apply, 750);
    apply();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
}
