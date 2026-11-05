import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function StatCard({
  label,
  value,
  hint,
  to,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  to?: string;
  icon?: ReactNode;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-campus-deep/70">{label}</p>
        {icon ? <span className="icon-well !h-9 !w-9 text-campus-teal">{icon}</span> : null}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-campus-ink">{value}</p>
      {hint ? <div className="mt-1 text-xs leading-relaxed text-campus-deep/55">{hint}</div> : null}
    </>
  );

  if (to) {
    return (
      <Link to={to} className="surface-interactive stat-card block p-5">
        {inner}
      </Link>
    );
  }

  return <div className="surface stat-card p-5">{inner}</div>;
}
