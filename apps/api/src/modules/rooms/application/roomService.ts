import { Prisma } from '@prisma/client';
import type { CreateRoomInput } from '@smart-campus/validation';
import { conflict, notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';

function mapRoom(room: {
  id: string;
  code: string;
  name: string;
  capacity: number;
  floor: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  building: { id: string; code: string; name: string };
}) {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    capacity: room.capacity,
    floor: room.floor,
    status: room.status,
    building: room.building,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

export async function listRooms() {
  const rooms = await prisma.room.findMany({
    include: { building: { select: { id: true, code: true, name: true } } },
    orderBy: { code: 'asc' },
  });
  return rooms.map(mapRoom);
}

export async function getRoom(id: string) {
  const room = await prisma.room.findUnique({
    where: { id },
    include: { building: { select: { id: true, code: true, name: true } } },
  });
  if (!room) throw notFound('ROOM_NOT_FOUND', 'Sala não encontrada');
  return mapRoom(room);
}

export async function createRoom(input: CreateRoomInput, actorId: string, correlationId: string) {
  const building = await prisma.building.findUnique({ where: { id: input.buildingId } });
  if (!building) throw notFound('BUILDING_NOT_FOUND', 'Edifício não encontrado');

  const room = await prisma.room.create({
    data: {
      code: input.code,
      name: input.name,
      capacity: input.capacity,
      floor: input.floor ?? 0,
      status: input.status ?? 'AVAILABLE',
      buildingId: input.buildingId,
    },
    include: { building: { select: { id: true, code: true, name: true } } },
  });

  await audit({
    action: 'ROOM_CREATE',
    resource: 'Room',
    resourceId: room.id,
    actorId,
    correlationId,
    metadata: { code: room.code },
  });

  return mapRoom(room);
}

export async function updateRoom(
  id: string,
  input: Partial<CreateRoomInput>,
  actorId: string,
  correlationId: string,
) {
  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) throw notFound('ROOM_NOT_FOUND', 'Sala não encontrada');

  if (input.buildingId) {
    const building = await prisma.building.findUnique({ where: { id: input.buildingId } });
    if (!building) throw notFound('BUILDING_NOT_FOUND', 'Edifício não encontrado');
  }

  try {
    const room = await prisma.room.update({
      where: { id },
      data: {
        code: input.code,
        name: input.name,
        capacity: input.capacity,
        floor: input.floor,
        status: input.status,
        buildingId: input.buildingId,
      },
      include: { building: { select: { id: true, code: true, name: true } } },
    });

    await audit({
      action: 'ROOM_UPDATE',
      resource: 'Room',
      resourceId: room.id,
      actorId,
      correlationId,
      metadata: { code: room.code },
    });

    return mapRoom(room);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('ROOM_CODE_EXISTS', 'Já existe uma sala com este código');
    }
    throw err;
  }
}

export async function deleteRoom(id: string, actorId: string, correlationId: string) {
  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) throw notFound('ROOM_NOT_FOUND', 'Sala não encontrada');

  await prisma.room.delete({ where: { id } }).catch((err: unknown) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') throw notFound('ROOM_NOT_FOUND', 'Sala não encontrada');
    if (err.code === 'P2003') throw conflict('ROOM_IN_USE', 'A sala tem registos associados');
    }
    throw err;
   });
   

  await audit({
    action: 'ROOM_DELETE',
    resource: 'Room',
    resourceId: id,
    actorId,
    correlationId,
    metadata: { code: existing.code },
  });

  return { id };
}

