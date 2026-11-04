import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationDto } from '@smart-campus/shared-types';
import { apiBaseUrl } from './apiBaseUrl';
import { getAccessToken, useAuth } from './auth';

/**
 * Notificações em tempo real.
 * - SSE em `/notifications/stream?token=` (o EventSource do browser não envia
 *   headers, por isso o access token vai por query pronta ou relativa).
 * - O token expirado / EventSource fechado ⇒ fallback: polling de 60 s.
 */
export function useNotifications() {
  const { api, user } = useAuth();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const itemsRef = useRef<NotificationDto[]>([]);

  const load = useCallback(async () => {
    try {
      const list = await api.notifications();
      itemsRef.current = list.data;
      setItems(list.data);
      setUnread(list.data.filter((n) => !n.readAt).length);
    } catch {
      // silencioso: a UI degrada para a campainha sem contagem
    }
  }, [api]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      return;
    }

    void load();

    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const startPolling = () => {
      if (!poll) poll = setInterval(() => void load(), 60_000);
    };

    try {
      const token = getAccessToken();
      if (token) {
        es = new EventSource(
          `${apiBaseUrl}/notifications/stream?token=${encodeURIComponent(token)}`,
        );
        es.addEventListener('ready', () => {
          if (!cancelled) setConnected(true);
        });
        es.addEventListener('notification', (ev) => {
          try {
            const dto = JSON.parse((ev as MessageEvent).data) as NotificationDto;
            itemsRef.current = [dto, ...itemsRef.current].slice(0, 50);
            setItems(itemsRef.current);
            setUnread((u) => u + 1);
          } catch {
            // mal-formed event: ignora; o próximo polling recupera
          }
        });
        es.onerror = () => {
          setConnected(false);
          startPolling(); // fallback quando o token expira ou SSE cai
        };
      }
    } catch {
      startPolling();
    }

    return () => {
      cancelled = true;
      es?.close();
      if (poll) clearInterval(poll);
      setConnected(false);
    };
  }, [user, load]);

  async function markRead(id: string) {
    try {
      await api.markNotificationRead(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      // silencioso
    }
  }

  return { items, unread, connected, refresh: load, markRead };
}
