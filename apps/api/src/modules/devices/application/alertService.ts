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

type SensorThresholds = {
  id: string;
  code: string;
  name: string;
  metric: string;
  unit: string | null;
  deviceId: string;
  warningMin: number | null;
  warningMax: number | null;
  criticalMin: number | null;
  criticalMax: number | null;
};

const DEFAULT_THRESHOLDS: Record<
  string,
  { warningMin?: number; warningMax?: number; criticalMin?: number; criticalMax?: number }
> = {
  temperature: { warningMin: 18, warningMax: 27, criticalMax: 32 },
  co2: { warningMax: 800, criticalMax: 1000 },
  humidity: { warningMin: 30, warningMax: 65 },
};

let settingsCache = { at: 0, tempWarningMax: 27, co2WarningMax: 800, co2CriticalMax: 1000 };

async function systemThresholds(tx: Prisma.TransactionClient) {
  if (Date.now() - settingsCache.at < 30_000) return settingsCache;
  const rows = await tx.systemSetting.findMany({
    where: { key: { in: ['tempWarningMax', 'co2WarningMax', 'co2CriticalMax'] } },
  });
  const map = new Map(rows.map((r) => [r.key, Number(r.value)]));
  settingsCache = {
    at: Date.now(),
    tempWarningMax: Number.isFinite(map.get('tempWarningMax')) ? map.get('tempWarningMax')! : 27,
    co2WarningMax: Number.isFinite(map.get('co2WarningMax')) ? map.get('co2WarningMax')! : 800,
    co2CriticalMax: Number.isFinite(map.get('co2CriticalMax')) ? map.get('co2CriticalMax')! : 1000,
  };
  return settingsCache;
}

function metricAlertTitle(sensor: SensorThresholds, severity: AlertSeverity) {
  const label = sensor.metric === 'co2' ? 'CO₂' : sensor.metric;
  return severity === 'CRITICAL'
    ? `${label} crítico (${sensor.code})`
    : `${label} fora do limiar (${sensor.code})`;
}

export async function raiseMetricAlert(
  tx: Prisma.TransactionClient,
  sensor: SensorThresholds,
  value: number,
) {
  const system = await systemThresholds(tx);
  const defaults = {
    ...(DEFAULT_THRESHOLDS[sensor.metric] ?? {}),
    ...(sensor.metric === 'temperature' ? { warningMax: system.tempWarningMax } : {}),
    ...(sensor.metric === 'co2'
      ? { warningMax: system.co2WarningMax, criticalMax: system.co2CriticalMax }
      : {}),
  };
  const warningMin = sensor.warningMin ?? defaults.warningMin;
  const warningMax = sensor.warningMax ?? defaults.warningMax;
  const criticalMin = sensor.criticalMin ?? defaults.criticalMin;
  const criticalMax = sensor.criticalMax ?? defaults.criticalMax;

  let severity: AlertSeverity | null = null;
  if (criticalMax != null && value > criticalMax) severity = 'CRITICAL';
  else if (criticalMin != null && value < criticalMin) severity = 'CRITICAL';
  else if (warningMax != null && value > warningMax) severity = 'WARNING';
  else if (warningMin != null && value < warningMin) severity = 'WARNING';

  const unit = sensor.unit ? ` ${sensor.unit}` : '';

  if (!severity) {
    await tx.alert.updateMany({
      where: {
        sensorId: sensor.id,
        acknowledged: false,
        isDemo: false,
        title: { contains: `(${sensor.code})` },
      },
      data: { acknowledged: true },
    });
    return null;
  }

  const title = metricAlertTitle(sensor, severity);
  const open = await tx.alert.findFirst({
    where: { sensorId: sensor.id, title, acknowledged: false },
    select: { id: true },
  });
  if (open) return null;

  const message = `O sensor "${sensor.name}" (${sensor.code}) registou ${value}${unit}.`;
  const alert = await tx.alert.create({
    data: {
      title,
      message,
      severity,
      isDemo: false,
      sensorId: sensor.id,
      deviceId: sensor.deviceId,
    },
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