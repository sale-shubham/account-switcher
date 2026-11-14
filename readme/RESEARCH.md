# Research — existing GitHub account switchers for Windows

Question (2026-10-30): is there a Windows tool that switches the GitHub account in VS Code, the
GitHub CLI and GitHub Desktop at the same time?

**Answer: no.** Each app keeps its own login, and no tool found switches GitHub Desktop at all.
That gap is why this project exists.

## Tools found

| Tool | Type | git config | Credential Manager / GCM | gh CLI | VS Code session | GitHub Desktop |
|---|---|---|---|---|---|---|
| [github-switch](https://github.com/liaohaoliang2003/github-switch) | Windows GUI + CLI exe | yes | clears github.com entries | no | clears it (backs up `state.vscdb`) | not mentioned |
| [GitHub Account Switcher](https://github.com/benRUSG/github-account-switcher) | VS Code extension | per workspace | no | `gh auth switch` | — | no |
| [GHA Switcher](https://marketplace.visualstudio.com/items?itemName=xtawfik.gha-switcher) | VS Code extension | no | no | yes | uses VS Code auth | no |
| [GitShift](https://github.com/mikeeeyy04/GitShift) | VS Code extension | yes | sets credentials | no | yes | no |
| [gitswitch](https://pkg.go.dev/github.com/aksisonline/gitswitch@v0.4.3-beta.2) | CLI | yes + SSH key | — | best effort | no | no |
| [HubSwitch](https://github.com/Wakatem/HubSwitch) | Windows CLI (Python) | undocumented | probably | undocumented | no | no |
| [GHSwitch](https://www.producthunt.com/p/ghswitch) | tray app | name/email/signing key | no | no | no | no |

Most are very new (0–21 stars). github-switch was the closest, but has no gh or SSH support,
Chinese-only docs, and prebuilt exes in the repo.

## GitHub Desktop

- Official Desktop supports **one** GitHub.com account. Issue
  [#3707](https://github.com/desktop/desktop/issues/3707) has been open since 2018, labelled `not-planned`.
- [Desktop Plus](https://github.com/pol-rivero/github-desktop-plus) fork: several accounts at once,
  `winget install DesktopPlus.DesktopPlus`, ~821 stars.
- [GITmaxed](https://github.com/GI-STANDARDS/GITmaxed) fork: picks the account by repo folder,
  Windows only, v1.0.0, no automated tests.

## Native multi-account support

- **gh CLI** ≥ 2.40: `gh auth login` per account, `gh auth switch -u <user>`. The active account is
  machine-wide. ([manual](https://cli.github.com/manual/gh_auth_switch),
  [docs](https://github.com/cli/cli/blob/4b077daf7e74dbe6bf933f69e220066e3a12e8b4/docs/multiple-accounts.md))
- **Git Credential Manager**: default account via `credential.https://github.com.username`, or per
  repo with `https://<user>@github.com/...` in the remote URL.
  ([docs](https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/multiple-users.md))
- **VS Code**: several GitHub accounts can be signed in, but the Git extension then shows a
  "Select Account" prompt on HTTPS operations.
  ([forum](https://forum.cursor.com/t/github-select-account-window-popping-up-constantly/159105))
- **Per-folder git identity**: `includeIf "gitdir:D:/work/"` in `.gitconfig` — an alternative to
  switching for commit authorship only.

## Decision

Build a small switcher that keeps every account's tokens (backed up in Credential Manager) and each
app's sign-in state (snapshots), and swaps them in one command. First version covered gh + git +
GCM; the second added Desktop and VS Code after locating their storage on this machine.

---
*Last updated: 2026-10-30 (initial research write-up)*
