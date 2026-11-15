# GitHub: switches the account used by the GitHub CLI, git (identity + Git Credential Manager),
# GitHub Desktop and VS Code's GitHub sign-in. Dot-sourced by switcher.ps1 after common.ps1; the web
# UI server (ui-server.ps1) calls the same functions. Defines variables and functions only.

$accountsFile = Join-Path $appRoot 'accounts.json'

# (Re)reads accounts.json into $accounts / $names. The web UI server calls it before every request, so a
# profile saved from the CLI while the server runs shows up, and the server never writes back an old list.
function Read-GitHubProfiles {
    # No accounts.json yet is fine: the web UI creates it with the first profile.
    $script:accounts = if (Test-Path $accountsFile) { Get-Content $accountsFile -Raw | ConvertFrom-Json } else { [pscustomobject]@{} }
    # Piped, not .Name: with no profiles .Name gives $null, and @($null) is one empty profile that
    # crashes the web UI.
    $script:names = @($script:accounts.PSObject.Properties | ForEach-Object { $_.Name })
}
Read-GitHubProfiles
$hasGh = [bool](Get-Command gh -ErrorAction SilentlyContinue)

# Older than the account-switch folder (common.ps1); kept so profiles saved before stay where they are.
$dataDir = Join-Path $env:LOCALAPPDATA 'github-switch'
New-Item -ItemType Directory -Force $dataDir | Out-Null
$currentFile = Join-Path $dataDir 'current.txt'
$desktopStorage = Join-Path $env:APPDATA 'GitHub Desktop\Local Storage'
$desktopExe = Join-Path $env:LOCALAPPDATA 'GitHubDesktop\GitHubDesktop.exe'
$codeCmd = Get-Command code -ErrorAction SilentlyContinue
$vscodeExe = if ($codeCmd) { Join-Path (Split-Path (Split-Path $codeCmd.Source)) 'Code.exe' } else { $null }
# Newer VS Code keeps secrets in the shared storage DB; older builds use the global one.
$vscodeDbs = @(@(
    (Join-Path $env:USERPROFILE '.vscode-shared\sharedStorage\state.vscdb'),
    (Join-Path $env:APPDATA 'Code\User\globalStorage\state.vscdb')
) | Where-Object { Test-Path $_ })
$vscodeHelper = Join-Path $PSScriptRoot 'vscode_secret.py'
$hasVSCode = $vscodeDbs.Count -gt 0 -and $hasPython
# Token entries written by GCM (git:...), gh (gh:github.com:<user>) and GitHub Desktop (GitHub - ...).
# gh's active-account entry "gh:github.com:" has no user name, so the per-user filter below skips it.
$tokenTarget = '^(git:https://(.+@)?github\.com|gh:github\.com:|GitHub - https://api\.github\.com/)'
# GitHub's own login rule. Logins also go on native command lines, so nothing else may pass.
$loginPattern = '^[A-Za-z0-9-]{1,39}$'

function Get-GitHubProfile($profileName) {
    if ($names -notcontains $profileName) {
        throw "Unknown GitHub profile '$profileName'. Available: $($names -join ', ')"
    }
    $account = $accounts.$profileName
    foreach ($field in 'name', 'email', 'user') {
        if (-not $account.$field) { throw "Profile '$profileName' is missing '$field' in $accountsFile" }
    }
    $account
}

