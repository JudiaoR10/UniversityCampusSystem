
import { Prisma } from '@prisma/client';
import type { CreateBuildingInput } from '@smart-campus/validation';
import { conflict, notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';

function mapBuilding(b: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    floors: number;
    _count?: { rooms: number };
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: b.id,
      code: b.code,
      name: b.name,
      description: b.description,
      floors: b.floors,
      roomsCount: b._count?.rooms ?? 0,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }

  export async function listBuildings() {
    const buildings = await prisma.building.findMany({
      orderBy: { code: 'asc' },
      include: { _count: { select: { rooms: true } } },
    });
    return buildings.map(mapBuilding);
  }

  export async function getBuilding(id: string) {
    const building = await prisma.building.findUnique({
      where: { id },
      include: { _count: { select: { rooms: true } } },
    });
    if (!building) throw notFound('BUILDING_NOT_FOUND', 'Edifício não encontrado');
    return mapBuilding(building);
  }

export async function createBuilding(input: CreateBuildingInput, actorId: string, correlationId: string) {
  try {
    const building = await prisma.building.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        floors: input.floors,
      },
      include: { _count: { select: { rooms: true } } },
    });

    await audit({
      action: 'BUILDING_CREATE',
      resource: 'Building',
      resourceId: building.id,
      actorId,
      correlationId,
      metadata: { code: building.code },
    });

    return mapBuilding(building);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('BUILDING_CODE_EXISTS', 'Já existe um edifício com este código');
    }
    throw err;
  }
}

export async function updateBuilding(id: string, input: Partial<CreateBuildingInput>, actorId: string, correlationId: string) {
  try {
    const building = await prisma.building.update({
      where: { id },
      data: {
        ...(input.code !== undefined ? { code: input.code } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.floors !== undefined ? { floors: input.floors } : {}),
      },
      include: { _count: { select: { rooms: true } } },
    });

    await audit({
      action: 'BUILDING_UPDATE',
      resource: 'Building',
      resourceId: building.id,
      actorId,
      correlationId,
      metadata: { code: building.code },
    });

    return mapBuilding(building);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('BUILDING_CODE_EXISTS', 'Já existe um edifício com este código');
    }
    throw err;
  }
}

  export async function deleteBuilding(id: string, actorId: string, correlationId: string) {
    const building = await prisma.building.delete({ where: { id } }).catch((err: unknown) =>
      {
       if (err instanceof Prisma.PrismaClientKnownRequestError) {
       if (err.code === 'P2025') throw notFound('BUILDING_NOT_FOUND', 'Edifício não encontrado');
       if (err.code === 'P2003') {
       throw conflict('BUILDING_IN_USE', 'O edifício tem salas ou laboratórios associados');
       }
       }
       throw err;
      });
      
  
    await audit({
      action: 'BUILDING_DELETE',
      resource: 'Building',
      resourceId: building.id,
      actorId,
      correlationId,
      metadata: { code: building.code },
    });
  
    return { id: building.id };
  }