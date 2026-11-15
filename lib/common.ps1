# Shared by every tool: Credential Manager access (CredStore), profile names, data folders, and
# closing / reopening apps. Dot-sourced first by switcher.ps1, before the tool files (github.ps1,
# claude.ps1). Defines types, variables and functions only - runs no command.

if (-not ('CredStore' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
using FILETIME = System.Runtime.InteropServices.ComTypes.FILETIME;

public class StoredCredential {
    public string Target;
    public string User;
    public byte[] Blob;
    public int Persist;
}

public static class CredStore {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public FILETIME LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CredEnumerateW(string filter, int flags, out int count, out IntPtr creds);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CredWriteW(ref CREDENTIAL cred, int flags);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CredDeleteW(string target, int type, int flags);
    [DllImport("advapi32.dll")]
    static extern void CredFree(IntPtr buffer);

    const int CRED_TYPE_GENERIC = 1;
    const int ERROR_NOT_FOUND = 1168;

    public static StoredCredential[] List(string filter) {
        if (string.IsNullOrEmpty(filter)) filter = null;
        var result = new List<StoredCredential>();
        int count;
        IntPtr creds;
        if (!CredEnumerateW(filter, 0, out count, out creds)) {
            int err = Marshal.GetLastWin32Error();
            if (err == ERROR_NOT_FOUND) return result.ToArray();
            throw new Win32Exception(err);
        }
        try {
            for (int i = 0; i < count; i++) {
                IntPtr p = Marshal.ReadIntPtr(creds, i * IntPtr.Size);
                var c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
                if (c.Type != CRED_TYPE_GENERIC) continue;
                var blob = new byte[c.CredentialBlobSize];
                if (c.CredentialBlobSize > 0) Marshal.Copy(c.CredentialBlob, blob, 0, c.CredentialBlobSize);
                result.Add(new StoredCredential { Target = c.TargetName, User = c.UserName, Blob = blob, Persist = c.Persist });
            }
        } finally {
            CredFree(creds);
        }
        return result.ToArray();
    }

    public static void Write(string target, string user, byte[] blob, int persist) {
        var c = new CREDENTIAL();
        c.Type = CRED_TYPE_GENERIC;
        c.TargetName = target;
        c.UserName = user;
        c.Persist = persist;
        c.CredentialBlobSize = blob.Length;
        c.CredentialBlob = Marshal.AllocHGlobal(Math.Max(blob.Length, 1));
        try {
            Marshal.Copy(blob, 0, c.CredentialBlob, blob.Length);
            if (!CredWriteW(ref c, 0)) throw new Win32Exception(Marshal.GetLastWin32Error());
        } finally {
            Marshal.FreeHGlobal(c.CredentialBlob);
        }
    }

    public static void Delete(string target) {
        if (!CredDeleteW(target, CRED_TYPE_GENERIC, 0)) {
            int err = Marshal.GetLastWin32Error();
            if (err != ERROR_NOT_FOUND) throw new Win32Exception(err);
        }
    }
}
'@
}

$appRoot = Split-Path $PSScriptRoot
# Profile names become folder names and parts of Credential Manager target names, so nothing else may pass.
$profilePattern = '^[A-Za-z0-9-]+$'
# Tools added after GitHub keep their state here. GitHub keeps %LOCALAPPDATA%\github-switch (github.ps1),
# where profiles saved before this folder existed already live.
$switchDir = Join-Path $env:LOCALAPPDATA 'account-switch'
$hasPython = [bool](Get-Command python -ErrorAction SilentlyContinue)

function Test-ProfileName($profileName) {
    if ("$profileName" -notmatch $profilePattern) {
        throw "Profile name '$profileName' may only contain letters, digits and '-'."
    }
}

# Closes the app's windows the normal way, so unsaved-work prompts still apply.
# Returns the exe path if the app was running, so it can be reopened.
function Stop-App($processName, $label) {
    $procs = @(Get-Process $processName -ErrorAction SilentlyContinue)
    if (-not $procs) { return $null }
    $exe = ($procs | Where-Object Path | Select-Object -First 1).Path
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Date) -lt $deadline) {
        $procs = @(Get-Process $processName -ErrorAction SilentlyContinue)
        if (-not $procs) { return $exe }
        foreach ($p in $procs) { if ($p.MainWindowHandle -ne 0) { $null = $p.CloseMainWindow() } }
        Start-Sleep -Milliseconds 500
    }
    throw "$label did not close (unsaved changes?). Close it and retry."
}

function Start-Apps($exes) {
    foreach ($exe in $exes) { if ($exe) { Start-Process $exe } }
}

function Copy-Folder($from, $to) {
    if (Test-Path $to) { Remove-Item $to -Recurse -Force -ErrorAction Stop }
    New-Item -ItemType Directory -Force (Split-Path $to) | Out-Null
    Copy-Item $from $to -Recurse -ErrorAction Stop
}