# Adds or replaces a profile in accounts.json and in the loaded $accounts / $names.
function Set-GitHubProfile($profileName, $gitName, $email, $user) {
    Test-ProfileName $profileName
    if ($user -notmatch $loginPattern) { throw "GitHub login '$user' is not valid (letters, digits and '-', up to 39)." }
    if (-not ($gitName -and $email)) { throw 'Git name and email are required.' }
    # Keep the login as GitHub spells it, so the profile shows the same text as gh and Desktop.
    $spelled = Get-GitHubLoginSpelling $user
    if ($spelled -cne $user) {
        Write-Host "GitHub spells the login '$spelled'; saved that way."
        $user = $spelled
    }
    # One profile per GitHub account: GitHub logins are unique, and an email belongs to one account at
    # a time (GitHub attributes commits by email). -eq is case-insensitive, like GitHub's comparison.
    foreach ($other in $script:names) {
        if ($other -eq $profileName) { continue }
        if ($script:accounts.$other.user -eq $user) { throw "GitHub login '$user' is already in profile '$other'. Use that profile, or delete it first." }
        if ($script:accounts.$other.email -eq $email) { throw "Email '$email' is already in profile '$other'. GitHub links an email to one account only." }
    }
    $entry = [pscustomobject]@{ name = $gitName; email = $email; user = $user }
    if ($script:accounts.PSObject.Properties[$profileName]) {
        $script:accounts.$profileName = $entry
    } else {
        $script:accounts | Add-Member -NotePropertyName $profileName -NotePropertyValue $entry
    }
    # WriteAllText: UTF-8 without BOM (Set-Content -Encoding UTF8 adds one in PowerShell 5.1).
    [IO.File]::WriteAllText($accountsFile, ($script:accounts | ConvertTo-Json))
    $script:names = @($script:accounts.PSObject.Properties | ForEach-Object { $_.Name })
    Write-Host "Saved profile '$profileName' to accounts.json."
}

# Forgets a profile: its accounts.json entry, its app snapshots and its token backups. Live sign-ins
# (the tools' own Credential Manager entries) are not touched, so no account is signed out - unless
# -SignOut, ticked in the web UI's delete dialog, also removes the account from gh and GCM.
function Remove-GitHubProfile($profileName, [switch]$SignOut) {
    $user = (Get-GitHubProfile $profileName).user
    # The name becomes a folder path below; never let it reach _previous, _cleared or a parent.
    Test-ProfileName $profileName
    if ((Get-GitHubActiveProfile) -eq $profileName) { throw "'$profileName' is the active profile. Switch to another profile first." }
    # Profile entry first: if a later step fails, only unreferenced leftovers remain, never a profile without its backups.
    $script:accounts.PSObject.Properties.Remove($profileName)
    [IO.File]::WriteAllText($accountsFile, ($script:accounts | ConvertTo-Json))
    $script:names = @($script:accounts.PSObject.Properties | ForEach-Object { $_.Name })
    $folder = Join-Path $dataDir $profileName
    if (Test-Path $folder) { Remove-Item $folder -Recurse -Force -ErrorAction Stop }
    foreach ($backup in [CredStore]::List("github-switch:${profileName}:*")) { [CredStore]::Delete($backup.Target) }
    Write-Host "Deleted profile '$profileName' (its saved sign-ins and token backups). The GitHub account itself is unchanged."
    if ($SignOut) { Remove-GitHubCliLogin $user }
}

