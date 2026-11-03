import type { AlertSeverity, DeviceStatus, Prisma } from '@prisma/client';
import { notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';

export async function acknowledgeAlert(id: string, actorId: string, correlationId: string) {
  const existing = await prisma.alert.findUnique({ where: { id } });
  if (!existing) throw notFound('ALERT_NOT_FOUND', 'Alerta não encontrado');

  const alert = existing.acknowledged
    ? existing
    : await prisma.alert.update({ where: { id }, data: { acknowledged: true } });

  if (!existing.acknowledged) {
    await audit({
      action: 'ALERT_ACK',
      resource: 'Alert',
      resourceId: alert.id,
      actorId,
      correlationId,
      metadata: { severity: alert.severity },
    });
  }

  return {
    ...alert,
    createdAt: alert.createdAt.toISOString(),
    updatedAt: alert.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Alertas de estado de dispositivo
// ---------------------------------------------------------------------------

/** Quem recebe as notificações operacionais (STUDENT nunca). */
const NOTIFIED_ROLES = ['TECHNICIAN', 'COORDINATOR', 'ADMIN'] as const;

type DeviceRef = { id: string; code: string; name: string };

const offlineTitle = (code: string) => `Dispositivo ${code} offline`;
const maintenanceTitle = (code: string) => `Dispositivo ${code} em manutenção`;

export async function raiseDeviceAlert(
  tx: Prisma.TransactionClient,
  device: DeviceRef,
  from: DeviceStatus,
  to: DeviceStatus,
) {
  if (from === to) return null;

  // Ao sair de um estado com alerta aberto, fecha esse alerta
  const staleTitles: string[] = [];
  if (from === 'OFFLINE') staleTitles.push(offlineTitle(device.code));
  if (from === 'MAINTENANCE') staleTitles.push(maintenanceTitle(device.code));
  if (staleTitles.length > 0) {
    await tx.alert.updateMany({
      where: { deviceId: device.id, title: { in: staleTitles }, acknowledged: false },
      data: { acknowledged: true },
    });
  }

  let title: string;
  let message: string;
  let severity: AlertSeverity;

  if (to === 'OFFLINE' || to === 'MAINTENANCE') {
    if (to === 'OFFLINE') {
      title = offlineTitle(device.code);
      message = `O dispositivo "${device.name}" (${device.code}) passou de ${from} para OFFLINE.`;
    } else {
      title = maintenanceTitle(device.code);
      message = `O dispositivo "${device.name}" (${device.code}) está em manutenção.`;
    }
    severity = 'WARNING';

    const open = await tx.alert.findFirst({
      where: { deviceId: device.id, title, acknowledged: false },
      select: { id: true },
    });
    if (open) return null;
  } else if (to === 'ONLINE' && (from === 'OFFLINE' || from === 'MAINTENANCE')) {
    title = `Dispositivo ${device.code} recuperado`;
    message = `O dispositivo "${device.name}" (${device.code}) está ONLINE.`;
    severity = 'INFO';
  } else {
    return null;
  }

  const alert = await tx.alert.create({
    data: { title, message, severity, isDemo: false, deviceId: device.id },
  });

  const recipients = await tx.user.findMany({
    where: { isActive: true, role: { code: { in: [...NOTIFIED_ROLES] } } },
    select: { id: true },
  });

  if (recipients.length > 0) {
    await tx.notification.createMany({
      data: recipients.map((u) => ({ userId: u.id, title, body: message })),
    });
  }

  return alert;
}