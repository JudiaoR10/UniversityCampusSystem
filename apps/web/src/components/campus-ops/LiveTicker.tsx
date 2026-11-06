import type { DashboardSummary } from '@smart-campus/shared-types';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { canViewAlerts } from '../../lib/roles';

export function LiveTicker({ summary }: { summary: DashboardSummary | null }) {
  const { user } = useAuth();
  if (!summary) return null;
  const canSeeAlerts = canViewAlerts(user?.role);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {canSeeAlerts ? (
        <div className="surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-campus-ink">Alertas ao vivo</h3>
            <Link to="/alerts" className="text-xs font-semibold text-campus-teal underline underline-offset-2">
              Ver todos
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {summary.recentAlerts.length === 0 ? (
              <li className="text-sm text-campus-deep/70">Sem alertas recentes.</li>
            ) : (
              summary.recentAlerts.slice(0, 4).map((a) => (
                <li key={a.id} className="rounded-xl border border-campus-line/70 bg-campus-mist/50 px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-campus-ink">{a.title}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-campus-deep/55">{a.severity}</span>
                  </div>
                  {a.isDemo ? <p className="mt-1 text-[10px] font-semibold text-campus-accent">DEMO</p> : null}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      <div className="surface p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-campus-ink">Actividade</h3>
          <Link to="/audit" className="text-xs font-semibold text-campus-teal underline underline-offset-2">
            Auditoria
          </Link>
        </div>
        <ul className="mt-3 space-y-2">
          {summary.recentActivity.slice(0, 5).map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 border-b border-campus-line/50 pb-2 text-sm last:border-0"
            >
              <span>
                {e.action} · {e.resource}
              </span>
              <span className="text-[10px] text-campus-deep/55">{new Date(e.createdAt).toLocaleTimeString('pt-PT')}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}