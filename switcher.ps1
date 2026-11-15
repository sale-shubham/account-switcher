<#
.SYNOPSIS
    Switch the account your developer tools use, one tool family at a time: GitHub (gh, git,
    GitHub Desktop, VS Code) and Claude Code.

.DESCRIPTION
    Each tool family has its own profiles; switching one never touches the other.

    GitHub profiles come from accounts.json next to this script. Per-profile state:
      - Windows Credential Manager: copies of each account's tokens, "github-switch:<profile>:<target>"
      - %LOCALAPPDATA%\github-switch\<profile>: GitHub Desktop's sign-in ("Local Storage") and
        VS Code's GitHub session ("vscode-github-auth.txt", still encrypted by VS Code)

    Claude Code profiles are saved from whatever Claude Code is signed in to:
      - Windows Credential Manager: the sign-in tokens, "account-switch:claude:<profile>"
      - %LOCALAPPDATA%\account-switch\claude\<profile>\account.json: email, name, organization

    The code lives in lib\: common.ps1 (shared), github.ps1, claude.ps1, ui-server.ps1 (-Ui).
    Requires Python 3 (standard library only) for the VS Code and Claude Code parts.

.EXAMPLE
    .\switcher.ps1 -Ui                   # web UI: every tool's account, add accounts, switch
.EXAMPLE
    .\switcher.ps1                       # show the current state of every tool
.EXAMPLE
    .\switcher.ps1 github personal       # switch gh, git, GitHub Desktop and VS Code to 'personal'
.EXAMPLE
    .\switcher.ps1 github -Save work     # save what GitHub tools are signed in to now as 'work'
.EXAMPLE
    .\switcher.ps1 github -Clear         # Desktop and VS Code start signed out (never use "Sign out")
.EXAMPLE
    .\switcher.ps1 claude work           # switch Claude Code to 'work' (exit Claude Code first)
.EXAMPLE
    .\switcher.ps1 claude -Save work     # save what Claude Code is signed in to now as 'work'
.EXAMPLE
    .\switcher.ps1 claude -Clear         # sign Claude Code out safely (never use /logout), to add an account
#>
param(
    [Parameter(Position = 0)]
    [ValidateSet('github', 'claude')]
    [string]$Tool,
    [Parameter(Position = 1)]
    [string]$Name,
    [switch]$Save,
    [switch]$Clear,
    [switch]$Ui
)

. (Join-Path $PSScriptRoot 'lib\common.ps1')
. (Join-Path $PSScriptRoot 'lib\github.ps1')
. (Join-Path $PSScriptRoot 'lib\claude.ps1')

if ($Ui) {
    . (Join-Path $PSScriptRoot 'lib\ui-server.ps1')
    Start-UiServer
    return
}

if (-not $Tool) {
    if ($Save -or $Clear -or $Name) { throw 'Name the tool first, for example: .\switcher.ps1 github -Save work' }
    Show-GitHubStatus
    Write-Host ''
    Show-ClaudeStatus
    return
}

if ($Save -and -not $Name) { throw "Usage: .\switcher.ps1 $Tool -Save <profile>" }

if ($Tool -eq 'github') {
    if ($Clear) { Invoke-WithAppsClosed { Clear-GitHubAppState }; return }
    if ($Save) {
        # Validate before closing any app.
        $null = Get-GitHubProfile $Name
        Invoke-WithAppsClosed { Save-GitHubProfileState $Name }
        return
    }
    if (-not $Name) { Show-GitHubStatus; return }
    Switch-GitHubProfile $Name
    return
}

if ($Clear) { Clear-ClaudeSignIn; return }
if ($Save) { Save-ClaudeProfile $Name; return }
if (-not $Name) { Show-ClaudeStatus; return }
Switch-ClaudeProfile $Name
