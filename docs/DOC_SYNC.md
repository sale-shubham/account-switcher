# Documentation sync rules (account-switcher)

> **NON-NEGOTIABLE.** Any code change MUST land with its docs update in the same change. Stale
> docs are treated as a bug.

Same doc-sync policy as the author's other repositories, with this project's file map.

## Before editing

| Change area | Read first |
|---|---|
| `Switch-GitHubProfile`, step order | `readme/flows/github-switch.md` |
| `Switch-ClaudeProfile`, `Save-ClaudeProfile`, `Clear-ClaudeSignIn` | `readme/flows/claude-switch.md` / `claude-save.md` / `claude-clear.md` |
| anything else in `lib/claude.ps1`, `lib/claude_account.py` | `readme/methods/claude-state.md` |
| `Save-GitHubProfileState` | `readme/flows/github-save.md` |
| `Clear-GitHubAppState`, add-account procedure | `readme/flows/github-clear.md` |
| `web/src/**` (dashboard, cards, drawers, wizards) | `readme/flows/ui.md` |
| `lib/ui-server.ps1` (server, token, API routes), `web/src/api.ts` | `readme/methods/ui-server.md` |
| `switcher.ps1` parameters / dispatch | `README.md` usage + the flow doc of the command |
| `CredStore` (`lib/common.ps1`), `Backup-Tokens`, `Restore-Tokens`, `$tokenTarget`, any Credential Manager target name | `readme/methods/credential-store.md` |
| `lib/vscode_secret.py`, `$vscodeDbs`, `$vscodeExe`, `*-VSCodeSession` | `readme/methods/vscode-session.md` |
| `$desktopStorage`, `$desktopExe`, `Get-DesktopLogin`, `Stop-App`, `Start-Apps`, `Invoke-WithAppsClosed`, `Copy-Folder` | `readme/methods/desktop-state.md` |
| `accounts.json`, `$dataDir` layout, `$loginPattern`, `Get-GitHubProfile`, `Set-GitHubProfile`, `Remove-GitHubProfile`, `Remove-GitHubCliLogin`, `Get-GitHubActiveProfile`, `Get-GitHubLoginState`, `Get-GitHubStatus`, `Show-GitHubStatus` | `readme/methods/profiles.md` |
| Storage locations, lifecycle, limitations | `readme/ARCHITECTURE.md` |
| `docs/index.html` (public GitHub Pages site) | `README.md` - the site repeats its facts |

## Additions trigger

| You added | You MUST also update |
|---|---|
| New command / parameter | **Create `readme/flows/<command>.md`** + register in `CLAUDE.md` + `README.md` usage block + `PROJECT_STRUCTURE.md` module map |
| New screen, step, button or status row in the web UI | `readme/flows/ui.md` (page / steps / status table) + `readme/methods/ui-server.md` client table if a file was added |
| New API route | `lib/ui-server.ps1` `Invoke-UiApi` + `web/src/api.ts` + `readme/methods/ui-server.md` API table |
| New npm dependency in `web/` | Justify it (`.claude/RULES.md` §2) + `PROJECT_STRUCTURE.md` conventions |
| New helper function | The owning `readme/methods/<domain>.md` + `PROJECT_STRUCTURE.md` module map + `.claude/RULES.md` §6 reuse list |
| New tool family (e.g. another CLI with its own login) | Follow `readme/ARCHITECTURE.md` "Adding a tool family": `lib/<tool>.ps1` + routes + `Status` key + card/drawer/wizard; `readme/ARCHITECTURE.md` storage map + lifecycle + limitations; new `readme/flows/<tool>-*.md` + `readme/methods/<tool>-state.md`; `README.md` + `CLAUDE.md` registry and hard rules + `PROJECT_STRUCTURE.md` + `.claude/RULES.md` reuse list |
| New Credential Manager target pattern | `$tokenTarget` + `readme/methods/credential-store.md` target table + `readme/ARCHITECTURE.md` storage map |
| New file under `%LOCALAPPDATA%\github-switch` or `account-switch` | `readme/methods/profiles.md` / `claude-state.md` data layout |
| New field in `accounts.json` | `Get-GitHubProfile` validation + `accounts.example.json` + `readme/methods/profiles.md` schema + `README.md` setup |
| New standing rule | `.claude/RULES.md` (+ `CLAUDE.md` hard rules if switcher-specific) |
| New skill | `.claude/skills/<skill>/SKILL.md` + skills table in `CLAUDE.md` + `PROJECT_STRUCTURE.md` tree |
| New hook | `.claude/hooks/` + `.claude/settings.json` + `PROJECT_STRUCTURE.md` tree |

## Modifications trigger

| You changed | You MUST also update |
|---|---|
| Order of steps in a switch | the tool's `readme/flows/<tool>-switch.md` steps + failure behavior + `readme/ARCHITECTURE.md` lifecycle |
| Restore policy (when a backup overwrites) | `readme/methods/credential-store.md` + `readme/flows/github-switch.md` + `CLAUDE.md` hard rule 5 |
| VS Code DB path or secret key | `vscode_secret.py` `KEY` + `$vscodeDbs` + `readme/methods/vscode-session.md` + `CLAUDE.md` hard rule 7 + `readme/ARCHITECTURE.md` storage map |
| Desktop storage path or login detection | `readme/methods/desktop-state.md` + `readme/ARCHITECTURE.md` storage map |
| App close timeout / close method | `readme/methods/desktop-state.md` (`Stop-App`) |
| `vscode_secret.py` exit codes | `readme/methods/vscode-session.md` + the PowerShell callers |
| Claude Code file layout (`.credentials.json` / `.claude.json` keys) or `claude_account.py` actions | `readme/methods/claude-state.md` + `readme/ARCHITECTURE.md` storage map + `CLAUDE.md` hard rule 16 |
| A tool version re-verified | `PROJECT_STRUCTURE.md` tool versions |
| `README.md` features, requirements, quick start, CLI usage or FAQ | `docs/index.html` (public site, including its FAQ JSON-LD) + `<lastmod>` in `docs/sitemap.xml` |

## Removals trigger

| You removed | You MUST also do |
|---|---|
| A command / parameter | Delete its flow doc; remove rows from `CLAUDE.md`, `README.md`, `PROJECT_STRUCTURE.md` |
| A helper function | Remove from its methods doc, the module map, and `.claude/RULES.md` §6 reuse list |
| A known limitation (fixed) | Remove it from `readme/ARCHITECTURE.md` §"Known limitations" and `CLAUDE.md` in the same change |

## Hard rules

- **No per-directory READMEs.** All documentation lives in `readme/`, plus the four root files
  (`README.md`, `CLAUDE.md`, `PROJECT_STRUCTURE.md`, `docs/DOC_SYNC.md`).
- **One flow per file.** Never merge two commands into one doc.
- **Register before finishing.** New doc files must appear in the `CLAUDE.md` README registry in
  the same change.
- **Every doc carries a `*Last updated:*` footer** with a one-line reason, newest first.

---
*Last updated: 2026-11-15 (Remove-GitHubCliLogin in the profiles row)*
*Previously: 2026-11-15 (public site docs/index.html rows for account-switcher)*
*Previously: 2026-11-15 (account-switcher: Claude Code rows, lib/ paths, tool-family addition; site rows dropped)*
*Previously: 2026-11-15 (public site docs/index.html rows)*
*Previously: 2026-11-15 (Remove-GitHubProfile row)*
*Previously: 2026-11-14 (web UI + API replace the login window)*
*Previously: 2026-10-30 (core split + login window rows)*
*Previously: 2026-10-30 (initial doc structure)*
