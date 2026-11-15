import { useState } from 'react';

interface Props {
  size: number;
  // A GitHub login: its public picture at github.com/<login>.png, initials if it can't load.
  github?: string;
  // Anything else (a Claude account): initials of this name.
  name?: string;
}

function initialsOf(text: string): string {
  const words = text.replace(/@.*$/, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2);
  return letters.toUpperCase() || '?';
}

export function Avatar({ size, github, name }: Props) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.36 };

  if (!github || failed) {
    return (
      <span className="avatar avatar-initials" style={style} aria-hidden="true">
        {initialsOf(github ?? name ?? '')}
      </span>
    );
  }
  return (
    <img
      className="avatar"
      style={style}
      src={`https://github.com/${encodeURIComponent(github)}.png?size=${size * 2}`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
