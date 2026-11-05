import { Link } from 'react-router-dom';
import { campusModules } from '@smart-campus/shared-types';
import { OccupancyPulse } from '../components/campus-ops/OccupancyPulse';
import { HubCard } from '../components/HubCard';
import { ModuleGlyph } from '../components/ModuleGlyph';
import { PageIntro } from '../components/PageIntro';
import { StatCard } from '../components/StatCard';
import { LoadingState, PageBanner } from '../components/ui';
import { useCampusOpsData } from '../hooks/useCampusOpsData';

const featured = ['ops', 'campus-twin'];
const directory = ['buildings', 'rooms', 'parking', 'maintenance', 'laboratories', 'equipment'];

export function CampusHubPage() {
  const { buildings, opsRooms, occupancyPeople, occupancyPercent, occupancyIsDemo, loading } = useCampusOpsData();
  const featuredItems = campusModules.filter((module) => featured.includes(module.key));
  const directoryItems = campusModules.filter((module) => directory.includes(module.key));
  const occupied = opsRooms.filter((room) => room.occupied).length;

  return (
    <div className="space-y-8">
      <PageBanner>
        Veja o campus em mapa 2D ou no gémeo 3D do D2. Edifícios, salas, parque e manutenção continuam a um clique.
      </PageBanner>
      <PageIntro
        eyebrow="Espaço físico"
        title="Campus físico"
        description="O D2, as salas e o parque — com ocupação viva e atalhos para o que precisa de atenção."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/ops" className="btn-primary">
              Mapa operacional
            </Link>
            <Link to="/campus/twin" className="btn-secondary">
              Gémeo 3D
            </Link>
          </div>
        }
      />

      {loading ? (
        <LoadingState label="A ler ocupação do D2…" />
      ) : (
        <section className="hero-panel grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Edifícios" value={buildings.length} hint="Cadastro no mapa do campus" to="/buildings" icon={<ModuleGlyph name="buildings" />} />
            <StatCard label="Salas ocupadas" value={`${occupied}/${opsRooms.length || 0}`} hint="Sessões a decorrer agora" to="/rooms" icon={<ModuleGlyph name="rooms" />} />
            <StatCard label="Pessoas no D2" value={occupancyPeople} hint={`${occupancyPercent}% da capacidade em uso`} to="/ops" icon={<ModuleGlyph name="ops" />} />
          </div>
          <OccupancyPulse people={occupancyPeople} percent={occupancyPercent} isDemo={occupancyIsDemo} />
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {featuredItems.map((item) => (
          <HubCard key={item.key} item={item} kicker="Vista do campus" featured />
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="section-title">Cadastro e operações</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {directoryItems.map((item) => (
            <HubCard key={item.key} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
