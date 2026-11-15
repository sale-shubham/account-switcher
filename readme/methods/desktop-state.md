# GitHub Desktop state and app control

Covers `$desktopStorage`, `$desktopExe`, `Get-DesktopLogin`, `Stop-App`, `Start-Apps`,
`Invoke-WithAppsClosed` and `Copy-Folder` in `switch-github-core.ps1`. The app-control functions
are also used for VS Code.

## How GitHub Desktop 3.6.7 stores its sign-in

- Token: Credential Manager `GitHub - https://api.github.com/<login>`, one entry per login, so
  several can exist side by side.
- Signed-in users: Chromium localStorage in `%APPDATA%\GitHub Desktop\Local Storage\leveldb\`
  (key `users`, a JSON array with `"login":"<login>"`). Desktop loads users from there, then looks
  up each token by login. No `users` → welcome screen, signed out.
- Repositories list: `IndexedDB` — not touched, so all profiles share one repo list.
- Official Desktop supports one GitHub.com account at a time (issue #3707), which is why the whole
  `Local Storage` folder is swapped.

## API

### `Get-DesktopLogin` → login or `$null`
Reads every `.log` / `.ldb` file in `Local Storage\leveldb` (oldest first) as Latin-1 and returns
the last `"login":"..."` match. Files are opened with `FileShare.ReadWrite`, because a running
Desktop keeps its `.log` open for writing and `File.ReadAllBytes` then fails (that made the login
show blank while Desktop was open). Files it still cannot read are skipped. Best effort: values in
`.log` files are plain text; compacted `.ldb` files may be Snappy-compressed, which can hide a match.

### `Stop-App $processName $label` → exe path or `$null`
`$null` if not running. Otherwise loops for up to 20 s: calls `CloseMainWindow()` on every process
with a window (a normal close — unsaved-work prompts still appear), until no process is left.
Returns the exe path captured before closing. Timeout → `throw "<label> did not close (unsaved
changes?)..."`. Never kills.

### `Start-Apps $exes`
`Start-Process` for each non-null path. VS Code restores its windows on start.

### `Invoke-WithAppsClosed -Action { ... } [-Desktop $bool] [-VSCode $bool]`
Closes GitHub Desktop and/or VS Code (both by default) with `Stop-App`, runs `-Action`, then
reopens whichever were running — in `finally`, so also after a failure. Every operation that
touches app storage (`Save-ProfileState`, `Clear-AppState`, `Switch-Profile`) runs inside it. The
action block sees the caller's variables (dynamic scope); avoid naming its variables `$Desktop`,
`$VSCode` or `$Action`.

When VS Code has to close and the script runs in VS Code's integrated terminal
(`$env:TERM_PROGRAM -eq 'vscode'`) while VS Code is running, it `throw`s before closing anything:
closing VS Code ends every process in its terminals, which would kill the script halfway with
nothing reopened (seen 2026-11-15 with the UI server). `Start-UiServer` avoids this by reopening
itself in its own window.

### `$desktopExe`
`%LOCALAPPDATA%\GitHubDesktop\GitHubDesktop.exe` (the Squirrel launcher). The web UI's sign-in step starts
it when Desktop is not running.

### `Copy-Folder $from $to`
Deletes `$to` if present, creates its parent, copies `$from` recursively. All with
`-ErrorAction Stop`.

## Notes

- Desktop writes `Local Storage` when it exits — only copy or replace it while Desktop is closed.
- Never click "Sign out" in Desktop: it deletes the `GitHub - ...` token. `-Clear` moves the
  folder aside instead.
- Desktop is reopened from the path that was running (`%LOCALAPPDATA%\GitHubDesktop\app-3.6.x\GitHubDesktop.exe`).

---
*Last updated: 2026-11-15 (Invoke-WithAppsClosed refuses to close VS Code from VS Code's own terminal)*
*Previously: 2026-11-14 (sign-in step moved to the web UI)*
*Previously: 2026-11-14 (Get-DesktopLogin reads with FileShare.ReadWrite so it works while Desktop runs)*
*Previously: 2026-10-30 (Invoke-WithAppsClosed + $desktopExe; code moved to switch-github-core.ps1)*
*Previously: 2026-10-30 (initial methods doc)*
