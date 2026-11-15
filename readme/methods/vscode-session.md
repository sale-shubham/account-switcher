# VS Code session

Covers `lib/vscode_secret.py` and the PowerShell wrappers `Save-VSCodeSession`, `Set-VSCodeSession`,
`Clear-VSCodeSession`, `Test-VSCodeSession`, plus `$vscodeDbs` / `$hasVSCode` / `$vscodeExe` in
`lib/github.ps1`.

## Where VS Code keeps the GitHub session (VS Code 1.144, verified 2026-10-30)

- DB: `%USERPROFILE%\.vscode-shared\sharedStorage\state.vscdb` (SQLite, table `ItemTable(key, value)`)
- Key: `secret://{"extensionId":"vscode.github-authentication","key":"github.auth"}`
- Value: text `{"type":"Buffer","data":[118,...]}` — Electron safeStorage ciphertext; the AES key is
  DPAPI-protected in VS Code's `Local State`. Holds the whole GitHub session list.
- **Not** in Windows Credential Manager, and **not** in `%APPDATA%\Code\User\globalStorage\state.vscdb`
  (that "fallback application storage" only has the Microsoft auth secret).

`$vscodeDbs` lists the shared DB first, then the global one, keeping those that exist. `get` / `set`
use the first; `clear` runs on all of them so an old copy cannot come back.

## How to re-find it after a VS Code update

1. Newest `%APPDATA%\Code\logs\<yyyymmddThhmmss>\main.log` → look for
   `[shared storage] Creating shared storage database at '<path>'`.
2. `...\window1\exthost\vscode.github-authentication\GitHub Authentication.log` → `Reading sessions
   from keychain...` / `Got N sessions` confirms a session exists.
3. Copy each candidate `state.vscdb` to the scratchpad and query the copy:
   `SELECT key, length(value) FROM ItemTable WHERE key LIKE 'secret://%';`
4. Update `KEY` / `$vscodeDbs`, this doc, `CLAUDE.md` hard rule 7 and `readme/ARCHITECTURE.md`.

## API

### `vscode_secret.py get|set|clear|has <state.vscdb> [<file>]`
Run as `python -I lib\vscode_secret.py ...` (isolated mode). `get` writes the value to `<file>`, exit
`3` if the key is absent (no file written). `set` writes `<file>`'s content with
`INSERT OR REPLACE`. `clear` deletes the row. `has` exits `0` if the row exists, `3` if not (reads
nothing out). Stdlib `sqlite3` only.

### `Save-VSCodeSession $file` → `$true` / `$false`
Creates the parent folder, runs `get`. `$false` means VS Code has no GitHub session.

### `Set-VSCodeSession $file`
Runs `set`; `throw` on non-zero exit.

### `Clear-VSCodeSession`
Runs `clear` on every DB in `$vscodeDbs`.

### `Test-VSCodeSession` → `$true` / `$false`
Runs `has` on the first DB. Used by `Get-GitHubLoginState` (the web UI's VS Code sign-in row) and
`Get-GitHubStatus` (the identity panel's VS Code row). Says
whether **a** GitHub session exists, not whose. While VS Code is running, a fresh sign-in shows up
once VS Code has written it to disk (usually within seconds).

### `$vscodeExe`
`Code.exe` next to the `bin\code.cmd` found on `PATH`, or `$null`. The web UI's sign-in step starts it.

## Notes

- VS Code **must be closed** before `set` / `clear` — it holds the state in memory and writes it
  back on exit, which would undo the change.
- The key is hard-coded in Python because Windows PowerShell 5.1 strips embedded `"` from native
  command arguments.
- Copilot's per-extension account preference lives elsewhere (`github.copilot-github` in the global
  `state.vscdb`, value = account label) and is not swapped.
- The ciphertext only decrypts for this Windows user on this machine.

---
*Last updated: 2026-11-15 (helper moved to lib/; $hasVSCode uses the shared $hasPython)*
*Previously: 2026-11-14 (callers are now the web UI and Get-SwitcherStatus)*
*Previously: 2026-10-30 (`has` action + Test-VSCodeSession for the login window; code moved to lib/github.ps1)*
*Previously: 2026-10-30 (initial methods doc — location found via main.log)*
