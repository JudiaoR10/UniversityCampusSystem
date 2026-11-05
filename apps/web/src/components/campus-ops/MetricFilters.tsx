import type { OpsMetric } from './types';

const options: Array<{ key: OpsMetric; label: string }> = [
  { key: 'occupancy', label: 'Ocupação' },
  { key: 'temperature', label: 'Temperatura' },
  { key: 'co2', label: 'CO₂' },
  { key: 'humidity', label: 'Humidade' },
];

export function MetricFilters({ value, onChange }: { value: OpsMetric; onChange: (m: OpsMetric) => void }) {
  return (
    <div className="chip-rail sm:w-auto" role="tablist" aria-label="Métrica do mapa">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          role="tab"
          aria-selected={value === opt.key}
          onClick={() => onChange(opt.key)}
          className="chip-tab"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
