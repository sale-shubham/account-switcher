# Web UI (see accounts, add an account, switch)

## Purpose

`.\switcher.ps1 -Ui` starts a local server (`Start-UiServer` in `lib/ui-server.ps1`) and opens a
React page (`web/`) in the browser: a dashboard with **one card per tool family** (GitHub, Claude
Code). Each card shows the account in use, lets you switch with one click, and opens a details
drawer and an add-account wizard. Every action calls the family's functions in `lib/github.ps1` or
`lib/claude.ps1`; the server and API are described in `readme/methods/ui-server.md`.

## First run

```powershell
cd web
npm install
npm run build        # once, and after any change in web/
cd ..
.\switcher.ps1 -Ui
```

Without `web\dist` the server still starts and prints the build command plus a development link.
Keep the PowerShell window open while the page is in use; Ctrl+C stops the server. Running `-Ui`
again while one is open replaces it: the old server stops after any running action and the new
one opens a fresh page (`readme/methods/ui-server.md`, "Taking over").

Started from **VS Code's terminal**, `Start-UiServer` reopens itself in its own PowerShell window
and returns: GitHub's Prepare / Save / Switch close VS Code, which ends every process in its
terminals, so a server running there would die mid-action and never reopen the apps.

## Page

| Area | Shows / does | Data |
|---|---|---|
| GitHub card | Active profile, @login and the git name/email commits use; a chip per tool (green = uses this account, amber = another account or GCM has no saved login, grey dashed = signed out); badge "All 4 tools linked" / "N of 4"; **Switch to** list of the other profiles | `GET /api/status` (`github`) |
| Claude Code card | Signed-in email, organization and plan (e.g. "Max 5x"); badge Saved / Not saved yet / Signed out / Not installed; "Save as profile" when the sign-in has no profile; a warning while Claude Code runs; **Switch to** list, expired sign-ins flagged | `GET /api/status` (`claude`) |
| Card footer | **Details** opens the family's drawer; **Add account** its wizard | - |
| GitHub details | Each tool and its account (bracket from the active profile), every profile with saved Desktop / VS Code sign-ins, **Switch** and **Delete** (not on the active profile) | `POST /api/github/switch`, `/delete` |
| Claude Code details | Who is signed in, running sessions, every profile with plan and "Sign-in valid until", **Switch** and **Delete**, how a switch works | `POST /api/claude/switch`, `/delete` |
| Activity | Each action's result and every line it printed (warnings amber, errors red), newest first, last 30; failed entries stay expanded | action responses |

**Refresh** re-reads the status; after an action the page refreshes by itself. Every Switch and
Delete asks to confirm first. Deleting a profile never signs anything out.

## GitHub: add an account

1. **Account details** - profile name (letters, digits, `-`), GitHub username (exact, GitHub's
   rule), name and email for commits. Checked in the browser before **Next**; checked again by
   `Set-GitHubProfile` on save. A GitHub username or email that another profile already has is
   refused (one profile per GitHub account, see `readme/methods/profiles.md`); reusing a profile's
   own name replaces it.
2. **Prepare the apps** - confirm, then `POST /api/github/prepare`:
   `Invoke-WithAppsClosed { Save-GitHubProfileState <active>; Clear-GitHubAppState }`. The current
   sign-in is saved into the active profile (if one is known), then Desktop and VS Code start signed
   out (`readme/flows/github-clear.md`). **Skip this step** is for when the apps are already signed
   out, or already signed in as the new account (e.g. after a refresh). The step counts as done only
   for the login it was run for, so changing the GitHub username offers Prepare again.
3. **Sign in to each tool** - sign in to github.com in the browser as the new account first. Each
   row's button (**Sign in** for GitHub CLI and Git, **Open Desktop** / **Open VS Code** for the apps,
   where you sign in inside the app) calls `POST /api/github/signin` (`Start-ToolSignIn`):

   | Tool | What starts |
   |---|---|
   | GitHub CLI | New console: `gh auth login --hostname github.com --web --git-protocol https --clipboard`. Answer **n** to "Authenticate Git with your GitHub credentials?" so git keeps using GCM |
   | Git | `git credential-manager github login --username <login> --browser` |
   | GitHub Desktop | Desktop (`$desktopExe`) if not running; user clicks "Sign in to GitHub.com" |
   | VS Code | `Code.exe --reuse-window` (`$vscodeExe`): starts VS Code, or hands a running one the request in its last window. User clicks the Accounts icon at the bottom of the left bar, signs in with GitHub, approves in the browser |

   The list re-checks every 4 s (`GET /api/github/login-state`, `Get-GitHubLoginState`).
