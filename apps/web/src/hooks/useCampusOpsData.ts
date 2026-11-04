import { useEffect, useState } from 'react';
import type { DashboardSummary, RoomDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { apiBaseUrl } from '../lib/apiBaseUrl';
import type { BuildingMetric, CampusBuildingView, CampusOpsData, MetricStatus, WeeklyCell } from '../components/campus-ops/types';

type BuildingApi = {
  id: string;
  code: string;
  name: string;
  floors: number;
  _count?: { rooms: number };
};

type DeviceApi = {
  id: string;
  code: string;
  status: string;
  room?: { id: string; code: string; name: string } | null;
  sensors?: Array<{ id: string; metric: string; unit: string | null }>;
};

const MAP_POSITIONS: Record<string, { x: number; y: number }> = {
  A: { x: 28, y: 42 },
  B: { x: 62, y: 48 },
};

function statusFor(metric: 'temperature' | 'co2' | 'humidity' | 'utilisation', value: number): MetricStatus {
  if (metric === 'temperature') {
    if (value < 18 || value > 27) return 'WARN';
    return 'GOOD';
  }
  if (metric === 'co2') {
    if (value > 1000) return 'CRITICAL';
    if (value > 800) return 'WARN';
    return 'GOOD';
  }
  if (metric === 'humidity') {
    if (value < 30 || value > 65) return 'WARN';
    return 'GOOD';
  }
  if (value < 15) return 'LOW';
  if (value > 85) return 'WARN';
  return 'GOOD';
}

function metric(value: number, unit: string, kind: 'temperature' | 'co2' | 'humidity' | 'utilisation', isDemo: boolean): BuildingMetric {
  return { value, unit, status: statusFor(kind, value), isDemo };
}

function demoMetricsFor(code: string): Pick<CampusBuildingView, 'temperature' | 'co2' | 'humidity' | 'utilisation'> {
  if (code === 'B') {
    return {
      temperature: metric(22.1, '°C', 'temperature', true),
      co2: metric(640, 'ppm', 'co2', true),
      humidity: metric(51.2, '%', 'humidity', true),
      utilisation: metric(34.5, '%', 'utilisation', true),
    };
  }
  return {
    temperature: metric(20.4, '°C', 'temperature', true),
    co2: metric(561, 'ppm', 'co2', true),
    humidity: metric(47.7, '%', 'humidity', true),
    utilisation: metric(9.1, '%', 'utilisation', true),
  };
}

function buildWeeklyPattern(seedTemp: number): WeeklyCell[] {
  const cells: WeeklyCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const lectureBoost = hour >= 8 && hour <= 18 && day < 5 ? 0.45 : 0.1;
      const wave = Math.sin((hour / 24) * Math.PI * 2) * 0.2;
      const intensity = Math.max(0.05, Math.min(1, lectureBoost + wave + (seedTemp - 20) * 0.02 + (day % 3) * 0.05));
      cells.push({ day, hour, intensity, isDemo: true });
    }
  }
  return cells;
}

export function useCampusOpsData(): CampusOpsData {
  const { api } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [buildings, setBuildings] = useState<CampusBuildingView[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [weeklyPattern, setWeeklyPattern] = useState<WeeklyCell[]>([]);
  const [occupancyPeople, setOccupancyPeople] = useState(0);
  const [occupancyPercent, setOccupancyPercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [dashRes, roomsRes, buildingsRes, devicesRes] = await Promise.all([
          api.dashboard(),
          api.rooms(),
          fetch(`${apiBaseUrl}/buildings`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('sc_access')}` },
          }).then(async (r) => {
            const json = await r.json();
            if (!r.ok) throw new Error(json.message || 'Erro ao carregar edifícios');
            return json as { data: BuildingApi[] };
          }),
          api.devices(),
        ]);

        if (cancelled) return;

        const roomList = roomsRes.data;
        const deviceList = devicesRes.data as DeviceApi[];
        setSummary(dashRes.data);
        setRooms(roomList);

        let liveTemp: number | null = null;
        const firstSensor = deviceList.flatMap((d) => d.sensors ?? [])[0];
        if (firstSensor?.id) {
          try {
            const readingsRes = await fetch(
              `${apiBaseUrl}/sensors/${firstSensor.id}/readings`,
              { headers: { Authorization: `Bearer ${localStorage.getItem('sc_access')}` } },
            );
            const readingsJson = await readingsRes.json();
            if (readingsRes.ok && Array.isArray(readingsJson.data) && readingsJson.data[0]) {
              liveTemp = Number(readingsJson.data[0].value);
            }
          } catch {
            // keep demo metrics
          }
        }

        const views: CampusBuildingView[] = buildingsRes.data.map((b) => {
          const pos = MAP_POSITIONS[b.code] ?? { x: 45, y: 50 };
          const buildingRooms = roomList.filter((r) => r.building.id === b.id);
          const buildingDevices = deviceList.filter((d) =>
            buildingRooms.some((r) => r.id === d.room?.id || r.code === d.room?.code),
          );
          const base = demoMetricsFor(b.code);
          if (liveTemp != null && b.code === 'A') {
            base.temperature = metric(liveTemp, '°C', 'temperature', true);
          }
          const occupied = buildingRooms.filter((r) => r.status === 'OCCUPIED').length;
          const utilFromRooms =
            buildingRooms.length > 0 ? Math.round((occupied / buildingRooms.length) * 1000) / 10 : base.utilisation.value;

          return {
            id: b.id,
            code: b.code,
            name: b.name,
            floors: b.floors,
            roomsCount: b._count?.rooms ?? buildingRooms.length,
            devicesCount: buildingDevices.length,
            mapX: pos.x,
            mapY: pos.y,
            ...base,
            utilisation: metric(utilFromRooms || base.utilisation.value, '%', 'utilisation', true),
            isDemo: true,
          };
        });

        setBuildings(views);

        const capacity = roomList.reduce((acc, r) => acc + r.capacity, 0) || 1;
        const people = Math.round(capacity * 0.035);
        setOccupancyPeople(people);
        setOccupancyPercent(Math.round((people / capacity) * 1000) / 10);
        setWeeklyPattern(buildWeeklyPattern(liveTemp ?? 24));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Falha ao carregar operações');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api]);

  return {
    summary,
    buildings,
    rooms,
    weeklyPattern,
    occupancyPeople,
    occupancyPercent,
    loading,
    error,
  };
}
