import type { WeeklyCell } from './types';

const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function colorFor(intensity: number): string {
  if (intensity > 0.75) return '#b35a2a';
  if (intensity > 0.5) return '#8a6a3d';
  if (intensity > 0.3) return '#1a6b5c';
  return '#9db7a8';
}

export function WeeklyPatternChart({ cells }: { cells: WeeklyCell[] }) {
  const isDemo = cells.length > 0 && cells.every((c) => c.isDemo);
  const hasSignal = cells.some((c) => c.intensity > 0);

  return (
    <section className="surface p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-semibold text-campus-ink">Padrões semanais</h3>
          <p className="text-sm text-campus-deep/70">
            {hasSignal
              ? 'Intensidade horária a partir de leituras MQTT dos últimos 7 dias'
              : 'Ainda sem leituras vivas nesta semana'}
          </p>
        </div>
        {isDemo ? (
          <span className="rounded-md bg-campus-accent/10 px-2 py-1 text-xs font-semibold text-campus-accent">DEMO</span>
        ) : (
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">Telemetria</span>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="grid min-w-[640px] grid-cols-[48px_repeat(24,minmax(0,1fr))] gap-1">
          <div />
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="text-center text-[10px] text-campus-deep/45">
              {hour}
            </div>
          ))}
          {days.map((dayLabel, day) => (
            <div key={dayLabel} className="contents">
              <div className="flex items-center text-xs font-medium text-campus-deep/70">{dayLabel}</div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = cells.find((c) => c.day === day && c.hour === hour);
                const intensity = cell?.intensity ?? 0.1;
                return (
                  <div
                    key={`${day}-${hour}`}
                    title={`${dayLabel} ${hour}h · ${Math.round(intensity * 100)}%`}
                    className="h-7 rounded-md transition hover:scale-105"
                    style={{ backgroundColor: colorFor(intensity), opacity: 0.55 + intensity * 0.45 }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
