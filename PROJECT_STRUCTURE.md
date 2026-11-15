# Project structure — account-switcher

Windows account switcher for developer tools: a PowerShell 5.1 CLI and localhost API server, one
script per tool family (GitHub, Claude Code) over shared code with inline C# for Credential Manager,
two Python stdlib helpers, and a React dashboard.

```
account-switcher/
├── CLAUDE.md                            # Root intelligence hub + README registry
├── PROJECT_STRUCTURE.md                 # This file
├── README.md                            # Overview, how it works, quick start, CLI usage, FAQ
├── LICENSE                              # MIT
├── switcher.ps1                         # CLI entry point — parameters (tool, profile, -Save/-Clear/-Ui), dispatch
├── lib/
│   ├── common.ps1                       # CredStore (inline C#), $profilePattern, $switchDir, Stop-App/Start-Apps/Copy-Folder
│   ├── github.ps1                       # GitHub family: gh, git, GitHub Desktop, VS Code
│   ├── claude.ps1                       # Claude Code family: tokens + account, sessions check
│   ├── ui-server.ps1                    # -Ui: HttpListener server, API routes per tool, static files
│   ├── vscode_secret.py                 # get/set/clear/has VS Code's GitHub secret row (sqlite3)
│   └── claude_account.py                # show/get/set/clear "oauthAccount" in Claude Code's .claude.json
├── accounts.json                        # GitHub profiles (gitignored — personal data)
├── accounts.example.json                # Template for accounts.json
├── web/                                 # React UI (Vite + TypeScript)
│   ├── package.json / package-lock.json
│   ├── vite.config.ts                   # dev server; proxies /api to the PowerShell server
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/favicon.svg
│   ├── src/
│   │   ├── main.tsx                     # mounts <App>
│   │   ├── App.tsx                      # dashboard, action runner, confirms, drawers, gate screens
│   │   ├── api.ts                       # API types (one key per tool) + calls + per-run token
│   │   ├── run.ts                       # Run / Busy types for the action runner
│   │   ├── tools.ts                     # GitHub tool names + routesFor; Claude planLabel, expiryNote
│   │   ├── draft.ts                     # add-account progress per tool in localStorage (survives refresh)
│   │   ├── icons.tsx                    # inline SVG icons + brand mark
│   │   ├── styles.css                   # design tokens (light/dark) + all styles
│   │   └── components/                  # shared: ToolCard, QuickSwitch, Drawer, Stepper, ConfirmDialog, Activity, Avatar
│   │                                    # GitHub: GitHubCard, GitHubDetails, GitHubAddAccount
│   │                                    # Claude Code: ClaudeCard, ClaudeDetails, ClaudeAddAccount
│   └── dist/                            # build output (gitignored; npm run build)
├── .claude/
│   ├── RULES.md                         # Standing instructions
│   ├── settings.json                    # Hooks: edit log, doc-sync check, syntax/type gate
│   ├── settings.local.json              # SessionStart hook — cats RULES.md (gitignored)
│   ├── hooks/
│   │   ├── log-edit.sh                  # PostToolUse — records edited paths
│   │   ├── check-readme-sync.sh         # Stop — code edited but no readme/ touched → block
│   │   └── quality-gate.sh              # Stop — parse .ps1 / .py (root + lib/), typecheck web/ after changes
│   └── skills/
│       └── readme-sync/SKILL.md
├── readme/
│   ├── ARCHITECTURE.md                  # Storage map, components, lifecycles, limitations, adding a tool
│   ├── RESEARCH.md                      # Existing GitHub-switcher survey (2026-10-30)
│   ├── flows/
│   │   ├── github-switch.md             # .\switcher.ps1 github <profile>
│   │   ├── github-save.md               # github -Save <profile>
│   │   ├── github-clear.md              # github -Clear + add-a-GitHub-account procedure
│   │   ├── claude-switch.md             # .\switcher.ps1 claude <profile>
│   │   ├── claude-save.md               # claude -Save <profile>
│   │   ├── claude-clear.md              # claude -Clear + add-a-Claude-account procedure
│   │   └── ui.md                        # -Ui dashboard
│   └── methods/
│       ├── credential-store.md          # CredStore, Backup-Tokens, Restore-Tokens, target names
│       ├── vscode-session.md            # vscode_secret.py + VS Code DB locations
│       ├── desktop-state.md             # Desktop Local Storage, Stop-App, Start-Apps
│       ├── profiles.md                  # GitHub accounts.json, data dir, status functions
│       ├── claude-state.md              # Claude Code files, profiles, claude_account.py
│       └── ui-server.md                 # API server, token, routes, React client map
├── docs/                                # also the GitHub Pages site (served from main /docs)
│   ├── DOC_SYNC.md                      # MANDATORY doc-sync matrix
│   ├── index.html                       # public site: SEO landing page, self-contained HTML/CSS/JS
│   ├── sitemap.xml, robots.txt          # for search engines
│   ├── og-image.png                     # 1280x640 link preview (also for the repo's social preview)
│   ├── favicon.svg                      # site icon (same mark as web/public/favicon.svg)
│   ├── .nojekyll                        # Pages serves the files as they are (no Jekyll)
│   └── screenshot.png                   # README + site screenshot (made-up demo data)
├── .gitignore
└── .claudeignore
```

