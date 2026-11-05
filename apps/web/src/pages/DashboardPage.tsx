import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DashboardSummary } from '@smart-campus/shared-types';
import { campusModules } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { ModuleGlyph } from '../components/ModuleGlyph';
import { ModuleStatusBadge } from '../components/ModuleStatusBadge';
import { PageIntro } from '../components/PageIntro';
import { StatCard } from '../components/StatCard';
import { EmptyState, LoadingState, StatusPill } from '../components/ui';
import { coreStatusLabel, greetingFor, relativeTime, roleLabels } from '../lib/labels';

const shortcutGroups = [
  {
    title: 'Vida académica',
    keys: ['academic', 'schedules', 'attendance', 'assessments'],
  },
  {
    title: 'Campus e operações',
    keys: ['campus', 'ops', 'campus-twin', 'iot'],
  },
];

export function DashboardPage() {
  const { api, user } = useAuth();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .dashboard()
      .then((res) => setData(res.data))
      .catch((err: Error) => setError(err.message));
  }, [api]);

  const visibleModules = useMemo(
    () =>
      campusModules.filter((module) => {
        if (module.requiredRoles && user && !module.requiredRoles.includes(user.role)) return false;
        return true;
      }),
    [user],
  );

  if (error) return <p className="alert-error">{error}</p>;
  if (!data) return <LoadingState label="A preparar o seu dia no campus…" />;

  const healthy = data.coreStatus === 'healthy';

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="O seu dia no campus"
        title={greetingFor(data.currentUser.fullName)}
        description={
          <>
            Entra como <strong className="font-semibold text-campus-ink">{roleLabels[data.currentUser.role]}</strong>. O Core
            está {healthy ? 'estável' : 'a pedir atenção'} — use os atalhos para ir directo ao que importa.
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={healthy ? 'success' : 'warning'}>{coreStatusLabel(data.coreStatus)}</StatusPill>
            <Link to="/ops" className="btn-primary">
              Ver mapa ao vivo
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Salas" value={data.roomsCount} hint="Espaços cadastrados no D2 e anexos" to="/rooms" icon={<ModuleGlyph name="rooms" />} />
        <StatCard
          label="Ocorrências abertas"
          value={data.openIncidents}
          hint="Pedidos ainda em curso"
          to="/incidents"
          icon={<ModuleGlyph name="incidents" />}
        />
        <StatCard
          label="Dispositivos"
          value={data.devicesCount}
          hint="Nós IoT visíveis no campus"
          to="/devices"
          icon={<ModuleGlyph name="iot" />}
        />
        <StatCard
          label="Módulos prontos"
          value={data.modulesAvailable}
          hint={data.modulesInDevelopment ? `${data.modulesInDevelopment} ainda em desenvolvimento` : 'Todos os módulos disponíveis'}
          to="/reports"
          icon={<ModuleGlyph name="admin" />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {shortcutGroups.map((group) => (
          <div key={group.title} className="hero-panel">
            <p className="eyebrow">{group.title}</p>
            <div className="mt-4 grid gap-2">
              {group.keys
                .map((key) => visibleModules.find((module) => module.key === key))
                .filter((module): module is NonNullable<typeof module> => Boolean(module))
                .map((module) => (
                  <Link
                    key={module.key}
                    to={module.path}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white/75 px-3 py-3 transition hover:bg-white"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="icon-well !h-9 !w-9">
                        <ModuleGlyph name={module.key} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-medium text-campus-ink">{module.label}</span>
                        <span className="block truncate text-xs text-campus-deep/60">{module.description}</span>
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-campus-teal">Abrir</span>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl font-semibold text-campus-ink">Alertas recentes</h3>
            <Link to="/alerts" className="text-xs font-semibold text-campus-teal">
              Ver todos
            </Link>
          </div>
          {data.recentAlerts.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Tudo calmo" description="Não há alertas a pedir a sua atenção." />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.recentAlerts.map((alert) => (
                <li key={alert.id} className="rounded-xl border border-campus-line/80 bg-campus-mist/50 px-3 py-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-campus-ink">{alert.title}</span>
                    <StatusPill tone={alert.severity === 'CRITICAL' ? 'danger' : alert.severity === 'WARNING' ? 'warning' : 'info'}>
                      {alert.severity}
                    </StatusPill>
                  </div>
                  {alert.isDemo ? <p className="mt-1 text-xs font-medium text-campus-accent">Dados de demonstração</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface p-5">
          <h3 className="font-display text-xl font-semibold text-campus-ink">Actividade recente</h3>
          <ul className="mt-4 space-y-3">
            {data.recentActivity.length === 0 ? (
              <li className="text-sm text-campus-deep/70">Ainda não há movimentos registados.</li>
            ) : (
              data.recentActivity.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-3 border-b border-campus-line/60 pb-2 text-sm last:border-0"
                >
                  <span className="min-w-0">
                    <span className="font-medium text-campus-ink">{event.action}</span>
                    <span className="text-campus-deep/60"> · {event.resource}</span>
                  </span>
                  <span className="shrink-0 text-xs text-campus-deep/60">{relativeTime(event.createdAt)}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <section className="surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold text-campus-ink">Mapa de módulos</h3>
            <p className="mt-1 text-sm text-campus-deep/65">Todos os destinos do Core, agrupados pelo mesmo vocabulário da navegação.</p>
          </div>
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
          {visibleModules.map((module) => (
            <Link key={module.key} to={module.path} className="surface-interactive flex items-start gap-3 p-4">
              <span className="icon-well">
                <ModuleGlyph name={module.key} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <p className="font-medium text-campus-ink">{module.label}</p>
                  {module.status !== 'available' ? <ModuleStatusBadge status={module.status} tone="light" /> : null}
                </span>
                <p className="mt-1 text-xs leading-relaxed text-campus-deep/70">{module.description}</p>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
