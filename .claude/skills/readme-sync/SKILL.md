---
name: readme-sync
description: Checklist for keeping readme/ docs in sync with code after any change to the GitHub account switcher (PowerShell core, UI server, React UI).
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
| `readme/flows/switch.md` | `.\switch-github.ps1 <profile>` |
| `readme/flows/save.md` | `-Save <profile>` |
| `readme/flows/clear.md` | `-Clear` + add-an-account procedure |
| `readme/flows/ui.md` | `-Ui` web page: identity panel, profiles, add-account steps (`web/src`) |
| `readme/methods/ui-server.md` | `switch-github-ui.ps1` server, token, API routes; `web/src/api.ts` and the client file map |
| `readme/methods/credential-store.md` | `CredStore`, `Backup-Tokens`, `Restore-Tokens`, `$tokenTarget` |
| `readme/methods/vscode-session.md` | `vscode_secret.py`, `$vscodeDbs`, `*-VSCodeSession` |
| `readme/methods/desktop-state.md` | `Get-DesktopLogin`, `Stop-App`, `Start-Apps`, `Invoke-WithAppsClosed`, `Copy-Folder` |
| `readme/methods/profiles.md` | `accounts.json`, data dir, `Get-Account`, `Set-AccountProfile`, `Get-LoginState`, `Get-SwitcherStatus`, `Show-Status` |

## High-frequency traps in this repo

- **Step order changed in the switch** → `readme/flows/switch.md` steps *and* failure table, plus
  the lifecycle list in `readme/ARCHITECTURE.md`. gh must stay before any change (`CLAUDE.md` hard rule 3).
- **A path or key changed** (VS Code DB, secret key, Desktop `Local Storage`, `%LOCALAPPDATA%\github-switch`)
  → it is quoted in the owning methods doc, `readme/ARCHITECTURE.md` storage map, and `CLAUDE.md`
  hard rules. Update all three.
- **New Credential Manager target** → `$tokenTarget` + the target table in `readme/methods/credential-store.md`.
- **New `accounts.json` field** → `Get-Account` validation + `accounts.example.json` + `readme/methods/profiles.md` + `README.md`.
- **A known limitation fixed** → remove it from `readme/ARCHITECTURE.md` and `CLAUDE.md` in the same change.
- **A tool version re-verified** → `PROJECT_STRUCTURE.md` tool versions.
- **A field added to `Get-SwitcherStatus` or an API route** → `web/src/api.ts` types + `readme/methods/ui-server.md`.
- **README features, requirements, quick start, CLI usage or FAQ changed** → the public site
  `docs/index.html` says the same things; update it and `<lastmod>` in `docs/sitemap.xml`.

## Flow README template (for `readme/flows/`)

```markdown
# <Command name>

## Purpose
<!-- What the command does, and which function in switch-github-core.ps1 implements it -->

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
