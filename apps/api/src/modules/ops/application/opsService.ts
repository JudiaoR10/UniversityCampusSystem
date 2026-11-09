import type { OpsBuildingMetric, OpsMetricStatus, OpsSnapshot, OpsWeeklyCell } from '@smart-campus/shared-types';
import { prisma } from '../../../lib/prisma.js';
import { getAdminSettings } from '../../admin/application/adminService.js';
import { computeOccupancyByRoom } from './occupancyService.js';

const FALLBACK_MAP: Record<string, { x: number; y: number }> = {
  A: { x: 28, y: 42 },
  B: { x: 62, y: 48 },
  D2: { x: 48, y: 46 },
};

function statusFor(
  metric: 'temperature' | 'co2' | 'humidity' | 'utilisation',
  value: number | null,
  thresholds: { tempWarningMax: number; co2WarningMax: number; co2CriticalMax: number },
): OpsMetricStatus {
  if (value == null) return 'LOW';
  if (metric === 'temperature') {
    if (value < 18 || value > thresholds.tempWarningMax) return 'WARN';
    return 'GOOD';
  }
  if (metric === 'co2') {
    if (value > thresholds.co2CriticalMax) return 'CRITICAL';
    if (value > thresholds.co2WarningMax) return 'WARN';
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

function metric(
  value: number | null,
  unit: string,
  kind: 'temperature' | 'co2' | 'humidity' | 'utilisation',
  isDemo: boolean,
  thresholds: { tempWarningMax: number; co2WarningMax: number; co2CriticalMax: number },
): OpsBuildingMetric {
  return { value, unit, status: statusFor(kind, value, thresholds), isDemo };
}

function mapPosition(code: string, mapX: number | null, mapY: number | null, index: number) {
  if (mapX != null && mapY != null) return { x: mapX, y: mapY };
  const known = FALLBACK_MAP[code];
  if (known) return known;
  return { x: 30 + ((index * 17) % 50), y: 32 + ((index * 13) % 40) };
}

export async function getOpsSnapshot(actorRole?: string): Promise<OpsSnapshot> {
  const isAdmin = actorRole === 'ADMIN';
  const roomWhere = isAdmin ? {} : { temPlaca: true };
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [settings, occupancy, buildings, rooms, devices, latestReadings, weekReadings] = await Promise.all([
    getAdminSettings(),
    computeOccupancyByRoom(),
    prisma.building.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { rooms: true } } },
    }),
    prisma.room.findMany({
      where: roomWhere,
      select: { id: true, code: true, name: true, floor: true, status: true, capacity: true, buildingId: true },
    }),
    prisma.device.findMany({
      select: { id: true, roomId: true },
    }),
    prisma.reading.findMany({
      orderBy: { recordedAt: 'desc' },
      take: 400,
      include: { sensor: { select: { id: true, metric: true, unit: true, deviceId: true } } },
    }),
    prisma.reading.findMany({
      where: { recordedAt: { gte: since }, isDemo: false },
      select: { recordedAt: true },
    }),
  ]);

  const thresholds = {
    tempWarningMax: settings.tempWarningMax,
    co2WarningMax: settings.co2WarningMax,
    co2CriticalMax: settings.co2CriticalMax,
  };

  const roomsByBuilding = new Map<string, typeof rooms>();
  for (const room of rooms) {
    const list = roomsByBuilding.get(room.buildingId) ?? [];
    list.push(room);
    roomsByBuilding.set(room.buildingId, list);
  }

  const latestByDeviceMetric = new Map<string, { value: number; unit: string | null; isDemo: boolean }>();
  for (const reading of latestReadings) {
    const key = `${reading.sensor.deviceId}:${reading.sensor.metric}`;
    if (latestByDeviceMetric.has(key)) continue;
    latestByDeviceMetric.set(key, {
      value: reading.value,
      unit: reading.sensor.unit,
      isDemo: reading.isDemo,
    });
  }

  const latestByRoomMetric = new Map<string, number>();
  for (const reading of latestReadings) {
    const device = devices.find((item) => item.id === reading.sensor.deviceId);
    if (!device?.roomId) continue;
    const key = `${device.roomId}:${reading.sensor.metric}`;
    if (latestByRoomMetric.has(key)) continue;
    latestByRoomMetric.set(key, reading.value);
  }

  const views = buildings.map((building, index) => {
    const buildingRooms = roomsByBuilding.get(building.id) ?? [];
    const roomIds = new Set(buildingRooms.map((r) => r.id));
    const buildingDevices = devices.filter((d) => d.roomId && roomIds.has(d.roomId));
    const pos = mapPosition(building.code, building.mapX, building.mapY, index);

    const pick = (metricName: 'temperature' | 'co2' | 'humidity', unit: string) => {
      let live: { value: number; unit: string | null; isDemo: boolean } | undefined;
      let demo: { value: number; unit: string | null; isDemo: boolean } | undefined;
      for (const device of buildingDevices) {
        const found = latestByDeviceMetric.get(`${device.id}:${metricName}`);
        if (!found) continue;
        if (!found.isDemo && !live) live = found;
        if (found.isDemo && !demo) demo = found;
      }
      const chosen = live ?? demo;
      return metric(chosen?.value ?? null, chosen?.unit ?? unit, metricName, Boolean(chosen?.isDemo && !live), thresholds);
    };

    const occupied = buildingRooms.filter((r) => occupancy.byRoom.get(r.id)?.occupied).length;
    const utilisationValue =
      buildingRooms.length > 0 ? Math.round((occupied / buildingRooms.length) * 1000) / 10 : 0;
    const env = {
      temperature: pick('temperature', '°C'),
      co2: pick('co2', 'ppm'),
      humidity: pick('humidity', '%'),
    };
    const hasLiveEnv = [env.temperature, env.co2, env.humidity].some((m) => m.value != null && !m.isDemo);

    return {
      id: building.id,
      code: building.code,
      name: building.name,
      floors: building.floors,
      roomsCount: building._count.rooms,
      devicesCount: buildingDevices.length,
      mapX: pos.x,
      mapY: pos.y,
      ...env,
      utilisation: metric(utilisationValue, '%', 'utilisation', occupancy.occupancyIsDemo, thresholds),
      isDemo: !hasLiveEnv && [env.temperature, env.co2, env.humidity].every((m) => m.value == null || m.isDemo),
    };
  });

  const buildingById = new Map(buildings.map((building) => [building.id, building]));
  const roomViews = rooms.map((room) => {
    const occ = occupancy.byRoom.get(room.id);
    const building = buildingById.get(room.buildingId);
    return {
      id: room.id,
      code: room.code,
      name: room.name,
      floor: room.floor,
      buildingId: room.buildingId,
      buildingCode: building?.code ?? '',
      occupied: Boolean(occ?.occupied),
      people: occ?.people ?? 0,
      capacity: room.capacity,
      temperature: latestByRoomMetric.get(`${room.id}:temperature`) ?? null,
      co2: latestByRoomMetric.get(`${room.id}:co2`) ?? null,
    };
  });

  const buckets = new Map<string, number>();
  for (const reading of weekReadings) {
    const day = (reading.recordedAt.getDay() + 6) % 7;
    const hour = reading.recordedAt.getHours();
    const key = `${day}:${hour}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const maxCount = Math.max(1, ...buckets.values());
  const weeklyPattern: OpsWeeklyCell[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = buckets.get(`${day}:${hour}`) ?? 0;
      weeklyPattern.push({
        day,
        hour,
        intensity: count / maxCount,
        isDemo: false,
      });
    }
  }

  return {
    buildings: views,
    rooms: roomViews,
    weeklyPattern,
    occupancyPeople: occupancy.occupancyPeople,
    occupancyPercent: occupancy.occupancyPercent,
    occupancyIsDemo: occupancy.occupancyIsDemo,
  };
}
