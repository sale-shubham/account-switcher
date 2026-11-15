# Claude Code state

`lib/claude.ps1` (functions) and `lib/claude_account.py` (the `.claude.json` helper). Called by the
CLI (`switcher.ps1 claude ...`) and the UI server (`/api/claude/*`). Dot-sourced after
`lib/common.ps1`, which provides `CredStore`, `$profilePattern`, `$switchDir` and `$hasPython`.

## Where Claude Code keeps its sign-in

| Variable | Path | Used for |
|---|---|---|
| `$claudeCredentialsFile` | `%USERPROFILE%\.claude\.credentials.json` (or `$env:CLAUDE_CONFIG_DIR\.credentials.json`) | `claudeAiOauth`: the tokens. Other keys (`mcpOAuth`) are kept as they are |
| `$claudeStateFile` | `%USERPROFILE%\.claude.json` (or `$env:CLAUDE_CONFIG_DIR\.claude.json`) | `oauthAccount`: who is signed in. Everything else is left alone |
| `$claudeDir` | `%LOCALAPPDATA%\account-switch\claude` | one folder per profile with `account.json` (a copy of `oauthAccount`) |
| `Get-ClaudeTarget` | Credential Manager `account-switch:claude:<profile>` | the `claudeAiOauth` object as compact JSON (user name = email), persist `LOCAL_MACHINE` |
| `$claudeExe` | `Get-Command claude -CommandType Application` | `claude auth login` for signing in |

A profile counts as saved when its folder has an `account.json`. `_previous` (an unsaved sign-in kept
aside before a switch) fails `$profilePattern`, so it is never listed and can never collide with a
profile name.

Identity: a Claude user can belong to several organizations and each sign-in is for one of them, so
"the same account" means the same `accountUuid` **and** `organizationUuid` (`Get-ClaudeIdentity`).

## API

### `Get-ClaudeStatus`
Ordered hashtable for the CLI and `GET /api/status` / `GET /api/claude/status`: `installed`, `python`,
`sessions` (running Claude Code processes), `account` (`email`, `displayName`, `organization`, `plan`,
`tier`) or `$null`, `activeProfile` (the profile holding the signed-in identity, or `''`), `profiles`
(`name`, `email`, `displayName`, `organization`, `plan`, `tier`, `expires` ISO date, `saved`). Reads
local files and Credential Manager only, no network. The saved tokens are parsed for `plan`,
`tier` and `expires`; nothing else from them leaves the function.

### `Save-ClaudeProfile $profileName`
Saves what Claude Code is signed in to now. Refuses: a bad name; Claude Code signed out; the same
identity already saved under another name; a name that holds a different identity. Works while
Claude Code runs (it only reads).

### `Switch-ClaudeProfile $profileName`
See `readme/flows/claude-switch.md`.

### `Clear-ClaudeSignIn`
Signs Claude Code out without `claude auth logout`. See `readme/flows/claude-clear.md`.

### `Remove-ClaudeProfile $profileName`
Deletes the profile folder, then its Credential Manager entry. The live sign-in is not touched, so
deleting the active profile does not sign anything out.

### `Start-ClaudeSignIn`
Opens `claude auth login` in its own console. Refuses while Claude Code is signed in: a sign-in over
an existing one would replace it before it is saved, so the UI's **Sign out** step comes first.

### Helpers
- `Read-ClaudeCredentials` / `Write-ClaudeCredentials`: the whole credentials file as an object;
  written in place (keeps the file's permissions), `ConvertTo-Json -Depth 20`, UTF-8 without BOM.
- `Get-ClaudeAccount`: `claude_account.py show`, parsed; `$null` when signed out or Python is missing.
- `Find-ClaudeProfile $account`: the profile with the same identity, or `''`.
- `Save-ClaudeSignIn $profileName [-AccountOptional]`: tokens to Credential Manager first (refuses
  more than `$credBlobLimit` = 2560 bytes), then `account.json`.
- `Backup-ClaudeCurrent`: before a switch or sign-out, saves the current sign-in into its own profile,
  or as `_previous`.
- `Get-ClaudeSessions`: `claude.exe` processes, except the Claude desktop app's (path contains
  `AnthropicClaude` or `WindowsApps`), plus `node.exe` running `claude-code` (npm installs).
- `Assert-ClaudeClosed`, `Assert-ClaudeReady` (Python present).

## `claude_account.py`

`python -I lib\claude_account.py show|get|set|clear <.claude.json> [<file>]`

| Action | Does | Exit |
|---|---|---|
| `show` | prints `emailAddress`, `displayName`, `organizationName`, `accountUuid`, `organizationUuid` as one JSON line (ASCII escapes, so PowerShell 5.1 reads non-ASCII names correctly) | 3 if no account |
| `get` | writes the whole `oauthAccount` to `<file>` | 3 if no account |
| `set` | replaces `oauthAccount` with `<file>` | 0 |
| `clear` | removes `oauthAccount` | 0 |

`set` and `clear` write a temporary file next to `.claude.json` and swap it in (`os.replace`), so a
failure never leaves half a file. Other keys keep their order; the file is written with a 2-space
indent like Claude Code writes it.

## Re-verifying after a Claude Code update

1. Print the key names only, never values:
   `(Get-Content ~\.claude\.credentials.json -Raw | ConvertFrom-Json).claudeAiOauth.PSObject.Properties.Name`
   and the same for `oauthAccount` in `~\.claude.json`.
2. Compare with `claude auth status --json` (email, org, plan) - it must match `.claude.json`.
3. If either moved (for example into Credential Manager, as Claude Code does on macOS with the
   Keychain), update the variables above, `ARCHITECTURE.md` and `CLAUDE.md` hard rule 16.

## Notes

- Tokens rotate when Claude Code refreshes them, which is why every switch and sign-out saves the
  current sign-in first (`Backup-ClaudeCurrent`).
- Tests use a fake config folder (`CLAUDE_CONFIG_DIR`) and override `$switchDir` / `$claudeDir`
  after dot-sourcing - never `LOCALAPPDATA` (see `.claude/RULES.md` section 10).

---
*Last updated: 2026-11-15 (new: Claude Code family)*
