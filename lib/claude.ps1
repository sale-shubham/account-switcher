# Claude Code: switches which Claude account the Claude Code CLI is signed in to. The VS Code
# extension runs the same CLI and login, so it follows. Dot-sourced by switcher.ps1 after common.ps1;
# the web UI server (ui-server.ps1) calls the same functions. Defines variables and functions only.
#
# Claude Code keeps its sign-in in two files, under %USERPROFILE% (or CLAUDE_CONFIG_DIR if set):
#   .claude\.credentials.json  "claudeAiOauth": the OAuth tokens (secret). Other entries in that file
#                              (MCP server logins) belong to no Claude account and are left alone.
#   .claude.json               "oauthAccount": who is signed in - email, name, organization (not secret)
# A profile is a copy of both: the tokens in Credential Manager (account-switch:claude:<profile>), the
# account details in %LOCALAPPDATA%\account-switch\claude\<profile>\account.json.

if ($env:CLAUDE_CONFIG_DIR) {
    $claudeConfigDir = $env:CLAUDE_CONFIG_DIR
    $claudeStateFile = Join-Path $env:CLAUDE_CONFIG_DIR '.claude.json'
} else {
    $claudeConfigDir = Join-Path $env:USERPROFILE '.claude'
    $claudeStateFile = Join-Path $env:USERPROFILE '.claude.json'
}
$claudeCredentialsFile = Join-Path $claudeConfigDir '.credentials.json'
$claudeDir = Join-Path $switchDir 'claude'
$claudeHelper = Join-Path $PSScriptRoot 'claude_account.py'
# -CommandType Application: an npm install also has claude.ps1, which Start-Process would open in an editor.
$claudeCmd = Get-Command claude -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$claudeExe = if ($claudeCmd) { $claudeCmd.Source } else { $null }
# Credential Manager stores at most this many bytes per secret (CRED_MAX_CREDENTIAL_BLOB_SIZE).
$credBlobLimit = 2560

function Get-ClaudeTarget($profileName) { "account-switch:claude:$profileName" }
function Get-ClaudeProfileDir($profileName) { Join-Path $claudeDir $profileName }

# Saved profiles: folders holding an account.json. "_previous" fails the name pattern, so it is never listed.
function Get-ClaudeProfileNames {
    @(Get-ChildItem $claudeDir -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match $profilePattern -and (Test-Path (Join-Path $_.FullName 'account.json')) } |
        ForEach-Object { $_.Name })
}

function Read-ClaudeSavedAccount($profileName) {
    $file = Join-Path (Get-ClaudeProfileDir $profileName) 'account.json'
    if (Test-Path $file) { [IO.File]::ReadAllText($file) | ConvertFrom-Json } else { $null }
}

function Read-ClaudeCredentials {
    if (-not (Test-Path $claudeCredentialsFile)) { return [pscustomobject]@{} }
    $text = [IO.File]::ReadAllText($claudeCredentialsFile)
    if (-not $text.Trim()) { return [pscustomobject]@{} }
    $text | ConvertFrom-Json
}

# Written in place, so the file keeps its permissions. The tokens go from memory to this file only.
function Write-ClaudeCredentials($credentials) {
    New-Item -ItemType Directory -Force $claudeConfigDir | Out-Null
    $json = ConvertTo-Json -InputObject $credentials -Depth 20 -Compress
    [IO.File]::WriteAllText($claudeCredentialsFile, $json, (New-Object Text.UTF8Encoding($false)))
}

# Who Claude Code is signed in as (email, name, organization, ids), from .claude.json; $null if nobody.
function Get-ClaudeAccount {
    if (-not $hasPython) { return $null }
    $json = python -I $claudeHelper show $claudeStateFile 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $json) { return $null }
    "$json" | ConvertFrom-Json
}

# One Claude user can belong to several organizations, and each sign-in is for one of them.
function Get-ClaudeIdentity($account) {
    if ($account -and $account.accountUuid) { "$($account.accountUuid)/$($account.organizationUuid)" } else { '' }
}

