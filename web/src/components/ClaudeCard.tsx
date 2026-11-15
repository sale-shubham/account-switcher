import type { ClaudeProfile, ClaudeStatus } from '../api';
import { AlertIcon, AssistantIcon } from '../icons';
import { expiryNote, planLabel } from '../tools';
import { Avatar } from './Avatar';
import { QuickSwitch } from './QuickSwitch';
import { ToolCard, type Tone } from './ToolCard';

interface Props {
  status: ClaudeStatus;
  onSwitch: (profile: ClaudeProfile) => void;
  onSaveCurrent: () => void;
  onDetails: () => void;
  onAdd: () => void;
}

export function ClaudeCard({ status, onSwitch, onSaveCurrent, onDetails, onAdd }: Props) {
  const { account } = status;
  const badge: { tone: Tone; text: string } = !status.installed
    ? { tone: 'off', text: 'Not installed' }
    : !account
      ? { tone: 'off', text: 'Signed out' }
      : status.activeProfile
        ? { tone: 'ok', text: 'Saved' }
        : { tone: 'warn', text: 'Not saved yet' };
  const others = status.profiles.filter((p) => p.name !== status.activeProfile);

  return (
    <ToolCard
      icon={<AssistantIcon size={22} />}
      title="Claude Code"
      subtitle="CLI and the VS Code extension"
      badge={badge}
      onDetails={onDetails}
      onAdd={onAdd}
    >
      {!status.installed ? (
        <p className="card-empty">Claude Code is not installed on this PC (no claude command found).</p>
      ) : account ? (
        <div className="current">
          <Avatar name={account.displayName || account.email} size={52} />
          <div className="current-text">
            <p className="current-name">{status.activeProfile || account.displayName || account.email}</p>
            <p className="current-id">{account.email}</p>
            <p className="current-meta">{[account.organization, planLabel(account)].filter(Boolean).join(', ')}</p>
          </div>
        </div>
      ) : (
        <p className="card-empty">Claude Code is signed out.</p>
      )}

      {account && !status.activeProfile ? (
        <div className="card-callout">
          <p>This sign-in is not saved yet. Save it to switch back to it later.</p>
          <button type="button" className="btn btn-primary btn-small" onClick={onSaveCurrent}>
            Save as profile
          </button>
        </div>
      ) : null}

      {status.sessions > 0 ? (
        <p className="card-warn">
          <AlertIcon />
          Claude Code is running ({status.sessions}). Exit it before you switch.
        </p>
      ) : null}

      {status.installed ? (
        <QuickSwitch
          items={others.map((p) => {
            const expiry = expiryNote(p);
            return {
              key: p.name,
              name: p.name,
              detail: p.email,
              avatar: <Avatar name={p.displayName || p.email} size={32} />,
              warning: expiry.expired ? expiry.text : undefined,
            };
          })}
          empty="Add another Claude account to switch between them."
          onSwitch={(key) => {
            const profile = others.find((p) => p.name === key);
            if (profile) onSwitch(profile);
          }}
        />
      ) : null}
    </ToolCard>
  );
}
