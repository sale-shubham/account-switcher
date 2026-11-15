import type { ReactNode } from 'react';
import { AlertIcon } from '../icons';

export interface SwitchItem {
  key: string;
  name: string;
  detail: string;
  avatar: ReactNode;
  // Shown under the detail in amber, e.g. an expired sign-in.
  warning?: string;
}

interface Props {
  items: SwitchItem[];
  empty: string;
  onSwitch: (key: string) => void;
}

// A card's other profiles, one click each.
export function QuickSwitch({ items, empty, onSwitch }: Props) {
  return (
    <div className="quick">
      <h3 className="quick-title">Switch to</h3>
      {items.length === 0 ? (
        <p className="quick-empty">{empty}</p>
      ) : (
        <ul className="quick-list">
          {items.map((item) => (
            <li key={item.key} className="quick-item">
              {item.avatar}
              <span className="quick-who">
                <span className="quick-name">{item.name}</span>
                <span className="quick-detail">{item.detail}</span>
                {item.warning ? (
                  <span className="quick-warning">
                    <AlertIcon />
                    {item.warning}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => onSwitch(item.key)}
                aria-label={`Switch to ${item.name}`}
              >
                Switch
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