# Signs one account out of gh and Git Credential Manager on this PC with their own logout commands. Those
# delete the local token only; it is not revoked on GitHub. Only for deleting a profile when the user asks:
# never part of a switch. Desktop and VS Code hold one sign-in each, which Clear-GitHubAppState moves aside.
function Remove-GitHubCliLogin($user) {
    if (-not $hasGh) {
        Write-Host 'GitHub CLI is not installed, nothing to sign out there.'
    } elseif ([CredStore]::List("gh:github.com:$user")) {
        # gh matches the login case-sensitively; when it was the active account, gh picks another one.
        gh auth logout --hostname github.com --user (Get-GitHubLoginSpelling $user)
        if ($LASTEXITCODE -ne 0) { Write-Warning "GitHub CLI could not sign '$user' out." }
    } else {
        Write-Host "GitHub CLI has no login for '$user'."
    }

    # GCM's own spelling of the login, found ignoring case like GitHub does.
    $gcmLogin = @(git credential-manager github list 2>$null) | Where-Object { $_ -eq $user } | Select-Object -First 1
    if ($gcmLogin) {
        git credential-manager github logout $gcmLogin --no-ui
        if ($LASTEXITCODE -eq 0) { Write-Host "Git Credential Manager signed '$gcmLogin' out." }
        else { Write-Warning "Git Credential Manager could not sign '$user' out." }
    } else {
        Write-Host "Git Credential Manager has no login for '$user'."
    }
    if ((git config --global credential.https://github.com.username) -eq $user) {
        Write-Warning "Git's default account is still '$user', so the next push asks to sign in. Switch to another profile first."
    }
}

# Makes git commits and pushes use this account: identity + Git Credential Manager default account.
function Set-GitIdentity($account) {
    git config --global user.name $account.name
    git config --global user.email $account.email
    git config --global credential.https://github.com.username $account.user
}

function Get-GitHubActiveProfile {
    # [string]: Get-Content strings carry PSPath etc., which ConvertTo-Json would serialize.
    if (Test-Path $currentFile) { [string](Get-Content $currentFile -TotalCount 1) } else { '' }
}

function Get-DesktopSnapshot($profileName) { Join-Path $dataDir "$profileName\Local Storage" }
function Get-VSCodeSnapshot($profileName) { Join-Path $dataDir "$profileName\vscode-github-auth.txt" }

function Backup-Tokens($profileName, $user) {
    $prefix = "github-switch:${profileName}:"
    foreach ($c in [CredStore]::List($null)) {
        if ($c.User -eq $user -and $c.Target -match $tokenTarget) {
            [CredStore]::Write($prefix + $c.Target, $c.User, $c.Blob, $c.Persist)
        }
    }
}

# GitHub logins ignore case, but `gh auth switch --user` does not, and gh and Desktop keep the login as GitHub
# spells it ("Octocat") while a profile may hold it as typed ("octocat"). Returns GitHub's spelling from gh's
# or Desktop's Credential Manager entry (the lookup ignores case), else $user unchanged.
function Get-GitHubLoginSpelling($user) {
    if (-not $user) { return $user }
    foreach ($prefix in 'gh:github.com:', 'GitHub - https://api.github.com/') {
        $entry = @([CredStore]::List("$prefix$user"))
        if ($entry.Count) { return $entry[0].Target.Substring($prefix.Length) }
    }
    $user
}

function Restore-Tokens($profileName, $user) {
    $prefix = "github-switch:${profileName}:"
    $current = @{}
    foreach ($c in [CredStore]::List($null)) { $current[$c.Target] = $c }
    foreach ($backup in [CredStore]::List("$prefix*")) {
        $target = $backup.Target.Substring($prefix.Length)
        $existing = $current[$target]
        if (-not $existing -or $existing.User -ne $user) {
            [CredStore]::Write($target, $backup.User, $backup.Blob, $backup.Persist)
            Write-Host "Restored token: $target"
        }
    }
}

# Desktop keeps its signed-in users in Chromium localStorage (LevelDB); the newest "login" entry is the current one.
function Get-DesktopLogin {
    $login = $null
    $files = Get-ChildItem (Join-Path $desktopStorage 'leveldb') -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in '.log', '.ldb' } | Sort-Object LastWriteTime
    foreach ($f in $files) {
        # Share ReadWrite: while Desktop runs it holds the .log open for writing, and ReadAllBytes would fail.
        try {
            $stream = [IO.File]::Open($f.FullName, 'Open', 'Read', 'ReadWrite')
            try { $buffer = New-Object IO.MemoryStream; $stream.CopyTo($buffer); $bytes = $buffer.ToArray() } finally { $stream.Dispose() }
        } catch { continue }
        $hits = [regex]::Matches([Text.Encoding]::GetEncoding(28591).GetString($bytes), '"login":"([^"]+)"')
        if ($hits.Count) { $login = $hits[$hits.Count - 1].Groups[1].Value }
    }
    $login
}

# Returns $true if VS Code had a GitHub session to save.
function Save-VSCodeSession($file) {
    New-Item -ItemType Directory -Force (Split-Path $file) | Out-Null
    python -I $vscodeHelper get $vscodeDbs[0] $file
    $LASTEXITCODE -eq 0
}

function Set-VSCodeSession($file) {
    python -I $vscodeHelper set $vscodeDbs[0] $file
    if ($LASTEXITCODE -ne 0) { throw 'Failed to write the VS Code GitHub session.' }
}

function Clear-VSCodeSession {
    foreach ($db in $vscodeDbs) { python -I $vscodeHelper clear $db }
}

function Test-VSCodeSession {
    python -I $vscodeHelper has $vscodeDbs[0]
    $LASTEXITCODE -eq 0
}

