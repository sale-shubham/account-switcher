# Credential store

Covers `CredStore` / `StoredCredential` (C# compiled by `Add-Type` in `lib/common.ps1`, shared by
every tool family) and GitHub's `Backup-Tokens` and `Restore-Tokens` (`lib/github.ps1`). Called by
the switch and save flows; `Get-GitHubLoginState` also uses `[CredStore]::List` to check sign-ins.
Claude Code's use of it (`account-switch:claude:<profile>`) is in `readme/methods/claude-state.md`.

## Token targets

`$tokenTarget = '^(git:https://(.+@)?github\.com|gh:github\.com:|GitHub - https://api\.github\.com/)'`

| Target (as seen in Credential Manager) | Written by | User field |
|---|---|---|
| `git:https://github.com` | Git Credential Manager | GitHub login |
| `git:https://<x>@github.com...` | GCM, for further accounts (pattern allowed for) | GitHub login |
| `gh:github.com:<user>` | gh CLI, one per logged-in account | GitHub login |
| `gh:github.com:` | gh CLI, active account copy | **empty** → never matched by the per-user filter |
| `GitHub - https://api.github.com/<login>` | GitHub Desktop (keytar) | GitHub login |
| `github-switch:<profile>:<original target>` | this tool — GitHub backups | GitHub login |
| `account-switch:claude:<profile>` | this tool — Claude Code sign-in (`claudeAiOauth` JSON, persist `2`); `_previous` for an unsaved sign-in kept aside | Claude email |

Tool families added after GitHub use `account-switch:<tool>:<profile>`; GitHub keeps its older
`github-switch:` prefix so existing backups stay valid. The two never collide.

`cmdkey /list` shows these as `LegacyGeneric:target=<target>`.

## API

### `[CredStore]::List(filter)`
`CredEnumerateW`. `filter` is a target prefix ending in `*` (e.g. `"github-switch:work:*"`), or
`$null` / `""` for all entries (an empty string is turned into `null` inside, because PowerShell
passes `$null` to a .NET `string` as `""`). Returns `StoredCredential[]` (`Target`, `User`, `Blob`
bytes, `Persist`); generic credentials only. `ERROR_NOT_FOUND` (1168) → empty array; other errors →
`Win32Exception`.

### `[CredStore]::Write(target, user, blob, persist)`
`CredWriteW`, type generic. Creates or overwrites. Keeps the original `Persist` value (Desktop uses
`3` Enterprise, gh/GCM use `2` Local machine). Attributes and comments are not copied.

### `[CredStore]::Delete(target)`
`CredDeleteW`; missing target is not an error. Used by `Remove-GitHubProfile`, `Remove-ClaudeProfile`
and test cleanup.

### `Backup-Tokens $profileName $user`
For every live entry whose `User -eq $user` and target matches `$tokenTarget`, writes a copy to
`github-switch:<profile>:<target>`. Overwrites older backups with the current value.

### `Restore-Tokens $profileName $user`
For every `github-switch:<profile>:*` backup: if the original target is **missing**, or held by a
**different user**, writes the backup back to the original target and prints
`Restored token: <target>`. An entry already owned by `$user` is left alone (it may be newer).

## Notes

- Token bytes never leave memory except into another Credential Manager entry. Never print `.Blob`.
- `cmdkey` cannot read secrets and failed to create targets containing ` - ` with spaces in tests —
  use `[CredStore]::Write` for test fixtures.
- To load `[CredStore]` in a shell for inspection, dot-source `. .\lib\common.ps1` — it defines
  types, state and functions and runs nothing.
- A secret may be at most 2560 bytes (`CRED_MAX_CREDENTIAL_BLOB_SIZE`); `Save-ClaudeSignIn` checks.
- `List` with an exact target and no `*` returns just that entry (used by `Get-GitHubLoginState`).
- C# must stay C# 5 (Windows PowerShell 5.1 compiles `Add-Type` with the .NET Framework compiler).
  The type is only added once per session (`'CredStore' -as [type]` guard).

---
*Last updated: 2026-11-15 (CredStore moved to lib/common.ps1; account-switch:claude:<profile> targets)*
*Previously: 2026-10-30 (code moved to switch-github-core.ps1)*
*Previously: 2026-10-30 (initial methods doc)*
