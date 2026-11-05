export type IotDeviceStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'UNKNOWN';

export type IotDeviceView = {
  id: string;
  code: string;
  name: string;
  type: string;
  status: IotDeviceStatus;
  roomLabel: string;
  mqttTopic: string;
  /** null enquanto o device não enviar telemetria. */
  signal: number | null;
  /** null enquanto o device não enviar telemetria. */
  battery: number | null;
  lastSeenLabel: string;
  metrics: Array<{ key: string; label: string; value: string; unit: string; trend: number[] }>;
  isDemo: boolean;
};

type ApiReading = { value: number; recordedAt: string };
type ApiSensor = { metric?: string; unit?: string | null; readings?: ApiReading[] };

const STATUSES: IotDeviceStatus[] = ['ONLINE', 'OFFLINE', 'MAINTENANCE', 'UNKNOWN'];

const METRIC_LABELS: Record<string, string> = {
  temperature: 'Temperatura',
  humidity: 'Humidade',
  co2: 'CO₂',
};

/** "há 5 min", "há 2 h", etc., a partir de uma data ISO. */
function relativeLabel(iso: unknown): string {
  const t = typeof iso === 'string' ? new Date(iso).getTime() : NaN;
  if (Number.isNaN(t)) return '—';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `há ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

const asPercent = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function formatValue(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function mapApiDevices(raw: Array<Record<string, unknown>>): IotDeviceView[] {
  return raw.map((d) => {
    const sensors = (d.sensors as ApiSensor[] | undefined) ?? [];
    const room = d.room as { code?: string; name?: string } | null | undefined;
    const rawStatus = String(d.status || 'UNKNOWN') as IotDeviceStatus;
    const status = STATUSES.includes(rawStatus) ? rawStatus : 'UNKNOWN';

    return {
      id: String(d.id),
      code: String(d.code),
      name: String(d.name),
      type: String(d.type),
      status,
      roomLabel: room ? `${room.code ?? ''} ${room.name ?? ''}`.trim() || 'Sem sala' : 'Sem sala',
      mqttTopic: String(d.mqttTopic ?? `campus/device/${d.code}`),
      signal: asPercent(d.signal),
      battery: asPercent(d.battery),
      // Última mensagem MQTT; se ainda não houve telemetria, a última alteração do registo
      lastSeenLabel: relativeLabel(d.lastSeenAt ?? d.updatedAt),
      metrics: sensors.slice(0, 2).map((s, i) => {
        // A API devolve as leituras da mais recente para a mais antiga
        const readings = s.readings ?? [];
        const latest = readings[0];
        return {
          key: s.metric ?? `m${i}`,
          label: METRIC_LABELS[s.metric ?? ''] ?? s.metric ?? 'Métrica',
          value: latest ? formatValue(latest.value) : '—',
          unit: s.unit ?? '',
          trend: [...readings].reverse().map((r) => r.value),
        };
      }),
      isDemo: false,
    };
  });
}