# Runs $Action with GitHub Desktop and/or VS Code closed, then reopens whichever were running - also after a failure.
function Invoke-WithAppsClosed([scriptblock]$Action, [bool]$Desktop = $true, [bool]$VSCode = $true) {
    # Closing VS Code ends every process in its terminals - this script too, halfway, with nothing reopened.
    if ($VSCode -and $env:TERM_PROGRAM -eq 'vscode' -and (Get-Process Code -ErrorAction SilentlyContinue)) {
        throw "This is running in VS Code's terminal, and closing VS Code would stop it halfway. Run it from a PowerShell window outside VS Code."
    }
    $reopen = @()
    try {
        if ($Desktop) { $reopen += Stop-App GitHubDesktop 'GitHub Desktop' }
        if ($VSCode) { $reopen += Stop-App Code 'VS Code' }
        & $Action
    } finally {
        Start-Apps $reopen
    }
}

# Is each tool ready for $user, by the same tests Save-GitHubProfileState uses? gh and git only need a login
# for $user (saving switches them to it). Desktop must show $user in the app: a token left in Credential
# Manager does not count, saving keeps Desktop only when Get-DesktopLogin matches. "now" is the account each
# tool uses at this moment. Local checks only, no network: the web UI polls this every few seconds.
function Get-GitHubLoginState($user) {
    $desktopNow = Get-DesktopLogin
    [ordered]@{
        gh      = [bool]([CredStore]::List("gh:github.com:$user"))
        git     = @(git credential-manager github list 2>$null) -contains $user
        desktop = [bool]$desktopNow -and $desktopNow -eq $user
        vscode  = $hasVSCode -and (Test-VSCodeSession)
        now     = [ordered]@{
            gh      = $(if ($hasGh) { gh config get user -h github.com 2>$null })
            git     = git config --global credential.https://github.com.username
            desktop = $desktopNow
        }
    }
}

# Everything Show-GitHubStatus prints and the web UI shows. Only gh's account needs the network (gh api user).
function Get-GitHubStatus {
    $gcmUser = git config --global credential.https://github.com.username
    $gcmUsers = @(git credential-manager github list 2>$null)
    [ordered]@{
        activeProfile = Get-GitHubActiveProfile
        git           = [ordered]@{
            name  = (git config --global user.name)
            email = (git config --global user.email)
        }
        tools         = [ordered]@{
            gh      = [ordered]@{ installed = $hasGh; account = $(if ($hasGh) { gh api user --jq .login 2>$null }) }
            git     = [ordered]@{ account = $gcmUser; signedIn = [bool]$gcmUser -and $gcmUsers -contains $gcmUser }
            desktop = [ordered]@{ account = Get-DesktopLogin }
            vscode  = [ordered]@{ installed = $hasVSCode; session = $hasVSCode -and (Test-VSCodeSession) }
        }
        profiles      = @(foreach ($n in $names) {
            [ordered]@{
                name         = $n
                gitName      = $accounts.$n.name
                email        = $accounts.$n.email
                user         = $accounts.$n.user
                desktopSaved = Test-Path (Get-DesktopSnapshot $n)
                vscodeSaved  = Test-Path (Get-VSCodeSnapshot $n)
            }
        })
    }
}

function Show-GitHubStatus {
    $status = Get-GitHubStatus
    Write-Host 'GitHub'
    Write-Host "  Active profile    : $($status.activeProfile)"
    Write-Host "  git user.name     : $($status.git.name)"
    Write-Host "  git user.email    : $($status.git.email)"
    Write-Host "  GCM default user  : $($status.tools.git.account)"
    if ($hasGh) { Write-Host "  gh active account : $($status.tools.gh.account)" }
    Write-Host "  GitHub Desktop    : $($status.tools.desktop.account)"
    $list = foreach ($p in $status.profiles) {
        $saved = @()
        if ($p.desktopSaved) { $saved += 'desktop' }
        if ($p.vscodeSaved) { $saved += 'vscode' }
        if ($saved) { "$($p.name) [$($saved -join ', ')]" } else { $p.name }
    }
    Write-Host "  Profiles          : $($list -join ', ')"
}

