import type { ReportSummaryDto } from '@smart-campus/shared-types';
import { prisma } from '../../../lib/prisma.js';
import { computeOccupancyByRoom } from '../../ops/application/occupancyService.js';

export async function getReportSummary(actorRole?: string): Promise<ReportSummaryDto> {
  const isAdmin = actorRole === 'ADMIN';
  const roomFilter = isAdmin ? {} : { temPlaca: true };
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [
    occupancy,
    roomsCount,
    openIncidents,
    devicesOnline,
    devicesOffline,
    unreadAlerts,
    liveReadingsLastHour,
    demoReadingsLastHour,
    openMaintenance,
  ] = await Promise.all([
    computeOccupancyByRoom(),
    prisma.room.count({ where: roomFilter }),
    prisma.incident.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.device.count({ where: { status: 'ONLINE' } }),
    prisma.device.count({ where: { status: 'OFFLINE' } }),
    prisma.alert.count({ where: { acknowledged: false } }),
    prisma.reading.count({ where: { recordedAt: { gte: hourAgo }, isDemo: false } }),
    prisma.reading.count({ where: { recordedAt: { gte: hourAgo }, isDemo: true } }),
    prisma.maintenanceAction.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
  ]);

  const occupiedRooms = [...occupancy.byRoom.values()].filter((row) => row.occupied).length;

  return {
    roomsCount,
    occupiedRooms,
    occupancyPercent: occupancy.occupancyPercent,
    openIncidents,
    devicesOnline,
    devicesOffline,
    unreadAlerts,
    liveReadingsLastHour,
    demoReadingsLastHour,
    openMaintenance,
  };
}
