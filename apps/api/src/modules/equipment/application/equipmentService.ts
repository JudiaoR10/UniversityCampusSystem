

import { Prisma } from '@prisma/client';
import type { CreateEquipmentInput } from '@smart-campus/validation';
import { conflict, notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';

function mapEquipment(e: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  roomId: string | null;
  laboratoryId: string | null;
  room: { id: string; code: string; name: string } | null;
  laboratory: { id: string; code: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: e.id,
    code: e.code,
    name: e.name,
    description: e.description,
    roomId: e.roomId,
    laboratoryId: e.laboratoryId,
    room: e.room,
    laboratory: e.laboratory,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export async function listEquipment() {
  const items = await prisma.equipment.findMany({
    orderBy: { code: 'asc' },
    include: {
      room: { select: { id: true, code: true, name: true } },
      laboratory: { select: { id: true, code: true, name: true } },
    },
  });
  return items.map(mapEquipment);
}

export async function getEquipment(id: string) {
  const item = await prisma.equipment.findUnique({
    where: { id },
    include: {
      room: { select: { id: true, code: true, name: true } },
      laboratory: { select: { id: true, code: true, name: true } },
    },
  });
  if (!item) throw notFound('EQUIPMENT_NOT_FOUND', 'Equipamento não encontrado');
  return mapEquipment(item);
}

export async function createEquipment(input: CreateEquipmentInput, actorId: string, correlationId: string) {
  if (input.roomId) {
    const room = await prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw notFound('ROOM_NOT_FOUND', 'Sala não encontrada');
  }
  if (input.laboratoryId) {
    const lab = await prisma.laboratory.findUnique({ where: { id: input.laboratoryId } });
    if (!lab) throw notFound('LABORATORY_NOT_FOUND', 'Laboratório não encontrado');
  }

  try {
    const item = await prisma.equipment.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        roomId: input.roomId ?? null,
        laboratoryId: input.laboratoryId ?? null,
      },
      include: {
        room: { select: { id: true, code: true, name: true } },
        laboratory: { select: { id: true, code: true, name: true } },
      },
    });

    await audit({
      action: 'EQUIPMENT_CREATE',
      resource: 'Equipment',
      resourceId: item.id,
      actorId,
      correlationId,
      metadata: { code: item.code },
    });

    return mapEquipment(item);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('EQUIPMENT_CODE_EXISTS', 'Já existe um equipamento com este código');
    }
    throw err;
  }
}

export async function updateEquipment(id: string, input: Partial<CreateEquipmentInput>, actorId: string, correlationId: string) {
  try {
    const item = await prisma.equipment.update({
      where: { id },
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        roomId: input.roomId ?? null,
        laboratoryId: input.laboratoryId ?? null,
      },
      include: {
        room: { select: { id: true, code: true, name: true } },
        laboratory: { select: { id: true, code: true, name: true } },
      },
    });

    await audit({
      action: 'EQUIPMENT_UPDATE',
      resource: 'Equipment',
      resourceId: item.id,
      actorId,
      correlationId,
      metadata: { code: item.code },
    });

    return mapEquipment(item);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('EQUIPMENT_CODE_EXISTS', 'Já existe um equipamento com este código');
    }
    throw err;
  }
}

export async function deleteEquipment(id: string, actorId: string, correlationId: string) {
  const item = await prisma.equipment.delete({ where: { id } }).catch((err: unknown) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    throw notFound('EQUIPMENT_NOT_FOUND', 'Equipamento não encontrado');
    }
    throw err;
   });
   

  await audit({
    action: 'EQUIPMENT_DELETE',
    resource: 'Equipment',
    resourceId: item.id,
    actorId,
    correlationId,
    metadata: { code: item.code },
  });

  return { id: item.id };
}