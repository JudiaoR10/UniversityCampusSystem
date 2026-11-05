import { Prisma } from '@prisma/client';
import type { CreatePOIInput, UpdatePOIInput } from '@smart-campus/validation';
import { notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';

function mapPOI(poi: {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  edificioId: string | null;
  edificio: { id: string; code: string; name: string } | null;
  sala_codigo: string | null;
  sala: { id: string; code: string; name: string } | null;
  piso: number | null;
  mapX: number;
  mapY: number;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: poi.id,
    nome: poi.nome,
    descricao: poi.descricao,
    tipo: poi.tipo,
    edificioId: poi.edificioId,
    edificio: poi.edificio,
    sala_codigo: poi.sala_codigo,
    sala: poi.sala,
    piso: poi.piso,
    mapX: poi.mapX,
    mapY: poi.mapY,
    ativo: poi.ativo,
    createdAt: poi.createdAt.toISOString(),
    updatedAt: poi.updatedAt.toISOString(),
  };
}

export async function listPOIs() {
  const pois = await prisma.pOI.findMany({
    include: {
      edificio: { select: { id: true, code: true, name: true } },
      sala: { select: { id: true, code: true, name: true, status: true } },
    },
    orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
  });
  return pois.map(mapPOI);
}

export async function getPOI(id: string) {
  const poi = await prisma.pOI.findUnique({
    where: { id },
    include: {
      edificio: { select: { id: true, code: true, name: true } },
      sala: { select: { id: true, code: true, name: true, status: true } },
    },
  });
  if (!poi) throw notFound('POI_NOT_FOUND', 'POI não encontrado');
  return mapPOI(poi);
}

export async function createPOI(input: CreatePOIInput, actorId: string, correlationId: string) {
  if (input.edificioId) {
    const building = await prisma.building.findUnique({ where: { id: input.edificioId } });
    if (!building) throw notFound('BUILDING_NOT_FOUND', 'Edifício não encontrado');
  }

  if (input.sala_codigo) {
    const room = await prisma.room.findUnique({ where: { code: input.sala_codigo } });
    if (!room) throw notFound('ROOM_NOT_FOUND', 'Sala não encontrada');
  }

  const poi = await prisma.pOI.create({
    data: {
      nome: input.nome,
      descricao: input.descricao,
      tipo: input.tipo,
      edificioId: input.edificioId,
      sala_codigo: input.sala_codigo,
      piso: input.piso,
      mapX: input.mapX ?? 0,
      mapY: input.mapY ?? 0,
      ativo: input.ativo ?? true,
    },
    include: {
      edificio: { select: { id: true, code: true, name: true } },
      sala: { select: { id: true, code: true, name: true, status: true } },
    },
  });

  await audit({
    action: 'POI_CREATE',
    resource: 'POI',
    resourceId: poi.id,
    actorId,
    correlationId,
    metadata: { nome: poi.nome, tipo: poi.tipo },
  });

  return mapPOI(poi);
}

export async function updatePOI(
  id: string,
  input: UpdatePOIInput,
  actorId: string,
  correlationId: string,
) {
  const existing = await prisma.pOI.findUnique({ where: { id } });
  if (!existing) throw notFound('POI_NOT_FOUND', 'POI não encontrado');

  if (input.edificioId) {
    const building = await prisma.building.findUnique({ where: { id: input.edificioId } });
    if (!building) throw notFound('BUILDING_NOT_FOUND', 'Edifício não encontrado');
  }

  if (input.sala_codigo) {
    const room = await prisma.room.findUnique({ where: { code: input.sala_codigo } });
    if (!room) throw notFound('ROOM_NOT_FOUND', 'Sala não encontrada');
  }

  try {
    const poi = await prisma.pOI.update({
      where: { id },
      data: {
        nome: input.nome,
        descricao: input.descricao,
        tipo: input.tipo,
        edificioId: input.edificioId,
        sala_codigo: input.sala_codigo,
        piso: input.piso,
        mapX: input.mapX,
        mapY: input.mapY,
        ativo: input.ativo,
      },
      include: {
        edificio: { select: { id: true, code: true, name: true } },
        sala: { select: { id: true, code: true, name: true, status: true } },
      },
    });

    await audit({
      action: 'POI_UPDATE',
      resource: 'POI',
      resourceId: poi.id,
      actorId,
      correlationId,
      metadata: { nome: poi.nome, tipo: poi.tipo },
    });

    return mapPOI(poi);
  } catch (err) {
    throw err;
  }
}

export async function deletePOI(id: string, actorId: string, correlationId: string) {
  const existing = await prisma.pOI.findUnique({ where: { id } });
  if (!existing) throw notFound('POI_NOT_FOUND', 'POI não encontrado');

  await prisma.pOI.delete({ where: { id } }).catch((err: unknown) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') throw notFound('POI_NOT_FOUND', 'POI não encontrado');
    }
    throw err;
  });

  await audit({
    action: 'POI_DELETE',
    resource: 'POI',
    resourceId: id,
    actorId,
    correlationId,
    metadata: { nome: existing.nome, tipo: existing.tipo },
  });

  return { id };
}
