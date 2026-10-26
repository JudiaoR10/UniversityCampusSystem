import { NavLink, Outlet, useLocation } from "react-router-dom";
import { campusModules } from "@smart-campus/shared-types";
import { useAuth } from "../lib/auth";
import { ModuleStatusBadge } from "../components/ModuleStatusBadge";
import { BrandMark } from "../components/BrandMark";
import { useEffect, useMemo, useState } from "react";

const primaryNav = [
  'ops',
  'dashboard',
  'financial',
  'users',
  'academic',
  'students',
  'enrolments',
  'rooms',
  'schedules',
  'attendance',
  'assessments',
  'incidents',
  'parking',
  'iot',
  'alerts',
  'reports',
  'audit',
  'admin',
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const modules = useMemo(
    () =>
      campusModules.filter((m) => {
        if (
          !primaryNav.includes(m.key) &&
          ![
            "buildings",
            "laboratories",
            "equipment",
            "devices",
            "campus",
            "teachers",
            "maintenance",
            "notifications",
          ].includes(m.key)
        ) {
          return false;
        }
        if (m.requiredRoles && user && !m.requiredRoles.includes(user.role))
          return false;
        return true;
      }),
    [user],
  );

  const current = campusModules.find((m) => m.path === location.pathname);

  return (
    <div className="min-h-screen min-h-[100dvh] lg:grid lg:grid-cols-[272px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(272px,88vw)] flex-col border-r border-white/10 bg-gradient-to-b from-[#10233d] via-[#123049] to-[#0f3d36] text-white transition duration-300 lg:static lg:w-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
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
        <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4">
          {modules.map((m) => (
            <NavLink
              key={m.key}
              to={m.path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `group flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-white/15 text-white shadow-soft"
                    : "text-white/70 hover:bg-white/8 hover:text-white"
                }`
              }
            >
              <span className="min-w-0 truncate font-medium">{m.label}</span>
              <span className="shrink-0 opacity-90 transition group-hover:opacity-100">
                <ModuleStatusBadge status={m.status} />
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="rounded-xl bg-white/8 px-3 py-3">
            <p className="truncate text-sm font-semibold">{user?.fullName}</p>
            <p className="mt-0.5 text-xs tracking-wide text-white/60">
              {user?.role}
            </p>
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
                  {current?.label ?? "Smart Campus"}
                </h1>
              </div>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <span className="rounded-lg border border-campus-line bg-white/80 px-3 py-1.5 text-xs text-campus-deep/70">
                Notificações · preparado
              </span>
              <span className="rounded-lg border border-campus-teal/25 bg-campus-teal/10 px-3 py-1.5 text-xs font-medium text-campus-teal">
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
