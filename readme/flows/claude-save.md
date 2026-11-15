# Save a Claude Code profile

## Purpose

`.\switcher.ps1 claude -Save <profile>` (or **Save as profile** / the last step of **Add account** on
the Claude Code card) - keep what Claude Code is signed in to now as `<profile>`. Implemented by
`Save-ClaudeProfile` in `lib/claude.ps1`. Nothing closes; Claude Code stays signed in.

## Steps

1. `Test-ProfileName`, `Assert-ClaudeReady`.
2. `Get-ClaudeAccount` + `claudeAiOauth` present - otherwise throw "not signed in ... claude auth login".
3. `Find-ClaudeProfile` - the identity is saved under another name: throw "already saved as '<x>'".
4. `Read-ClaudeSavedAccount <profile>` holds a different identity: throw "already holds <email>".
5. `Save-ClaudeSignIn <profile>`: tokens into Credential Manager `account-switch:claude:<profile>`
   (user = email), then `claude_account.py get` writes `account.json`.
6. Print `Saved Claude Code sign-in for '<profile>' (<email>).`

## Data pathways

Reads `.credentials.json`, `.claude.json`, saved profiles. Writes Credential Manager and
`%LOCALAPPDATA%\account-switch\claude\<profile>\account.json`.

## Failure behavior

| Fails at | Changed by then |
|---|---|
| 1-4 | nothing |
| 5, token write (e.g. more than 2560 bytes) | nothing |
| 5, `account.json` write | the Credential Manager entry exists but the profile is not listed; saving again fixes it |

## Notes

- Saving the same account again under its own name refreshes the copy (that is also what every
  switch does automatically).
- One profile per Claude identity (user + organization), like GitHub's one profile per login.

---
*Last updated: 2026-11-15 (new: Claude Code family)*
