import { EventEmitter } from 'node:events';
import { notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';

type NotificationRow = {
  id: string;
  userId: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
};

/**
 * Barramento em memória para entrega em tempo real (SSE).
 * Chave = userId; emite o DTO já mapeado assim que a notificação é gravada.
 * Só cobre um processo de API (o do projecto) — se houver vários, trocar por Redis.
 */
export const notificationBus = new EventEmitter().setMaxListeners(0);

function mapNotification(n: NotificationRow) {
  return {
    id: n.id,
    userId: n.userId,
    title: n.title,
    body: n.body,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function listMyNotifications(userId: string) {
  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return items.map(mapNotification);
}

export async function markNotificationRead(id: string, userId: string) {
  const existing = await prisma.notification.findFirst({ where: { id, userId } });
  if (!existing) throw notFound('NOTIFICATION_NOT_FOUND', 'Notificação não encontrada');

  const updated = existing.readAt
    ? existing
    : await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });

  return mapNotification(updated);
}

/**
 * Cria notificações em lote e emite cada uma pelo barramento (SSE).
 * Falhas de emissão nunca interrompem a operação original do módulo.
 */
export async function notifyUsers(
  users: Array<{ id: string }>,
  title: string,
  body: string,
): Promise<void> {
  if (!users.length) return;

  const created = await prisma.notification.createManyAndReturn({
    data: users.map((u) => ({ userId: u.id, title, body })),
  });

  for (const n of created) {
    notificationBus.emit(n.userId, mapNotification(n));
  }
}
