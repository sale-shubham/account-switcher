import { useId, type ReactNode } from 'react';
import { PlusIcon } from '../icons';

export type Tone = 'ok' | 'warn' | 'off';

interface Props {
  icon: ReactNode;
  title: string;
  subtitle: string;
  badge: { tone: Tone; text: string };
  children: ReactNode;
  onDetails: () => void;
  onAdd: () => void;
}

// The frame every tool's card shares: what the tool is, how it stands, its body, and two actions.
export function ToolCard({ icon, title, subtitle, badge, children, onDetails, onAdd }: Props) {
  const titleId = useId();
  return (
    <section className="card" aria-labelledby={titleId}>
      <header className="card-head">
        <span className="card-icon">{icon}</span>
        <div className="card-title">
          <h2 id={titleId}>{title}</h2>
          <span className="card-sub">{subtitle}</span>
        </div>
        <span className={`badge badge-${badge.tone}`}>{badge.text}</span>
      </header>
      <div className="card-body">{children}</div>
      <footer className="card-foot">
        <button type="button" className="btn btn-ghost" onClick={onDetails}>
          Details
        </button>
        <button type="button" className="btn btn-secondary" onClick={onAdd}>
          <PlusIcon />
          Add account
        </button>
      </footer>
    </section>
  );
}
