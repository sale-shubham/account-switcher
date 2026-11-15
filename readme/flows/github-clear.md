# Clear (and adding an account)

## Purpose

`.\switcher.ps1 github -Clear` (or **Prepare** in the `-Ui` web page, which first saves the active
profile) — make GitHub Desktop and VS Code start signed out **without signing out** (which would
delete the token), so another account can be signed in. Implemented by `Clear-GitHubAppState` in
`lib/github.ps1`, run inside `Invoke-WithAppsClosed`.

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

1. `.\switcher.ps1 github -Save work` — the current account is saved
2. `.\switcher.ps1 github -Clear`
3. Sign in to GitHub Desktop and VS Code with the new account
4. `gh auth login --hostname github.com --web` with the new account
5. `git credential-manager github login --username <new-login>` (or let the first push prompt)
6. Add the profile to `accounts.json`
7. `.\switcher.ps1 github -Save personal`

## Failure behavior

- An app does not close → `throw` before anything moves.
- `Move-Item` fails → `throw`; VS Code not cleared.

## Notes

- Never "Sign out" in the apps, never `gh auth logout`: those delete tokens. `-Clear` is the safe
  path.
- Old `_cleared\<timestamp>` folders are never deleted automatically.

---
*Last updated: 2026-11-15 (GitHub family in lib/github.ps1; functions renamed *-GitHub*; CLI is switcher.ps1 github -Clear)*
*Previously: 2026-11-14 (Prepare moved to the -Ui web page)*
*Previously: 2026-10-30 (moved into Clear-GitHubAppState; Prepare in the -Login window reuses it)*
*Previously: 2026-10-30 (initial flow doc)*
