

import { Prisma } from '@prisma/client';
import type { CreateLaboratoryInput } from '@smart-campus/validation';
import { conflict, notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';

function mapLaboratory(l: {
  id: string;
  code: string;
  name: string;
  description: string | null;
  buildingId: string;
  building: { id: string; code: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: l.id,
    code: l.code,
    name: l.name,
    description: l.description,
    buildingId: l.buildingId,
    building: l.building,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

export async function listLaboratories() {
  const labs = await prisma.laboratory.findMany({
    orderBy: { code: 'asc' },
    include: { building: { select: { id: true, code: true, name: true } } },
  });
  return labs.map(mapLaboratory);
}

export async function getLaboratory(id: string) {
  const lab = await prisma.laboratory.findUnique({
    where: { id },
    include: { building: { select: { id: true, code: true, name: true } } },
  });
  if (!lab) throw notFound('LABORATORY_NOT_FOUND', 'Laboratório não encontrado');
  return mapLaboratory(lab);
}

export async function createLaboratory(input: CreateLaboratoryInput, actorId: string, correlationId: string) {
  const building = await prisma.building.findUnique({ where: { id: input.buildingId } });
  if (!building) throw notFound('BUILDING_NOT_FOUND', 'Edifício não encontrado');

  try {
    const lab = await prisma.laboratory.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        buildingId: input.buildingId,
      },
      include: { building: { select: { id: true, code: true, name: true } } },
    });

    await audit({
      action: 'LABORATORY_CREATE',
      resource: 'Laboratory',
      resourceId: lab.id,
      actorId,
      correlationId,
      metadata: { code: lab.code },
    });

    return mapLaboratory(lab);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('LABORATORY_CODE_EXISTS', 'Já existe um laboratório com este código');
    }
    throw err;
  }
}

export async function updateLaboratory(id: string, input: Partial<CreateLaboratoryInput>, actorId: string, correlationId: string) {
  try {
    const lab = await prisma.laboratory.update({
      where: { id },
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        buildingId: input.buildingId,
      },
      include: { building: { select: { id: true, code: true, name: true } } },
    });

    await audit({
      action: 'LABORATORY_UPDATE',
      resource: 'Laboratory',
      resourceId: lab.id,
      actorId,
      correlationId,
      metadata: { code: lab.code },
    });

    return mapLaboratory(lab);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('LABORATORY_CODE_EXISTS', 'Já existe um laboratório com este código');
    }
    throw err;
  }
}

export async function deleteLaboratory(id: string, actorId: string, correlationId: string) {
  const lab = await prisma.laboratory.delete({ where: { id } }).catch((err: unknown) => {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    throw notFound('LABORATORY_NOT_FOUND', 'Laboratório não encontrado');
    }
    throw err;
   });

  await audit({
    action: 'LABORATORY_DELETE',
    resource: 'Laboratory',
    resourceId: lab.id,
    actorId,
    correlationId,
    metadata: { code: lab.code },
  });

  return { id: lab.id };
}