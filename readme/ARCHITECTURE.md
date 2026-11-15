# Architecture

## Overview

Every developer tool on Windows keeps its own login in its own place. The switcher groups them
into **tool families** that switch together, each with its own profiles:

- **GitHub**: the GitHub CLI, git (identity + Git Credential Manager), GitHub Desktop and VS Code's
  GitHub sign-in. One GitHub account across all four.
- **Claude Code**: the Claude Code CLI, and the VS Code extension, which runs the same CLI and login.

Switching one family never touches the other. For each family the switcher:

1. **Backs up the sign-in.** Tokens are copied into Windows Credential Manager entries (encrypted
   by Windows for this user): `github-switch:<profile>:<original target>` for GitHub,
   `account-switch:claude:<profile>` for Claude Code.
2. **Keeps the non-secret state** per profile: GitHub Desktop's `Local Storage` and VS Code's
   still-encrypted GitHub session under `%LOCALAPPDATA%\github-switch\<profile>`; the Claude account
   details under `%LOCALAPPDATA%\account-switch\claude\<profile>`.
3. **Switches** by putting the target profile's copy back with the affected apps closed.

It never signs anything out and never prints or decrypts a token.

## Where each tool stores its login

GitHub tools, verified 2026-10-30:

| App | Token | "Which account is signed in" |
|---|---|---|
| gh CLI 2.100 | Credential Manager `gh:github.com:<user>` (one per account) | `gh:github.com:` (active copy, empty user) + `%APPDATA%\GitHub CLI\hosts.yml`, both rewritten by `gh auth switch` |
| Git Credential Manager 2.9 | Credential Manager `git:https://github.com` (user = login); other accounts may get their own `git:https://...github.com` targets | Global git config `credential.https://github.com.username` |
| GitHub Desktop 3.6.7 | Credential Manager `GitHub - https://api.github.com/<login>` (persistence: Enterprise) | `%APPDATA%\GitHub Desktop\Local Storage` (Chromium LevelDB, key `users`). Repositories list is in `IndexedDB` and is **not** swapped |
| VS Code 1.144 | **Not** in Credential Manager. Encrypted value in `%USERPROFILE%\.vscode-shared\sharedStorage\state.vscdb`, key `secret://{"extensionId":"vscode.github-authentication","key":"github.auth"}` | Same value (it holds the session list) |
| git identity | - | Global git config `user.name`, `user.email` |

Claude Code 2.1.325 (native install), verified 2026-11-15:

| File (under `%USERPROFILE%`, or `CLAUDE_CONFIG_DIR` if set) | Holds | Secret |
|---|---|---|
| `.claude\.credentials.json`, key `claudeAiOauth` | `accessToken`, `refreshToken`, `expiresAt`, `refreshTokenExpiresAt`, `scopes`, `subscriptionType`, `rateLimitTier` | yes |
| `.claude\.credentials.json`, key `mcpOAuth` | MCP server logins (Figma etc.), not tied to the Claude account | yes, never touched |
| `.claude.json`, key `oauthAccount` | `accountUuid`, `emailAddress`, `organizationUuid`, `organizationName`, `displayName`, billing fields | no |

The rest of `.claude.json` (settings, projects, caches) belongs to the Windows user, not the
account, and stays as it is. Found by reading the key names (never the values) of both files and
comparing with `claude auth status --json`. Details: `readme/methods/claude-state.md`.

## Components

