# CLAUDE.md — Project Intelligence Hub

This file is the single source of truth for Claude Code in this project.
Whenever code, logic, or flow changes — update the relevant README(s) listed below **in the same
operation**.

---

## Project type

**Language:** Windows PowerShell 5.1 (`switcher.ps1` CLI; `lib/common.ps1` shared state + inline C# via `Add-Type`; one file per tool family: `lib/github.ps1`, `lib/claude.ps1`; `lib/ui-server.ps1` localhost API server) + Python 3 stdlib (`lib/vscode_secret.py`, `lib/claude_account.py`) + React 18 / TypeScript / Vite (`web/`, the UI)
**Package manager:** npm, for `web/` only (React, Vite, TypeScript). The PowerShell / Python side has no third-party dependencies by design
**Platform:** Windows only (Credential Manager, DPAPI, `%APPDATA%` layouts)

This project is an **account switcher for one Windows user's developer tools**, grouped into tool
families that each have their own profiles and switch on their own:

- **GitHub** - gh CLI, git (identity + Git Credential Manager), GitHub Desktop and VS Code's GitHub
  sign-in, switched together. Tokens backed up in Credential Manager, app sign-in state
  snapshotted per profile.
- **Claude Code** - the CLI and its VS Code extension. The OAuth tokens (`~\.claude\.credentials.json`)
  are kept in Credential Manager, the account details (`~\.claude.json` `oauthAccount`) in a file.

Started from the GitHub-only switcher (`sale-shubham/github-account-switcher`, git history kept).
The design allows more families: see `readme/ARCHITECTURE.md`, "Adding a tool family".

---

## README registry

All READMEs live in the `readme/` directory at the project root.

### Core documentation

| Path | Covers |
|---|---|
| `README.md` | Project overview (portfolio), how it works, quick start, CLI usage, requirements, FAQ |
| `PROJECT_STRUCTURE.md` | File tree, module map, conventions, tool versions |
| `readme/ARCHITECTURE.md` | Where each tool stores its login, components, switch lifecycles, security, known limitations, adding a tool family |
| `readme/RESEARCH.md` | Survey of existing GitHub switcher tools (2026-10-30) and why this project exists |
| `docs/DOC_SYNC.md` | **MANDATORY** — which docs to update when adding / modifying / removing code |
| `docs/index.html` | Public GitHub Pages site (SEO landing page, served from `main` `/docs`); repeats README facts, so it changes with them |

### Folder-based documentation

| Folder | Covers | Naming convention |
|---|---|---|
| `readme/flows/` | End-to-end command flows | `<tool>-<command>.md` (`ui.md` for the web page) |
| `readme/methods/` | Helpers and storage reference | `<domain>.md` |

### Registered flow / method docs

| Path | Covers |
|---|---|
| `readme/flows/github-switch.md` | `.\switcher.ps1 github <profile>` — ordering, token restore, app swap, failure behavior |
| `readme/flows/github-save.md` | `github -Save <profile>` — Desktop snapshot, VS Code session, token backup |
| `readme/flows/github-clear.md` | `github -Clear` + the full add-a-GitHub-account procedure (CLI) |
| `readme/flows/claude-switch.md` | `.\switcher.ps1 claude <profile>` — running-session check, save current first, write tokens + account |
| `readme/flows/claude-save.md` | `claude -Save <profile>` — one profile per Claude identity |
| `readme/flows/claude-clear.md` | `claude -Clear` (sign out without `/logout`) + the add-a-Claude-account procedure |
| `readme/flows/ui.md` | `-Ui` dashboard — tool cards, details drawers, both add-account wizards, activity log |
| `readme/methods/credential-store.md` | `CredStore` (C# P/Invoke, `lib/common.ps1`), `Backup-Tokens` / `Restore-Tokens`, `Get-GitHubLoginSpelling`, every target name |
| `readme/methods/vscode-session.md` | `lib/vscode_secret.py`, VS Code DB locations, secret key, how to re-find it after a VS Code update |
| `readme/methods/desktop-state.md` | Desktop `Local Storage`, `Get-DesktopLogin`, `Invoke-WithAppsClosed`; shared `Stop-App` / `Start-Apps` / `Copy-Folder` |
| `readme/methods/profiles.md` | GitHub `accounts.json` schema, data-dir layout, `Read-GitHubProfiles`, `Get-GitHubProfile`, `Set-GitHubProfile` (one profile per GitHub login/email), `Remove-GitHubProfile` (+ opt-in `Remove-GitHubCliLogin`), `Get-GitHubActiveProfile`, `Get-GitHubLoginState`, `Get-GitHubStatus`, `Show-GitHubStatus` |
| `readme/methods/claude-state.md` | `lib/claude.ps1` + `lib/claude_account.py`: Claude Code's files, profile storage, identity, every function, how to re-verify after a Claude Code update |
| `readme/methods/ui-server.md` | `lib/ui-server.ps1` (HttpListener, per-run token, API routes per tool, `Invoke-UiAction`) and the React client file map |

---

## Plugins & Skills

No vendored plugins — a small tool with no PR flow yet.

### Project-specific skills

| Skill file | Purpose |
|---|---|
| `.claude/skills/readme-sync/SKILL.md` | README update checklist + this repo's doc map and high-frequency traps |

---

## Sync rules for Claude

**Full additions / modifications / removals matrix lives in [`docs/DOC_SYNC.md`](./docs/DOC_SYNC.md).
Read it before any code change.**

Quick reference:

1. **Before editing any file** — read the relevant doc in `readme/flows/` or `readme/methods/`.
2. **After editing any file** — update the corresponding `readme/` file in the SAME change.
3. **When adding a new command / flow** — create `readme/flows/<tool>-<command>.md` AND register it above.
4. **When adding a helper domain or tool family** — create or update `readme/methods/<domain>.md`.
5. **Never leave a README out of date** — stale README = bug.
6. **No per-directory READMEs** — flows and methods only, in `readme/`.
7. **One flow per file** — never merge unrelated flows.

The Stop hook `.claude/hooks/check-readme-sync.sh` blocks a turn that edited `*.ps1` / `*.py` /
`web/src` code without touching `readme/`.

---

## Hard rules (switcher-specific)

1. **Never print, log, or write a token in clear text.** Token bytes only travel between the
   tool's own store (Credential Manager entries, Claude Code's `.credentials.json`), PowerShell
   memory and Credential Manager (`CredStore`). Output shows target names, user names and emails
   only. The VS Code snapshot is the value VS Code already encrypted — never decrypt it. Never pipe
   a token through a native command's stdout: `Invoke-UiAction` captures all output into the
   Activity log.
2. **Never sign out to switch.** "Sign out" in Desktop / VS Code, `gh auth logout`,
   `git credential-manager github logout`, and Claude Code's `/logout` / `claude auth logout` end
   the saved sign-in. Use `-Clear` (GitHub: moves state aside; Claude Code: saves, then removes it
   from Claude Code's files). The one exception is deleting a GitHub profile with the opt-in "Also
   sign out of GitHub CLI and Git" box ticked (`Remove-GitHubProfile -SignOut` ->
   `Remove-GitHubCliLogin`): the user asked for that account to be removed from this PC. Off by default.
3. **gh switches first, before any GitHub change.** It is the step most likely to fail (account
   not logged in to gh); failing there must leave git config, tokens and app state untouched. Keep
   that ordering in `readme/flows/github-switch.md` in sync.
4. **Back up every profile's tokens before restoring.** A restore can overwrite an entry another
   account holds (e.g. `git:https://github.com`). The pre-switch backup is what makes that lossless.
   For Claude Code: always save the current sign-in (`Backup-ClaudeCurrent`) before replacing it.
5. **Restore only when the entry is missing or held by another user.** An entry already owned
   by the target user may be fresher than the backup — never overwrite it.
6. **Apps must be fully closed before their storage is touched.** Desktop writes `Local Storage`
   on exit; VS Code keeps its state DB in memory and flushes on exit. Close with
   `CloseMainWindow()` (normal close, unsaved-work prompts apply) — **never** `Stop-Process`/kill.
   Claude Code sessions are console processes with no window: the switch refuses while any runs
   (`Assert-ClaudeClosed`) and never kills them.
7. **VS Code's secret location is undocumented and has moved before.** As of VS Code 1.144 it is
   `%USERPROFILE%\.vscode-shared\sharedStorage\state.vscdb`, key
   `secret://{"extensionId":"vscode.github-authentication","key":"github.auth"}` — not Credential
   Manager, not the global `state.vscdb`. After a VS Code update, re-verify per
   `readme/methods/vscode-session.md` before trusting the VS Code part.
8. **Snapshots are bound to this Windows user on this machine.** VS Code's value is encrypted with
   a DPAPI-protected key; Credential Manager entries are per-user. Never copy them to another machine.
9. **`gh:github.com:` (no user) is gh's active-account entry.** It has an empty user name, so the
   per-user backup filter skips it on purpose; `gh auth switch` rewrites it.
10. **Windows PowerShell 5.1 compatibility is required.** No `&&`/`||`/`??`/`?.`; `Add-Type` C# is
    C# 5 (no `$""`, no `out var`); a `$null` passed to a .NET `string` parameter arrives as `""`
    (handled inside `CredStore.List`); never name a parameter `$Profile` (automatic variable); no
    global `$ErrorActionPreference = 'Stop'` (native `2>$null` then throws `NativeCommandError`) —
    use `-ErrorAction Stop` per file operation; wrap filtered lists in `@()` (a single result is a
    scalar and `[0]` would index a string's characters); `ConvertTo-Json` needs an explicit
    `-Depth` (default 2).
11. **Never pass double-quoted text to a native exe from PS 5.1.** Embedded `"` are stripped —
    that is why the VS Code key lives inside `vscode_secret.py`, not on the command line.
12. **No new dependencies.** PowerShell built-ins + inline C# + Python stdlib only; Python runs
    with `python -I`. `web/` may use React, React DOM, Vite and TypeScript (+ their types) — no UI
    kits, state libraries or HTTP clients. Never run `npm run build` / `vite build` yourself
    (global rule): verify with `npm run check` and the dev server, the user builds.
13. **One implementation per operation, one file per tool family.** Save / clear / switch live once
    in the family's file (`lib/github.ps1`: `Save-GitHubProfileState`, `Clear-GitHubAppState`,
    `Switch-GitHubProfile`; `lib/claude.ps1`: `Save-ClaudeProfile`, `Clear-ClaudeSignIn`,
    `Switch-ClaudeProfile`). Shared helpers go in `lib/common.ps1`. The CLI and the UI server only
    call them — never copy their logic into either entry point, and never into the React code.
    Switching one family never touches another.
14. **Script files stay ASCII.** Windows PowerShell 5.1 reads a `.ps1` without BOM as ANSI, so a
    non-ASCII character in a string prints garbled.
15. **The UI API stays local and keyed.** `HttpListener` prefix `http://localhost:<port>/` only
    (never `+`, `*` or an IP — other hosts must keep getting `400`), and every `/api/` route checks
    the per-run `X-Switcher-Token`. Never add CORS headers. Tokens never appear in an API response.
16. **Claude Code's layout is undocumented.** As of Claude Code 2.1.325 (Windows) the tokens are
    `claudeAiOauth` in `%USERPROFILE%\.claude\.credentials.json` and the account is `oauthAccount`
    in `%USERPROFILE%\.claude.json` (both under `CLAUDE_CONFIG_DIR` if set). Touch only those two
    keys; `mcpOAuth` and the rest of `.claude.json` belong to no account. After a Claude Code
    update, re-verify per `readme/methods/claude-state.md`.
17. **State locations are compatibility contracts.** GitHub keeps `%LOCALAPPDATA%\github-switch` and
    `github-switch:<profile>:<target>` (profiles saved before the rename live there). New families
    use `%LOCALAPPDATA%\account-switch\<tool>` and `account-switch:<tool>:<profile>`. Never rename
    either without a migration.

---

## Known limitations

Documented in `readme/ARCHITECTURE.md` §"Known limitations". Do not treat these as bugs to fix
incidentally — they are known, and removing them means updating the docs that describe them:

- Copilot's per-extension account preference (`github.copilot-github` in VS Code's global state) is not swapped
- Saving cannot verify which account the VS Code session belongs to (it is encrypted)
- No GitHub save-back: a switch restores the snapshot taken at save time
- The web UI's VS Code row shows only whether *a* session exists, not whose
- Desktop's repository list is shared by all profiles (background fetch of a repo the active account cannot see logs "Repository not found")
- Claude Code must be fully exited to switch; a saved Claude sign-in expires (`refreshTokenExpiresAt`)
- `_previous` holds one unsaved Claude sign-in; the Claude desktop app and API-key logins are not covered

---

## Rules reference

All standing instructions live in `.claude/RULES.md`, auto-injected each session by the
`SessionStart` hook in `.claude/settings.local.json`. Read it at the start of every session.