4. **Save profile** - confirm, then `POST /api/github/save`: `Set-GitHubProfile` writes
   `accounts.json`, then `Invoke-WithAppsClosed { Save-GitHubProfileState <profile> }`
   (`readme/flows/github-save.md`). The new profile becomes active everywhere, gh and git included.

## Claude Code: add an account

Step 1 **Account** names the profile. If Claude Code is signed in to an account that has no
profile, it also asks which account to add:

- **The account signed in now** - two steps: Account, **Save profile** (`POST /api/claude/save`,
  `readme/flows/claude-save.md`). The card's **Save as profile** opens the wizard here.
- **Another Claude account** - four steps:
  2. **Sign out** - confirm, then `POST /api/claude/prepare` (`Clear-ClaudeSignIn`,
     `readme/flows/claude-clear.md`): the current sign-in is saved first (into its profile or as
     `_previous`), then removed. Needs every Claude Code session closed; **Next** unlocks when
     Claude Code is signed out.
  3. **Sign in** - `POST /api/claude/signin` opens `claude auth login` in a console; the user signs
     in in the browser. The page checks `GET /api/claude/status` every 4 s and shows the email.
  4. **Save profile** - shows profile, account, organization and plan, then saves.

A name that already holds a different Claude account is refused; so is saving one account under a
second name.

## Progress survives a refresh

Each wizard keeps its step and what was typed in `localStorage` (`web/src/draft.ts`):
`switcher-add-account` (GitHub: step, the four fields, which login was prepared) and
`switcher-add-claude` (step, profile name, which account). No tokens. After a reload the wizard
reopens at the same step with "Picked up where you left off." The draft is deleted when the profile
is saved or on **Cancel**; the close button (X) keeps it. If the browser blocks storage, the wizards
still work without this.

## Status checks (GitHub)

| Tool | "Uses this account" when |
|---|---|
| GitHub CLI | `gh api user` returns the profile's login (needs network) |
| Git | `credential.https://github.com.username` is the login **and** `git credential-manager github list` has it; otherwise amber "No saved login, next push asks" |
| GitHub Desktop | `Get-DesktopLogin` returns the login |
| VS Code | a GitHub session exists - VS Code encrypts it, so the account cannot be checked |

Claude Code's status comes from its own files (`Get-ClaudeStatus`, no network).

## Failure behavior

- An action that throws comes back as `ok: false`; the Activity entry shows **Failed** and the
  error in red. Nothing else on the page changes.
- GitHub apps that do not close within 20 s: `... did not close (unsaved changes?)` - nothing changed.
- Claude Code running during a Claude switch or sign-out: `Claude Code is running (N process(es))...` -
  nothing changed. Exit the sessions, **Refresh**, try again.
- While an action runs, a modal covers the page (GitHub actions add "If an app asks about unsaved
  changes, answer it there"). The server handles one request at a time, so actions never overlap.
- Server not running: "Cannot reach the switcher" with **Try again**.
- Page opened without the one-time link: it explains to start `.\switcher.ps1 -Ui`.

## Notes

- GitHub avatars load from `https://github.com/<login>.png`; initials if that fails. Claude accounts
  always show initials.
- Development: run `.\switcher.ps1 -Ui`, then `cd web; npm run dev` and open the
  `http://localhost:5173/?t=...` link the server printed. Vite forwards `/api` to the server.
- Testing without clicking real actions: `.claude/RULES.md` section 10, step 4.

---
*Last updated: 2026-11-15 (dashboard: one card per tool family; Claude Code card, details and wizard)*
*Previously: 2026-11-15 (duplicate login/email refused; Delete profile button)*
*Previously: 2026-11-15 (wizard progress kept in localStorage across refresh; Skip copy for already-signed-in)*
*Previously: 2026-11-15 (Open Desktop / Open VS Code labels; VS Code opened with --reuse-window)*
*Previously: 2026-11-15 (server reopens outside VS Code's terminal; failed Activity entries stay expanded)*
*Previously: 2026-11-14 (replaces the WinForms -Login window)*
