import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { ActionResult, LoginState, Status, ToolKey } from '../api';
import { api, loginPattern, profilePattern } from '../api';
import { CheckIcon, CloseIcon, toolIcons } from '../icons';
import { toolNames, toolOrder } from '../tools';
import type { ConfirmRequest } from './ConfirmDialog';

type Run = (title: string, busyText: string | null, action: () => Promise<ActionResult>) => Promise<ActionResult | null>;

interface Props {
  status: Status;
  run: Run;
  confirm: (request: ConfirmRequest) => void;
  onClose: () => void;
}

const steps = ['Account details', 'Prepare the apps', 'Sign in to each tool', 'Save profile'];

const signInHelp: Record<ToolKey, string> = {
  gh: 'Opens a console and puts a one-time code on your clipboard. If it asks to authenticate Git with your GitHub credentials, answer n.',
  git: 'Opens the browser to sign Git Credential Manager in. Pushes from any tool use this login.',
  desktop: 'Opens GitHub Desktop. Choose "Sign in to GitHub.com".',
  vscode: 'Opens VS Code. Use the Accounts icon (bottom left), then "Sign in with GitHub".',
};

interface Fields {
  profile: string;
  user: string;
  gitName: string;
  email: string;
}

function validate(fields: Fields): Partial<Record<keyof Fields, string>> {
  const errors: Partial<Record<keyof Fields, string>> = {};
  if (!profilePattern.test(fields.profile)) errors.profile = 'Use letters, digits and "-" only, for example personal.';
  if (!loginPattern.test(fields.user)) errors.user = 'Enter the exact GitHub username, as shown on the profile page.';
  if (!fields.gitName.trim()) errors.gitName = 'Enter the name your commits should show.';
  if (!/^[^\s@]+@[^\s@]+$/.test(fields.email)) errors.email = 'Enter the email your commits should show.';
  return errors;
}

// Add-account wizard: details, prepare (sign the apps out safely), sign in to each tool, save.
export function AddAccount({ status, run, confirm, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState<Fields>({ profile: '', user: '', gitName: '', email: '' });
  const [touched, setTouched] = useState(false);
  const [prepared, setPrepared] = useState(false);
  const [logins, setLogins] = useState<LoginState | null>(null);

  const errors = validate(fields);
  const detailsValid = Object.keys(errors).length === 0;
  const replacing = status.profiles.some((p) => p.name === fields.profile);
  const activeProfile = status.profiles.find((p) => p.name === status.activeProfile);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // While the sign-in step is open, check the four tools every few seconds.
  useEffect(() => {
    if (step < 2) return;
    let cancelled = false;
    const check = () =>
      api
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

  const set = (key: keyof Fields) => (event: ChangeEvent<HTMLInputElement>) =>
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
        const result = await run('Prepare apps', 'Closing GitHub Desktop and VS Code', api.prepare);
        if (result?.ok) setPrepared(true);
      },
    });

  const save = () =>
    confirm({
      title: `Save profile "${fields.profile}"?`,
      body: `GitHub Desktop and VS Code close and reopen while their sign-ins for @${fields.user} are saved. The profile then becomes active everywhere, git included.`,
      confirmLabel: 'Save profile',
      onConfirm: async () => {
        const result = await run(`Save profile ${fields.profile}`, 'Saving sign-ins', () => api.save(fields));
        if (result?.ok) ref.current?.close();
      },
    });

  const field = (key: keyof Fields, label: string, hint: string, type = 'text') => {
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
    <dialog ref={ref} className="drawer" onClose={onClose} aria-labelledby="add-title">
      <header className="drawer-head">
        <h2 id="add-title">Add an account</h2>
        <button type="button" className="btn btn-icon" onClick={() => ref.current?.close()} aria-label="Close">
          <CloseIcon />
        </button>
      </header>

      <ol className="stepper">
        {steps.map((label, i) => (
          <li key={label} className={i === step ? 'step-current' : i < step ? 'step-done' : ''}>
            <span className="step-mark">{i < step ? <CheckIcon /> : i + 1}</span>
            <span className="step-label">{label}</span>
          </li>
        ))}
      </ol>

      <div className="drawer-body">
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
              Each app holds one GitHub sign-in at a time. Preparing keeps the current one safe, then starts GitHub
              Desktop and VS Code signed out so @{fields.user} can sign in.
            </p>
            <p className="callout">
              Never use <strong>Sign out</strong> inside the apps. It deletes the saved login. Preparing moves it aside
              instead.
            </p>
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
                First sign in to github.com in your browser as <strong>@{fields.user}</strong>. Every tool below signs
                in through the browser and picks up that account. This list checks itself every few seconds.
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
              {toolOrder.map((tool) => {
                const ToolIcon = toolIcons[tool];
                const ok = logins?.[tool];
                return (
                  <li key={tool} className={`signin ${ok ? 'signin-ok' : ''}`}>
                    <span className="route-icon">
                      <ToolIcon />
                    </span>
                    <span className="signin-text">
                      <span className="route-name">{toolNames[tool].name}</span>
                      {step === 2 ? <span className="signin-help">{signInHelp[tool]}</span> : null}
                    </span>
                    <span className="signin-state">
                      {logins === null ? 'Checking' : ok ? 'Signed in' : 'Not yet'}
                    </span>
                    {step === 2 ? (
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() =>
                          void run(`Sign in to ${toolNames[tool].name}`, null, () => api.signIn(tool, fields.user))
                        }
                      >
                        Sign in
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
      </div>

      <footer className="drawer-foot">
        <button type="button" className="btn btn-ghost" onClick={() => (step === 0 ? ref.current?.close() : setStep(step - 1))}>
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < steps.length - 1 ? (
          <button type="button" className={`btn ${step === 1 && !prepared ? 'btn-secondary' : 'btn-primary'}`} onClick={next}>
            {step === 1 && !prepared ? 'Skip, apps are signed out' : 'Next'}
          </button>
        ) : null}
      </footer>
    </dialog>
  );
}
