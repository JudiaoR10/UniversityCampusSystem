import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotificationDto } from '@smart-campus/shared-types';
import { apiBaseUrl } from './apiBaseUrl';
import { getAccessToken, useAuth } from './auth';

export type ConnectionState = 'connecting' | 'open' | 'error' | 'closed';

/**
 * Notificações em tempo real.
 * - SSE em `/notifications/stream?token=` (o EventSource do browser não envia
 *   headers, por isso o access token vai por query pronta ou relativa).
 * - O token expirado / EventSource fechado ⇒ fallback: polling adaptativo.
 * - Deduplicação por id: um evento SSE que seja eco de uma acção já aplicada
 *   (mesmo id) é ignorado, evitando reaplicar uma mudança (Secção 6 do Módulo 8).
 */
export function useNotifications() {
  const { api, user } = useAuth();
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unread, setUnread] = useState(0);
  const [connectionState, setConnectionState] = useState<ConnectionState>('closed');
  const itemsRef = useRef<NotificationDto[]>([]);
  const seenIds = useRef<Set<string>>(new Set());

  const connected = connectionState === 'open';

  const load = useCallback(async () => {
    try {
      const list = await api.notifications();
      itemsRef.current = list.data;
      setItems(list.data);
      setUnread(list.data.filter((n) => !n.readAt).length);
      for (const n of list.data) seenIds.current.add(n.id);
    } catch {
      // silencioso: a UI degrada para a campainha sem contagem
    }
  }, [api]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setUnread(0);
      setConnectionState('closed');
      return;
    }

    void load();

    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const startPolling = (ms: number) => {
      if (poll) return;
      poll = setInterval(() => void load(), ms);
    };

    const stopPolling = () => {
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
    };

    setConnectionState('connecting');
    try {
      const token = getAccessToken();
      if (token) {
        es = new EventSource(
          `${apiBaseUrl}/notifications/stream?token=${encodeURIComponent(token)}`,
        );
        es.addEventListener('ready', () => {
          if (!cancelled) {
            setConnectionState('open');
            stopPolling();
          }
        });
        es.addEventListener('notification', (ev) => {
          try {
            const dto = JSON.parse((ev as MessageEvent).data) as NotificationDto;
            // Deduplicação por id: ignora eco da própria acção.
            if (seenIds.current.has(dto.id)) return;
            seenIds.current.add(dto.id);
            itemsRef.current = [dto, ...itemsRef.current].slice(0, 50);
            setItems(itemsRef.current);
            setUnread((u) => u + 1);
          } catch {
            // mal-formed event: ignora; o próximo polling recupera
          }
        });
        es.onerror = () => {
          if (cancelled) return;
          setConnectionState('error');
          startPolling(15_000);
        };
      } else {
        setConnectionState('closed');
        startPolling(15_000);
      }
    } catch {
      setConnectionState('error');
      startPolling(15_000);
    }

    return () => {
      cancelled = true;
      es?.close();
      if (poll) clearInterval(poll);
      setConnectionState('closed');
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

  return { items, unread, connected, connectionState, refresh: load, markRead };
}
