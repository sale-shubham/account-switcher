import type { GitHubProfile, GitHubStatus } from '../api';
import { BranchIcon, githubToolIcons } from '../icons';
import { githubToolNames, offAccountTools, routesFor } from '../tools';
import { Avatar } from './Avatar';
import { QuickSwitch } from './QuickSwitch';
import { ToolCard, type Tone } from './ToolCard';

interface Props {
  status: GitHubStatus;
  onSwitch: (profile: GitHubProfile) => void;
  onRepair: (profile: GitHubProfile) => void;
  onDetails: () => void;
  onAdd: () => void;
}

export function GitHubCard({ status, onSwitch, onRepair, onDetails, onAdd }: Props) {
  const active = status.profiles.find((p) => p.name === status.activeProfile);
  const routes = routesFor(status, active?.user);
  const offTools = active ? offAccountTools(status, routes) : '';
  const linked = routes.filter((r) => r.state === 'ok').length;
  const badge: { tone: Tone; text: string } = !active
    ? { tone: 'off', text: 'No active profile' }
    : linked === routes.length
      ? { tone: 'ok', text: `All ${routes.length} tools linked` }
      : { tone: 'warn', text: `${linked} of ${routes.length} tools linked` };
  const others = status.profiles.filter((p) => p.name !== status.activeProfile);

  return (
    <ToolCard
      icon={<BranchIcon size={22} />}
      title="GitHub"
      subtitle="GitHub CLI, Git, GitHub Desktop, VS Code"
      badge={badge}
      onDetails={onDetails}
      onAdd={onAdd}
    >
      {active ? (
        <div className="current">
          <Avatar github={active.user} size={52} />
          <div className="current-text">
            <p className="current-name">{active.name}</p>
            <p className="current-id">@{active.user}</p>
            <p className="current-meta">
              Commits as {status.git.name ?? 'nobody'}
              {status.git.email ? <span> &lt;{status.git.email}&gt;</span> : null}
            </p>
          </div>
        </div>
      ) : (
        <p className="card-empty">No GitHub profile is active. Add an account to start.</p>
      )}

      <ul className="chips" aria-label="Each GitHub tool and its account">
        {routes.map((route) => {
          const ToolIcon = githubToolIcons[route.key];
          return (
            <li key={route.key} className={`chip chip-${route.state}`} title={`${githubToolNames[route.key].name}: ${route.note}`}>
              <ToolIcon />
              <span>{githubToolNames[route.key].name}</span>
              <span className="visually-hidden">: {route.note}</span>
            </li>
          );
        })}
      </ul>

      {active && offTools ? (
        <div className="card-callout">
          <p>
            {offTools} not use <span className="nowrap">@{active.user}</span>.
          </p>
          <button type="button" className="btn btn-primary btn-small" onClick={() => onRepair(active)}>
            Sign in again
          </button>
        </div>
      ) : null}

      <QuickSwitch
        items={others.map((p) => ({
          key: p.name,
          name: p.name,
          detail: `@${p.user}`,
          avatar: <Avatar github={p.user} size={32} />,
        }))}
        empty="Add another GitHub account to switch between them."
        onSwitch={(key) => {
          const profile = others.find((p) => p.name === key);
          if (profile) onSwitch(profile);
        }}
      />
    </ToolCard>
  );
}
