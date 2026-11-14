<#
.SYNOPSIS
    Switch the active GitHub account for git, the GitHub CLI, GitHub Desktop and VS Code in one command.

.DESCRIPTION
    Profiles come from accounts.json next to this script. Per-profile state is kept in two places:
      - Windows Credential Manager: backup copies of each account's tokens, under the target
        "github-switch:<profile>:<original target>" (encrypted by Windows like the originals)
      - %LOCALAPPDATA%\github-switch\<profile>: GitHub Desktop's sign-in state ("Local Storage")
        and VS Code's GitHub session ("vscode-github-auth.txt", still encrypted by VS Code)

    Switching to a profile:
      - switches the gh CLI active account (gh auth switch)
      - backs up every profile's current tokens, then restores the target profile's tokens
        that are missing or currently held by another account
      - sets global git user.name / user.email and the Git Credential Manager default account
      - closes GitHub Desktop and VS Code, swaps in the profile's saved sign-in, and reopens them

    The functions live in switch-github-core.ps1; the -Ui web server in switch-github-ui.ps1.
    Requires Python 3 (standard library sqlite3) for the VS Code part. SSH keys are not handled.

.EXAMPLE
    .\switch-github.ps1 -Ui        # web UI: see every tool's account, add accounts, switch
.EXAMPLE
    .\switch-github.ps1 personal   # switch to profile 'personal'
.EXAMPLE
    .\switch-github.ps1            # show current state
.EXAMPLE
    .\switch-github.ps1 -Save work # save what is signed in now into 'work'
.EXAMPLE
    .\switch-github.ps1 -Clear     # Desktop and VS Code start signed out (do not use "Sign out")
#>
param(
    [Parameter(Position = 0)]
    [string]$Name,
    [switch]$Save,
    [switch]$Clear,
    [switch]$Ui
)

. (Join-Path $PSScriptRoot 'switch-github-core.ps1')

if ($Ui) {
    . (Join-Path $PSScriptRoot 'switch-github-ui.ps1')
    Start-UiServer
    return
}

if ($Clear) {
    Invoke-WithAppsClosed { Clear-AppState }
    return
}

if ($Save) {
    if (-not $Name) { throw 'Usage: .\switch-github.ps1 -Save <profile>' }
    # Validate before closing any app.
    $null = Get-Account $Name
    Invoke-WithAppsClosed { Save-ProfileState $Name }
    return
}

if (-not $Name) {
    Show-Status
    return
}

Switch-Profile $Name