| Component | File | Doc |
|---|---|---|
| CLI entry point (`github|claude <profile>`, `-Save`, `-Clear`, `-Ui`, status) | `switcher.ps1` | `readme/flows/*.md` |
| Shared: `CredStore` (inline C#), `$profilePattern`, `$switchDir`, `Stop-App`, `Start-Apps`, `Copy-Folder` | `lib/common.ps1` | `readme/methods/credential-store.md`, `desktop-state.md` |
| GitHub family: profiles, tokens, Desktop + VS Code state, `Switch-GitHubProfile`, `Save-GitHubProfileState`, `Clear-GitHubAppState` | `lib/github.ps1` | `readme/flows/github-*.md`, `readme/methods/profiles.md` |
| VS Code secret row | `lib/vscode_secret.py` | `readme/methods/vscode-session.md` |
| Claude Code family: `Switch-ClaudeProfile`, `Save-ClaudeProfile`, `Clear-ClaudeSignIn`, status | `lib/claude.ps1` | `readme/flows/claude-*.md`, `readme/methods/claude-state.md` |
| Claude account details in `.claude.json` | `lib/claude_account.py` | `readme/methods/claude-state.md` |
| UI server (localhost API, per-run token, static files) | `lib/ui-server.ps1` | `readme/methods/ui-server.md` |
| Web UI (one card per tool family, details drawers, add-account wizards, activity) | `web/` (React + TypeScript, Vite) | `readme/flows/ui.md` |

Both entry points (CLI and UI server) only call the family operations; each operation exists once.
The React page holds no switching logic; it shows the status and calls the API.

```
browser (web/dist)  --X-Switcher-Token-->  lib/ui-server.ps1  --+
switcher.ps1 (CLI)  ------------------------------------------+-->  lib/github.ps1  --+
                                                              +-->  lib/claude.ps1  --+-->  lib/common.ps1
```

### Adding a tool family

A new family (e.g. another CLI with its own login) gets `lib/<tool>.ps1` with the same set of
operations (status, save, switch, sign out safely, delete, start sign-in), its state under
`$switchDir\<tool>` and Credential Manager targets `account-switch:<tool>:<profile>`; routes under
`/api/<tool>/` in `ui-server.ps1`; a key in `Status` (`web/src/api.ts`); and a card, details drawer
and add-account wizard in `web/src/components/`. The `ToolCard`, `QuickSwitch`, `Drawer` and
`Stepper` components are shared.

## Switch lifecycle

GitHub (`Switch-GitHubProfile`, full detail in `readme/flows/github-switch.md`):

1. Validate the profile (`Get-GitHubProfile`)
2. Close GitHub Desktop / VS Code if that profile has a snapshot for them
3. `gh auth switch`: **abort here** if gh has no login for the account (nothing changed yet)
4. Back up every profile's current tokens
5. Restore the target's tokens that are missing or held by another account
6. Set git `user.name`, `user.email`, `credential.https://github.com.username`
7. Swap Desktop `Local Storage` and the VS Code session (previous state kept in `_previous`)
8. Write `current.txt`; reopen the apps that were running
9. Warn if GCM has no stored login for the account; print status

Claude Code (`Switch-ClaudeProfile`, full detail in `readme/flows/claude-switch.md`):

1. Validate the profile, its saved sign-in, and that the sign-in has not expired
2. **Abort** if any Claude Code process runs (nothing changed yet)
3. Save the current sign-in again: into its own profile, or aside as `_previous` (tokens rotate)
4. Write the profile's tokens into `.credentials.json` and its account into `.claude.json`

## Security model

- Tokens stay inside Credential Manager (DPAPI, per Windows user). Backups are more entries in the
  same store, not files.
- Claude Code's tokens travel only between its `.credentials.json`, PowerShell memory and
  Credential Manager. The Python helper only handles the non-secret `oauthAccount`.
- The VS Code snapshot file is VS Code's ciphertext (`{"type":"Buffer","data":[118,...]}`,
  Electron safeStorage); the key is DPAPI-protected in VS Code's `Local State`. It only decrypts
  for this user on this machine.
- The Desktop snapshot contains no token, only the user list and Desktop preferences.
- The UI server listens on `localhost` only (other `Host` headers get `400` from HttpListener) and
  every API call needs the per-run key from the link the server opens. API responses carry
  logins, names, emails, plans and expiry dates, never a token (`readme/methods/ui-server.md`).
- The tool reads and writes tokens as opaque values; it never prints them.

## Known limitations

GitHub:

- **VS Code storage is undocumented.** It moved to `.vscode-shared` in a recent VS Code release;
  a future release may move it again. Then saving warns "no GitHub session" and the VS Code part
  is skipped. Re-find it per `readme/methods/vscode-session.md`.
