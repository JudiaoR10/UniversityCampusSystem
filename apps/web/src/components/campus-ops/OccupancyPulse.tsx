export function OccupancyPulse({
  people,
  percent,
  isDemo = false,
}: {
  people: number;
  percent: number;
  isDemo?: boolean;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(percent, 100) / 100);

  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-campus-line/80 bg-white/90 px-3 py-3 shadow-soft sm:w-auto sm:px-4">
      <svg className="h-16 w-16 shrink-0 sm:h-[88px] sm:w-[88px]" viewBox="0 0 96 96" aria-hidden>
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#e7eef5" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="#1a6b5c"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 48 48)"
          className="campus-ops-gauge"
        />
        <text
          x="48"
          y="52"
          textAnchor="middle"
          fill="#10233d"
          fontSize="15"
          fontWeight="700"
          fontFamily="Manrope, sans-serif"
        >
          {percent}%
        </text>
      </svg>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-campus-deep/55">Ocupação</p>
        <p className="font-display text-xl font-semibold text-campus-ink sm:text-2xl">{people} pessoas</p>
        <p className="text-xs text-campus-brass">
          {isDemo ? 'Estimativa DEMO sobre capacidade' : 'Inscritos em sessões a decorrer'}
        </p>
      </div>
    </div>
  );
}
