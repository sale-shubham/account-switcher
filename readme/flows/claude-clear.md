# Sign Claude Code out safely (to add an account)

## Purpose

`.\switcher.ps1 claude -Clear` (or the **Sign out** step of **Add account** on the Claude Code card)
- make Claude Code start signed out so another account can sign in, without losing the current
sign-in. Implemented by `Clear-ClaudeSignIn` in `lib/claude.ps1`.

**Never use `/logout` or `claude auth logout` to switch.** They end the sign-in (it may be revoked on
the server), so the saved copy would stop working. This flow only moves it out of Claude Code's files.

## Steps

1. `Assert-ClaudeReady`, `Assert-ClaudeClosed` - Claude Code running: throw, nothing changed.
2. Not signed in: print "already signed out" and stop.
3. `Backup-ClaudeCurrent` - saved into its own profile, or as `_previous`.
4. Remove `claudeAiOauth` from `.credentials.json` (other keys kept).
5. `claude_account.py clear` - remove `oauthAccount` from `.claude.json`.
6. Print the next step: sign in (`claude auth login`), then save it as a profile.

## Adding an account (whole procedure)

UI: Claude Code card, **Add account**: Account (name the profile) - Sign out (this flow) - Sign in
(`Start-ClaudeSignIn` opens `claude auth login` in a console; the page checks `/api/claude/status`
every 4 s) - Save profile (`readme/flows/claude-save.md`).

CLI:

```powershell
.\switcher.ps1 claude -Save work      # keep the current account (if it has no profile yet)
.\switcher.ps1 claude -Clear          # exit Claude Code first
claude auth login                     # sign in with the next account
.\switcher.ps1 claude -Save personal
```

## Failure behavior

| Fails at | Changed by then |
|---|---|
| 1 | nothing |
| 3 | possibly the current profile's backup (refreshed) |
| 4 | the backup only; Claude Code still signed in |
| 5 | warning only; tokens removed, so Claude Code starts signed out anyway |

---
*Last updated: 2026-11-15 (new: Claude Code family)*