# The saved profile that holds this account (same user and organization), or ''.
function Find-ClaudeProfile($account) {
    $id = Get-ClaudeIdentity $account
    if (-not $id) { return '' }
    foreach ($n in Get-ClaudeProfileNames) {
        if ((Get-ClaudeIdentity (Read-ClaudeSavedAccount $n)) -eq $id) { return $n }
    }
    ''
}

# Claude Code processes: the native claude.exe (also the one inside the VS Code extension) and npm
# installs (node running @anthropic-ai/claude-code). The Claude desktop app is also claude.exe, but it
# keeps its own sign-in, so it does not count.
function Get-ClaudeSessions {
    @(Get-CimInstance Win32_Process -Filter "Name = 'claude.exe' OR Name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            if ($_.Name -eq 'node.exe') { "$($_.CommandLine)" -match 'claude-code' }
            else { "$($_.ExecutablePath)" -notmatch '\\(AnthropicClaude|WindowsApps)\\' }
        })
}

# A running session keeps its tokens in memory and writes them back when it refreshes them, which
# would undo a switch. Console sessions have no window to close normally, and they are never killed.
function Assert-ClaudeClosed {
    $count = @(Get-ClaudeSessions).Count
    if ($count) {
        throw "Claude Code is running ($count process(es)). Exit every Claude Code session first (type /exit, and close Claude Code in VS Code), then try again."
    }
}

function Assert-ClaudeReady {
    if (-not $hasPython) { throw 'Python 3 was not found on PATH. The Claude Code part needs it to update .claude.json.' }
}

# Copies what Claude Code is signed in with now into a profile: the tokens into Credential Manager
# first, then the account details, whose file is what marks the profile as saved.
function Save-ClaudeSignIn($profileName, [switch]$AccountOptional) {
    $oauth = (Read-ClaudeCredentials).claudeAiOauth
    if (-not $oauth) { throw 'Claude Code is not signed in.' }
    $account = Get-ClaudeAccount
    $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $oauth -Depth 10 -Compress))
    if ($bytes.Length -gt $credBlobLimit) {
        throw "Claude Code's sign-in is $($bytes.Length) bytes, more than Credential Manager can store ($credBlobLimit). Nothing was saved."
    }
    $email = if ($account) { "$($account.emailAddress)" } else { '' }
    # 2 = CRED_PERSIST_LOCAL_MACHINE: kept across sign-ins to Windows, never roamed to another PC.
    [CredStore]::Write((Get-ClaudeTarget $profileName), $email, $bytes, 2)
    $dir = Get-ClaudeProfileDir $profileName
    New-Item -ItemType Directory -Force $dir | Out-Null
    python -I $claudeHelper get $claudeStateFile (Join-Path $dir 'account.json')
    if ($LASTEXITCODE -ne 0 -and -not $AccountOptional) {
        throw 'Could not read the signed-in Claude account from .claude.json.'
    }
}

# Tokens rotate each time Claude Code refreshes them, so a copy saved earlier may no longer work.
# Before a switch or a sign-out the current sign-in is saved again: into its own profile if it has
# one, otherwise aside as "_previous", so no sign-in is ever lost.
function Backup-ClaudeCurrent {
    if (-not (Read-ClaudeCredentials).claudeAiOauth) { return }
    $account = Get-ClaudeAccount
    $own = Find-ClaudeProfile $account
    if ($own) {
        Save-ClaudeSignIn $own
        Write-Host "Updated profile '$own' with the current sign-in."
    } else {
        Save-ClaudeSignIn '_previous' -AccountOptional
        $who = if ($account) { $account.emailAddress } else { 'an unknown account' }
        Write-Host "The current sign-in ($who) has no profile, so it was kept aside as _previous."
    }
}

