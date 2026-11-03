import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { canViewAlerts } from '../lib/roles';
import { mapApiDevices, type IotDeviceView } from '../lib/iotDemo';
import { IotDeviceCard } from '../components/iot/IotDeviceCard';
import { PageIntro } from '../components/PageIntro';
import type { AlertDto } from '@smart-campus/shared-types';

const pipeline = ['Sensor', 'ESP32', 'Wi-Fi', 'MQTT', 'API', 'Dashboard'];

export function IotHubPage() {
  const { api, user } = useAuth();
  const canSeeAlerts = canViewAlerts(user?.role);
  const [devices, setDevices] = useState<IotDeviceView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pulse, setPulse] = useState(0);
  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);

  useEffect(() => {
    api
      .devices()
      .then((res) => {
        const mapped = mapApiDevices(res.data as Array<Record<string, unknown>>);
        setDevices(mapped);
        setSelectedId(mapped[0]?.id ?? null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    const id = window.setInterval(() => setPulse((p) => p + 1), 1800);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!canSeeAlerts || !selectedId || selectedId.startsWith('demo-')) {
      setAlerts([]);
      setAlertsError(null);
      setAlertsLoading(false);
      return;
    }
    let cancelled = false;
    setAlertsLoading(true);
    setAlertsError(null);
    api
      .alerts(selectedId)
      .then((res) => {
        if (!cancelled) setAlerts(res.data);
      })
      .catch((err: Error) => {
        if (!cancelled) setAlertsError(err.message);
      })
      .finally(() => {
        if (!cancelled) setAlertsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, selectedId, canSeeAlerts]);

  const selected = useMemo(() => devices.find((d) => d.id === selectedId) ?? null, [devices, selectedId]);
  const online = devices.filter((d) => d.status === 'ONLINE').length;

  if (loading) {
    return <div className="grid min-h-[40vh] place-items-center text-campus-deep/70">A sincronizar a malha IoT…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-campus-brass/25 bg-gradient-to-r from-campus-teal/10 via-white/80 to-campus-brass/10 px-4 py-3 text-sm text-campus-ink">
        Hub IoT com os dispositivos registados no Core. A telemetria em tempo real (MQTT) fica para o grupo IoT.
      </div>

      <PageIntro
        eyebrow="Campus inteligente"
        title="Rede IoT"
        description={`${online} online · ${devices.length} nós visíveis · pulso #${pulse + 1}`}
        actions={
          <Link to="/devices" className="btn-secondary">
            Inventário
          </Link>
        }
      />

      <section className="surface relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-campus-teal/10" />
        <p className="eyebrow">Fluxo futuro</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {pipeline.map((step, idx) => (
            <div key={step} className="flex items-center gap-2">
              <span
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  idx <= pulse % pipeline.length
                    ? 'border-campus-teal/40 bg-campus-teal text-white'
                    : 'border-campus-line bg-campus-mist text-campus-deep/70'
                }`}
              >
                {step}
              </span>
              {idx < pipeline.length - 1 ? <span className="text-campus-deep/35">→</span> : null}
            </div>
          ))}
        </div>
      </section>

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.7fr)]">
        <div className="grid gap-3 sm:grid-cols-2">
          {devices.length === 0 ? (
            <p className="surface p-4 text-sm text-campus-deep/70 sm:col-span-2">
              Ainda não há dispositivos registados. Cria o primeiro no <Link to="/devices" className="underline">inventário</Link>.
            </p>
          ) : (
            devices.map((device) => (
              <IotDeviceCard
                key={device.id}
                device={device}
                selected={device.id === selectedId}
                onSelect={() => setSelectedId(device.id)}
              />
            ))
          )}
        </div>

        <aside className="surface h-fit p-4 sm:p-5 xl:sticky xl:top-24">
          {selected ? (
            <>
              <p className="eyebrow">Nó seleccionado</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-campus-ink">{selected.name}</h2>
              <p className="mt-1 text-sm text-campus-deep/70">{selected.roomLabel}</p>

              <div className="mt-5 space-y-3">
                <div className="rounded-xl bg-campus-mist/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-campus-deep/50">Tópico MQTT</p>
                  <p className="mt-1 break-all font-mono text-xs text-campus-ink">{selected.mqttTopic}</p>
                </div>

                {selected.signal !== null || selected.battery !== null ? (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {selected.signal !== null ? (
                      <div className="rounded-xl border border-campus-line/70 p-3">
                        <p className="text-campus-deep/55">Sinal</p>
                        <p className="font-display text-2xl font-semibold">{selected.signal}%</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded bg-campus-sand">
                          <div className="h-full rounded bg-campus-teal" style={{ width: `${selected.signal}%` }} />
                        </div>
                      </div>
                    ) : null}
                    {selected.battery !== null ? (
                      <div className="rounded-xl border border-campus-line/70 p-3">
                        <p className="text-campus-deep/55">Bateria</p>
                        <p className="font-display text-2xl font-semibold">{selected.battery}%</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded bg-campus-sand">
                          <div className="h-full rounded bg-campus-brass" style={{ width: `${selected.battery}%` }} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-xl border border-campus-line/70 p-3 text-sm text-campus-deep/65">
                    Sinal e bateria ficam disponíveis quando existir telemetria MQTT.
                  </p>
                )}

                <p className="text-xs text-campus-deep/60">Atualizado {selected.lastSeenLabel}</p>

                {canSeeAlerts ? (
                  <>
                    <div className="rounded-xl border border-campus-line/70 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-campus-deep/50">
                        Alertas deste nó
                      </p>
                      {alertsLoading ? (
                        <p className="mt-2 text-sm text-campus-deep/70">A carregar…</p>
                      ) : alertsError ? (
                        <p className="mt-2 text-sm text-red-700">{alertsError}</p>
                      ) : alerts.length === 0 ? (
                        <p className="mt-2 text-sm text-campus-deep/70">Nenhum alerta associado.</p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {alerts.map((a) => (
                            <li key={a.id} className="text-sm">
                              <span className="font-medium text-campus-ink">{a.title}</span>
                              <span className="ml-2 text-[10px] font-semibold">{a.severity}</span>
                              <p className="text-xs text-campus-deep/65">
                                {a.acknowledged ? 'Confirmado' : 'Por confirmar'}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <Link to={`/alerts?deviceId=${encodeURIComponent(selected.id)}`} className="btn-primary w-full">
                      Ver alertas relacionados
                    </Link>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-sm text-campus-deep/70">Seleccione um dispositivo.</p>
          )}
        </aside>
      </section>

      <section className="surface overflow-hidden p-0">
        <div className="border-b border-campus-line/70 px-5 py-4">
          <h3 className="font-display text-xl font-semibold text-campus-ink">Mapa da malha (conceptual)</h3>
          <p className="text-sm text-campus-deep/70">Disposição ilustrativa dos nós; não representa localizações reais</p>
        </div>
        <div className="relative h-52 sm:h-64 md:h-72 bg-[radial-gradient(circle_at_30%_40%,rgba(26,107,92,0.12),transparent_40%),radial-gradient(circle_at_70%_55%,rgba(138,106,61,0.12),transparent_35%),linear-gradient(160deg,#eef4f1,#f7f9fb)]">
          {devices.slice(0, 6).map((d, i) => {
            const positions = [
              { left: '18%', top: '30%' },
              { left: '42%', top: '22%' },
              { left: '68%', top: '34%' },
              { left: '28%', top: '62%' },
              { left: '55%', top: '58%' },
              { left: '78%', top: '64%' },
            ];
            const pos = positions[i];
            const active = d.id === selectedId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={pos}
              >
                <span
                  className={`absolute inset-0 rounded-full ${d.status === 'ONLINE' ? 'animate-ping bg-campus-teal/30' : 'bg-campus-brass/20'}`}
                  style={{ width: 36, height: 36, left: -6, top: -6 }}
                />
                <span
                  className={`relative grid h-6 w-6 place-items-center rounded-full border-2 border-white text-[9px] font-bold text-white shadow-soft ${
                    active ? 'bg-campus-accent' : d.status === 'ONLINE' ? 'bg-campus-teal' : 'bg-campus-brass'
                  }`}
                >
                  {i + 1}
                </span>
              </button>
            );
          })}
          <div className="pointer-events-none absolute bottom-3 left-3 right-3 text-[10px] text-campus-deep/55 sm:left-4 sm:right-auto sm:text-xs">
            Clique num nó para inspeccionar · animação ilustrativa
          </div>
        </div>
      </section>
    </div>
  );
}