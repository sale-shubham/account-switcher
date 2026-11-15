import type { ClaudeProfile, ClaudeStatus } from '../api';
import { AlertIcon } from '../icons';
import { expiryNote, planLabel } from '../tools';
import { Avatar } from './Avatar';
import { Drawer } from './Drawer';

interface Props {
  status: ClaudeStatus;
  onSwitch: (profile: ClaudeProfile) => void;
  onDelete: (profile: ClaudeProfile) => void;
  onClose: () => void;
}

// Everything about the Claude Code side: who is signed in, what is running, and every profile.
export function ClaudeDetails({ status, onSwitch, onDelete, onClose }: Props) {
  const { account } = status;

  return (
    <Drawer title="Claude Code" onClose={onClose} wide>
      <section className="detail-section" aria-labelledby="cc-now">
        <h3 id="cc-now">Signed in now</h3>
        {account ? (
          <dl className="summary">
            <dt>Account</dt>
            <dd>{account.email}</dd>
            {account.displayName ? (
              <>
                <dt>Name</dt>
                <dd>{account.displayName}</dd>
              </>
            ) : null}
            <dt>Organization</dt>
            <dd>{account.organization || 'Unknown'}</dd>
            {account.plan ? (
              <>
                <dt>Plan</dt>
                <dd>{planLabel(account)}</dd>
              </>
            ) : null}
            <dt>Profile</dt>
            <dd>{status.activeProfile || 'Not saved yet'}</dd>
          </dl>
        ) : (
          <p className="detail-intro">{status.installed ? 'Claude Code is signed out.' : 'Claude Code is not installed.'}</p>
        )}
        {status.sessions > 0 ? (
          <p className="card-warn">
            <AlertIcon />
            {status.sessions} Claude Code process{status.sessions === 1 ? ' is' : 'es are'} running. A switch or sign-out
            waits until you exit them: type /exit in each terminal and close Claude Code in VS Code.
          </p>
        ) : null}
        {!status.python ? (
          <p className="card-warn">
            <AlertIcon />
            Python 3 was not found. The switcher needs it to update Claude Code's account file.
          </p>
        ) : null}
      </section>

      <section className="detail-section" aria-labelledby="cc-profiles">
        <h3 id="cc-profiles">Profiles</h3>
        {status.profiles.length === 0 ? (
          <p className="detail-intro">No Claude profiles yet.</p>
        ) : (
          <ul className="rows">
            {status.profiles.map((profile) => {
              const isActive = profile.name === status.activeProfile;
              const expiry = expiryNote(profile);
              const meta = [profile.organization, planLabel(profile)].filter(Boolean).join(', ');
              return (
                <li key={profile.name} className="row">
                  <Avatar name={profile.displayName || profile.email} size={40} />
                  <div className="row-who">
                    <span className="row-name">{profile.name}</span>
                    <span className="row-id">{profile.email}</span>
                    {meta ? <span className="row-meta">{meta}</span> : null}
                    {expiry.text ? (
                      <span className={expiry.expired ? 'row-warning' : 'row-meta'}>{expiry.text}</span>
                    ) : null}
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-danger-ghost btn-small"
                      onClick={() => onDelete(profile)}
                      aria-label={`Delete Claude profile ${profile.name}`}
                    >
                      Delete
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

      <section className="detail-section" aria-labelledby="cc-how">
        <h3 id="cc-how">How a switch works</h3>
        <p className="detail-intro">
          Claude Code keeps its sign-in in <code>.claude\.credentials.json</code> and the account details in{' '}
          <code>.claude.json</code> in your user folder. A switch first saves the current sign-in again (its tokens
          change every few hours), then puts the profile's sign-in in their place. The tokens stay in Windows Credential
          Manager and are never shown. The VS Code extension uses the same sign-in.
        </p>
      </section>
    </Drawer>
  );
}