function Save-ClaudeProfile($profileName) {
    Test-ProfileName $profileName
    Assert-ClaudeReady
    $account = Get-ClaudeAccount
    if (-not ((Read-ClaudeCredentials).claudeAiOauth -and $account)) {
        throw 'Claude Code is not signed in. Sign in first (claude auth login), then save.'
    }
    # One profile per Claude account and organization, like GitHub's one profile per login.
    $own = Find-ClaudeProfile $account
    if ($own -and $own -ne $profileName) {
        throw "This Claude account ($($account.emailAddress)) is already saved as '$own'. Use that profile, or delete it first."
    }
    # Saving under a name that holds another account would silently replace that account's sign-in.
    $holder = Read-ClaudeSavedAccount $profileName
    if ($holder -and (Get-ClaudeIdentity $holder) -ne (Get-ClaudeIdentity $account)) {
        throw "Profile '$profileName' already holds $($holder.emailAddress). Pick another name, or delete it first."
    }
    Save-ClaudeSignIn $profileName
    Write-Host "Saved Claude Code sign-in for '$profileName' ($($account.emailAddress))."
}

function Switch-ClaudeProfile($profileName) {
    Test-ProfileName $profileName
    Assert-ClaudeReady
    $saved = Read-ClaudeSavedAccount $profileName
    if (-not $saved) { throw "Unknown Claude profile '$profileName'. Saved: $((Get-ClaudeProfileNames) -join ', ')" }
    $backup = @([CredStore]::List((Get-ClaudeTarget $profileName)))
    if (-not $backup) { throw "Profile '$profileName' has no saved sign-in. Sign in to Claude Code as $($saved.emailAddress) and save it again." }
    $oauth = [Text.Encoding]::UTF8.GetString($backup[0].Blob) | ConvertFrom-Json
    if ($oauth.refreshTokenExpiresAt -and [long]$oauth.refreshTokenExpiresAt -lt [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()) {
        throw "The sign-in saved in '$profileName' has expired. Sign in to Claude Code as $($saved.emailAddress) again (Add account), then save it as '$profileName'."
    }
    # Before any change: failing here leaves Claude Code exactly as it was.
    Assert-ClaudeClosed

    $current = Get-ClaudeAccount
    Backup-ClaudeCurrent
    if ((Get-ClaudeIdentity $current) -eq (Get-ClaudeIdentity $saved) -and (Read-ClaudeCredentials).claudeAiOauth) {
        Write-Host "Claude Code is already signed in as '$profileName' ($($saved.emailAddress))."
        return
    }

    $credentials = Read-ClaudeCredentials
    if ($credentials.PSObject.Properties['claudeAiOauth']) {
        $credentials.claudeAiOauth = $oauth
    } else {
        $credentials | Add-Member -NotePropertyName claudeAiOauth -NotePropertyValue $oauth
    }
    Write-ClaudeCredentials $credentials
    python -I $claudeHelper set $claudeStateFile (Join-Path (Get-ClaudeProfileDir $profileName) 'account.json')
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Claude Code has the sign-in of '$profileName', but .claude.json could not be updated. Claude Code shows the new account after it starts once."
    }
    Write-Host "Switched Claude Code to '$profileName' ($($saved.emailAddress)). New Claude Code sessions use this account."
}

# Signs Claude Code out without "claude auth logout" (which may revoke the sign-in on the server):
# the sign-in is saved first, then removed from Claude Code's files. Used to add another account.
function Clear-ClaudeSignIn {
    Assert-ClaudeReady
    Assert-ClaudeClosed
    if (-not (Read-ClaudeCredentials).claudeAiOauth) {
        Write-Host 'Claude Code is already signed out.'
        return
    }
    Backup-ClaudeCurrent
    $credentials = Read-ClaudeCredentials
    $credentials.PSObject.Properties.Remove('claudeAiOauth')
    Write-ClaudeCredentials $credentials
    python -I $claudeHelper clear $claudeStateFile
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Could not remove the account from .claude.json. Claude Code still starts signed out.' }
    Write-Host 'Claude Code is signed out. Sign in with the next account (claude auth login), then save it as a profile.'
}

