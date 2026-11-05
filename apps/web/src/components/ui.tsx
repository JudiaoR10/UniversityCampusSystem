import type { ReactNode } from 'react';

export function PageBanner({ children }: { children: ReactNode }) {
  return <div className="page-banner">{children}</div>;
}

export function EmptyState({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="icon-well mx-auto mb-3 !h-12 !w-12 text-campus-teal" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
          <rect x="4.5" y="6" width="15" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="M8 10h8M8 13.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>
      <p className="font-display text-lg font-semibold text-campus-ink">{title}</p>
      {description ? <div className="mt-1 text-sm leading-relaxed text-campus-deep/70">{description}</div> : null}
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="grid min-h-[28vh] place-items-center text-sm text-campus-deep/70">
      <div className="flex flex-col items-center gap-3">
        <span className="skeleton-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        {label}
      </div>
    </div>
  );
}

export function FormField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`form-label ${className}`}>
      {label}
      {children}
    </label>
  );
}

const pillTone: Record<'success' | 'warning' | 'danger' | 'info' | 'muted', string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  muted: 'border-campus-line bg-campus-mist text-campus-deep/70',
};

export function StatusPill({
  tone = 'muted',
  children,
}: {
  tone?: keyof typeof pillTone;
  children: ReactNode;
}) {
  return <span className={`status-pill ${pillTone[tone]}`}>{children}</span>;
}

export function ChipTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  asTabs = false,
  className = '',
}: {
  items: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  asTabs?: boolean;
  className?: string;
}) {
  return (
    <div className={`chip-rail ${className}`} role={asTabs ? 'tablist' : 'navigation'} aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role={asTabs ? 'tab' : undefined}
          aria-selected={asTabs ? value === item.id : undefined}
          aria-current={!asTabs && value === item.id ? 'page' : undefined}
          className="chip-tab"
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
