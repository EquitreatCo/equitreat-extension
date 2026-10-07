import type { ReactElement } from 'react';

interface IconProps {
  readonly size?: number;
  readonly className?: string;
}

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...(className ? { className } : {}),
});

export const IconCheck = ({ size = 16, className }: IconProps): ReactElement => (
  <svg {...base(size, className ? `check ${className}` : 'check')}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

export const IconArrow = ({ size = 16, className }: IconProps): ReactElement => (
  <svg {...base(size, className)}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const IconRefresh = ({ size = 14, className }: IconProps): ReactElement => (
  <svg {...base(size, className)}>
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 4v5h-5" />
  </svg>
);

export const IconWallet = ({ size = 16, className }: IconProps): ReactElement => (
  <svg {...base(size, className)}>
    <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2H5a2 2 0 0 0-2 2z" />
    <path d="M3 10v7a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H5" />
    <circle cx="16.5" cy="14.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconMail = ({ size = 16, className }: IconProps): ReactElement => (
  <svg {...base(size, className)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 8l9 6 9-6" />
  </svg>
);

export const IconGoogle = ({ size = 18 }: IconProps): ReactElement => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.7-5.5 3.7-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z" />
  </svg>
);

export const IconSparkle = ({ size = 18, className }: IconProps): ReactElement => (
  <svg {...base(size, className)}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
  </svg>
);

export const IconClock = ({ size = 12, className }: IconProps): ReactElement => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconAlert = ({ size = 14, className }: IconProps): ReactElement => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </svg>
);

export const IconBag = ({ size = 20, className }: IconProps): ReactElement => (
  <svg {...base(size, className)}>
    <path d="M6 8h12l-1 12H7z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);