function Remove-ClaudeProfile($profileName) {
    Test-ProfileName $profileName
    if (-not (Read-ClaudeSavedAccount $profileName)) { throw "Unknown Claude profile '$profileName'." }
    # Account file first: if deleting the tokens fails, no listed profile is left without them.
    Remove-Item (Get-ClaudeProfileDir $profileName) -Recurse -Force -ErrorAction Stop
    [CredStore]::Delete((Get-ClaudeTarget $profileName))
    Write-Host "Deleted Claude profile '$profileName'. The Claude account and what Claude Code is signed in to now are unchanged."
}

# Opens "claude auth login" in its own console. Only from signed out: signing in over an existing
# sign-in would replace it before it is saved.
function Start-ClaudeSignIn {
    if (-not $claudeExe) { throw 'Claude Code was not found (no "claude" on PATH).' }
    if ((Read-ClaudeCredentials).claudeAiOauth) {
        $account = Get-ClaudeAccount
        $who = if ($account) { $account.emailAddress } else { 'an account' }
        throw "Claude Code is still signed in as $who. Prepare first, so that sign-in is saved instead of replaced."
    }
    Start-Process $claudeExe -ArgumentList 'auth', 'login'
    Write-Host 'Claude Code: a console window opened. Sign in to Claude in the browser with the account to add; the window closes when it is done.'
}

# Everything Show-ClaudeStatus prints and the web UI shows. Local files only, no network. Tokens are
# read to get the plan and expiry date; only those leave this function.
function Get-ClaudeStatus {
    $oauth = (Read-ClaudeCredentials).claudeAiOauth
    $account = if ($oauth) { Get-ClaudeAccount } else { $null }
    $backups = @{}
    foreach ($c in [CredStore]::List('account-switch:claude:*')) { $backups[$c.Target] = $c }
    [ordered]@{
        installed     = [bool]$claudeExe
        python        = $hasPython
        sessions      = @(Get-ClaudeSessions).Count
        account       = $(if ($oauth) {
            [ordered]@{
                email        = "$($account.emailAddress)"
                displayName  = "$($account.displayName)"
                organization = "$($account.organizationName)"
                plan         = "$($oauth.subscriptionType)"
                tier         = "$($oauth.rateLimitTier)"
            }
        } else { $null })
        activeProfile = $(if ($oauth) { Find-ClaudeProfile $account } else { '' })
        profiles      = @(foreach ($n in Get-ClaudeProfileNames) {
            $saved = Read-ClaudeSavedAccount $n
            $backup = $backups[(Get-ClaudeTarget $n)]
            $plan = ''; $tier = ''; $expires = $null
            if ($backup) {
                $tokens = [Text.Encoding]::UTF8.GetString($backup.Blob) | ConvertFrom-Json
                $plan = "$($tokens.subscriptionType)"
                $tier = "$($tokens.rateLimitTier)"
                if ($tokens.refreshTokenExpiresAt) {
                    $expires = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$tokens.refreshTokenExpiresAt).UtcDateTime.ToString('o')
                }
            }
            [ordered]@{
                name         = $n
                email        = "$($saved.emailAddress)"
                displayName  = "$($saved.displayName)"
                organization = "$($saved.organizationName)"
                plan         = $plan
                tier         = $tier
                expires      = $expires
                saved        = [bool]$backup
            }
        })
    }
}

function Show-ClaudeStatus {
    $status = Get-ClaudeStatus
    Write-Host 'Claude Code'
    if (-not $status.installed) { Write-Host '  Not installed (no "claude" on PATH)'; return }
    if ($status.account) {
        $a = $status.account
        Write-Host "  Signed in as      : $($a.email) ($($a.organization), $($a.plan))"
        $own = if ($status.activeProfile) { $status.activeProfile } else { '(not saved as a profile)' }
        Write-Host "  Profile           : $own"
    } else {
        Write-Host '  Signed in as      : nobody'
    }
    Write-Host "  Running sessions  : $($status.sessions)"
    $list = foreach ($p in $status.profiles) { "$($p.name) <$($p.email)>" }
    Write-Host "  Profiles          : $($list -join ', ')"
}
