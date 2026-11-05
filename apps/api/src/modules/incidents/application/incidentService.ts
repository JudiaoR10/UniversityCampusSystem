import type { CreateIncidentInput, UpdateIncidentStatusInput } from '@smart-campus/validation';
import { forbidden, notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';

function mapIncident(incident: {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  roomId: string | null;
  reporterId: string;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: incident.id,
    title: incident.title,
    description: incident.description,
    status: incident.status,
    priority: incident.priority,
    roomId: incident.roomId,
    reporterId: incident.reporterId,
    assigneeId: incident.assigneeId,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
}

export async function listIncidents() {
  const incidents = await prisma.incident.findMany({ orderBy: { createdAt: 'desc' } });
  return incidents.map(mapIncident);
}

export async function createIncident(input: CreateIncidentInput, reporterId: string, correlationId: string) {
  if (input.roomId) {
    const room = await prisma.room.findUnique({ where: { id: input.roomId } });
    if (!room) throw notFound('ROOM_NOT_FOUND', 'Sala não encontrada');
  }

  const incident = await prisma.incident.create({
    data: {
      title: input.title,
      description: input.description,
      priority: input.priority ?? 'MEDIUM',
      roomId: input.roomId ?? null,
      equipmentId: input.equipmentId ?? null,
      reporterId,
    },
  });

  await audit({
    action: 'INCIDENT_CREATE',
    resource: 'Incident',
    resourceId: incident.id,
    actorId: reporterId,
    correlationId,
    metadata: { title: incident.title, priority: incident.priority },
  });

  return mapIncident(incident);
}

export async function updateIncidentStatus(
  id: string,
  input: UpdateIncidentStatusInput,
  actor: { id: string; role: string },
  correlationId: string,
) {
  const allowed = ['TECHNICIAN', 'COORDINATOR', 'ADMIN'];
  if (!allowed.includes(actor.role)) {
    throw forbidden('Apenas técnico, coordenador ou admin pode alterar estado de ocorrência');
  }

  const existing = await prisma.incident.findUnique({ where: { id } });
  if (!existing) throw notFound('INCIDENT_NOT_FOUND', 'Ocorrência não encontrada');

  const incident = await prisma.incident.update({
    where: { id },
    data: {
      status: input.status,
      assigneeId: input.assigneeId === undefined ? existing.assigneeId : input.assigneeId,
      closedAt: ['RESOLVED', 'CLOSED'].includes(input.status) ? new Date() : null,
    },
  });

  if (input.notes) {
    await prisma.maintenanceAction.create({
      data: {
        incidentId: incident.id,
        performedBy: actor.id,
        notes: input.notes,
        status: ['RESOLVED', 'CLOSED'].includes(input.status)
          ? 'DONE'
          : input.status === 'IN_PROGRESS'
            ? 'IN_PROGRESS'
            : 'OPEN',
      },
    });
  }

  await audit({
    action: 'INCIDENT_STATUS_UPDATE',
    resource: 'Incident',
    resourceId: incident.id,
    actorId: actor.id,
    correlationId,
    metadata: { from: existing.status, to: incident.status },
  });

  return mapIncident(incident);
}
