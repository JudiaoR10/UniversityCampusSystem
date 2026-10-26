import { AppError } from '../../../lib/errors.js';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { loadEnv } from '../../../config/env.js';
const env = loadEnv();
import { prisma } from '../infrastructure/financialRepository.js';
import { notificationsConfigured, sendToNotifications } from '../infrastructure/notificationsClient.js';
import type { FinancialNotificationDeliveryDto } from '@smart-campus/shared-types';

function eligible(now: Date): Prisma.FinancialNotificationWhereInput {
  return { OR: [
    { deliveryStatus: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: now } },
    { deliveryStatus: 'PROCESSING', lockedUntil: { lte: now } },
  ] };
}

export async function dispatchNotification(id: string): Promise<void> {
  if (!notificationsConfigured()) return;
  const now = new Date();
  const lockToken = randomUUID();
  const claimed = await prisma.financialNotification.updateMany({
    where: { id, ...eligible(now) },
    data: {
      deliveryStatus: 'PROCESSING', lockToken,
      lockedUntil: new Date(now.getTime() + env.NOTIFICATIONS_TIMEOUT_MS + 60000),
      lastAttemptAt: now, attempts: { increment: 1 },
    },
  });
  if (!claimed.count) return;
  const notification = await prisma.financialNotification.findUniqueOrThrow({ where: { id } });
  try {
    const externalNotificationId = await sendToNotifications({
      sourceModule: 'financial', sourceEventId: notification.id,
      recipientUserId: notification.studentId, eventType: notification.eventType,
      resourceId: notification.resourceId, title: notification.title, message: notification.message,
      channel: 'IN_APP', occurredAt: notification.createdAt.toISOString(),
    }, notification.correlationId ?? notification.id);
    await prisma.financialNotification.updateMany({
      where: { id, lockToken },
      data: { deliveryStatus: 'SENT', externalNotificationId, sentAt: new Date(), lastError: null, lockToken: null, lockedUntil: null },
    });
  } catch (error) {
    // Never persist response bodies, URLs or credentials from the external API.
    const message = error instanceof Error && /^NOTIFICATIONS_(HTTP_\d{3}|INVALID_ACK)$/.test(error.message)
      ? error.message : 'NOTIFICATIONS_UNAVAILABLE';
    const delay = Math.min(3600000, 30000 * 2 ** Math.min(notification.attempts - 1, 7));
    await prisma.financialNotification.updateMany({
      where: { id, lockToken },
      data: {
        deliveryStatus: 'FAILED', lastError: message,
        nextAttemptAt: new Date(Date.now() + delay), lockToken: null, lockedUntil: null,
      },
    });
  }
}

// Called only after the financial transaction commits. Delivery never rolls it back.
export async function dispatchNotificationSafely(id: string): Promise<void> {
  try { await dispatchNotification(id); }
  catch { console.error('Falha ao processar envio financeiro; o aviso permanece recuperavel na fila.'); }
}

export async function getNotificationDelivery(id: string): Promise<FinancialNotificationDeliveryDto> {
  const n = await prisma.financialNotification.findUnique({ where: { id } });
  if (!n) throw new AppError('NOTIFICATION_NOT_FOUND', 'Notificacao financeira nao encontrada', 404);
  return {
    id: n.id, deliveryStatus: n.deliveryStatus, externalNotificationId: n.externalNotificationId,
    attempts: n.attempts, lastAttemptAt: n.lastAttemptAt?.toISOString() ?? null,
    nextAttemptAt: n.deliveryStatus === 'PENDING' || n.deliveryStatus === 'FAILED' ? n.nextAttemptAt.toISOString() : null,
    sentAt: n.sentAt?.toISOString() ?? null, lastError: n.lastError,
  };
}

export async function retryNotification(id: string, actorId: string, correlationId: string) {
  const existing = await getNotificationDelivery(id);
  if (existing.deliveryStatus === 'SENT' || existing.deliveryStatus === 'LOCAL_ONLY') return existing;
  if (!notificationsConfigured()) {
    throw new AppError('NOTIFICATIONS_NOT_CONFIGURED', 'Configurar URL e token da API de notificacoes', 503);
  }
  await prisma.$transaction(async tx => {
    // SENT and active PROCESSING records are deliberately not reset.
    const updated = await tx.financialNotification.updateMany({
      where: { id, OR: [
        { deliveryStatus: { in: ['PENDING', 'FAILED'] } },
        { deliveryStatus: 'PROCESSING', lockedUntil: { lte: new Date() } },
      ] },
      data: { deliveryStatus: 'PENDING', nextAttemptAt: new Date(), lockToken: null, lockedUntil: null },
    });
    if (updated.count) await tx.auditEvent.create({ data: {
      actorId, correlationId, resource: 'financial', action: 'NOTIFICATION_RETRY_REQUESTED',
      resourceId: id, metadata: { notificationId: id },
    } });
  });
  await dispatchNotificationSafely(id);
  return getNotificationDelivery(id);
}

export async function dispatchPendingNotifications(): Promise<void> {
  if (!notificationsConfigured()) return;
  const notifications = await prisma.financialNotification.findMany({
    where: eligible(new Date()), orderBy: { nextAttemptAt: 'asc' }, take: 10, select: { id: true },
  });
  for (const notification of notifications) await dispatchNotificationSafely(notification.id);
}

export function startNotificationDispatcher(): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await dispatchPendingNotifications(); }
    catch { console.error('Fila de notificacoes temporariamente indisponivel.'); }
    finally { running = false; }
  };
  const timer = setInterval(() => { void tick(); }, env.NOTIFICATIONS_POLL_INTERVAL_MS);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
