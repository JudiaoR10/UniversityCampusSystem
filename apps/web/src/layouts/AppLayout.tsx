import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { campusModules } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { useNotifications } from '../lib/useNotifications';
import { ModuleStatusBadge } from '../components/ModuleStatusBadge';
import { ModuleGlyph } from '../components/ModuleGlyph';
import { BrandMark } from '../components/BrandMark';
import { useEffect, useMemo, useState } from 'react';
import { initialsFor, roleLabels } from '../lib/labels';

const navGroups = [
  { id: 'hoje', label: 'Hoje', keys: ['ops', 'dashboard', 'notifications'] },
  { id: 'pessoas', label: 'Pessoas e aulas', keys: ['academic', 'users', 'students', 'teachers', 'enrolments', 'schedules', 'attendance', 'assessments'] },
  { id: 'campus', label: 'Campus', keys: ['campus', 'campus-twin', 'rooms', 'pois', 'buildings', 'parking', 'laboratories', 'equipment'] },
  { id: 'operacoes', label: 'Operações', keys: ['iot', 'devices', 'sensors', 'readings', 'incidents', 'maintenance', 'alerts', 'reports'] },
  { id: 'gestao', label: 'Gestão', keys: ['financial', 'admin', 'audit'] },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { unread, connectionState } = useNotifications(); // may be removed later if UI no longer uses them
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const modules = useMemo(
    () =>
      campusModules.filter((module) => {
        if (module.requiredRoles && user && !module.requiredRoles.includes(user.role)) return false;
        return navGroups.some((group) => group.keys.includes(module.key));
      }),
    [user],
  );

  const groups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.keys
            .map((key) => modules.find((module) => module.key === key))
            .filter((module): module is NonNullable<typeof module> => Boolean(module)),
        }))
        .filter((group) => group.items.length > 0),
    [modules],
  );

  const current = campusModules.find((module) => module.path === location.pathname);

  return (
    <div className="min-h-screen min-h-[100dvh] lg:grid lg:grid-cols-[272px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(272px,88vw)] flex-col border-r border-white/10 bg-gradient-to-b from-[#10233d] via-[#123049] to-[#0f3d36] text-white transition duration-300 lg:static lg:w-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 py-4 sm:px-5 sm:py-5">
          <BrandMark />
          <button
            type="button"
            className="rounded-lg border border-white/20 px-2.5 py-1.5 text-sm text-white/80 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            Fechar
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-3">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="nav-group-label">{group.label}</p>
              {group.items.map((module) => (
                <NavLink
                  key={module.key}
                  to={module.path}
                  end
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition ${
                      isActive ? 'bg-white/15 text-white shadow-soft' : 'text-white/70 hover:bg-white/8 hover:text-white'
                    }`
                  }
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <ModuleGlyph name={module.key} className="opacity-80" />
                    <span className="min-w-0 truncate font-medium">{module.label}</span>
                  </span>
                  {module.status !== 'available' ? (
                    <span className="shrink-0 opacity-90 transition group-hover:opacity-100">
                      <ModuleStatusBadge status={module.status} />
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="rounded-xl bg-white/8 px-3 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-xs font-bold tracking-wide">
                {user ? initialsFor(user.fullName) : 'SC'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user?.fullName}</p>
                <p className="mt-0.5 text-xs tracking-wide text-white/60">{user ? roleLabels[user.role] : ''}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-3 w-full rounded-lg border border-white/20 px-3 py-2.5 text-left text-sm text-white/90 transition hover:bg-white/10"
            >
              Terminar sessão
            </button>
          </div>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[#10233d]/45 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        />
      ) : null}

      <div className="app-shell-main min-w-0">
        <header className="sticky top-0 z-20 border-b border-campus-line/70 bg-campus-paper/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-6 sm:py-3.5 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                className="btn-secondary shrink-0 !min-h-10 !px-3 !py-2 lg:hidden"
                onClick={() => setOpen(true)}
                aria-label="Abrir menu"
              >
                Menu
              </button>
              <div className="min-w-0">
                <p className="eyebrow hidden sm:block">Área actual</p>
                <h1 className="truncate font-display text-lg font-semibold text-campus-ink sm:text-xl">
                  {current?.label ?? 'Smart Campus'}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NavLink
                to="/notifications"
                className="relative inline-flex items-center justify-center rounded-full border border-campus-line bg-white/85 px-2.5 py-1.5 text-base leading-none transition hover:border-campus-teal/40 hover:bg-campus-teal/10"
                title="Notificações (tempo real)"
                aria-label={`Notificações${unread > 0 ? `, ${unread} por ler` : ''}`}
              >
                <span aria-hidden="true">🔔</span>
                <span
                  aria-hidden="true"
                  title={connectionState}
                  className={
                    'ml-1 inline-block h-2 w-2 rounded-full ' +
                    (connectionState === 'open'
                      ? 'bg-emerald-500'
                      : connectionState === 'connecting'
                        ? 'bg-amber-400 animate-pulse'
                        : connectionState === 'error'
                          ? 'bg-red-500'
                          : 'bg-campus-deep/30')
                  }
                />
                {unread > 0 ? <span className="notice-badge">{unread > 9 ? '9+' : unread}</span> : null}
              </NavLink>
              <span className="hidden items-center gap-2 rounded-lg border border-campus-teal/25 bg-campus-teal/10 px-3 py-1.5 text-xs font-medium text-campus-teal md:inline-flex">
                <span className="live-dot" aria-hidden />
                Core activo
              </span>
            </div>
          </div>
        </header>
        <main className="px-3 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
