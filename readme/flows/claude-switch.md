# Switch Claude Code

## Purpose

`.\switcher.ps1 claude <profile>` (or **Switch** on the Claude Code card in the `-Ui` page) - make
Claude Code sign in as `<profile>`'s account. Implemented by `Switch-ClaudeProfile` in
`lib/claude.ps1`. GitHub tools are not touched.

## Steps

1. `Test-ProfileName`, `Assert-ClaudeReady` (Python present).
2. `Read-ClaudeSavedAccount <profile>` - unknown profile: throw with the saved names.
3. Read the profile's Credential Manager entry (`account-switch:claude:<profile>`) - missing: throw.
4. If its `refreshTokenExpiresAt` is in the past: throw "has expired ... sign in again".
5. `Assert-ClaudeClosed` - any Claude Code process running: throw. **Nothing has changed up to here.**
6. `Backup-ClaudeCurrent` - the sign-in Claude Code has now is saved again, into its own profile
   (`Updated profile '<x>' with the current sign-in.`) or, if it has none, as `_previous`.
7. If Claude Code is already signed in as the target identity: print "already signed in" and stop.
8. Put the profile's `claudeAiOauth` into `.credentials.json` (`Write-ClaudeCredentials`, other keys
   such as `mcpOAuth` kept).
9. `claude_account.py set` - put the profile's `account.json` into `.claude.json` as `oauthAccount`.
10. Print `Switched Claude Code to '<profile>' (<email>).` New Claude Code sessions use it.

## Data pathways

Reads: `%LOCALAPPDATA%\account-switch\claude\<profile>\account.json`, Credential Manager
`account-switch:claude:<profile>`, `.credentials.json`, `.claude.json`, the process list.
Writes: Credential Manager (`<current profile>` or `_previous`), `account.json` of the current
profile, `.credentials.json`, `.claude.json`.

## Failure behavior

| Fails at | Message | Changed by then |
|---|---|---|
| 1-4 | unknown profile / no saved sign-in / expired | nothing |
| 5 | `Claude Code is running (N process(es)). Exit every Claude Code session first...` | nothing |
| 6 | Credential Manager or `.claude.json` read error | possibly the current profile's backup (refreshed, not lost) |
| 8 | file write error | the backup of the current sign-in only |
| 9 | warning: `.claude.json could not be updated` | tokens switched; Claude Code updates the account details itself on its next start |

## Notes

- Why Claude Code must be closed: a running session keeps its tokens in memory and writes them back
  when it refreshes them, which would put the old account back. Console sessions are never killed.
- Why the current sign-in is saved first: Claude Code's tokens rotate when refreshed, so the copy
  from save time may no longer work.
- The VS Code extension runs the same CLI, so it follows after it restarts.

---
*Last updated: 2026-11-15 (new: Claude Code family)*
