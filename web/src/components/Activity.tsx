import type { LogLine } from '../api';

export interface ActivityEntry {
  id: number;
  at: Date;
  title: string;
  ok: boolean;
  log: LogLine[];
}

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export function Activity({ entries }: { entries: ActivityEntry[] }) {
  return (
    <section className="panel" aria-labelledby="activity-title">
      <div className="panel-head">
        <h2 id="activity-title">Activity</h2>
      </div>
      {entries.length === 0 ? (
        <p className="empty">Every action you run shows up here with what the switcher did.</p>
      ) : (
        <ol className="activity" aria-live="polite">
          {entries.map((entry, index) => (
            <li key={entry.id} className={`entry ${entry.ok ? 'entry-ok' : 'entry-failed'}`}>
              <details open={index === 0}>
                <summary>
                  <span className="entry-dot" aria-hidden="true" />
                  <span className="entry-title">{entry.title}</span>
                  <span className="entry-result">{entry.ok ? 'Done' : 'Failed'}</span>
                  <time className="entry-time" dateTime={entry.at.toISOString()}>
                    {timeFormat.format(entry.at)}
                  </time>
                </summary>
                {entry.log.length > 0 ? (
                  <ul className="log">
                    {entry.log.map((line, i) => (
                      <li key={i} className={`log-${line.level}`}>
                        {line.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
