import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ClaudeProfile, GitHubProfile, Status } from './api';
import { api, hasToken } from './api';
import { Activity, type ActivityEntry } from './components/Activity';
import { ClaudeAddAccount } from './components/ClaudeAddAccount';
import { ClaudeCard } from './components/ClaudeCard';
import { ClaudeDetails } from './components/ClaudeDetails';
import { ConfirmDialog, type ConfirmRequest } from './components/ConfirmDialog';
import { GitHubAddAccount } from './components/GitHubAddAccount';
import { GitHubCard } from './components/GitHubCard';
import { GitHubDetails } from './components/GitHubDetails';
import { loadClaudeDraft, loadGitHubDraft } from './draft';
import { BrandMark, RefreshIcon } from './icons';
import { appsHint, type Busy, type Run } from './run';

type ToolId = 'github' | 'claude';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Shown while an action runs. A modal <dialog> so it also covers an open drawer.
function BusyDialog({ busy }: { busy: Busy | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (busy && !dialog.open) dialog.showModal();
    if (!busy && dialog.open) dialog.close();
  }, [busy]);
  return (
    <dialog ref={ref} className="busy" onCancel={(event) => event.preventDefault()} aria-live="assertive">
      <span className="spinner" aria-hidden="true" />
      <p className="busy-text">{busy?.text}</p>
      {busy?.hint ? <p className="busy-hint">{busy.hint}</p> : null}
    </dialog>
  );
}

function Gate({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="gate">
      <BrandMark />
      <h1>{title}</h1>
      {children}
    </main>
  );
}

