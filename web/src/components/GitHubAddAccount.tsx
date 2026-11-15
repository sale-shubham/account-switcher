import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { GitHubLoginState, GitHubProfile, GitHubStatus, GitHubToolKey } from '../api';
import { api, loginPattern, profilePattern } from '../api';
import { clearGitHubDraft, emptyGitHubFields, loadGitHubDraft, saveGitHubDraft, type GitHubFields } from '../draft';
import { CheckIcon, githubToolIcons } from '../icons';
import { appsHint, type Run } from '../run';
import { githubToolNames, githubToolOrder } from '../tools';
import type { ConfirmRequest } from './ConfirmDialog';
import { Drawer } from './Drawer';
import { Stepper } from './Stepper';

interface Props {
  status: GitHubStatus;
  run: Run;
  confirm: (request: ConfirmRequest) => void;
  onClose: () => void;
}

const steps = ['Account details', 'Prepare the apps', 'Sign in to each tool', 'Save profile'];

const signInHelp: Record<GitHubToolKey, string> = {
  gh: 'Opens a console and puts a one-time code on your clipboard. If it asks to authenticate Git with your GitHub credentials, answer n.',
  git: 'Opens the browser to sign Git Credential Manager in. Pushes from any tool use this login.',
  desktop: 'Opens GitHub Desktop. Choose "Sign in to GitHub.com", then approve in the browser.',
  vscode: 'Opens VS Code. Click the Accounts icon at the bottom of the left bar, sign in with GitHub, then approve in the browser.',
};

// gh and git start the sign-in themselves; Desktop and VS Code can only be opened - you sign in inside the app.
const signInLabel: Record<GitHubToolKey, string> = {
  gh: 'Sign in',
  git: 'Sign in',
  desktop: 'Open Desktop',
  vscode: 'Open VS Code',
};

// Same rules as Set-GitHubProfile: one profile per GitHub login and per email (both case-insensitive),
// because GitHub logins are unique and an email belongs to one GitHub account at a time.
function validate(fields: GitHubFields, profiles: GitHubProfile[]): Partial<Record<keyof GitHubFields, string>> {
  const errors: Partial<Record<keyof GitHubFields, string>> = {};
  const others = profiles.filter((p) => p.name.toLowerCase() !== fields.profile.toLowerCase());
  const sameUser = others.find((p) => p.user.toLowerCase() === fields.user.trim().toLowerCase());
  const sameEmail = others.find((p) => p.email.toLowerCase() === fields.email.trim().toLowerCase());
  if (!profilePattern.test(fields.profile)) errors.profile = 'Use letters, digits and "-" only, for example personal.';
  if (!loginPattern.test(fields.user)) errors.user = 'Enter the exact GitHub username, as shown on the profile page.';
  else if (sameUser) errors.user = `@${sameUser.user} already has a profile: ${sameUser.name}. Use it, or delete it first.`;
  if (!fields.gitName.trim()) errors.gitName = 'Enter the name your commits should show.';
  if (!/^[^\s@]+@[^\s@]+$/.test(fields.email)) errors.email = 'Enter the email your commits should show.';
  else if (sameEmail) errors.email = `This email is already in profile ${sameEmail.name}. GitHub links an email to one account only.`;
  return errors;
}

