# Verification and release gate

## Current decision

**Public documentation is available; the executable is not released.** A Windows-executable runtime test reproduced loss of a newly entered task with a second window open. The release is held pending a persistence fix and a fresh regression pass. A visually refreshed build is not automatically a safe build.

The work is limited to original artwork, presentation copy, and packaging/notices. No application persistence logic, storage key, application ID, library schema, or library location was changed. Development source remains outside this public repository.

## Checks completed on the current rebuild

- **Build:** Windows x64 portable packaging succeeds using Electron 45.0.0.
- **Core regression:** 38 model and merge tests pass.
- **Browser interaction:** 31 scenarios pass, including editing, scheduling, recurrence, backups, preferences, and window-control dispatch.
- **Desktop runtime:** 11 checks pass using macOS Electron with the current production renderer. This is not packaged Windows execution.
- **Original graphics:** all 72 extracted interface images have independently authored geometric replacements. All replacement image content is present in the packaged app; zero packaged image hashes match the 72 recorded extracted resources, including PNG data embedded in JavaScript.
- **Packaging:** no development source directories, tests, reference-image directories, or private reference metadata were found in the application archive. Runnable compiled JavaScript and the Electron entry points are necessarily included.
- **Notices:** React, React DOM, Scheduler, Lucide, Electron, and Chromium notices are included. Application binary-use terms are included inside the package and alongside its archive.
- **Screenshots:** eight app-renderer captures use isolated fictional task data, with matching light/dark views. They are not mockups or native Windows screenshots.

## The failing release check

The rebuilt Windows executable launches under CrossOver on macOS with its default sandbox and graphics settings. The full workflow run passes eleven checks covering launch, task details, scheduling, tags, persistence, projects, recurrence, moves, and task restoration, then fails while adding a task with a second window open.

A reduced test repeats only:

1. Open a second Inbox window.
2. Return to the main window and create a task.
3. Type its title and press Enter.
4. Assert that the title exists in the on-disk library through the application's real IPC bridge.

The reduced run fails in its second round: the entered title is no longer in either the main view or the saved library. Instrumentation observes repeated incoming library updates during this period. In a differential run, waiting until the title is saved **before** pressing Enter produces three passing rounds.

This supports a pending-save/incoming-update timing problem; it is not a completed root-cause fix. Waiting in a test is diagnostic, **not** an accepted product workaround or a passing release gate. The normal, unmodified workflow must pass after a fix.

## Local artifact identity

The unreleased rebuilt executable is `Thongs-Local-0.1.0-Windows-x64.exe`, 110,665,775 bytes.

```text
ccb79fc259081f1aeff524fde3f250ff1b9824bc1ae03fa66895f19805b12f4f
```

This SHA-256 identifies the artifact that was audited and runtime-tested. It is **not** a checksum for a public download; no release asset is available. Any later rebuilt artifact needs its own audit, tests, and checksum.

## Remaining verification

- Fix the persistence failure with explicit approval for that narrow logic change; test task creation, edits, concurrent windows, and restart persistence.
- Repeat the unmodified full Windows-executable workflow and restart checks against the final artifact hash.
- Native Windows 10/11 testing, DPI scaling, native file-picker interaction, and full accessibility validation remain outstanding. CrossOver is not a Windows installation; file-picker responses are substituted in automation.
- Only after release gates pass: publish the binary and notices, publish a checksum, wire the README download link, download the public asset again, and verify its hash.

Raw local runtime traces contain machine-specific paths and therefore are not uploaded. This public summary retains the relevant outcomes and limitations without exposing private task data or development source.

## Public README checks

The live GitHub repository page was checked at **1440px and 390px widths**, in **light and dark appearance**. In each of the four combinations:

- All eight README images loaded.
- All four picture elements selected the expected theme-specific capture.
- All seventeen rendered in-page anchor references resolved.
- No horizontal overflow was detected inside the README.

Full-size light/dark links accompany the full-window screenshots so narrow-screen readers can inspect the interface at its original resolution. These checks establish presentation behavior, not executable release readiness.
