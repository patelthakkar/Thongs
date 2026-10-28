# Building Thongs Local for Windows

This folder holds the Windows desktop shell of **Thongs Local 0.2.0**, the build
published as [v0.2.0](https://github.com/patelthakkar/Thongs/releases/tag/v0.2.0),
plus everything needed to package it again on Windows.

## What is in here

```text
windows/
  electron/main.cjs      main process: windows, tray, Quick Entry, library I/O
  electron/preload.cjs   the renderer's only bridge to the main process
  electron/merge.cjs     three-way merge for saves from several windows
  dist/                  the compiled renderer bundle, as shipped
  build/icon.png         window and tray icon
  package.json           app metadata and electron-builder configuration
  LICENSE-BINARY.txt     copy of the repository licence, packaged as a resource
  THIRD-PARTY-NOTICES.txt  copy of the repository notices, packaged as a resource
```

The two licence files are copies of the repository root files, kept here so the
folder builds on its own. The root copies remain the canonical versions.

`dist/` is the renderer exactly as it ships: `index.html`, one JavaScript
bundle, one stylesheet, and six image assets. It is compiled output, not
renderer source, so a rebuild reproduces the interface but cannot change it.
The renderer source is not part of this repository.

## Requirements

- Windows 10 or 11, 64-bit
- [Node.js](https://nodejs.org/) 22 LTS or newer (includes npm)
- Network access for the first install, to download Electron and the packaging
  tools. The built application needs no network.

## Build

From this folder (`windows/`):

```powershell
npm install
npm run dist:win
```

`npm install` fetches Electron 45.0.0, the runtime used by the published
build, and electron-builder. `npm run dist:win` writes a portable executable
to:

```text
windows/release/Thongs-Local-0.2.0-Windows-x64.exe
```

The file name matches the published asset. The bytes do not: timestamps,
packing order, and locally downloaded toolchain files differ, so the SHA-256
will not match the audited artifact. Rebuilding produces a new artifact that
has not been audited or runtime-tested. Treat it as such.

## Run from source

```powershell
npm install
npm start
```

To keep a rebuild away from your real library, point it at a scratch folder:

```powershell
$env:THONGS_LOCAL_DATA_DIR = "$env:TEMP\thongs-scratch"
npm start
```

Remove the variable (`Remove-Item Env:THONGS_LOCAL_DATA_DIR`) to return to
`%APPDATA%\Thongs Local`. Set `THONGS_LOCAL_TEST=1` to add **View → Toggle
Developer Tools**.

## What the build produces

- A portable `.exe`: no installer, no registry writes, no Node.js requirement
  on the target machine.
- `%APPDATA%\Thongs Local\library.json`, with `library.json.backup` written
  before each save.
- `%APPDATA%\Thongs Local\preferences.json`, holding the close-to-taskbar
  choice and whether the prompt was answered.

## Known limitation

The multi-window persistence failure described in
[`../docs/VERIFICATION.md`](../docs/VERIFICATION.md) is present in this code.
A task entered while a second window is open can be lost. Do not use this
build for important data until that is fixed.

## License

Building and running the result is permitted under
[`../LICENSE-BINARY.txt`](../LICENSE-BINARY.txt). The source in this folder is
published so the shipped build can be inspected and reproduced; that is not an
open-source license and grants no right to redistribute modified builds.
