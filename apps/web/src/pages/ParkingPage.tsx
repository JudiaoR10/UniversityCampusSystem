import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AdminSettingsDto, ParkingLotOverview, ParkingSpotDto, PlateReadingDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { PageBanner } from '../components/ui';

const statusStyle: Record<ParkingSpotDto['status'], string> = {
  FREE: 'bg-emerald-500 border-emerald-600 text-white',
  OCCUPIED: 'bg-campus-ink border-campus-ink text-white',
  RESERVED: 'bg-amber-500 border-amber-600 text-white',
  OUT_OF_SERVICE: 'bg-slate-300 border-slate-400 text-slate-700',
};

const statusLabel: Record<ParkingSpotDto['status'], string> = {
  FREE: 'Livre',
  OCCUPIED: 'Ocupada',
  RESERVED: 'Reservada',
  OUT_OF_SERVICE: 'Indisponível',
};

export function ParkingPage() {
  const { api, user } = useAuth();
  const [lots, setLots] = useState<ParkingLotOverview[]>([]);
  const [readings, setReadings] = useState<PlateReadingDto[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpotDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [plate, setPlate] = useState('AIT 954 MC');
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<AdminSettingsDto | null>(null);
  const canManage = user && ['TECHNICIAN', 'COORDINATOR', 'ADMIN'].includes(user.role);
  const isAdmin = user?.role === 'ADMIN';
  const labMode = Boolean(isAdmin && settings?.parkingLabMode);

  const lot = lots[0] ?? null;

  async function load() {
    const [overview, plateRes] = await Promise.all([api.parkingOverview(), api.parkingReadings()]);
    setLots(overview.data);
    setReadings(plateRes.data);
    if (isAdmin) {
      try {
        const settingsRes = await api.adminSettings();
        setSettings(settingsRes.data);
      } catch {
        setSettings(null);
      }
    }
    if (selectedSpot) {
      const refreshed = overview.data[0]?.spots.find((s) => s.id === selectedSpot.id) ?? null;
      setSelectedSpot(refreshed);
    }
  }

  useEffect(() => {
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api]);

  const rows = useMemo(() => {
    if (!lot) return [] as string[];
    return [...new Set(lot.spots.map((s) => s.rowLabel))];
  }, [lot]);

  async function simulateEntry(e: FormEvent) {
    e.preventDefault();
    if (!lot || !canManage) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createPlateReading({
        lotId: lot.id,
        plate,
        direction: 'IN',
        sensorCode: labMode ? 'CAM-LPR-B-01' : 'CAM-LPR-LIVE',
        confidence: labMode ? 0.93 : 0.98,
        photoUrl: labMode
          ? 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80'
          : null,
        isDemo: labMode,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registar entrada');
    } finally {
      setSubmitting(false);
    }
  }

  async function simulateExit() {
    if (!lot || !canManage || !selectedSpot?.plate) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createPlateReading({
        lotId: lot.id,
        plate: selectedSpot.plate,
        direction: 'OUT',
        sensorCode: labMode ? 'CAM-LPR-B-02' : 'CAM-LPR-LIVE',
        confidence: labMode ? 0.95 : 0.98,
        photoUrl: labMode
          ? 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80'
          : null,
        isDemo: labMode,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registar saída');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-[40vh] place-items-center text-campus-deep/70">A carregar parque…</div>;
  }

  return (
    <div className="space-y-6">
      <PageBanner>
        {labMode
          ? 'Modo laboratório activo: as entradas LPR ficam marcadas como DEMO.'
          : 'Entradas e saídas LPR são registadas como telemetria real. O modo laboratório só está disponível para administradores.'}
      </PageBanner>

      <PageIntro
        eyebrow="Mobilidade no campus"
        title="Parque de viaturas"
        description={
          lot
            ? `${lot.name} · ${lot.free} livres de ${lot.capacity} · ocupação ${lot.occupancyPercent}%`
            : 'Sem parques registados'
        }
      />

      {error ? <p className="alert-error">{error}</p> : null}

      {lot ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Livres', value: lot.free, tone: 'text-emerald-700' },
              { label: 'Ocupadas', value: lot.occupied, tone: 'text-campus-ink' },
              { label: 'Reservadas', value: lot.reserved, tone: 'text-amber-700' },
              { label: 'Indisponíveis', value: lot.outOfService, tone: 'text-slate-600' },
            ].map((card) => (
              <div key={card.label} className="surface p-4">
                <p className="text-sm text-campus-deep/65">{card.label}</p>
                <p className={`mt-1 font-display text-3xl font-semibold sm:text-4xl ${card.tone}`}>{card.value}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.75fr)]">
            <div className="surface p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-campus-ink">Mapa de vagas</h2>
                  <p className="text-sm text-campus-deep/70">Clique numa vaga para ver matrícula e estado</p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {(['FREE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'] as const).map((s) => (
                    <span key={s} className={`rounded-md border px-2 py-1 font-semibold ${statusStyle[s]}`}>
                      {statusLabel[s]}
                    </span>
                  ))}
                </div>
              </div>

              <div className="parking-map-scroll mt-5">
                <div className="parking-rows space-y-3">
                  {rows.map((row) => (
                    <div key={row} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-sm font-semibold text-campus-deep/60 sm:w-6">{row}</span>
                      <div className="grid flex-1 grid-cols-6 gap-1.5 sm:gap-2">
                        {lot.spots
                          .filter((s) => s.rowLabel === row)
                          .map((spot) => (
                            <button
                              key={spot.id}
                              type="button"
                              onClick={() => setSelectedSpot(spot)}
                              className={`min-h-[3.25rem] rounded-lg border px-1 py-2 text-center transition hover:scale-[1.03] sm:min-h-0 sm:rounded-xl sm:px-2 sm:py-3 ${statusStyle[spot.status]} ${
                                selectedSpot?.id === spot.id ? 'ring-2 ring-campus-teal ring-offset-1 sm:ring-offset-2' : ''
                              }`}
                            >
                              <p className="text-[10px] font-bold sm:text-xs">{spot.code}</p>
                              <p className="mt-0.5 truncate text-[9px] opacity-90 sm:mt-1 sm:text-[10px]">
                                {spot.plate ?? '—'}
                              </p>
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="surface p-4 sm:p-5">
                <p className="eyebrow">Vaga seleccionada</p>
                {selectedSpot ? (
                  <>
                    <h3 className="mt-2 font-display text-2xl font-semibold text-campus-ink">{selectedSpot.code}</h3>
                    <p className="mt-1 text-sm text-campus-deep/70">{statusLabel[selectedSpot.status]}</p>
                    <p className="mt-3 font-mono text-lg font-semibold tracking-wide text-campus-ink">
                      {selectedSpot.plate ?? 'Sem matrícula'}
                    </p>
                    {labMode && selectedSpot.status === 'OCCUPIED' && selectedSpot.plate ? (
                      <button type="button" disabled={submitting} onClick={() => void simulateExit()} className="btn-secondary mt-4 w-full">
                        {labMode ? 'Simular saída LPR' : 'Registar saída LPR'}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-campus-deep/70">Seleccione uma vaga no mapa.</p>
                )}
              </div>

              {labMode ? (
                <form onSubmit={simulateEntry} className="surface space-y-3 p-4 sm:p-5">
                  <p className="eyebrow">{labMode ? 'Laboratório LPR' : 'Câmara LPR'}</p>
                  <h3 className="font-display text-lg font-semibold text-campus-ink">Entrada de viatura</h3>
                  {isAdmin ? (
                    <label className="flex items-center gap-2 text-sm text-campus-deep/80">
                      <input
                        type="checkbox"
                        checked={labMode}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setSettings((s) => (s ? { ...s, parkingLabMode: next } : s));
                          void api.updateAdminSettings({ parkingLabMode: next }).then((res) => setSettings(res.data));
                        }}
                      />
                      Modo laboratório (DEMO)
                    </label>
                  ) : null}
                  <label className="block text-sm font-medium text-campus-ink">
                    Matrícula (MZ)
                    <input
                      className="field-input font-mono tracking-wide"
                      value={plate}
                      onChange={(e) => setPlate(e.target.value.toUpperCase())}
                      placeholder="AIT 954 MC"
                      required
                    />
                  </label>
                  <p className="text-[11px] leading-relaxed text-campus-deep/55">
                    Formatos: <span className="font-mono">AXX 123 MP</span>, <span className="font-mono">AXX 123 MC</span>{' '}
                    (começam por A) ou <span className="font-mono">AAA 12 34</span>
                  </p>
                  <button type="submit" disabled={submitting} className="btn-primary w-full">
                    {submitting ? 'A processar…' : labMode ? 'Registar entrada (DEMO)' : 'Registar entrada'}
                  </button>
                </form>
              ) : null}
            </aside>
          </section>

          <section className="surface p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-xl font-semibold text-campus-ink">Leituras de matrícula</h2>
                <p className="text-sm text-campus-deep/70">Câmaras LPR · confiança · foto capturada</p>
              </div>
              {readings.some((r) => r.isDemo) ? (
                <span className="rounded-md bg-campus-accent/10 px-2 py-1 text-xs font-semibold text-campus-accent">
                  Inclui DEMO
                </span>
              ) : (
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                  Leituras reais
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {readings.map((r) => (
                <article key={r.id} className="overflow-hidden rounded-2xl border border-campus-line/80 bg-white">
                  <div className="relative h-36 bg-campus-mist">
                    {r.photoUrl ? (
                      <img src={r.photoUrl} alt={`Captura ${r.plate}`} className="h-full w-full object-cover" />
                    ) : null}
                    <span
                      className={`absolute left-3 top-3 rounded-md px-2 py-0.5 text-[10px] font-bold text-white ${
                        r.direction === 'IN' ? 'bg-campus-teal' : 'bg-campus-accent'
                      }`}
                    >
                      {r.direction === 'IN' ? 'ENTRADA' : 'SAÍDA'}
                    </span>
                    {r.isDemo ? (
                      <span className="absolute right-3 top-3 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white">
                        DEMO
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <p className="font-mono text-lg font-bold tracking-wider text-campus-ink">{r.plate}</p>
                    <p className="mt-1 text-xs text-campus-deep/65">
                      {r.sensorCode} · confiança {(r.confidence * 100).toFixed(0)}%
                      {r.spot ? ` · vaga ${r.spot.code}` : ''}
                    </p>
                    <p className="mt-1 text-[11px] text-campus-deep/50">
                      {new Date(r.recordedAt).toLocaleString('pt-PT')}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <p className="surface p-5 text-sm text-campus-deep/70">Execute o seed para criar o parque de demonstração.</p>
      )}
    </div>
  );
}
