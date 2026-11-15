// Add-account wizard progress, kept in localStorage so a refresh or a closed tab does not lose it.
// Holds only what the user typed and which step they reached (no tokens). Cleared once the profile
// is saved, or on Cancel. One draft per tool.

export interface GitHubFields {
  profile: string;
  user: string;
  gitName: string;
  email: string;
}

export interface GitHubDraft {
  step: number;
  fields: GitHubFields;
  // The login the apps were prepared for; preparing again is offered when the login changes.
  preparedFor: string;
}

export interface ClaudeDraft {
  step: number;
  profile: string;
  // 'current': save what Claude Code is signed in to now. 'another': sign out, sign in, save.
  mode: 'current' | 'another';
}

const githubKey = 'switcher-add-account';
const claudeKey = 'switcher-add-claude';

export const emptyGitHubFields: GitHubFields = { profile: '', user: '', gitName: '', email: '' };

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the wizard still works, it just will not survive a refresh.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing stored to clear.
  }
}

const stepIn = (value: unknown, max: number) =>
  typeof value === 'number' && value >= 0 && value <= max ? value : 0;

export function loadGitHubDraft(): GitHubDraft | null {
  const draft = read(githubKey) as Partial<GitHubDraft> | null;
  if (!draft || typeof draft !== 'object') return null;
  const fields = { ...emptyGitHubFields, ...draft.fields };
  if (Object.values(fields).some((v) => typeof v !== 'string')) return null;
  return {
    step: stepIn(draft.step, 3),
    fields,
    preparedFor: typeof draft.preparedFor === 'string' ? draft.preparedFor : '',
  };
}

export const saveGitHubDraft = (draft: GitHubDraft) => write(githubKey, draft);
export const clearGitHubDraft = () => remove(githubKey);

export function loadClaudeDraft(): ClaudeDraft | null {
  const draft = read(claudeKey) as Partial<ClaudeDraft> | null;
  if (!draft || typeof draft !== 'object' || typeof draft.profile !== 'string') return null;
  return {
    step: stepIn(draft.step, 3),
    profile: draft.profile,
    mode: draft.mode === 'current' ? 'current' : 'another',
  };
}

export const saveClaudeDraft = (draft: ClaudeDraft) => write(claudeKey, draft);
export const clearClaudeDraft = () => remove(claudeKey);