// An unfinished add-account wizard (saved in localStorage) reopens after a refresh.
function draftTool(): ToolId | null {
  if (loadGitHubDraft()) return 'github';
  if (loadClaudeDraft()) return 'claude';
  return null;
}

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [adding, setAdding] = useState<ToolId | null>(draftTool);
  const [savingCurrent, setSavingCurrent] = useState(false);
  const [details, setDetails] = useState<ToolId | null>(null);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const nextId = useRef(1);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setStatus(await api.status());
      setLoadError(null);
    } catch (error) {
      setLoadError(messageOf(error));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (hasToken) void refresh();
  }, [refresh]);

  const run: Run = useCallback(
    async (title, busyState, action) => {
      if (busyState) setBusy(busyState);
      const record = (ok: boolean, log: ActivityEntry['log']) =>
        setEntries((list) => [{ id: nextId.current++, at: new Date(), title, ok, log }, ...list].slice(0, 30));
      try {
        const result = await action();
        record(result.ok, result.log);
        return result;
      } catch (error) {
        record(false, [{ level: 'error', text: messageOf(error) }]);
        return null;
      } finally {
        setBusy(null);
        void refresh();
      }
    },
    [refresh],
  );

  const switchGitHub = (profile: GitHubProfile) => {
    const closesApps = profile.desktopSaved || profile.vscodeSaved;
    setConfirmRequest({
      title: `Switch GitHub to ${profile.name}?`,
      body: closesApps
        ? `GitHub CLI, git, GitHub Desktop and VS Code all move to @${profile.user}. Desktop and VS Code close and reopen, so save your work in them first.`
        : `GitHub CLI and git move to @${profile.user}. This profile has no saved Desktop or VS Code sign-in, so those apps stay as they are.`,
      confirmLabel: 'Switch',
      onConfirm: () =>
        void run(`GitHub: switch to ${profile.name}`, { text: `Switching GitHub to ${profile.name}`, hint: appsHint }, () =>
          api.github.switchTo(profile.name),
        ),
    });
  };

  const deleteGitHub = (profile: GitHubProfile) =>
    setConfirmRequest({
      title: `Delete GitHub profile ${profile.name}?`,
      body: `The switcher forgets ${profile.name}: its saved Desktop and VS Code sign-ins and its token backups. The GitHub account @${profile.user} and whatever the apps are signed in to right now are not touched. Nothing closes.`,
      confirmLabel: 'Delete profile',
      onConfirm: () => void run(`GitHub: delete profile ${profile.name}`, null, () => api.github.remove(profile.name)),
    });

  const switchClaude = (profile: ClaudeProfile) =>
    setConfirmRequest({
      title: `Switch Claude Code to ${profile.name}?`,
      body: `Claude Code signs in as ${profile.email}. Exit every Claude Code session first (type /exit, and close Claude Code in VS Code): the switch stops if one is still running. The current sign-in is saved before it is replaced.`,
      confirmLabel: 'Switch',
      onConfirm: () =>
        void run(`Claude Code: switch to ${profile.name}`, { text: `Switching Claude Code to ${profile.name}` }, () =>
          api.claude.switchTo(profile.name),
        ),
    });

  const deleteClaude = (profile: ClaudeProfile) =>
    setConfirmRequest({
      title: `Delete Claude profile ${profile.name}?`,
      body: `The switcher forgets the sign-in it saved for ${profile.email}. The Claude account itself and what Claude Code is signed in to right now are not touched.`,
      confirmLabel: 'Delete profile',
      onConfirm: () => void run(`Claude Code: delete profile ${profile.name}`, null, () => api.claude.remove(profile.name)),
    });

  const openAdd = (tool: ToolId, current = false) => {
    setDetails(null);
    setSavingCurrent(current);
    setAdding(tool);
  };

  if (!hasToken) {
    return (
      <Gate title="Open the switcher from PowerShell">
        <p>
          This page only works with the one-time link the switcher prints. In the project folder, run{' '}
          <code>.\switcher.ps1 -Ui</code> and it opens the page for you.
        </p>
      </Gate>
    );
  }

  if (!status) {
    return (
      <Gate title={loadError ? 'Cannot reach the switcher' : 'Reading your sign-ins'}>
        {loadError ? (
          <>
            <p>{loadError}</p>
            <button type="button" className="btn btn-primary" onClick={() => void refresh()}>
              Try again
            </button>
          </>
        ) : (
          <span className="spinner" aria-label="Loading" />
        )}
      </Gate>
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <BrandMark />
          <span className="brand-name">Account Switcher</span>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void refresh()} aria-busy={refreshing}>
          <span className={refreshing ? 'spin' : ''}>
            <RefreshIcon />
          </span>
          Refresh
        </button>
      </header>

      <main className="page">
        {loadError ? (
          <p className="banner" role="alert">
            {loadError}
          </p>
        ) : null}
        <div className="cards">
          <GitHubCard
            status={status.github}
            onSwitch={switchGitHub}
            onDetails={() => setDetails('github')}
            onAdd={() => openAdd('github')}
          />
          <ClaudeCard
            status={status.claude}
            onSwitch={switchClaude}
            onSaveCurrent={() => openAdd('claude', true)}
            onDetails={() => setDetails('claude')}
            onAdd={() => openAdd('claude')}
          />
        </div>
        <Activity entries={entries} />
      </main>

      <footer className="footer">
        Runs only on this PC. Each tool's accounts switch on their own. Tokens stay in Windows Credential Manager and are
        never shown here.
      </footer>

      {details === 'github' ? (
        <GitHubDetails status={status.github} onSwitch={switchGitHub} onDelete={deleteGitHub} onClose={() => setDetails(null)} />
      ) : null}
      {details === 'claude' ? (
        <ClaudeDetails status={status.claude} onSwitch={switchClaude} onDelete={deleteClaude} onClose={() => setDetails(null)} />
      ) : null}
      {adding === 'github' ? (
        <GitHubAddAccount status={status.github} run={run} confirm={setConfirmRequest} onClose={() => setAdding(null)} />
      ) : null}
      {adding === 'claude' ? (
        <ClaudeAddAccount
          status={status.claude}
          run={run}
          confirm={setConfirmRequest}
          onClose={() => setAdding(null)}
          startWithCurrent={savingCurrent}
        />
      ) : null}
      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
      <BusyDialog busy={busy} />
    </>
  );
}
