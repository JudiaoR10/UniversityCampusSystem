import { z } from 'zod';
import { loadEnv } from '../../../config/env.js';
import type { FinancialNotificationEvent } from '@smart-campus/shared-types';

const acknowledgementSchema = z.object({
  data: z.object({
    id: z.string().min(1).max(200),
    sourceEventId: z.string().min(1),
    status: z.literal('ACCEPTED'),
  }),
});

export function notificationsConfigured(): boolean {
  const env = loadEnv();
  if (!env.NOTIFICATIONS_API_TOKEN) return false;
  try {
    const url = new URL(env.NOTIFICATIONS_API_URL);
    const localHttp =
      env.NODE_ENV !== 'production' &&
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return (url.protocol === 'https:' || localHttp) && !url.username && !url.password;
  } catch {
    return false;
  }
}

// The receiver must deduplicate by (sourceModule, sourceEventId).
export async function sendToNotifications(
  event: FinancialNotificationEvent,
  correlationId: string,
): Promise<string> {
  const env = loadEnv();
  if (!notificationsConfigured()) throw new Error('NOTIFICATIONS_UNAVAILABLE');
  const response = await fetch(env.NOTIFICATIONS_API_URL, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(env.NOTIFICATIONS_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.NOTIFICATIONS_API_TOKEN}`,
      'Idempotency-Key': `financial:${event.sourceEventId}`,
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify(event),
  });
  if (response.status !== 200 && response.status !== 201) {
    await response.body?.cancel();
    throw new Error(`NOTIFICATIONS_HTTP_${response.status}`);
  }
  // Limitar bytes durante a leitura, incluindo respostas sem Content-Length.
  const reader = response.body?.getReader();
  if (!reader) throw new Error('NOTIFICATIONS_INVALID_ACK');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) throw new Error('NOTIFICATIONS_INVALID_ACK');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const parsed = acknowledgementSchema.safeParse(
    JSON.parse(Buffer.concat(chunks).toString('utf8')),
  );
  if (!parsed.success || parsed.data.data.sourceEventId !== event.sourceEventId) {
    throw new Error('NOTIFICATIONS_INVALID_ACK');
  }
  return parsed.data.data.id;
}
