import type { AdminSettingsDto, AdminStatusDto } from '@smart-campus/shared-types';
import type { UpdateAdminSettingsInput } from '@smart-campus/validation';
import { prisma } from '../../../lib/prisma.js';
import { getEnv } from '../../../config/env.js';
import { getMqttStatus } from '../../iot/application/mqttIngestService.js';
import { audit } from '../../audit/application/auditService.js';

const KEYS = {
  parkingLabMode: 'parkingLabMode',
  tempWarningMax: 'tempWarningMax',
  co2WarningMax: 'co2WarningMax',
  co2CriticalMax: 'co2CriticalMax',
  readingRetentionDays: 'readingRetentionDays',
} as const;

const DEFAULTS = {
  parkingLabMode: false,
  tempWarningMax: 27,
  co2WarningMax: 800,
  co2CriticalMax: 1000,
  readingRetentionDays: 30,
};

async function readSettingsMap() {
  const rows = await prisma.systemSetting.findMany();
  return new Map(rows.map((r) => [r.key, r.value]));
}

export async function getAdminSettings(): Promise<AdminSettingsDto> {
  const map = await readSettingsMap();
  const mqtt = getMqttStatus();
  return {
    parkingLabMode: (map.get(KEYS.parkingLabMode) ?? String(DEFAULTS.parkingLabMode)) === 'true',
    tempWarningMax: Number(map.get(KEYS.tempWarningMax) ?? DEFAULTS.tempWarningMax),
    co2WarningMax: Number(map.get(KEYS.co2WarningMax) ?? DEFAULTS.co2WarningMax),
    co2CriticalMax: Number(map.get(KEYS.co2CriticalMax) ?? DEFAULTS.co2CriticalMax),
    readingRetentionDays: Number(map.get(KEYS.readingRetentionDays) ?? DEFAULTS.readingRetentionDays),
    mqttUrl: mqtt.url || getEnv().MQTT_URL,
    mqttConnected: mqtt.connected,
  };
}

export async function updateAdminSettings(
  input: UpdateAdminSettingsInput,
  actorId: string,
  correlationId: string,
): Promise<AdminSettingsDto> {
  const entries: Array<[string, string]> = [];
  if (input.parkingLabMode !== undefined) entries.push([KEYS.parkingLabMode, String(input.parkingLabMode)]);
  if (input.tempWarningMax !== undefined) entries.push([KEYS.tempWarningMax, String(input.tempWarningMax)]);
  if (input.co2WarningMax !== undefined) entries.push([KEYS.co2WarningMax, String(input.co2WarningMax)]);
  if (input.co2CriticalMax !== undefined) entries.push([KEYS.co2CriticalMax, String(input.co2CriticalMax)]);
  if (input.readingRetentionDays !== undefined) {
    entries.push([KEYS.readingRetentionDays, String(input.readingRetentionDays)]);
  }

  for (const [key, value] of entries) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value, updatedBy: actorId },
      create: { key, value, updatedBy: actorId },
    });
  }

  if (entries.length > 0) {
    await audit({
      action: 'ADMIN_SETTINGS_UPDATE',
      resource: 'SystemSetting',
      resourceId: entries.map(([k]) => k).join(','),
      actorId,
      correlationId,
      metadata: Object.fromEntries(entries),
    });
  }

  return getAdminSettings();
}

export async function getAdminStatus(): Promise<AdminStatusDto> {
  const env = getEnv();
  const mqtt = getMqttStatus();
  const [devicesOnline, devicesOffline, openIncidents, unreadAlerts] = await Promise.all([
    prisma.device.count({ where: { status: 'ONLINE' } }),
    prisma.device.count({ where: { status: 'OFFLINE' } }),
    prisma.incident.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.alert.count({ where: { acknowledged: false, isDemo: false } }),
  ]);

  const mqttDown = env.NODE_ENV === 'production' && !mqtt.connected;
  const degraded = mqttDown || devicesOffline > 0 || openIncidents > 25 || unreadAlerts > 3;

  return {
    coreStatus: degraded ? 'degraded' : 'healthy',
    mqttConnected: mqtt.connected,
    mqttUrl: mqtt.url || env.MQTT_URL,
    devicesOnline,
    devicesOffline,
    openIncidents,
    unreadAlerts,
  };
}
