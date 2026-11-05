import { useEffect, useMemo, useState } from 'react';
import type { ReadingDto, SensorDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { ChipTabs, EmptyState, LoadingState, StatusPill } from '../components/ui';

export function ReadingsPage() {
  const { api } = useAuth();
  const [sensors, setSensors] = useState<SensorDto[]>([]);
  const [readings, setReadings] = useState<ReadingDto[]>([]);
  const [sensorId, setSensorId] = useState('ALL');
  const [source, setSource] = useState<'live' | 'all'>('live');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextSensor = sensorId, nextSource = source) {
    const [sensorRes, readingRes] = await Promise.all([
      api.sensors(),
      api.readings({
        sensorId: nextSensor === 'ALL' ? undefined : nextSensor,
        includeDemo: nextSource === 'all',
        limit: 200,
      }),
    ]);
    setSensors(sensorRes.data);
    setReadings(readingRes.data);
  }

  useEffect(() => {
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api]);

  const tabs = useMemo(
    () => [{ id: 'ALL', label: 'Todos' }, ...sensors.map((s) => ({ id: s.id, label: s.code }))],
    [sensors],
  );

  async function onSensorChange(id: string) {
    setSensorId(id);
    setError(null);
    try {
      await load(id, source);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao filtrar leituras');
    }
  }

  async function onSourceChange(next: 'live' | 'all') {
    setSource(next);
    setError(null);
    try {
      await load(sensorId, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao filtrar leituras');
    }
  }

  if (loading) return <LoadingState label="A carregar leituras…" />;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Telemetria"
        title="Leituras"
        description="Valores persistidos pelos sensores. As leituras MQTT entram como dados reais; o seed permanece marcado como DEMO."
      />

      {error ? <p className="alert-error">{error}</p> : null}

      <ChipTabs items={tabs} value={sensorId} onChange={onSensorChange} ariaLabel="Filtrar por sensor" />
      <ChipTabs
        items={[
          { id: 'live', label: 'Só telemetria viva' },
          { id: 'all', label: 'Incluir DEMO' },
        ]}
        value={source}
        onChange={onSourceChange}
        ariaLabel="Origem das leituras"
      />

      {readings.length === 0 ? (
        <EmptyState
          title="Sem leituras neste filtro"
          description="Arranque o broker Mosquitto e o simulador MQTT (npm run iot:sim) para gerar telemetria."
        />
      ) : (
        <div className="surface table-scroll">
          <table className="min-w-[720px] text-left text-sm">
            <thead className="bg-campus-mist/80 text-campus-deep">
              <tr>
                <th className="px-4 py-3 font-semibold">Quando</th>
                <th className="px-4 py-3 font-semibold">Sensor</th>
                <th className="px-4 py-3 font-semibold">Valor</th>
                <th className="px-4 py-3 font-semibold">Origem</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((r) => (
                <tr key={r.id} className="border-t border-campus-line/70">
                  <td className="px-4 py-3 text-campus-deep/75">{new Date(r.recordedAt).toLocaleString('pt-PT')}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.sensor?.code ?? r.sensorId}</p>
                    <p className="text-xs text-campus-deep/55">{r.sensor?.metric}</p>
                  </td>
                  <td className="px-4 py-3 font-display text-lg font-semibold text-campus-ink">
                    {r.value}
                    {r.sensor?.unit ? <span className="ml-1 text-sm font-sans font-medium text-campus-deep/60">{r.sensor.unit}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={r.isDemo ? 'warning' : 'success'}>{r.isDemo ? 'DEMO' : 'MQTT'}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
