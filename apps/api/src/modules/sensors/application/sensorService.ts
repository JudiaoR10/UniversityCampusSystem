import { Prisma } from '@prisma/client';
import type { CreateSensorInput, UpdateSensorInput } from '@smart-campus/validation';
import { conflict, notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';

const sensorInclude = {
  device: { select: { id: true, code: true, name: true, status: true } },
} as const;

function mapSensor(s: {
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
  createdAt: Date;
  updatedAt: Date;
  device?: { id: string; code: string; name: string; status: string };
}) {
  return {
    id: s.id,
    code: s.code,
    name: s.name,
    metric: s.metric,
    unit: s.unit,
    deviceId: s.deviceId,
    warningMin: s.warningMin,
    warningMax: s.warningMax,
    criticalMin: s.criticalMin,
    criticalMax: s.criticalMax,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    device: s.device,
  };
}

export async function listSensors() {
  const sensors = await prisma.sensor.findMany({
    include: sensorInclude,
    orderBy: { code: 'asc' },
  });
  return sensors.map(mapSensor);
}

export async function createSensor(input: CreateSensorInput, actorId: string, correlationId: string) {
  const device = await prisma.device.findUnique({ where: { id: input.deviceId } });
  if (!device) throw notFound('DEVICE_NOT_FOUND', 'Dispositivo não encontrado');

  try {
    const sensor = await prisma.sensor.create({
      data: {
        code: input.code,
        name: input.name,
        metric: input.metric,
        unit: input.unit ?? null,
        deviceId: input.deviceId,
        warningMin: input.warningMin ?? null,
        warningMax: input.warningMax ?? null,
        criticalMin: input.criticalMin ?? null,
        criticalMax: input.criticalMax ?? null,
      },
      include: sensorInclude,
    });

    await audit({
      action: 'SENSOR_CREATE',
      resource: 'Sensor',
      resourceId: sensor.id,
      actorId,
      correlationId,
      metadata: { code: sensor.code, metric: sensor.metric },
    });

    return mapSensor(sensor);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('SENSOR_CODE_EXISTS', 'Já existe um sensor com este código');
    }
    throw err;
  }
}

export async function updateSensor(
  id: string,
  input: UpdateSensorInput,
  actorId: string,
  correlationId: string,
) {
  const existing = await prisma.sensor.findUnique({ where: { id } });
  if (!existing) throw notFound('SENSOR_NOT_FOUND', 'Sensor não encontrado');

  if (input.deviceId) {
    const device = await prisma.device.findUnique({ where: { id: input.deviceId } });
    if (!device) throw notFound('DEVICE_NOT_FOUND', 'Dispositivo não encontrado');
  }

  try {
    const sensor = await prisma.sensor.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.metric !== undefined ? { metric: input.metric } : {}),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        ...(input.deviceId !== undefined ? { deviceId: input.deviceId } : {}),
        ...(input.warningMin !== undefined ? { warningMin: input.warningMin } : {}),
        ...(input.warningMax !== undefined ? { warningMax: input.warningMax } : {}),
        ...(input.criticalMin !== undefined ? { criticalMin: input.criticalMin } : {}),
        ...(input.criticalMax !== undefined ? { criticalMax: input.criticalMax } : {}),
      },
      include: sensorInclude,
    });

    await audit({
      action: 'SENSOR_UPDATE',
      resource: 'Sensor',
      resourceId: sensor.id,
      actorId,
      correlationId,
      metadata: { code: sensor.code },
    });

    return mapSensor(sensor);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('SENSOR_CODE_EXISTS', 'Já existe um sensor com este código');
    }
    throw err;
  }
}

export async function deleteSensor(id: string, actorId: string, correlationId: string) {
  const existing = await prisma.sensor.findUnique({ where: { id } });
  if (!existing) throw notFound('SENSOR_NOT_FOUND', 'Sensor não encontrado');

  await prisma.sensor.delete({ where: { id } });
  await audit({
    action: 'SENSOR_DELETE',
    resource: 'Sensor',
    resourceId: id,
    actorId,
    correlationId,
    metadata: { code: existing.code },
  });
  return { id };
}

export async function listReadings(filters: {
  sensorId?: string;
  metric?: string;
  includeDemo?: boolean;
  limit?: number;
}) {
  const take = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const readings = await prisma.reading.findMany({
    where: {
      ...(filters.sensorId ? { sensorId: filters.sensorId } : {}),
      ...(filters.includeDemo === false ? { isDemo: false } : {}),
      ...(filters.metric ? { sensor: { metric: filters.metric } } : {}),
    },
    include: {
      sensor: {
        select: {
          id: true,
          code: true,
          name: true,
          metric: true,
          unit: true,
          device: { select: { id: true, code: true, name: true } },
        },
      },
    },
    orderBy: { recordedAt: 'desc' },
    take,
  });

  return readings.map((r) => ({
    id: r.id,
    sensorId: r.sensorId,
    value: r.value,
    recordedAt: r.recordedAt.toISOString(),
    isDemo: r.isDemo,
    sensor: r.sensor,
  }));
}
