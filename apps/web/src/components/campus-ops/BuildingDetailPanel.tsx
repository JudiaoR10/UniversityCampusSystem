import { Link } from 'react-router-dom';
import type { CampusBuildingView, MetricStatus } from './types';

const statusTone: Record<MetricStatus, string> = {
  GOOD: 'bg-emerald-50 text-emerald-800',
  WARN: 'bg-amber-50 text-amber-900',
  LOW: 'bg-orange-50 text-orange-900',
  CRITICAL: 'bg-red-50 text-red-800',
};

function MetricRow({
  label,
  value,
  unit,
  status,
  isDemo,
}: {
  label: string;
  value: number | null;
  unit: string;
  status: MetricStatus;
  isDemo: boolean;
}) {
  return (
    <div className="rounded-xl border border-campus-line/70 bg-campus-mist/70 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-campus-deep/55">{label}</p>
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${statusTone[status]}`}>{status}</span>
      </div>
      <p className="mt-1 font-display text-2xl font-semibold text-campus-ink">
        {value == null ? '—' : value}
        {value != null ? <span className="ml-1 text-sm font-sans font-medium text-campus-deep/70">{unit}</span> : null}
      </p>
      {isDemo ? <p className="mt-1 text-[10px] font-semibold text-campus-accent">DEMO</p> : null}
    </div>
  );
}

export function BuildingDetailPanel({
  building,
  open,
}: {
  building: CampusBuildingView | null;
  open: boolean;
}) {
  if (!building) {
    return (
      <aside className="surface border-dashed p-5 text-sm text-campus-deep/70">
        Seleccione um edifício no mapa para ver métricas ambientais e de utilização.
      </aside>
    );
  }

  return (
    <aside
      className={`surface p-5 transition duration-300 ${
        open ? 'campus-ops-panel-in translate-y-0 opacity-100' : 'translate-y-2 opacity-80'
      }`}
    >
      <p className="eyebrow">Edifício seleccionado</p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-campus-ink">
        {building.code} — {building.name}
      </h2>
      <p className="mt-1 text-sm text-campus-deep/70">
        {building.floors} pisos · {building.roomsCount} salas · {building.devicesCount} dispositivos
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MetricRow label="CO₂" {...building.co2} />
        <MetricRow label="Temperatura" {...building.temperature} />
        <MetricRow label="Humidade" {...building.humidity} />
        <MetricRow label="Utilização" {...building.utilisation} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/rooms" className="btn-primary !py-2">
          Ver salas
        </Link>
        <Link to="/incidents" className="btn-secondary !py-2">
          Ocorrências
        </Link>
        <Link to="/campus/twin" className="rounded-xl bg-campus-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#9a4c22]">
          Gémeo digital
        </Link>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-campus-deep/60">
        O modelo 3D do D2 usa o cadastro de salas e as métricas vivas do centro de operações.
      </p>
    </aside>
  );
}
