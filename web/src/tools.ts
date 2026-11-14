import type { Status, ToolKey } from './api';

export const toolOrder: ToolKey[] = ['gh', 'git', 'desktop', 'vscode'];

export const toolNames: Record<ToolKey, { name: string; detail: string }> = {
  gh: { name: 'GitHub CLI', detail: 'gh' },
  git: { name: 'Git', detail: 'Credential Manager' },
  desktop: { name: 'GitHub Desktop', detail: 'App sign-in' },
  vscode: { name: 'VS Code', detail: 'GitHub session' },
};

export type RouteState = 'ok' | 'other' | 'off';

export interface Route {
  key: ToolKey;
  state: RouteState;
  account: string;
  note: string;
}

// How each tool relates to the active account: on it, on another account, or signed out.
export function routesFor(status: Status, user: string | undefined): Route[] {
  const { gh, git, desktop, vscode } = status.tools;

  const byAccount = (key: ToolKey, account: string | null, missing: string): Route => {
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
