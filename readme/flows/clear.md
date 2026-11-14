# Clear (and adding an account)

## Purpose

`.\switch-github.ps1 -Clear` (or **Prepare** in the `-Ui` web page, which first saves the active
profile) — make GitHub Desktop and VS Code start signed out **without signing out** (which would
delete the token), so another account can be signed in. Implemented by `Clear-AppState` in
`switch-github-core.ps1`, run inside `Invoke-WithAppsClosed`.

## Steps

1. `Invoke-WithAppsClosed` closes GitHub Desktop, then VS Code.
2. Create `<dataDir>\_cleared\<yyyyMMdd-HHmmss>\`.
3. Move Desktop's `Local Storage` into it (Desktop then starts with no users → welcome screen).
4. VS Code: save the session into the same folder (`vscode-github-auth.txt`), then
   `Clear-VSCodeSession` deletes the secret row from **every** VS Code DB found (shared + global).
5. Delete `current.txt`.
6. `Invoke-WithAppsClosed` reopens the apps that were running.

Tokens in Credential Manager are not touched.

## Adding an account — full procedure

The `-Ui` web page walks through this (`readme/flows/ui.md`). From the command line:

1. `.\switch-github.ps1 -Save work` — the current account is saved
2. `.\switch-github.ps1 -Clear`
3. Sign in to GitHub Desktop and VS Code with the new account
4. `gh auth login --hostname github.com --web` with the new account
5. `git credential-manager github login --username <new-login>` (or let the first push prompt)
6. Add the profile to `accounts.json`
7. `.\switch-github.ps1 -Save personal`

## Failure behavior

- An app does not close → `throw` before anything moves.
- `Move-Item` fails → `throw`; VS Code not cleared.

## Notes

- Never "Sign out" in the apps, never `gh auth logout`: those delete tokens. `-Clear` is the safe
  path.
- Old `_cleared\<timestamp>` folders are never deleted automatically.

---
*Last updated: 2026-11-14 (Prepare moved to the -Ui web page)*
*Previously: 2026-10-30 (moved into Clear-AppState; Prepare in the -Login window reuses it)*
*Previously: 2026-10-30 (initial flow doc)*
