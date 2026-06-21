import type { ReactNode } from 'react';
import type { PanelIconKind } from './panelIconUtils';

const iconClass = 'h-4 w-4';

export function PanelIcon({ kind, className = iconClass }: { kind: PanelIconKind; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (kind === 'camera') {
    return (
      <svg {...common}>
        <path d="M4 7.5h3l1.35-2h4.3l1.35 2h6a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5V9A1.5 1.5 0 0 1 4 7.5Z" />
        <circle cx="12" cy="13" r="3.3" />
        <path d="M18.5 10.2h.01" />
      </svg>
    );
  }

  if (kind === 'pointLight') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3.3" />
        <path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5" />
      </svg>
    );
  }

  if (kind === 'spotLight') {
    return (
      <svg {...common}>
        <path d="M5.5 7.2 12 4l6.5 3.2-3.2 4.1H8.7L5.5 7.2Z" />
        <path d="m9 11.3-2.3 8M15 11.3l2.3 8M8.5 16.5h7" />
        <path d="M9.2 7.4h5.6" />
      </svg>
    );
  }

  if (kind === 'directionalLight') {
    return (
      <svg {...common}>
        <circle cx="7" cy="7" r="2.8" />
        <path d="M12.5 6.5h7M15.8 3.2l3.7 3.3-3.7 3.3M10.5 13h7M13.8 9.7l3.7 3.3-3.7 3.3M8.5 19.5h7M11.8 16.2l3.7 3.3-3.7 3.3" />
      </svg>
    );
  }

  if (kind === 'calibration') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="1.5" />
        <path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16" />
        <path d="M4 4h5.3v5.3H4zM14.7 9.3H20v5.4h-5.3zM9.3 14.7h5.4V20H9.3z" fill="currentColor" stroke="none" opacity="0.35" />
      </svg>
    );
  }

  if (kind === 'composite') {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="7" height="7" rx="1" />
        <rect x="13.5" y="5" width="7" height="7" rx="1" />
        <rect x="8.5" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 3.5 20 8l-8 4.5L4 8l8-4.5Z" />
      <path d="M4 8v8l8 4.5 8-4.5V8M12 12.5v8" />
    </svg>
  );
}

export function IconFrame({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] text-[var(--color-accent)]">
      {children}
    </span>
  );
}
