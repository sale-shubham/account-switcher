import type { ClaudeAccount, ClaudeProfile, GitHubStatus, GitHubToolKey } from './api';

export const githubToolOrder: GitHubToolKey[] = ['gh', 'git', 'desktop', 'vscode'];

export const githubToolNames: Record<GitHubToolKey, { name: string; detail: string }> = {
  gh: { name: 'GitHub CLI', detail: 'gh' },
  git: { name: 'Git', detail: 'Credential Manager' },
  desktop: { name: 'GitHub Desktop', detail: 'App sign-in' },
  vscode: { name: 'VS Code', detail: 'GitHub session' },
};

export type RouteState = 'ok' | 'other' | 'off';

export interface Route {
  key: GitHubToolKey;
  state: RouteState;
  account: string;
  note: string;
}

// How each GitHub tool relates to the active account: on it, on another account, or signed out.
export function routesFor(status: GitHubStatus, user: string | undefined): Route[] {
  const { gh, git, desktop, vscode } = status.tools;

  const byAccount = (key: GitHubToolKey, account: string | null, missing: string): Route => {
    if (!account) return { key, state: 'off', account: '', note: missing };
    if (account === user) return { key, state: 'ok', account, note: 'Uses this account' };
    return { key, state: 'other', account, note: 'Uses another account' };
  };

  const ghRoute = gh.installed
    ? byAccount('gh', gh.account, 'Not signed in')
    : { key: 'gh' as const, state: 'off' as const, account: '', note: 'Not installed' };

  let gitRoute = byAccount('git', git.account, 'No default account');
  if (gitRoute.state === 'ok' && !git.signedIn) {
    gitRoute = { ...gitRoute, state: 'other', note: 'No saved login, next push asks' };
  }

  const vscodeRoute: Route = !vscode.installed
    ? { key: 'vscode', state: 'off', account: '', note: 'VS Code or Python not found' }
    : vscode.session
      ? { key: 'vscode', state: 'ok', account: '', note: 'Signed in (VS Code hides which account)' }
      : { key: 'vscode', state: 'off', account: '', note: 'Not signed in' };

  return [ghRoute, gitRoute, byAccount('desktop', desktop.account, 'Not signed in'), vscodeRoute];
}

// "max" + "default_claude_max_20x" -> "Max 20x". Unknown plans show as stored, capitalized.
export function planLabel(account: Pick<ClaudeAccount, 'plan' | 'tier'>): string {
  if (!account.plan) return '';
  const name = account.plan.charAt(0).toUpperCase() + account.plan.slice(1);
  const multiple = /(\d+x)\b/.exec(account.tier)?.[1];
  return multiple && account.plan === 'max' ? `${name} ${multiple}` : name;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// A saved Claude sign-in works until its refresh token expires; after that the account signs in again.
export function expiryNote(profile: ClaudeProfile): { expired: boolean; text: string } {
  if (!profile.saved) return { expired: true, text: 'No saved sign-in' };
  if (!profile.expires) return { expired: false, text: '' };
  const at = new Date(profile.expires);
  if (at.getTime() < Date.now()) return { expired: true, text: 'Sign-in expired, add it again' };
  return { expired: false, text: `Sign-in valid until ${dateFormat.format(at)}` };
}
