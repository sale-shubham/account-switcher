// Typed client for the PowerShell server's JSON API (lib/ui-server.ps1).

export type GitHubToolKey = 'gh' | 'git' | 'desktop' | 'vscode';

export interface GitHubProfile {
  name: string;
  gitName: string;
  email: string;
  user: string;
  desktopSaved: boolean;
  vscodeSaved: boolean;
}

export interface GitHubStatus {
  activeProfile: string;
  git: { name: string | null; email: string | null };
  tools: {
    gh: { installed: boolean; account: string | null };
    git: { account: string | null; signedIn: boolean };
    desktop: { account: string | null };
    vscode: { installed: boolean; session: boolean };
  };
  profiles: GitHubProfile[];
}

export interface ClaudeAccount {
  email: string;
  displayName: string;
  organization: string;
  plan: string;
  tier: string;
}

export interface ClaudeProfile {
  name: string;
  email: string;
  displayName: string;
  organization: string;
  plan: string;
  tier: string;
  // When the saved sign-in stops working (ISO date), or null if unknown.
  expires: string | null;
  saved: boolean;
}

export interface ClaudeStatus {
  installed: boolean;
  python: boolean;
  // Claude Code processes running now; a switch or sign-out needs 0.
  sessions: number;
  account: ClaudeAccount | null;
  activeProfile: string;
  profiles: ClaudeProfile[];
}

// One key per tool. A new tool adds a key here, a card in App.tsx and its routes in ui-server.ps1.
export interface Status {
  github: GitHubStatus;
  claude: ClaudeStatus;
}

// Whether each tool is ready for the login being added (the same tests saving uses), and the account
// gh, git and Desktop use right now (null when signed out). VS Code hides its account.
export type GitHubLoginState = Record<GitHubToolKey, boolean> & {
  now: { gh: string | null; git: string | null; desktop: string | null };
};

export interface LogLine {
  level: 'info' | 'warn' | 'error';
  text: string;
}

export interface ActionResult {
  ok: boolean;
  log: LogLine[];
}

export interface NewGitHubProfile {
  profile: string;
  user: string;
  gitName: string;
  email: string;
}

const tokenKey = 'switcher-token';

// The server opens this page with ?t=<token>. Keep it for reloads, then drop it from the address bar.
function readToken(): string {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('t');
  if (fromUrl) {
    try {
      sessionStorage.setItem(tokenKey, fromUrl);
    } catch {
      // Storage can be blocked; the token still works until the page reloads.
    }
    params.delete('t');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
    return fromUrl;
  }
  try {
    return sessionStorage.getItem(tokenKey) ?? '';
  } catch {
    return '';
  }
}

const token = readToken();
export const hasToken = token !== '';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-Switcher-Token': token },
    });
  } catch {
    throw new ApiError('The switcher is not running. Start it with .\\switcher.ps1 -Ui and open the link it prints.', 0);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error ?? `The switcher answered ${response.status}.`, response.status);
  }
  return body as T;
}

function post(path: string, body: object = {}): Promise<ActionResult> {
  return request<ActionResult>(path, { method: 'POST', body: JSON.stringify(body) });
}

export const api = {
  status: () => request<Status>('/api/status'),
  github: {
    loginState: (user: string) => request<GitHubLoginState>(`/api/github/login-state?user=${encodeURIComponent(user)}`),
    prepare: () => post('/api/github/prepare'),
    signIn: (tool: GitHubToolKey, user: string) => post('/api/github/signin', { tool, user }),
    save: (profile: NewGitHubProfile) => post('/api/github/save', profile),
    switchTo: (profile: string) => post('/api/github/switch', { profile }),
    // signOut: also sign the account out of gh and Git Credential Manager on this PC.
    remove: (profile: string, signOut: boolean) => post('/api/github/delete', { profile, signOut }),
  },
  claude: {
    // Local files only (no network), cheap enough to poll while waiting for a sign-in.
    status: () => request<ClaudeStatus>('/api/claude/status'),
    prepare: () => post('/api/claude/prepare'),
    signIn: () => post('/api/claude/signin'),
    save: (profile: string) => post('/api/claude/save', { profile }),
    switchTo: (profile: string) => post('/api/claude/switch', { profile }),
    remove: (profile: string) => post('/api/claude/delete', { profile }),
  },
};

export const loginPattern = /^[A-Za-z0-9-]{1,39}$/;
export const profilePattern = /^[A-Za-z0-9-]+$/;
