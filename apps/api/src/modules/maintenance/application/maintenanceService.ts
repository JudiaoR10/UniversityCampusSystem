import type { CreateMaintenanceInput, UpdateMaintenanceInput } from '@smart-campus/validation';
import { notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';

const include = {
  performer: { select: { id: true, fullName: true } },
  incident: { select: { id: true, title: true, status: true, priority: true } },
} as const;

function mapAction(a: {
  id: string;
  incidentId: string;
  performedBy: string;
  notes: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  createdAt: Date;
  updatedAt: Date;
  performer: { id: string; fullName: string };
  incident: { id: string; title: string; status: string; priority: string };
}) {
  return {
    id: a.id,
    incidentId: a.incidentId,
    performedBy: a.performedBy,
    notes: a.notes,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    performer: a.performer,
    incident: a.incident,
  };
}

export async function listMaintenance() {
  const actions = await prisma.maintenanceAction.findMany({
    include,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return actions.map(mapAction);
}

export async function createMaintenance(
  input: CreateMaintenanceInput,
  actorId: string,
  correlationId: string,
) {
  const incident = await prisma.incident.findUnique({ where: { id: input.incidentId } });
  if (!incident) throw notFound('INCIDENT_NOT_FOUND', 'Ocorrência não encontrada');

  const action = await prisma.maintenanceAction.create({
    data: {
      incidentId: input.incidentId,
      performedBy: actorId,
      notes: input.notes,
      status: input.status ?? 'OPEN',
    },
    include,
  });

  await audit({
    action: 'MAINTENANCE_CREATE',
    resource: 'MaintenanceAction',
    resourceId: action.id,
    actorId,
    correlationId,
    metadata: { incidentId: incident.id, status: action.status },
  });

  return mapAction(action);
}

export async function updateMaintenance(
  id: string,
  input: UpdateMaintenanceInput,
  actorId: string,
  correlationId: string,
) {
  const existing = await prisma.maintenanceAction.findUnique({ where: { id } });
  if (!existing) throw notFound('MAINTENANCE_NOT_FOUND', 'Acção de manutenção não encontrada');

  const action = await prisma.maintenanceAction.update({
    where: { id },
    data: {
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
    include,
  });

  await audit({
    action: 'MAINTENANCE_UPDATE',
    resource: 'MaintenanceAction',
    resourceId: action.id,
    actorId,
    correlationId,
    metadata: { status: action.status },
  });

  return mapAction(action);
}
