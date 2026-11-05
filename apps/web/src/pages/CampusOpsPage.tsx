import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCampusOpsData } from '../hooks/useCampusOpsData';
import { BuildingDetailPanel } from '../components/campus-ops/BuildingDetailPanel';
import { CampusMap } from '../components/campus-ops/CampusMap';
import { LiveTicker } from '../components/campus-ops/LiveTicker';
import { MetricFilters } from '../components/campus-ops/MetricFilters';
import { OccupancyPulse } from '../components/campus-ops/OccupancyPulse';
import { WeeklyPatternChart } from '../components/campus-ops/WeeklyPatternChart';
import type { OpsMetric } from '../components/campus-ops/types';
import { PageIntro } from '../components/PageIntro';
import { LoadingState, PageBanner } from '../components/ui';
import { coreStatusLabel } from '../lib/labels';

export function CampusOpsPage() {
  const {
    summary,
    buildings,
    opsRooms,
    weeklyPattern,
    occupancyPeople,
    occupancyPercent,
    occupancyIsDemo,
    loading,
    error,
  } = useCampusOpsData();
  const [metric, setMetric] = useState<OpsMetric>('occupancy');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (!selectedId && buildings[0]) {
      setSelectedId(buildings[0].id);
      setPanelOpen(true);
    }
  }, [buildings, selectedId]);

  const selected = useMemo(() => buildings.find((b) => b.id === selectedId) ?? null, [buildings, selectedId]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setPanelOpen(true);
  }

  if (loading) {
    return <LoadingState label="A preparar o centro de operações…" />;
  }

  if (error) {
    return <p className="alert-error">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <PageBanner>
        Centro de operações com ocupação real das salas e telemetria MQTT quando o broker estiver ligado.{' '}
        <Link to="/dashboard" className="inline font-semibold text-campus-teal underline decoration-campus-teal/30 underline-offset-2">
          Abrir dashboard clássico
        </Link>
      </PageBanner>

      <PageIntro
        eyebrow="Centro de operações"
        title="Smart Campus"
        description={
          <>
            Olá, {summary?.currentUser.fullName} · {coreStatusLabel(summary?.coreStatus)} · {summary?.roomsCount ?? 0} salas ·{' '}
            {summary?.openIncidents ?? 0} ocorrências abertas
          </>
        }
        actions={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <MetricFilters value={metric} onChange={setMetric} />
            <OccupancyPulse people={occupancyPeople} percent={occupancyPercent} isDemo={occupancyIsDemo} />
          </div>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <CampusMap buildings={buildings} rooms={opsRooms} metric={metric} selectedId={selectedId} onSelect={handleSelect} />
        <BuildingDetailPanel building={selected} open={panelOpen} />
      </section>

      <WeeklyPatternChart cells={weeklyPattern} />
      <LiveTicker summary={summary} />

      <section className="flex flex-wrap gap-2.5">
        {[
          { to: '/rooms', label: 'Salas' },
          { to: '/incidents', label: 'Ocorrências' },
          { to: '/devices', label: 'Dispositivos' },
          { to: '/campus/twin', label: 'Gémeo 3D' },
          { to: '/dashboard', label: 'Dashboard Core' },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="btn-secondary !py-2 text-sm">
            {item.label}
          </Link>
        ))}
      </section>
    </div>
  );
}
