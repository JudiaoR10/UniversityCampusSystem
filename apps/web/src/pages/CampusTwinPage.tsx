import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useCampusOpsData } from '../hooks/useCampusOpsData';
import { PageIntro } from '../components/PageIntro';
import { OccupancyPulse } from '../components/campus-ops/OccupancyPulse';
import { ChipTabs, EmptyState, LoadingState, PageBanner } from '../components/ui';
import type { POIDto } from '@smart-campus/shared-types';

const CampusTwinCanvas = lazy(() =>
  import('../components/campus-ops/CampusTwinCanvas').then((mod) => ({ default: mod.CampusTwinCanvas })),
);

type TwinMetric = 'occupancy' | 'temperature' | 'co2';

export function CampusTwinPage() {
  const { api } = useAuth();
  const { buildings, opsRooms, occupancyPeople, occupancyPercent, occupancyIsDemo, loading, error } = useCampusOpsData();
  const [metric, setMetric] = useState<TwinMetric>('occupancy');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pois, setPois] = useState<POIDto[]>([]);
  const [poisLoading, setPoisLoading] = useState(true);

  const selected = useMemo(() => {
    if (selectedId) return opsRooms.find((room) => room.id === selectedId) ?? null;
    return opsRooms.find((room) => room.buildingCode === 'D2' && room.occupied)
      ?? opsRooms.find((room) => room.buildingCode === 'D2')
      ?? opsRooms[0]
      ?? null;
  }, [opsRooms, selectedId]);
  const building = buildings.find((item) => item.id === selected?.buildingId) ?? buildings[0];

  useEffect(() => {
    api.pois()
      .then((res) => {
        setPois(res.data.filter((p) => p.edificio?.code === 'D2'));
      })
      .catch(() => setPois([]))
      .finally(() => setPoisLoading(false));
  }, [api]);

  if (loading) return <LoadingState label="A montar o gémeo digital do D2…" />;
  if (error) return <p className="alert-error">{error}</p>;
  if (opsRooms.length === 0) {
    return <EmptyState title="Sem salas para modelar" description="Cadastre salas no D2 para ver o volume 3D." />;
  }

  return (
    <div className="space-y-6">
      <PageBanner>
        Modelo esquemático a partir do cadastro. Clique numa sala para ver ocupação, ambiente e atalhos.
      </PageBanner>
      <PageIntro
        eyebrow="Campus físico"
        title="Gémeo digital do D2"
        description={`${occupancyPeople} pessoas em sessões vivas · ocupação ${occupancyPercent}%`}
        actions={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ChipTabs
              items={[
                { id: 'occupancy', label: 'Ocupação' },
                { id: 'temperature', label: 'Temperatura' },
                { id: 'co2', label: 'CO₂' },
              ]}
              value={metric}
              onChange={setMetric}
              ariaLabel="Métrica do gémeo"
            />
            <OccupancyPulse people={occupancyPeople} percent={occupancyPercent} isDemo={occupancyIsDemo} />
          </div>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <div className="space-y-3">
          <div className="surface twin-stage p-0 relative">
            <Suspense fallback={<LoadingState label="A carregar o modelo 3D…" />}>
              <CampusTwinCanvas rooms={opsRooms} metric={metric} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
            </Suspense>
            {!poisLoading && (
              <div className="absolute inset-0 pointer-events-none">
                {pois.map((p) => (
                  <div
                    key={p.id}
                    className="absolute pointer-events-auto"
                    style={{
                      left: `${Math.min(100, Math.max(0, (p.mapX ?? 0) / 1000 * 100))}%`,
                      top: `${Math.min(100, Math.max(0, (p.mapY ?? 0) / 1000 * 100))}%`,
                    }}
                  >
                    <button
                      className="flex flex-col items-center gap-1 bg-white/90 backdrop-blur-sm border border-campus-line rounded-full px-2 py-1 text-xs font-semibold text-campus-ink shadow-sm hover:bg-campus-teal hover:text-white transition"
                      onClick={(e) => {
                        e.stopPropagation();
                        alert(`${p.nome} — ${p.tipo}\nPiso: ${p.piso ?? 'N/D'}\n${p.descricao ?? ''}`);
                      }}
                    >
                      <span className="w-2 h-2 rounded-full bg-campus-teal border-2 border-white"></span>
                      <span>{p.nome}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-campus-deep/65">
              <span className="rounded-full bg-campus-teal/15 px-3 py-1 font-semibold text-campus-teal">Ocupada</span>
              <span className="rounded-full bg-campus-sand px-3 py-1 font-semibold">Livre</span>
              <span className="rounded-full bg-campus-accent/15 px-3 py-1 font-semibold text-campus-accent">Atenção ambiental</span>
            </div>
          </div>
          <aside className="surface h-fit space-y-4 p-5">
            <p className="eyebrow">{building?.code ?? 'D2'}</p>
            <h2 className="font-display text-2xl font-semibold text-campus-ink">{selected?.name ?? 'Sala'}</h2>
            <p className="text-sm text-campus-deep/70">{selected?.code} · piso {selected?.floor}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-campus-mist/80 p-3">
                <p className="text-xs text-campus-deep/60">Pessoas</p>
                <p className="font-display text-2xl font-semibold">{selected?.people ?? 0}</p>
              </div>
              <div className="rounded-xl bg-campus-mist/80 p-3">
                <p className="text-xs text-campus-deep/60">Capacidade</p>
                <p className="font-display text-2xl font-semibold">{selected?.capacity ?? 0}</p>
              </div>
              <div className="rounded-xl bg-campus-mist/80 p-3">
                <p className="text-xs text-campus-deep/60">Temperatura</p>
                <p className="font-display text-2xl font-semibold">{selected?.temperature ?? '—'}{selected?.temperature != null ? '°' : ''}</p>
              </div>
              <div className="rounded-xl bg-campus-mist/80 p-3">
                <p className="text-xs text-campus-deep/60">CO₂</p>
                <p className="font-display text-2xl font-semibold">{selected?.co2 ?? '—'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/rooms" className="btn-primary">Ver salas</Link>
              <Link to="/incidents" className="btn-secondary">Ocorrências</Link>
              <Link to="/pois" className="btn-secondary">Pontos de Interesse</Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
