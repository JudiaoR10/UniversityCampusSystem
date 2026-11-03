import { campusModules } from '@smart-campus/shared-types';
import { prisma } from '../../../lib/prisma.js';
import { getMe } from '../../auth/application/authService.js';

export async function getDashboard(userId: string) {
  const viewer = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: { select: { code: true } } },
  });
  const canSeeAlerts = viewer?.role.code !== 'STUDENT';

  const [currentUser, roomsCount, openIncidents, devicesCount, recentAlerts, recentActivity] = await Promise.all([
    getMe(userId),
    prisma.room.count(),
    prisma.incident.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.device.count(),
    canSeeAlerts
      ? prisma.alert.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
      : Promise.resolve([]),
    prisma.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
  ]);

  return {
    currentUser,
    coreStatus: 'healthy' as const,
    roomsCount,
    openIncidents,
    devicesCount,
    recentAlerts: recentAlerts.map((a) => ({
      id: a.id,
      title: a.title,
      severity: a.severity,
      createdAt: a.createdAt.toISOString(),
      isDemo: a.isDemo,
    })),
    modulesAvailable: campusModules.filter((m) => m.status === 'available').length,
    modulesInDevelopment: campusModules.filter((m) => m.status === 'development').length,
    recentActivity: recentActivity.map((e) => ({
      id: e.id,
      action: e.action,
      resource: e.resource,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}
