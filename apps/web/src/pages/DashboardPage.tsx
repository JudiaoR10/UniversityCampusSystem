import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardSummary } from '@smart-campus/shared-types';
import { campusModules } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { ModuleStatusBadge } from '../components/ModuleStatusBadge';
import { PageIntro } from '../components/PageIntro';

export function DashboardPage() {
  const { api } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .dashboard()
      .then((res) => setData(res.data))
      .catch((err: Error) => setError(err.message));
  }, [api]);

  if (error) return <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  if (!data) {
    return <div className="grid min-h-[40vh] place-items-center text-campus-deep/70">A carregar dashboard…</div>;
  }

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Dashboard Core"
        title={`Olá, ${data.currentUser.fullName}`}
        description={
          <>
            Role <strong className="font-semibold text-campus-ink">{data.currentUser.role}</strong> · estado do Core:{' '}
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-sm font-medium text-emerald-800">
              {data.coreStatus}
            </span>
          </>
        }
        actions={
          <Link to="/ops" className="btn-primary">
            Ir às Operações
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Salas', value: data.roomsCount, to: '/rooms' },
          { label: 'Ocorrências abertas', value: data.openIncidents, to: '/incidents' },
          { label: 'Dispositivos', value: data.devicesCount, to: '/devices' },
          { label: 'Módulos disponíveis', value: data.modulesAvailable, to: '/admin' },
        ].map((card) => (
          <Link key={card.label} to={card.to} className="surface-interactive block p-5">
            <p className="text-sm text-campus-deep/70">{card.label}</p>
            <p className="mt-2 font-display text-3xl font-semibold text-campus-ink sm:text-4xl">{card.value}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface p-5">
          <h3 className="font-display text-xl font-semibold text-campus-ink">Alertas recentes</h3>
          <ul className="mt-4 space-y-3">
            {data.recentAlerts.length === 0 ? (
              <li className="text-sm text-campus-deep/70">Sem alertas.</li>
            ) : (
              data.recentAlerts.map((a) => (
                <li key={a.id} className="rounded-xl border border-campus-line/80 bg-campus-mist/50 px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-campus-ink">{a.title}</span>
                    <span className="text-xs text-campus-deep/60">{a.severity}</span>
                  </div>
                  {a.isDemo ? <p className="mt-1 text-xs font-medium text-campus-accent">Dados de demonstração</p> : null}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="surface p-5">
          <h3 className="font-display text-xl font-semibold text-campus-ink">Actividade recente</h3>
          <ul className="mt-4 space-y-3">
            {data.recentActivity.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 border-b border-campus-line/60 pb-2 text-sm last:border-0"
              >
                <span>
                  {e.action} · {e.resource}
                </span>
                <span className="text-xs text-campus-deep/60">{new Date(e.createdAt).toLocaleString('pt-PT')}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-xl font-semibold text-campus-ink">Mapa de módulos</h3>
          <a
            className="text-sm font-medium text-campus-teal underline decoration-campus-teal/30 underline-offset-4"
            href="/api/docs"
            target="_blank"
            rel="noreferrer"
          >
            Documentação API
          </a>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {campusModules.map((m) => (
            <Link key={m.key} to={m.path} className="rounded-xl border border-campus-line/80 bg-white/70 p-3.5 transition hover:border-campus-teal/40 hover:bg-campus-mist">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-campus-ink">{m.label}</p>
                <ModuleStatusBadge status={m.status} tone="light" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-campus-deep/70">{m.description}</p>
            </Link>
          ))}
        </div>
        <p className="mt-4 text-sm text-campus-deep/70">
          Em desenvolvimento: {data.modulesInDevelopment} módulos · disponível: {data.modulesAvailable}
        </p>
      </section>
    </div>
  );
}
