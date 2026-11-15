---
name: readme-sync
description: Checklist for keeping readme/ docs in sync with code after any change to the account switcher (lib/ tool families, UI server, React UI).
---

# Skill: readme-sync

Use after any code change to ensure READMEs are in sync. Full matrix: `docs/DOC_SYNC.md`.

## Checklist

- [ ] Read the relevant doc in the matching `readme/` subfolder for every change made:
  - Command behavior or step order changed → `readme/flows/<command>.md`
  - Helper / storage reference changed → `readme/methods/<domain>.md`
- [ ] For each doc touched, verify:
  - Does the **Steps** section reflect the current code path, in order?
  - Are function names, paths, target names and the VS Code key still literally correct?
  - Is the **Failure behavior** table still true (what is changed before the failure point)?
  - Are stale steps or removed behavior deleted, not just amended?
- [ ] New command → create `readme/flows/<command>.md`. Do NOT append to another flow's file.
- [ ] New helper domain or new app covered → create `readme/methods/<domain>.md`.
- [ ] Register any new doc in the `CLAUDE.md` README registry **and** the `PROJECT_STRUCTURE.md` tree + module map.
- [ ] Update the *Last updated* line (with a one-line reason) in every document touched.

## This repo's docs

| Doc | Owns |
|---|---|
| `readme/ARCHITECTURE.md` | Storage map per app, components, switch lifecycle, security model, known limitations |
| `readme/RESEARCH.md` | Existing-tool survey and the decision to build |
| `readme/flows/github-switch.md` | `.\switcher.ps1 github <profile>` |
| `readme/flows/github-save.md` | `github -Save <profile>` |
| `readme/flows/github-clear.md` | `github -Clear` + add-an-account procedure |
| `readme/flows/claude-switch.md` | `.\switcher.ps1 claude <profile>` |
| `readme/flows/claude-save.md` | `claude -Save <profile>` |
| `readme/flows/claude-clear.md` | `claude -Clear` + add-a-Claude-account procedure |
| `readme/flows/ui.md` | `-Ui` dashboard: tool cards, details drawers, add-account wizards (`web/src`) |
| `readme/methods/claude-state.md` | `lib/claude.ps1`, `lib/claude_account.py`, Claude Code's files and profile storage |
| `readme/methods/ui-server.md` | `lib/ui-server.ps1` server, token, API routes; `web/src/api.ts` and the client file map |
| `readme/methods/credential-store.md` | `CredStore`, `Backup-Tokens`, `Restore-Tokens`, `$tokenTarget` |
| `readme/methods/vscode-session.md` | `vscode_secret.py`, `$vscodeDbs`, `*-VSCodeSession` |
| `readme/methods/desktop-state.md` | `Get-DesktopLogin`, `Stop-App`, `Start-Apps`, `Invoke-WithAppsClosed`, `Copy-Folder` |
| `readme/methods/profiles.md` | `accounts.json`, data dir, `Get-GitHubProfile`, `Set-GitHubProfile`, `Get-GitHubLoginState`, `Get-GitHubStatus`, `Show-GitHubStatus` |

## High-frequency traps in this repo

- **Step order changed in the switch** → `readme/flows/github-switch.md` steps *and* failure table, plus
  the lifecycle list in `readme/ARCHITECTURE.md`. gh must stay before any change (`CLAUDE.md` hard rule 3).
- **A path or key changed** (VS Code DB, secret key, Desktop `Local Storage`, `%LOCALAPPDATA%\github-switch`)
  → it is quoted in the owning methods doc, `readme/ARCHITECTURE.md` storage map, and `CLAUDE.md`
  hard rules. Update all three.
- **New Credential Manager target** → `$tokenTarget` + the target table in `readme/methods/credential-store.md`.
- **New `accounts.json` field** → `Get-GitHubProfile` validation + `accounts.example.json` + `readme/methods/profiles.md` + `README.md`.
- **A known limitation fixed** → remove it from `readme/ARCHITECTURE.md` and `CLAUDE.md` in the same change.
- **A tool version re-verified** → `PROJECT_STRUCTURE.md` tool versions.
- **A field added to `Get-GitHubStatus` / `Get-ClaudeStatus` or an API route** → `web/src/api.ts` types + `readme/methods/ui-server.md`.
- **Claude Code moved its files or keys** → `lib/claude.ps1` variables, `readme/methods/claude-state.md`,
  `readme/ARCHITECTURE.md` storage map and `CLAUDE.md` hard rule 16.
- **A new tool family** → `readme/ARCHITECTURE.md` "Adding a tool family" lists every place.
- **README features, requirements, quick start, CLI or FAQ changed** → the public site
  `docs/index.html` says the same things (FAQ also in its JSON-LD); update it and `<lastmod>` in `docs/sitemap.xml`.

## Flow README template (for `readme/flows/`)

```markdown
# <Command name>

## Purpose
<!-- What the command does, and which function in lib/github.ps1 implements it -->

## Steps
<!-- Numbered sequence, with real function names and paths inline -->

## Data pathways
<!-- What it reads and what it writes -->

## Failure behavior
<!-- What is thrown, what has already changed at that point -->

## Notes
<!-- Edge cases, known limitations, gotchas -->

---
*Last updated: YYYY-MM-DD (one-line reason)*
```

## Method README template (for `readme/methods/`)

```markdown
# <Domain name>

<!-- Which file(s)/functions this covers, and who calls them -->

## API

### `Function-Name $params`
<!-- Description, params, return value, edge cases -->

## Notes
<!-- Gotchas, coupling with other parts -->

---
*Last updated: YYYY-MM-DD (one-line reason)*
```

### Rule: No per-directory or per-module READMEs
Never create `README.md` files in inner folders. All documentation stays in `readme/`, plus the
four root files (`README.md`, `CLAUDE.md`, `PROJECT_STRUCTURE.md`, `docs/DOC_SYNC.md`).