- **Copilot's account preference** (`github.copilot-github` in `%APPDATA%\Code\User\globalStorage\state.vscdb`)
  is not swapped; Copilot may ask once which account to use.
- **Saving cannot verify the VS Code account**: the session is encrypted. The user must make sure
  the right account is signed in.
- **No save-back.** A switch restores the snapshot from save time; Desktop preferences changed
  since then are replaced (the replaced state is kept in `_previous`, one level deep).
- **gh logout is not recoverable from backups alone**: `gh auth logout` also removes the account
  from `hosts.yml`; run `gh auth login` again. The switcher runs it only when a profile is deleted
  with "Also sign out of GitHub CLI and Git" ticked (`Remove-GitHubCliLogin`).
- **`_cleared\<timestamp>` folders accumulate**; delete old ones by hand.
- **Desktop is reopened from the exact exe path that was running** (`app-3.6.x\GitHubDesktop.exe`).
- **Desktop's repository list is shared by all profiles** (it lives in IndexedDB; only `Local Storage`
  is swapped). Its hourly background fetch of a private repo the active account cannot access logs
  `remote: Repository not found`. Harmless; it stops after switching to the account that has access.
- **Apps reopened by the switcher print their logs in the console that ran it.** VS Code / Desktop
  noise there (`DEP0169`, `Unknown channel`, `desktop-notifications`) is theirs, not the switcher's.
- **github.com only**, no SSH keys, no GitHub Enterprise Server.
- **The web UI's VS Code row cannot name the account**; it only shows that a session exists.
- **GitHub state still lives in `%LOCALAPPDATA%\github-switch`** and `github-switch:` targets (the
  names from before Claude Code support), so existing profiles keep working.

Claude Code:

- **Claude Code must be fully closed to switch or sign out.** A running session holds its tokens in
  memory and writes them back when it refreshes them, which would undo the switch. Console sessions
  have no window to close normally and are never killed, so the user exits them (`/exit`) - this
  includes a Claude Code session that started the switcher.
- **A saved sign-in expires** (`refreshTokenExpiresAt` in the saved tokens). A profile not used
  until then must be signed in and saved again; the UI shows the date and flags expired profiles.
- **The file layout is undocumented** and may change with a Claude Code update; re-verify per
  `readme/methods/claude-state.md`.
- **`_previous` holds one sign-in.** An unsaved sign-in replaced by a switch is kept there until the
  next unsaved one replaces it.
- **The Claude desktop app is not covered**; it has its own sign-in. Its `claude.exe` is not counted
  as a running Claude Code session.
- **API-key logins (`ANTHROPIC_API_KEY`, Console) are not covered**; only Claude subscription sign-ins.

Both:

- **The UI server does one thing at a time.** While apps close (up to 20 s each) the page shows a
  busy modal and status requests wait. The sign-in buttons only start the tools; the wizards pick up
  the result on their next 4 s check.
- **The web UI needs `npm run build` once** (and after any change in `web/`); without `web\dist`
  the server prints the build command.

## Verified against real apps

- **2026-11-14** - GitHub: second account added through the (since replaced) WinForms window:
  Prepare, the four sign-ins, Save profile, then Switch between the two profiles, with VS Code and
  Desktop closed and reopened. A commit + push from VS Code worked as the new account.
- **2026-11-15** - GitHub: third account added through the web UI: Prepare, the four sign-ins, Save
  profile (after a page refresh, resumed with "Skip this step"), then Switch back to an earlier
  profile.
- **2026-11-15** - Claude Code: save / sign out / switch / expired / running-session refusal tested
  against a fake Claude config folder and Credential Manager (30 checks). **Not yet run against
  real Claude accounts.**

---
*Last updated: 2026-11-15 (gh logout only on an opt-in profile delete)*
*Previously: 2026-11-15 (Claude Code family; lib/ layout; dashboard UI; how to add a family)*
*Previously: 2026-11-15 (web UI verified against real apps; untested limitation removed)*
*Previously: 2026-11-14 (web UI replaces the WinForms window: components, security, limitations)*
*Previously: 2026-10-30 (core split + login window components and limitations)*
*Previously: 2026-10-30 (initial architecture doc from the build session)*
