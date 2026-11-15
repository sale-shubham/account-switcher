import type { ReactNode } from 'react';
import type { GitHubToolKey } from './api';

function Icon({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const TerminalIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="m7 9 3 3-3 3M12.5 15H17" />
  </Icon>
);

export const BranchIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="6" cy="5.5" r="2" />
    <circle cx="6" cy="18.5" r="2" />
    <circle cx="18" cy="8" r="2" />
    <path d="M6 7.5v9M18 10c0 4-4 4.5-10.5 7" />
  </Icon>
);

export const DesktopIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M9 20h6M12 16v4" />
  </Icon>
);

export const EditorIcon = () => (
  <Icon>
    <path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13" />
  </Icon>
);

// Claude Code: a terminal prompt with a spark, not any company's logo.
export const AssistantIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="m6.5 9.5 2.5 2.5-2.5 2.5M16 8.5v5M13.5 11h5M14.2 9.2l3.6 3.6M17.8 9.2l-3.6 3.6" />
  </Icon>
);

export const PlusIcon = () => (
  <Icon size={18}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const RefreshIcon = () => (
  <Icon size={18}>
    <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4.5h-4.5" />
  </Icon>
);

export const CheckIcon = () => (
  <Icon size={16}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon size={18}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

export const AlertIcon = () => (
  <Icon size={16}>
    <path d="M12 4 2.8 19.5h18.4L12 4ZM12 10v4.5M12 17.2v.3" />
  </Icon>
);

export const BrandMark = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="var(--accent)" />
    <circle cx="9" cy="16" r="3.5" fill="var(--on-accent)" />
    <path
      d="M12.5 16h4M16.5 9v14M16.5 9h3.5M16.5 16h3.5M16.5 23h3.5"
      stroke="var(--on-accent)"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="23" cy="9" r="2" fill="var(--on-accent)" />
    <circle cx="23" cy="16" r="2" fill="var(--on-accent)" />
    <circle cx="23" cy="23" r="2" fill="var(--on-accent)" />
  </svg>
);

export const githubToolIcons: Record<GitHubToolKey, () => JSX.Element> = {
  gh: TerminalIcon,
  git: () => <BranchIcon />,
  desktop: DesktopIcon,
  vscode: EditorIcon,
};
