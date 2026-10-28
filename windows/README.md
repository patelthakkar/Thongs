# Thongs Local — Windows source

The desktop shell behind the published Windows build of Thongs Local 0.2.0.
It is a small Electron application: one local JSON library, no account, no
network calls, no telemetry.

## Provenance

The files in `electron/` are the main-process code from the published
`app.asar`, cleaned up for a Windows-only build:

- macOS-only branches were removed: traffic-light placement, the application
  menu, dock activation, and the dock badge. The shipped Windows build never
  used them.
- Formatting and naming were made consistent, and repeated literals became
  named constants. Behavior on Windows is unchanged.
- No machine paths, user names, accounts, keys, or task data are included.

`dist/` and `build/icon.png` are copied unchanged from the same package. The
renderer is compiled JavaScript, so this tree rebuilds the executable but does
not let you edit the interface.

## Layout

| Path | Role |
| --- | --- |
| `electron/main.cjs` | Windows, tray, Quick Entry, menus, library file I/O |
| `electron/preload.cjs` | `window.desktop` bridge; also mounts the Windows tray setting in Settings |
| `electron/merge.cjs` | Three-way merge for concurrent saves |
| `dist/` | Compiled renderer bundle |
| `build/icon.png` | Window and tray icon |
| `LICENSE-BINARY.txt` | Repository licence, copied here for packaging |
| `THIRD-PARTY-NOTICES.txt` | Repository notices, copied here for packaging |

## Build and run

See [BUILD.md](BUILD.md).

## Data

The library lives in `%APPDATA%\Thongs Local\library.json`; `preferences.json`
in the same folder holds the tray and Quick Entry preferences. Set
`THONGS_LOCAL_DATA_DIR` to use a different folder.

## License

See [../LICENSE-BINARY.txt](../LICENSE-BINARY.txt). Third-party components are
covered by [../THIRD-PARTY-NOTICES.txt](../THIRD-PARTY-NOTICES.txt).
