import type {
  CreateDeviceInput,
  UpdateDeviceInput,
  UpdateDeviceStatusInput,
} from '@smart-campus/validation';
import { conflict, notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';
import { raiseDeviceAlert } from '../../devices/application/alertService.js';

const deviceInclude = {
  sensors: true,
  room: { select: { id: true, code: true, name: true } },
} as const;

export async function createDevice(input: CreateDeviceInput, actorId: string, correlationId: string) {
  const existing = await prisma.device.findUnique({ where: { code: input.code } });
  if (existing) throw conflict('DEVICE_CODE_TAKEN', 'Já existe um dispositivo com este código');

  if (input.roomId) {
    const room = await prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw notFound('ROOM_NOT_FOUND', 'Sala não encontrada');
  }

  const device = await prisma.device.create({
    data: {
      code: input.code,
      name: input.name,
      type: input.type,
      status: input.status ?? 'UNKNOWN',
      roomId: input.roomId ?? null,
      mqttTopic: input.mqttTopic ?? null,
    },
    include: deviceInclude,
  });

  await audit({
    action: 'DEVICE_CREATE',
    resource: 'Device',
    resourceId: device.id,
    actorId,
    correlationId,
    metadata: { code: device.code },
  });

  return device;
}
export async function updateDevice(
  id: string,
  input: UpdateDeviceInput,
  actorId: string,
  correlationId: string,
) {
  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) throw notFound('DEVICE_NOT_FOUND', 'Dispositivo não encontrado');

  if (input.roomId) {
    const room = await prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw notFound('ROOM_NOT_FOUND', 'Sala não encontrada');
  }

  const device = await prisma.device.update({
    where: { id },
    data: input,
    include: deviceInclude,
  });

  await audit({
    action: 'DEVICE_UPDATE',
    resource: 'Device',
    resourceId: device.id,
    actorId,
    correlationId,
    metadata: { code: device.code, fields: Object.keys(input) },
  });

  return device;
}


export async function updateDeviceStatus(
  id: string,
  input: UpdateDeviceStatusInput,
  actorId: string,
  correlationId: string,
) {
  const existing = await prisma.device.findUnique({ where: { id }, include: deviceInclude });
  if (!existing) throw notFound('DEVICE_NOT_FOUND', 'Dispositivo não encontrado');

  if (existing.status === input.status) return existing;

  // Estado + alerta + notificações gravam juntos, ou nenhum grava
  const { device, alert } = await prisma.$transaction(async (tx) => {
    const updated = await tx.device.update({
      where: { id },
      data: { status: input.status },
      include: deviceInclude,
    });

    const raised = await raiseDeviceAlert(tx, updated, existing.status, updated.status);
    return { device: updated, alert: raised };
  });

  await audit({
    action: 'DEVICE_STATUS_UPDATE',
    resource: 'Device',
    resourceId: device.id,
    actorId,
    correlationId,
    metadata: {
      code: device.code,
      from: existing.status,
      to: device.status,
      alertId: alert?.id ?? null,
    },
  });

  return device;
}

export async function deleteDevice(id: string, actorId: string, correlationId: string) {
  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) throw notFound('DEVICE_NOT_FOUND', 'Dispositivo não encontrado');

  // Regra de negócio: um dispositivo em operação não se elimina
  if (existing.status === 'ONLINE') {
    throw conflict(
      'DEVICE_ONLINE',
      'Não é possível eliminar um dispositivo ONLINE. Coloque-o em MAINTENANCE ou OFFLINE primeiro.',
    );
  }

  await prisma.device.delete({ where: { id } });

  await audit({
    action: 'DEVICE_DELETE',
    resource: 'Device',
    resourceId: id,
    actorId,
    correlationId,
    metadata: { code: existing.code },
  });

  return { id };
}