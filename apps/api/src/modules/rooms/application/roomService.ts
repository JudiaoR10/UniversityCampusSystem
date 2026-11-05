import { Prisma } from '@prisma/client';
import type { CreateRoomInput } from '@smart-campus/validation';
import { conflict, notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';
import { computeOccupancyByRoom } from '../../ops/application/occupancyService.js';

function mapRoom(room: {
  id: string;
  code: string;
  name: string;
  capacity: number;
  floor: number;
  status: string;
  temPlaca: boolean;
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
    temPlaca: room.temPlaca,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

export async function listRooms(actorRole?: string) {
  const [rooms, occupancy] = await Promise.all([
    prisma.room.findMany({
      include: { building: { select: { id: true, code: true, name: true } } },
      orderBy: { code: 'asc' },
    }),
    computeOccupancyByRoom(),
  ]);
  // Filter out rooms that are associated with POIs or Laboratories
  const poiRoomCodes = new Set(
    (await prisma.pOI.findMany({ select: { sala_codigo: true } }))
      .map((p) => p.sala_codigo)
      .filter((c): c is string => c !== null),
  );
  const labRoomCodes = new Set(
    (await prisma.laboratory.findMany({ select: { sala_codigo: true } }))
      .map((l) => l.sala_codigo)
      .filter((c): c is string => c !== null),
  );
  const filteredRooms = rooms.filter(
    (room) => !poiRoomCodes.has(room.code) && !labRoomCodes.has(room.code),
  );
  // Non-admin users only see rooms with temPlaca = true
  const visibleRooms = actorRole === 'ADMIN'
    ? filteredRooms
    : filteredRooms.filter((room) => room.temPlaca);
  return visibleRooms.map((room) => {
    const mapped = mapRoom(room);
    if (room.status === 'MAINTENANCE' || room.status === 'RESERVED') return mapped;
    const live = occupancy.byRoom.get(room.id);
    return {
      ...mapped,
      status: live?.occupied ? 'OCCUPIED' : room.status === 'OCCUPIED' ? 'AVAILABLE' : room.status,
    };
  });
}

export async function getRoom(id: string, actorRole?: string) {
  const room = await prisma.room.findUnique({
    where: { id },
    include: { building: { select: { id: true, code: true, name: true } } },
  });
  if (!room) throw notFound('ROOM_NOT_FOUND', 'Sala não encontrada');
  // Non-admin users cannot access rooms without temPlaca
  if (actorRole !== 'ADMIN' && !room.temPlaca) {
    throw notFound('ROOM_NOT_FOUND', 'Sala não encontrada');
  }
  const mapped = mapRoom(room);
  return mapped;
}

export async function createRoom(input: CreateRoomInput, actorId: string, correlationId: string) {
  const building = await prisma.building.findUnique({ where: { id: input.buildingId } });
  if (!building) throw notFound('BUILDING_NOT_FOUND', 'Edifício não encontrado');

  if (input.status === 'OCCUPIED' || input.status === 'MAINTENANCE') {
    throw conflict('ROOM_INVALID_STATUS', 'Não é possível criar uma sala ocupada ou em manutenção. O estado inicial deve ser AVAILABLE');
  }

  const room = await prisma.room.create({
    data: {
      code: input.code,
      name: input.name,
      capacity: input.capacity,
      floor: input.floor ?? 0,
      status: input.status ?? 'AVAILABLE',
      buildingId: input.buildingId,
      temPlaca: input.temPlaca ?? false,
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

  if (existing.status !== 'AVAILABLE') {
    throw conflict('ROOM_NOT_AVAILABLE', 'Apenas salas em estado AVAILABLE podem ser manipuladas');
  }

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
        temPlaca: input.temPlaca,
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

  if (existing.status !== 'AVAILABLE') {
    throw conflict('ROOM_NOT_AVAILABLE', 'Apenas salas em estado AVAILABLE podem ser eliminadas');
  }

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

