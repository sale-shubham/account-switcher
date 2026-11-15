import type { CSSProperties } from 'react';
import type { GitHubProfile, GitHubStatus } from '../api';
import { CheckIcon, githubToolIcons } from '../icons';
import { githubToolNames, offAccountTools, routesFor } from '../tools';
import { Avatar } from './Avatar';
import { Drawer } from './Drawer';

interface Props {
  status: GitHubStatus;
  onSwitch: (profile: GitHubProfile) => void;
  onDelete: (profile: GitHubProfile) => void;
  onRepair: (profile: GitHubProfile) => void;
  onClose: () => void;
}

function Saved({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`saved ${ok ? 'saved-ok' : 'saved-missing'}`}>
      {ok ? <CheckIcon /> : <span className="saved-dash" aria-hidden="true" />}
      {label}
      <span className="visually-hidden">{ok ? ' saved' : ' not saved'}</span>
    </span>
  );
}

// Everything about the GitHub side: which account each tool uses, and every profile.
export function GitHubDetails({ status, onSwitch, onDelete, onRepair, onClose }: Props) {
  const active = status.profiles.find((p) => p.name === status.activeProfile);
  const routes = routesFor(status, active?.user);
  const offTools = active ? offAccountTools(status, routes) : '';

  return (
    <Drawer title="GitHub" onClose={onClose} wide>
      <section className="detail-section" aria-labelledby="gh-tools">
        <h3 id="gh-tools">Tools</h3>
        <p className="detail-intro">
          {active ? (
            <>
              Active profile <strong>{active.name}</strong> (@{active.user}). Commits as {status.git.name ?? 'nobody'}
              {status.git.email ? ` <${status.git.email}>` : ''}.
            </>
          ) : (
            'No profile is active.'
          )}
        </p>
        <ul className="routes">
          {routes.map((route, i) => {
            const ToolIcon = githubToolIcons[route.key];
            return (
              <li key={route.key} className={`route route-${route.state}`} style={{ '--i': i } as CSSProperties}>
                <span className="route-icon">
                  <ToolIcon />
                </span>
                <span className="route-tool">
                  <span className="route-name">{githubToolNames[route.key].name}</span>
                  <span className="route-detail">{githubToolNames[route.key].detail}</span>
                </span>
                <span className="route-account">
                  {route.account ? <span className="route-login">@{route.account}</span> : null}
                  <span className="route-note">{route.note}</span>
                </span>
              </li>
            );
          })}
        </ul>
        {active && offTools ? (
          <div className="card-callout detail-callout">
            <p>
              {offTools} not use <span className="nowrap">@{active.user}</span>. Sign in to them again and save the
              profile.
            </p>
            <button type="button" className="btn btn-primary btn-small" onClick={() => onRepair(active)}>
              Sign in again
            </button>
          </div>
        ) : null}
      </section>

      <section className="detail-section" aria-labelledby="gh-profiles">
        <h3 id="gh-profiles">Profiles</h3>
        {status.profiles.length === 0 ? (
          <p className="detail-intro">No GitHub profiles yet.</p>
        ) : (
          <ul className="rows">
            {status.profiles.map((profile) => {
              const isActive = profile.name === status.activeProfile;
              return (
                <li key={profile.name} className="row">
                  <Avatar github={profile.user} size={40} />
                  <div className="row-who">
                    <span className="row-name">{profile.name}</span>
                    <span className="row-id">@{profile.user}</span>
                    <span className="row-meta">
                      {profile.gitName} &lt;{profile.email}&gt;
                    </span>
                    <span className="row-saved" title="Sign-ins saved in this profile">
                      <Saved ok={profile.desktopSaved} label="Desktop" />
                      <Saved ok={profile.vscodeSaved} label="VS Code" />
                    </span>
                  </div>
                  <div className="row-actions">
                    {isActive ? null : (
                      <button
                        type="button"
                        className="btn btn-danger-ghost btn-small"
                        onClick={() => onDelete(profile)}
                        aria-label={`Delete GitHub profile ${profile.name}`}
                      >
                        Delete
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => onRepair(profile)}
                      aria-label={`Sign in again to GitHub profile ${profile.name}`}
                    >
                      Sign in again
                    </button>
                    {isActive ? (
                      <span className="pill pill-active">Active</span>
                    ) : (
                      <button type="button" className="btn btn-secondary btn-small" onClick={() => onSwitch(profile)}>
                        Switch
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Drawer>
  );
}
