import { useEffect, useState } from 'react';
import type { DashboardSummary, OpsSnapshot, RoomDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import type { CampusBuildingView, CampusOpsData, WeeklyCell } from '../components/campus-ops/types';

export function useCampusOpsData(): CampusOpsData {
  const { api } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [buildings, setBuildings] = useState<CampusBuildingView[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [opsRooms, setOpsRooms] = useState<OpsSnapshot['rooms']>([]);
  const [weeklyPattern, setWeeklyPattern] = useState<WeeklyCell[]>([]);
  const [occupancyPeople, setOccupancyPeople] = useState(0);
  const [occupancyPercent, setOccupancyPercent] = useState(0);
  const [occupancyIsDemo, setOccupancyIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [dashRes, roomsRes, opsRes] = await Promise.all([
          api.dashboard(),
          api.rooms(),
          api.opsSnapshot(),
        ]);
        if (cancelled) return;

        const snapshot: OpsSnapshot = opsRes.data;
        setSummary(dashRes.data);
        setRooms(roomsRes.data);
        setOpsRooms(snapshot.rooms ?? []);
        setBuildings(snapshot.buildings);
        setWeeklyPattern(snapshot.weeklyPattern);
        setOccupancyPeople(snapshot.occupancyPeople);
        setOccupancyPercent(snapshot.occupancyPercent);
        setOccupancyIsDemo(snapshot.occupancyIsDemo);
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
    opsRooms,
    weeklyPattern,
    occupancyPeople,
    occupancyPercent,
    occupancyIsDemo,
    loading,
    error,
  };
}
