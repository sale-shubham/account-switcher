import { useEffect, useRef, useState } from 'react';
import type { ClaudeStatus } from '../api';
import { api, profilePattern } from '../api';
import { clearClaudeDraft, loadClaudeDraft, saveClaudeDraft, type ClaudeDraft } from '../draft';
import { AlertIcon, CheckIcon } from '../icons';
import type { Run } from '../run';
import { planLabel } from '../tools';
import type { ConfirmRequest } from './ConfirmDialog';
import { Drawer } from './Drawer';
import { Stepper } from './Stepper';

interface Props {
  status: ClaudeStatus;
  run: Run;
  confirm: (request: ConfirmRequest) => void;
  onClose: () => void;
  // Opened from "Save as profile": start with the account signed in now.
  startWithCurrent?: boolean;
}

const stepsFor = (mode: ClaudeDraft['mode']) =>
  mode === 'current' ? ['Account', 'Save profile'] : ['Account', 'Sign out', 'Sign in', 'Save profile'];

// Add a Claude account: either save the one signed in now, or sign out safely, sign in as another, save.
export function ClaudeAddAccount({ status, run, confirm, onClose, startWithCurrent }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [restored] = useState(loadClaudeDraft);
  const unsavedNow = Boolean(status.account && !status.activeProfile);
  const [mode, setMode] = useState<ClaudeDraft['mode']>(
    restored?.mode ?? (startWithCurrent || unsavedNow ? 'current' : 'another'),
  );
  const [step, setStep] = useState(restored?.step ?? 0);
  const [profile, setProfile] = useState(restored?.profile ?? '');
  const [touched, setTouched] = useState(false);
  // Fresh status while waiting for the sign-out / sign-in; the page's status otherwise.
  const [polled, setPolled] = useState<ClaudeStatus | null>(null);
  const saved = useRef(false);

  useEffect(() => setPolled(null), [status]);
  const current = polled ?? status;
  const steps = stepsFor(mode);
  const at = Math.min(step, steps.length - 1);
  const isLast = at === steps.length - 1;
  const account = current.account;

  // A name already used by a different Claude account would be overwritten; the server refuses that too.
  const holder = current.profiles.find((p) => p.name.toLowerCase() === profile.toLowerCase());
  const nameError = !profilePattern.test(profile)
    ? 'Use letters, digits and "-" only, for example work.'
    : holder && mode === 'current' && account && holder.email !== account.email
      ? `Profile ${holder.name} already holds ${holder.email}. Pick another name, or delete it first.`
      : undefined;

  useEffect(() => {
    if (saved.current) return;
    if (at > 0 || profile !== '') saveClaudeDraft({ step: at, profile, mode });
  }, [at, profile, mode]);

  // While waiting for Claude Code to sign out or in, check every few seconds.
  useEffect(() => {
    if (mode !== 'another' || (at !== 1 && at !== 2)) return;
    let cancelled = false;
    const check = () =>
      api.claude
        .status()
        .then((next) => !cancelled && setPolled(next))
        .catch(() => undefined);
    const timer = window.setInterval(check, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [mode, at]);

  const cancel = () => {
    clearClaudeDraft();
    ref.current?.close();
  };

  const canGoOn = at === 0 ? !nameError : mode === 'another' && at === 1 ? !account : mode === 'another' && at === 2 ? Boolean(account) : true;

  const next = () => {
    if (at === 0 && nameError) {
      setTouched(true);
      return;
    }
    if (canGoOn) setStep(at + 1);
  };

  const signOut = () =>
    confirm({
      title: 'Sign Claude Code out?',
      body: account
        ? `${account.email} is saved first${current.activeProfile ? ` into "${current.activeProfile}"` : ' and kept aside (it has no profile yet)'}, then removed from Claude Code. Exit every Claude Code session first, or the sign-out stops.`
        : 'Claude Code is already signed out.',
      confirmLabel: 'Sign out',
      onConfirm: () => void run('Claude Code: sign out', { text: 'Signing Claude Code out' }, api.claude.prepare),
    });

  const save = () =>
    confirm({
      title: `Save Claude profile "${profile}"?`,
      body: `The sign-in for ${account?.email ?? 'the current account'} is copied into Windows Credential Manager. Nothing closes, and Claude Code stays signed in.`,
      confirmLabel: 'Save profile',
      onConfirm: async () => {
        const result = await run(`Claude Code: save profile ${profile}`, { text: 'Saving the Claude sign-in' }, () =>
          api.claude.save(profile),
        );
        if (result?.ok) {
          saved.current = true;
          clearClaudeDraft();
          ref.current?.close();
        }
      },
    });

  const running =
    current.sessions > 0 ? (
      <p className="card-warn">
        <AlertIcon />
        Claude Code is running ({current.sessions}). Type /exit in each session and close Claude Code in VS Code first.
      </p>
    ) : null;

  return (
    <Drawer
      title="Add a Claude account"
      onClose={onClose}
      dialogRef={ref}
      closeLabel="Close, your progress is kept"
      head={
        <>
          <Stepper steps={steps} current={at} />
          {restored ? <p className="drawer-note">Picked up where you left off.</p> : null}
        </>
      }
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => (at === 0 ? cancel() : setStep(at - 1))}>
            {at === 0 ? 'Cancel' : 'Back'}
          </button>
          {!isLast ? (
            <button type="button" className="btn btn-primary" onClick={next} disabled={at > 0 && !canGoOn}>
              Next
            </button>
          ) : null}
        </>
      }
    >
      {at === 0 ? (
        <div className="prose">
          {!current.installed ? (
            <p className="callout">Claude Code is not installed on this PC, so there is nothing to sign in to yet.</p>
          ) : unsavedNow && account ? (
            <fieldset className="choices">
              <legend className="field-label">Which account?</legend>
              <label className={`choice ${mode === 'current' ? 'choice-on' : ''}`}>
                <input type="radio" name="claude-mode" checked={mode === 'current'} onChange={() => setMode('current')} />
                <span>
                  <span className="choice-title">The account signed in now</span>
                  <span className="choice-detail">{account.email}</span>
                </span>
              </label>
              <label className={`choice ${mode === 'another' ? 'choice-on' : ''}`}>
                <input type="radio" name="claude-mode" checked={mode === 'another'} onChange={() => setMode('another')} />
                <span>
                  <span className="choice-title">Another Claude account</span>
                  <span className="choice-detail">Claude Code signs out first. The current sign-in is kept aside, not deleted.</span>
                </span>
              </label>
            </fieldset>
          ) : account ? (
            <p>
              Claude Code is signed in as <strong>{account.email}</strong>
              {current.activeProfile ? ` (profile ${current.activeProfile})` : ''}. To add another account it signs out
              first; that sign-in stays saved.
            </p>
          ) : (
            <p>Claude Code is signed out. In the next steps you sign in with the account to add.</p>
          )}
          <label className="field">
            <span className="field-label">Profile name</span>
            <input
              value={profile}
              onChange={(event) => setProfile(event.target.value)}
              aria-invalid={touched && nameError ? true : undefined}
              spellCheck={false}
              autoComplete="off"
              autoFocus
            />
            <span className={touched && nameError ? 'field-error' : 'field-hint'}>
              {touched && nameError ? nameError : 'A short name you switch by, like work or personal.'}
            </span>
          </label>
        </div>
      ) : null}

      {mode === 'another' && at === 1 ? (
        <div className="prose">
          <p>Claude Code holds one sign-in at a time. Signing out here saves the current one first, then removes it from Claude Code.</p>
          <p className="callout">
            Never use <strong>/logout</strong> or <strong>claude auth logout</strong> to switch. They end the sign-in for good;
            this keeps it.
          </p>
          {running}
          {account ? (
            <button type="button" className="btn btn-primary" onClick={signOut}>
              Sign out Claude Code
            </button>
          ) : (
            <p className="done-line">
              <CheckIcon /> Claude Code is signed out.
            </p>
          )}
        </div>
      ) : null}

      {mode === 'another' && at === 2 ? (
        <div className="prose">
          {account ? (
            <>
              <p className="done-line">
                <CheckIcon /> Signed in as {account.email}.
              </p>
              {current.activeProfile && current.activeProfile !== profile ? (
                <p className="callout">This account is already saved as {current.activeProfile}. Saving it again under another name is refused.</p>
              ) : null}
            </>
          ) : (
            <>
              <p>
                Click <strong>Sign in</strong>. A console window opens and your browser asks you to sign in to Claude: use the
                account you want to add. This page notices when you are done.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void run('Claude Code: sign in', null, api.claude.signIn)}
              >
                Sign in
              </button>
              <p className="field-hint">Waiting for the sign-in. Checked every few seconds.</p>
            </>
          )}
        </div>
      ) : null}

      {isLast ? (
        <div className="prose">
          {account ? (
            <dl className="summary">
              <dt>Profile</dt>
              <dd>{profile}</dd>
              <dt>Account</dt>
              <dd>{account.email}</dd>
              <dt>Organization</dt>
              <dd>{account.organization || 'Unknown'}</dd>
              {account.plan ? (
                <>
                  <dt>Plan</dt>
                  <dd>{planLabel(account)}</dd>
                </>
              ) : null}
            </dl>
          ) : (
            <p className="callout">Claude Code is not signed in, so there is nothing to save. Go back and sign in.</p>
          )}
          <button type="button" className="btn btn-primary" onClick={save} disabled={!account}>
            Save profile
          </button>
        </div>
      ) : null}
    </Drawer>
  );
}