# Moves the current Desktop / VS Code sign-in aside so both start signed out. Apps must be closed.
function Clear-GitHubAppState {
    $dest = Join-Path $dataDir ('_cleared\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Force $dest | Out-Null
    if (Test-Path $desktopStorage) { Move-Item $desktopStorage $dest -ErrorAction Stop }
    if ($hasVSCode) {
        $null = Save-VSCodeSession (Join-Path $dest 'vscode-github-auth.txt')
        Clear-VSCodeSession
    }
    Remove-Item $currentFile -ErrorAction SilentlyContinue
    Write-Host "Previous sign-in state kept in $dest"
    Write-Host 'GitHub Desktop and VS Code are signed out. Sign in with the next account, then save it as a profile.'
}

# Captures the current Desktop sign-in, VS Code session and tokens into a profile. Apps must be closed.
function Save-GitHubProfileState($profileName) {
    $account = Get-GitHubProfile $profileName

    $login = Get-DesktopLogin
    if ($login -eq $account.user) {
        Copy-Folder $desktopStorage (Get-DesktopSnapshot $profileName)
        Write-Host "Saved GitHub Desktop sign-in for '$profileName'."
    } else {
        Write-Warning "GitHub Desktop is signed in as '$login', not '$($account.user)'. Desktop not saved."
    }

    # The session is encrypted, so the account cannot be checked here.
    if (-not $hasVSCode) {
        Write-Warning 'VS Code or Python not found. VS Code not saved.'
    } elseif (Save-VSCodeSession (Get-VSCodeSnapshot $profileName)) {
        Write-Host "Saved VS Code GitHub session for '$profileName' (it must be signed in as '$($account.user)')."
    } else {
        Write-Warning 'VS Code has no GitHub session. VS Code not saved.'
    }

    Backup-Tokens $profileName $account.user
    Write-Host "Backed up tokens for '$($account.user)'."

    # Saving marks the profile active, so gh and git must point at it too - they are not part of the snapshot.
    if ($hasGh -and [CredStore]::List("gh:github.com:$($account.user)")) {
        gh auth switch --hostname github.com --user (Get-GitHubLoginSpelling $account.user)
    } elseif ($hasGh) {
        Write-Warning "gh has no login for '$($account.user)'. Run: gh auth login --hostname github.com --web"
    }
    Set-GitIdentity $account
    Set-Content $currentFile $profileName
}

function Switch-GitHubProfile($profileName) {
    $account = Get-GitHubProfile $profileName
    $desktopSnapshot = Get-DesktopSnapshot $profileName
    $vscodeSnapshot = Get-VSCodeSnapshot $profileName
    $useDesktop = Test-Path $desktopSnapshot
    $useVSCode = $hasVSCode -and (Test-Path $vscodeSnapshot)

    Invoke-WithAppsClosed -Desktop $useDesktop -VSCode $useVSCode -Action {
        # gh before any change: it is the step most likely to fail, and failing here leaves everything untouched.
        if ($hasGh) {
            gh auth switch --hostname github.com --user (Get-GitHubLoginSpelling $account.user)
            if ($LASTEXITCODE -ne 0) {
                throw "gh has no login for '$($account.user)'. Run: gh auth login --hostname github.com --web"
            }
        } else {
            Write-Warning 'gh not found, skipping GitHub CLI switch.'
        }

        # Refresh every profile's backups before restoring, so a token overwritten below is never lost.
        foreach ($n in $names) { Backup-Tokens $n $accounts.$n.user }
        Restore-Tokens $profileName $account.user
        Set-GitIdentity $account

        if ($useDesktop) {
            if (Test-Path $desktopStorage) {
                Copy-Folder $desktopStorage (Join-Path $dataDir '_previous\Local Storage')
            }
            Copy-Folder $desktopSnapshot $desktopStorage
        } else {
            Write-Warning "No GitHub Desktop sign-in saved for '$profileName'. Save the profile while Desktop is signed in to it."
        }

        if ($useVSCode) {
            $null = Save-VSCodeSession (Join-Path $dataDir '_previous\vscode-github-auth.txt')
            Set-VSCodeSession $vscodeSnapshot
        } else {
            Write-Warning "No VS Code session saved for '$profileName'. Save the profile while VS Code is signed in to it."
        }

        Set-Content $currentFile $profileName
    }

    # GCM prompts a browser login on the next push if it has no stored token for this account.
    $gcmUsers = @(git credential-manager github list 2>$null)
    if ($gcmUsers -notcontains $account.user) {
        Write-Warning "Git Credential Manager has no saved login for '$($account.user)'. Next push will open a browser sign-in (or run: git credential-manager github login --username $($account.user))."
    }

    Write-Host "Switched GitHub to '$profileName'."
    Show-GitHubStatus
}
