import type { IotDeviceView } from '../../lib/iotDemo';

function Sparkline({ values, color }: { values: number[]; color: string }) {
  // Sem pelo menos 2 pontos não há linha para desenhar (e evita divisão por zero)
  if (values.length < 2) return <div className="h-8" aria-hidden />;

  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 28 - ((v - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 32" className="h-8 w-full" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

const statusStyle: Record<IotDeviceView['status'], string> = {
  ONLINE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  OFFLINE: 'bg-slate-100 text-slate-600 border-slate-200',
  MAINTENANCE: 'bg-amber-50 text-amber-900 border-amber-200',
  UNKNOWN: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function IotDeviceCard({
  device,
  selected,
  onSelect,
}: {
  device: IotDeviceView;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`surface w-full p-4 text-left transition duration-200 ${
        selected
          ? 'border-campus-teal ring-2 ring-campus-teal/20'
          : 'hover:-translate-y-0.5 hover:border-campus-teal/35'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold tracking-wide text-campus-teal">{device.code}</p>
          <h3 className="mt-1 font-display text-lg font-semibold text-campus-ink">{device.name}</h3>
          <p className="mt-1 text-xs text-campus-deep/65">
            {device.type} · {device.roomLabel}
          </p>
        </div>
        <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusStyle[device.status]}`}>
          {device.status}
        </span>
      </div>

      {device.metrics.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {device.metrics.map((m) => (
            <div key={m.key} className="rounded-xl bg-campus-mist/80 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-campus-deep/50">{m.label}</p>
              <p className="mt-0.5 font-display text-xl font-semibold text-campus-ink">
                {m.value}
                {m.unit ? (
                  <span className="ml-1 text-xs font-sans font-medium text-campus-deep/60">{m.unit}</span>
                ) : null}
              </p>
              <Sparkline values={m.trend} color={device.status === 'ONLINE' ? '#1a6b5c' : '#8a6a3d'} />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs text-campus-deep/60">Sem sensores associados</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-campus-deep/60">
        {device.signal !== null ? <span>Sinal {device.signal}%</span> : null}
        {device.battery !== null ? <span>Bateria {device.battery}%</span> : null}
        <span>Atualizado {device.lastSeenLabel}</span>
      </div>
    </button>
  );
}