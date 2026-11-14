import { useState } from 'react';

// GitHub serves every account's public avatar at github.com/<login>.png; initials if it can't load.
export function Avatar({ user, size }: { user: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const initials = user.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  const style = { width: size, height: size, fontSize: size * 0.36 };

  if (failed || !user) {
    return (
      <span className="avatar avatar-initials" style={style} aria-hidden="true">
        {initials}
      </span>
    );
  }
  return (
    <img
      className="avatar"
      style={style}
      src={`https://github.com/${encodeURIComponent(user)}.png?size=${size * 2}`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