// Add a GitHub account: details, prepare (sign the apps out safely), sign in to each tool, save.
export function GitHubAddAccount({ status, run, confirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [restored] = useState(loadGitHubDraft);
  const [step, setStep] = useState(restored?.step ?? 0);
  const [fields, setFields] = useState<GitHubFields>(restored?.fields ?? emptyGitHubFields);
  const [touched, setTouched] = useState(false);
  const [preparedFor, setPreparedFor] = useState(restored?.preparedFor ?? '');
  const [logins, setLogins] = useState<GitHubLoginState | null>(null);
  const saved = useRef(false);

  const errors = validate(fields, status.profiles);
  const detailsValid = Object.keys(errors).length === 0;
  const replacing = status.profiles.some((p) => p.name === fields.profile);
  const activeProfile = status.profiles.find((p) => p.name === status.activeProfile);
  const prepared = preparedFor !== '' && preparedFor === fields.user;

  // Keep progress across a refresh until the profile is saved or the wizard is cancelled.
  useEffect(() => {
    if (saved.current) return;
    if (step > 0 || Object.values(fields).some((v) => v !== '')) saveGitHubDraft({ step, fields, preparedFor });
  }, [step, fields, preparedFor]);

  const cancel = () => {
    clearGitHubDraft();
    ref.current?.close();
  };

  // While the sign-in step is open, check the four tools every few seconds.
  useEffect(() => {
    if (step < 2) return;
    let cancelled = false;
    const check = () =>
      api.github
        .loginState(fields.user)
        .then((state) => !cancelled && setLogins(state))
        .catch(() => undefined);
    void check();
    if (step !== 2) return () => void (cancelled = true);
    const timer = window.setInterval(check, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [step, fields.user]);

  const set = (key: keyof GitHubFields) => (event: ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [key]: event.target.value }));

  const next = () => {
    if (step === 0 && !detailsValid) {
      setTouched(true);
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const prepare = () =>
    confirm({
      title: 'Prepare the apps?',
      body: activeProfile
        ? `The current sign-ins are saved into "${activeProfile.name}" first. Then GitHub Desktop and VS Code close, start again signed out, and reopen. Save your work in them first.`
        : 'No profile is active, so the current sign-ins are kept aside in a backup folder. Then GitHub Desktop and VS Code close, start again signed out, and reopen. Save your work in them first.',
      confirmLabel: 'Prepare apps',
      onConfirm: async () => {
        const user = fields.user;
        const result = await run('GitHub: prepare apps', { text: 'Closing GitHub Desktop and VS Code', hint: appsHint }, api.github.prepare);
        if (result?.ok) setPreparedFor(user);
      },
    });

  const save = () =>
    confirm({
      title: `Save GitHub profile "${fields.profile}"?`,
      body: `GitHub Desktop and VS Code close and reopen while their sign-ins for @${fields.user} are saved. The profile then becomes active everywhere, git included.`,
      confirmLabel: 'Save profile',
      onConfirm: async () => {
        const result = await run(`GitHub: save profile ${fields.profile}`, { text: 'Saving sign-ins', hint: appsHint }, () =>
          api.github.save(fields),
        );
        if (result?.ok) {
          saved.current = true;
          clearGitHubDraft();
          ref.current?.close();
        }
      },
    });

  const field = (key: keyof GitHubFields, label: string, hint: string, type = 'text') => {
    const error = touched ? errors[key] : undefined;
    return (
      <label className="field">
        <span className="field-label">{label}</span>
        <input
          type={type}
          value={fields[key]}
          onChange={set(key)}
          aria-invalid={error ? true : undefined}
          spellCheck={false}
          autoComplete="off"
          autoFocus={key === 'profile'}
        />
        <span className={error ? 'field-error' : 'field-hint'}>{error ?? hint}</span>
      </label>
    );
  };

  return (
    <Drawer
      title="Add a GitHub account"
      onClose={onClose}
      dialogRef={ref}
      closeLabel="Close, your progress is kept"
      head={
        <>
          <Stepper steps={steps} current={step} />
          {restored ? <p className="drawer-note">Picked up where you left off.</p> : null}
        </>
      }
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => (step === 0 ? cancel() : setStep(step - 1))}>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < steps.length - 1 ? (
            <button type="button" className={`btn ${step === 1 && !prepared ? 'btn-secondary' : 'btn-primary'}`} onClick={next}>
              {step === 1 && !prepared ? 'Skip this step' : 'Next'}
            </button>
          ) : null}
        </>
      }
    >
      {step === 0 ? (
        <div className="fields">
          {field('profile', 'Profile name', replacing ? 'A profile with this name exists. Saving replaces it.' : 'A short name you switch by, like work or personal.')}
          {field('user', 'GitHub username', 'Exactly as on github.com, for example octocat.')}
          {field('gitName', 'Name on commits', 'Sets git user.name.')}
          {field('email', 'Email on commits', 'Sets git user.email.', 'email')}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="prose">
          <p>
            Each app holds one GitHub sign-in at a time. Preparing keeps the current one safe, then starts GitHub Desktop
            and VS Code signed out so @{fields.user} can sign in.
          </p>
          <p className="callout">
            Never use <strong>Sign out</strong> inside the apps. It deletes the saved login. Preparing moves it aside
            instead.
          </p>
          {prepared ? null : (
            <p>
              Already signed in to all four tools as @{fields.user}? Skip this step. Preparing now would move those
              sign-ins aside and you would sign in again.
            </p>
          )}
          {prepared ? (
            <p className="done-line">
              <CheckIcon /> The apps are ready for @{fields.user}.
            </p>
          ) : (
            <button type="button" className="btn btn-primary" onClick={prepare}>
              Prepare apps
            </button>
          )}
        </div>
      ) : null}

      {step >= 2 ? (
        <div className="prose">
          {step === 2 ? (
            <p>
              First sign in to github.com in your browser as <strong>@{fields.user}</strong>. Every tool below signs in
              through the browser and picks up that account. This list checks itself every few seconds.
            </p>
          ) : (
            <dl className="summary">
              <dt>Profile</dt>
              <dd>{fields.profile}</dd>
              <dt>GitHub</dt>
              <dd>@{fields.user}</dd>
              <dt>Commits as</dt>
              <dd>
                {fields.gitName} &lt;{fields.email}&gt;
              </dd>
            </dl>
          )}
          <ul className="signins">
            {githubToolOrder.map((tool) => {
              const ToolIcon = githubToolIcons[tool];
              const ok = logins?.[tool];
              return (
                <li key={tool} className={`signin ${ok ? 'signin-ok' : ''}`}>
                  <span className="route-icon">
                    <ToolIcon />
                  </span>
                  <span className="signin-text">
                    <span className="route-name">{githubToolNames[tool].name}</span>
                    {step === 2 ? <span className="signin-help">{signInHelp[tool]}</span> : null}
                  </span>
                  <span className="signin-state">{logins === null ? 'Checking' : ok ? 'Signed in' : 'Not yet'}</span>
                  {step === 2 ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() =>
                        void run(
                          `GitHub: ${tool === 'gh' || tool === 'git' ? 'sign in to' : 'open'} ${githubToolNames[tool].name}`,
                          null,
                          () => api.github.signIn(tool, fields.user),
                        )
                      }
                    >
                      {signInLabel[tool]}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {step === 2 ? (
            <p className="field-hint">VS Code keeps its account encrypted, so its row only shows that a session exists.</p>
          ) : null}
          {step === 3 ? (
            <button type="button" className="btn btn-primary" onClick={save}>
              Save profile
            </button>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
