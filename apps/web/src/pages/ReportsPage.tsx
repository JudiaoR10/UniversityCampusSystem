import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { IncidentDto, OpsSnapshot, ReadingDto, ReportSummaryDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { EmptyState, LoadingState, StatusPill } from '../components/ui';
import { StatCard } from '../components/StatCard';
import { ModuleGlyph } from '../components/ModuleGlyph';
import { downloadText, toCsv, toSimplePdf } from '../lib/exportFiles';

export function ReportsPage() {
  const { api } = useAuth();
  const [data, setData] = useState<ReportSummaryDto | null>(null);
  const [snapshot, setSnapshot] = useState<OpsSnapshot | null>(null);
  const [readings, setReadings] = useState<ReadingDto[]>([]);
  const [incidents, setIncidents] = useState<IncidentDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.reportSummary(), api.opsSnapshot(), api.readings({ limit: 80 }), api.incidents()])
      .then(([summaryRes, opsRes, readingsRes, incidentsRes]) => {
        setData(summaryRes.data);
        setSnapshot(opsRes.data);
        setReadings(readingsRes.data);
        setIncidents(incidentsRes.data);
      })
      .catch((err: Error) => setError(err.message));
  }, [api]);

  if (error) return <p className="alert-error">{error}</p>;
  if (!data) return <LoadingState label="A agregar indicadores…" />;

  const occupiedRooms = (snapshot?.rooms ?? []).filter((room) => room.occupied);
  const openIncidents = incidents.filter((incident) => incident.status === 'OPEN' || incident.status === 'IN_PROGRESS');

  function exportCsv() {
    const rows: Array<Array<string | number>> = [
      ['Indicador', 'Valor'],
      ['Salas ocupadas', `${data!.occupiedRooms}/${data!.roomsCount}`],
      ['Ocupação %', data!.occupancyPercent],
      ['Ocorrências abertas', data!.openIncidents],
      ['Dispositivos online', data!.devicesOnline],
      ['Leituras última hora', data!.liveReadingsLastHour],
      [],
      ['Sala', 'Piso', 'Ocupada', 'Pessoas'],
      ...(snapshot?.rooms ?? []).map((room) => [room.code, room.floor, room.occupied ? 'sim' : 'não', room.people]),
      [],
      ['Leitura', 'Métrica', 'Valor', 'Quando'],
      ...readings.slice(0, 40).map((reading) => [
        reading.sensor?.name ?? reading.sensorId,
        reading.sensor?.metric ?? '',
        reading.value,
        reading.recordedAt,
      ]),
      [],
      ['Ocorrência', 'Estado', 'Prioridade'],
      ...incidents.slice(0, 20).map((incident) => [incident.title, incident.status, incident.priority]),
    ];
    downloadText(`relatorio-campus-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  }

  function exportPdf() {
    const lines = [
      `Salas ocupadas: ${data!.occupiedRooms}/${data!.roomsCount}`,
      `Ocupação: ${data!.occupancyPercent}%`,
      `Ocorrências abertas: ${data!.openIncidents}`,
      `Dispositivos online: ${data!.devicesOnline}`,
      `Leituras na última hora: ${data!.liveReadingsLastHour}`,
      '',
      ...((snapshot?.rooms ?? []).slice(0, 12).map((room) => `${room.code} · piso ${room.floor} · ${room.occupied ? `${room.people} pessoas` : 'livre'}`)),
    ];
    downloadText(`relatorio-campus-${new Date().toISOString().slice(0, 10)}.pdf`, toSimplePdf('Relatório Smart Campus', lines), 'application/pdf');
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Indicadores"
        title="Relatórios"
        description="Agregação em tempo real a partir de salas, IoT, ocorrências e manutenção. Exporte o resumo para CSV ou PDF."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={exportCsv}>
              Exportar CSV
            </button>
            <button type="button" className="btn-secondary" onClick={exportPdf}>
              Exportar PDF
            </button>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Salas ocupadas" value={`${data.occupiedRooms}/${data.roomsCount}`} hint={`${data.occupancyPercent}% de ocupação`} to="/rooms" icon={<ModuleGlyph name="rooms" />} />
        <StatCard label="Ocorrências abertas" value={data.openIncidents} hint="OPEN e IN_PROGRESS" to="/incidents" icon={<ModuleGlyph name="incidents" />} />
        <StatCard label="Dispositivos online" value={data.devicesOnline} hint={`${data.devicesOffline} offline`} to="/devices" icon={<ModuleGlyph name="iot" />} />
        <StatCard label="Alertas por confirmar" value={data.unreadAlerts} hint="Inclui DEMO e telemetria" to="/alerts" icon={<ModuleGlyph name="alerts" />} />
        <StatCard label="Leituras na última hora" value={data.liveReadingsLastHour} hint={`${data.demoReadingsLastHour} DEMO`} to="/readings" icon={<ModuleGlyph name="readings" />} />
        <StatCard label="Manutenção em curso" value={data.openMaintenance} hint="Acções abertas ou em curso" to="/maintenance" icon={<ModuleGlyph name="maintenance" />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl font-semibold text-campus-ink">Salas agora</h3>
            <Link to="/ops" className="text-xs font-semibold text-campus-teal">
              Abrir mapa
            </Link>
          </div>
          {occupiedRooms.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Nenhuma sessão em curso" description="Quando houver aulas, a ocupação aparece aqui." />
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {occupiedRooms.slice(0, 8).map((room) => (
                <li key={room.id} className="flex items-center justify-between rounded-xl bg-campus-mist/70 px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold text-campus-ink">{room.code}</span>
                    <span className="text-campus-deep/60"> · piso {room.floor}</span>
                  </span>
                  <StatusPill tone="success">{room.people} pessoas</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl font-semibold text-campus-ink">Fila de ocorrências</h3>
            <Link to="/incidents" className="text-xs font-semibold text-campus-teal">
              Tratar
            </Link>
          </div>
          {openIncidents.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Sem ocorrências abertas" description="A manutenção está em dia." />
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {openIncidents.slice(0, 8).map((incident) => (
                <li key={incident.id} className="rounded-xl bg-campus-mist/70 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-campus-ink">{incident.title}</span>
                    <StatusPill tone={incident.priority === 'HIGH' || incident.priority === 'CRITICAL' ? 'danger' : 'warning'}>
                      {incident.priority}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-xs text-campus-deep/60">{incident.status}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
