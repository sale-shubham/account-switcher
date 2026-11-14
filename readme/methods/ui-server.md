# Web UI server and API

Covers `switch-github-ui.ps1` (dot-sourced by `switch-github.ps1 -Ui` after the core) and the
client in `web/src/api.ts`. The user flow is in `readme/flows/ui.md`.

## Server

`Start-UiServer` opens `System.Net.HttpListener` on `http://localhost:47821/` (`$uiPort`) and
handles one request at a time on the PowerShell thread, so two actions never run together. It
waits on `BeginGetContext` in 500 ms slices so Ctrl+C can stop it; the listener is closed in
`finally`.

| Path | Served by |
|---|---|
| `/api/*` | `Invoke-UiApi` (token required) |
| anything else | `Send-UiFile` from `web\dist`; unknown paths get `index.html`; a path that resolves outside `web\dist` is never served |

Port already in use: `throw` "Is the switcher UI already running in another window?".

## Access control

- **Per-run token.** `New-UiToken` makes 24 random bytes (`RandomNumberGenerator`) per start. The
  browser is opened at `/?t=<token>`; the page keeps it in `sessionStorage`, removes it from the
  address bar and sends it as `X-Switcher-Token` on every API call. Wrong or missing: `401`.
  Other web pages cannot read it, and a cross-origin request with that header needs a CORS
  preflight the server never allows.
- **localhost only.** `HttpListener` with a `localhost` prefix answers `400 Bad Request - Invalid
  Hostname` to any other `Host` header (DNS rebinding), before the script sees the request.
- No admin rights are needed for a `localhost` prefix.
- The token protects this API only; it is not a GitHub token and is printed in the console.

## API

All JSON. Actions return `{ ok, log: [{ level: info|warn|error, text }] }`.

| Route | Body / query | Calls |
|---|---|---|
| `GET /api/status` | - | `Get-SwitcherStatus` |
| `GET /api/login-state` | `?user=<login>` (must match `$loginPattern`, else `400`) | `Get-LoginState` |
| `POST /api/prepare` | - | `Invoke-WithAppsClosed { Save-ProfileState <active>; Clear-AppState }` |
| `POST /api/signin` | `{ tool: gh\|git\|desktop\|vscode, user }` | `Start-ToolSignIn` |
| `POST /api/save` | `{ profile, user, gitName, email }` | `Set-AccountProfile`, then `Invoke-WithAppsClosed { Save-ProfileState }` |
| `POST /api/switch` | `{ profile }` | `Switch-Profile` |

Unknown route: `404`. An exception outside an action: `500 { error }` and a warning in the console.

### `Invoke-UiAction $Action`
Runs the action with `*>&1` and turns each record into a log line: `WarningRecord` -> `warn`;
`ErrorRecord` -> `error`, except `NativeCommandError*` (gh / git progress on stderr) -> `info`;
`Write-Host` and native stdout -> `info`. A thrown exception sets `ok = $false` and adds an
`error` line. Returns `$log.ToArray()` - PowerShell 5.1's `ConvertTo-Json` fails on `@($list)`
("Argument types do not match").

### `Start-ToolSignIn $tool $user`
Starts the sign-in for one tool (table in `readme/flows/ui.md`). `git` requires a login matching
`$loginPattern`, because it goes on the `git credential-manager` command line.

### `Send-UiJson` / `Send-UiResponse` / `Read-UiBody` / `Send-UiFile`
JSON via `ConvertTo-Json -Depth 6 -Compress`, UTF-8. Every response has `Cache-Control: no-store`
and `X-Content-Type-Options: nosniff`.

## Client (`web/`)

React 18 + TypeScript, built with Vite into `web\dist`. No UI library; styles in
`web/src/styles.css` (light and dark via `prefers-color-scheme`).

| File | Owns |
|---|---|
| `src/api.ts` | Types for every response, token handling, `api.*` calls, `loginPattern` / `profilePattern` (same rules as the core) |
| `src/tools.ts` | Tool names and `routesFor` - how each tool relates to the active account |
| `src/App.tsx` | Page state, `run` (busy modal + Activity entry + refresh), Switch confirm, gate screens |
| `src/components/Identity.tsx` | Active account and the line to each tool |
| `src/components/Profiles.tsx` | Profile list with saved sign-ins and **Switch** |
| `src/components/AddAccount.tsx` | Four-step drawer, sign-in polling |
| `src/components/ConfirmDialog.tsx`, `Activity.tsx`, `Avatar.tsx` | Confirm modal, action log, GitHub avatar with initials fallback |

`npm run check` (= `tsc --noEmit`) typechecks; `npm run build` typechecks and writes `web\dist`.

## Notes

- PowerShell 5.1 strings from `Get-Content` carry `PSPath` etc.; `Get-ActiveProfile` casts to
  `[string]` so `ConvertTo-Json` writes a plain string.
- `vite.config.ts` proxies `/api` to the server with `changeOrigin`, so the `Host` header is
  `localhost:47821` - the only host the listener accepts.

---
*Last updated: 2026-11-14 (initial: replaces the WinForms window)*