State kept **outside** the project (per Windows user):

```
%LOCALAPPDATA%\github-switch\                       # GitHub snapshots — see readme/methods/profiles.md
%LOCALAPPDATA%\account-switch\claude\<profile>\     # Claude account details — see readme/methods/claude-state.md
Credential Manager: github-switch:<profile>:<original target>   # GitHub token backups
Credential Manager: account-switch:claude:<profile>              # Claude Code sign-ins
```

## Module map

| File | Owns |
|---|---|
| `switcher.ps1` | Parameters (`github`/`claude`, `<profile>`, `-Save`, `-Clear`, `-Ui`); dot-sources `lib\common.ps1`, `lib\github.ps1`, `lib\claude.ps1` (and `lib\ui-server.ps1` for `-Ui`) and dispatches. No logic of its own |
| `lib/common.ps1` | `CredStore` / `StoredCredential` (C#); `$appRoot`, `$profilePattern`, `Test-ProfileName`, `$switchDir`, `$hasPython`; `Stop-App`, `Start-Apps`, `Copy-Folder` |
| `lib/github.ps1` | GitHub state (`$accounts`, `$names`, `$dataDir`, paths, `$tokenTarget`, `$loginPattern`); `Get-GitHubProfile`, `Set-GitHubProfile`, `Remove-GitHubProfile`, `Set-GitIdentity`, `Get-GitHubActiveProfile`, `Get-DesktopSnapshot`, `Get-VSCodeSnapshot`, `Backup-Tokens`, `Restore-Tokens`, `Get-DesktopLogin`, `Save-VSCodeSession`, `Set-VSCodeSession`, `Clear-VSCodeSession`, `Test-VSCodeSession`, `Invoke-WithAppsClosed`, `Get-GitHubLoginState`, `Get-GitHubStatus`, `Show-GitHubStatus`; operations `Clear-GitHubAppState`, `Save-GitHubProfileState`, `Switch-GitHubProfile` |
| `lib/claude.ps1` | Claude state (`$claudeConfigDir`, `$claudeCredentialsFile`, `$claudeStateFile`, `$claudeDir`, `$claudeExe`, `$credBlobLimit`); `Get-ClaudeTarget`, `Get-ClaudeProfileDir`, `Get-ClaudeProfileNames`, `Read-ClaudeSavedAccount`, `Read-ClaudeCredentials`, `Write-ClaudeCredentials`, `Get-ClaudeAccount`, `Get-ClaudeIdentity`, `Find-ClaudeProfile`, `Get-ClaudeSessions`, `Assert-ClaudeClosed`, `Assert-ClaudeReady`, `Save-ClaudeSignIn`, `Backup-ClaudeCurrent`, `Start-ClaudeSignIn`, `Get-ClaudeStatus`, `Show-ClaudeStatus`; operations `Save-ClaudeProfile`, `Switch-ClaudeProfile`, `Clear-ClaudeSignIn`, `Remove-ClaudeProfile` |
| `lib/ui-server.ps1` | `$uiPort`, `$uiRoot`, `$uiTypes`, `$uiWindowTitle`, `$uiStopEventName`, `$uiTakeoverSeconds`; `Start-UiServer`, `Open-UiListener`, `Invoke-UiRequest`, `Invoke-UiApi`, `Invoke-UiAction`, `Start-ToolSignIn`, `New-UiToken`, `Send-UiFile`, `Send-UiJson`, `Send-UiResponse`, `Read-UiBody` |
| `lib/vscode_secret.py` | `KEY` (the VS Code secret key), actions `get` / `set` / `clear` / `has`, exit code `3` = no session |
| `lib/claude_account.py` | actions `show` / `get` / `set` / `clear` on `oauthAccount`, exit code `3` = no account |
| `web/src/` | React client — file map in `readme/methods/ui-server.md` |
| `accounts.json` | GitHub profile name → `name`, `email`, `user` |

## Conventions

| Concern | Choice |
|---|---|
| Credential Manager access | `CredStore` — advapi32 `CredEnumerateW` / `CredWriteW` / `CredDeleteW` via `Add-Type` |
| SQLite | Python stdlib `sqlite3`, run as `python -I lib\vscode_secret.py ...` |
| Claude Code's `.claude.json` | Python stdlib `json` (`python -I lib\claude_account.py ...`): the file is large and must keep its other keys exactly |
| JSON (PowerShell) | `ConvertFrom-Json` / `ConvertTo-Json` with an explicit `-Depth` |
| App close | `Process.CloseMainWindow()` loop, 20 s timeout — never kill; Claude Code: refuse while it runs |
| HTTP | `System.Net.HttpListener` on `http://localhost:47821/`, one request at a time, per-run `X-Switcher-Token`, routes `/api/<tool>/*` |
| UI | React 18 function components, TypeScript strict, plain CSS with light/dark tokens, native `<dialog>`; Segoe UI Variable + Cascadia Mono (Windows-native) |
| Errors | `throw` with the next command to run; `Write-Warning` for skipped parts; the UI shows both in Activity |

## Tool versions (verified on this machine)

- Windows 10 Pro 10.0.19045, Windows PowerShell 5.1.19041
- Git 2.55.0.windows.3, Git Credential Manager 2.9.0
- GitHub CLI 2.100.0
- Python 3.14.7 (SQLite 3.50.4)
- VS Code 1.144.0 (uses `.vscode-shared` shared storage for secrets)
- GitHub Desktop 3.6.7
- Claude Code 2.1.325, native install (`%USERPROFILE%\.local\bin\claude.exe`) (2026-11-15)
- Node.js 24.19.0, npm 11.17.0; React 18.3.1, Vite 6.4.6, TypeScript 5.9.3 (2026-11-14)

## Not present here (by design)

- No PowerShell / Python dependency file — stdlib and built-ins only
- No test suite — manual procedure in `.claude/RULES.md` §10
- No vendored Claude plugins
- No committed `web/dist` — build it once with `npm run build`

---
*Last updated: 2026-11-15 (GitHub Pages site for account-switcher in docs/)*
*Previously: 2026-11-15 (account-switcher: lib/ layout, Claude Code family, dashboard components)*
*Previously: 2026-11-15 (MIT LICENSE)*
*Previously: 2026-11-15 (GitHub Pages site in docs/ — not carried into this repo)*
*Previously: 2026-11-15 (Remove-AccountProfile; docs/screenshot.png for the README)*
*Previously: 2026-11-14 (React web UI + switch-github-ui.ps1 replace the WinForms window)*
*Previously: 2026-10-30 (core split out of switch-github.ps1; -Login window added)*
*Previously: 2026-10-30 (initial Claude setup)*
