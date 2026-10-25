# Thongs 3



Thongs 3 is a local-first task manager for Windows. It keeps your to-dos close, your projects together, and your data out of everybody else's cloud.

One executable. No installer. No account. No subscription. No browser. No internet connection required.

## Put it on

1. Get the Windows executable (`Thongs-Local-0.1.0-Windows-x64.exe`).
2. Double-click it.
3. Start with the Inbox. Add a to-do. Breathe.

Windows 10/11, 64-bit. The executable is unsigned, so Windows may ask whether you are sure. You are.

## What's it does

- **Inbox, Today, This Evening, Upcoming, Tomorrow, Anytime, Someday, Logbook, Trash.**
- **Projects, areas, headings, progress rings.** Everything has a place. Some places have subplaces.
- **Quick Entry** from a global shortcut, with notes, dates, tags, checklists, deadlines and a destination.
- **Quick Find** across lists, tags, notes, checklists and the Logbook.
- **Tags, deadlines, reminders, checklists and notes.** All the small labels that make a large day behave.
- **Repeating to-dos** after completion or on a fixed schedule, with weekly weekdays, monthly and yearly rules, last-weekday options, pause/resume, early next copies and a one-time next-date override.
- **Multiple windows** with a three-way merge. Edit in two places; keep both changes.
- **All Projects, Logged Projects, Deadlines and tag lists**, grouped the way a tidy person would group them.
- **Light, dark and system appearance.**
- **Backups** in plain JSON, because your to-dos should not require a rescue party.

## What it doesn't do

- No accounts, analytics, telemetry or network calls.
- No connected calendars, reminders import, mail capture or subscription upsell.
- No notifications after the app closes. Reminders live in the app while it is running.
- No phones, tablets, watches or headsets. This one is for the computer you already have.
- No forty-seven-step onboarding. There is an Inbox. Start there.

## The fit

Your library is a JSON file in the app's own application-data folder, with a previous-save backup. Export and import live in **Settings → Local Library**. Nothing leaves the machine.

No name, email address, account, machine ID or usage record is collected. The app makes no network requests.

## Build it

Requires Node.js 24+ and npm:

```sh
npm ci
npm run build
npm start
npm run dist:win
```

The Windows release is one portable executable.

## Test it

```sh
npm test
npm run test:ui
node scripts/desktop-smoke.mjs
node scripts/windows-acceptance.mjs
node scripts/branding-audit.mjs
node scripts/pii-audit.mjs
```

The suite covers 38 model and merge checks, 31 browser scenarios, 11 packaged desktop checks, 19 Windows executable workflows, and 21 visual comparisons. More checks than a swimming-pool locker room.

## Known snug spots

- Same-field edits from two windows resolve to the latest save. Different fields merge.
- Fonts and native materials are close, not identical.
- Some hover, focus, error and animation states are not exhaustively certified.
- Cloud and connected calendar/reminder services are deliberately absent.

## License

Private build. All thongs reserved.
