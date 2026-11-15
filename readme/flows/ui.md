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
| GitHub card | Active profile, @login and the git name/email commits use; a chip per tool (green = uses this account, amber = another account or GCM has no saved login, grey dashed = signed out; logins compared ignoring case, so `Octocat` and `octocat` are the same account); badge "All 4 tools linked" / "N of 4"; when an installed tool is off the active account, a callout naming those tools with **Sign in again**; **Switch to** list of the other profiles | `GET /api/status` (`github`) |
| Claude Code card | Signed-in email, organization and plan (e.g. "Max 5x"); badge Saved / Not saved yet / Signed out / Not installed; "Save as profile" when the sign-in has no profile; a warning while Claude Code runs; **Switch to** list, expired sign-ins flagged | `GET /api/status` (`claude`) |
| Card footer | **Details** opens the family's drawer; **Add account** its wizard | - |
| GitHub details | Each tool and its account (bracket from the active profile), the same **Sign in again** callout, every profile with saved Desktop / VS Code sign-ins, **Sign in again** on every profile, **Switch** and **Delete** (not on the active profile) | `POST /api/github/switch`, `/delete` |
| Claude Code details | Who is signed in, running sessions, every profile with plan and "Sign-in valid until", **Switch** and **Delete**, how a switch works | `POST /api/claude/switch`, `/delete` |
| Activity | Each action's result and every line it printed (warnings amber, errors red), newest first, last 30; failed entries stay expanded | action responses |

**Refresh** re-reads everything the page shows: every tool's live sign-in, the active profile, the
Claude Code account, and the profile list (the server re-reads `accounts.json` before every request,
so profiles saved from the CLI appear). After an action the page refreshes by itself. Which tools
are installed is found when the server starts: restart `-Ui` after installing one. Every Switch and
Delete asks to confirm first.

**Deleting a GitHub profile** forgets only what the switcher saved (its Desktop / VS Code snapshots
and token backups). gh and Git Credential Manager each keep a list of logins, so they stay signed in
to that account - which is why the add-account wizard shows them "Signed in" when the same account
is added again, and that sign-in step can be skipped. The delete dialog has an opt-in checkbox,
unticked every time: **Also sign @login out of GitHub CLI and Git on this PC**. Ticked, the delete
also runs `Remove-GitHubCliLogin` (`gh auth logout` + `git credential-manager github logout` for that
account only; the Activity entry is "delete profile X and sign out"). Desktop and VS Code are never
signed out by a delete. Deleting a Claude Code profile has no such option.

## GitHub: add an account

1. **Account details** - each field says what goes in it, with an example as placeholder:
   - **Profile name** - your own label, only used in the switcher (`work`); not the GitHub name.
   - **GitHub username** - the login in `github.com/<username>` (GitHub's rule), not the display
     name or email; capitals do not matter, the profile is saved with GitHub's spelling.
   - **Name on commits** - `git user.name`, the author shown on every commit.
   - **Email on commits** - `git user.email`: an email added to that GitHub account or its private
     noreply address (`<id>+<login>@users.noreply.github.com`); GitHub credits commits by it.

   Checked in the browser before **Next**; checked again by
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

   The list re-checks every 4 s (`GET /api/github/login-state`, `Get-GitHubLoginState`) with the
   same tests saving uses: GitHub Desktop counts only when the app itself shows the login (an old
   token left in Credential Manager does not). Each row also says what the tool uses now:
   - gh / Git signed in to this login but using another: "Uses @other now. Saving switches it to @login."
   - Desktop signed in as another login: a warning to go back one step and prepare the apps.

   When a row changes, the dashboard status reloads too, so the card behind the wizard agrees.
4. **Save profile** - names the tools that are not ready ("... not signed in as @login, so saving
   leaves it out"), then confirm and `POST /api/github/save`: `Set-GitHubProfile` writes
   `accounts.json`, then `Invoke-WithAppsClosed { Save-GitHubProfileState <profile> }`
   (`readme/flows/github-save.md`). The new profile becomes active everywhere, gh and git included.

Step 2 says what the apps hold right now: GitHub Desktop signed in as another login, or a VS Code
session (counted as another account unless it is the active profile's own, since VS Code hides the
account). If neither, it says the step can be skipped and **Skip this step** becomes the main button.

## GitHub: sign in again (fix a saved profile)

A profile saved before every tool was signed in (no Desktop or VS Code sign-in saved, or gh / git
on another account) is fixed with **Sign in again**: on each profile row in the GitHub details, and
in the callout on the card and in the details when the active profile has tools off its account.

It opens the same four-step wizard, titled "Sign in again: <profile>", with the profile's details
filled in. The profile name is read-only; username, name and email can be corrected. Prepare, sign
in and save work as above; saving under the same name updates the profile (`Set-GitHubProfile`
replaces the entry, `Save-GitHubProfileState` re-saves the sign-ins) and the buttons say **Update
profile**. No new API route: it is `POST /api/github/prepare`, `/signin` and `/save`.

For a profile that is not active, Desktop and VS Code usually hold the active account: prepare the
apps first, or the save would store that account's VS Code session in this profile.

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
`switcher-add-account` (GitHub: step, the four fields, which login was prepared, and which profile
is being signed in again, `repair`, empty when adding) and
`switcher-add-claude` (step, profile name, which account). No tokens. After a reload the wizard
reopens at the same step with "Picked up where you left off." A draft resumes only for the same
job: **Add account** does not resume a Sign-in-again draft, and the other way round. The draft is deleted when the profile
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

- One scrollbar at a time. With no drawer open, only the page scrolls. While a drawer, confirm or busy
  dialog is open, the page is locked (`html:has(dialog:modal) { overflow: hidden }`), and a drawer's
  title and footer stay put while only its body (`.drawer-body`) scrolls. `.drawer-body` is
  `position: relative` so screen-reader-only text inside it (`.visually-hidden`, absolutely
  positioned) stays inside the scrolling box. Without that, the text is positioned against the
  dialog itself, which then grows a second scrollbar.
- GitHub avatars load from `https://github.com/<login>.png`; initials if that fails. Claude accounts
  always show initials.
- Development: run `.\switcher.ps1 -Ui`, then `cd web; npm run dev` and open the
  `http://localhost:5173/?t=...` link the server printed. Vite forwards `/api` to the server.
- Testing without clicking real actions: `.claude/RULES.md` section 10, step 4.

---
*Last updated: 2026-11-15 (one scrollbar: page locked while a dialog is open, only the drawer body scrolls)*
*Previously: 2026-11-15 (GitHub delete: opt-in "also sign out of GitHub CLI and Git")*
*Previously: 2026-11-15 (logins compared ignoring case; Refresh also re-reads profiles; step 1 field hints + examples)*
*Previously: 2026-11-15 (sign-in list uses the save tests: Desktop must show the login; row notes; save-step warning)*
*Previously: 2026-11-15 (GitHub "Sign in again" for a saved profile; Prepare step says what the apps hold)*
*Previously: 2026-11-15 (dashboard: one card per tool family; Claude Code card, details and wizard)*
*Previously: 2026-11-15 (duplicate login/email refused; Delete profile button)*
*Previously: 2026-11-15 (wizard progress kept in localStorage across refresh; Skip copy for already-signed-in)*
*Previously: 2026-11-15 (Open Desktop / Open VS Code labels; VS Code opened with --reuse-window)*
*Previously: 2026-11-15 (server reopens outside VS Code's terminal; failed Activity entries stay expanded)*
*Previously: 2026-11-14 (replaces the WinForms -Login window)*
