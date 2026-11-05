import { useState } from 'react';
import { useNotifications } from '../lib/useNotifications';
import { PageIntro } from '../components/PageIntro';
import { AlertMessage } from '../components/AlertMessage';
import { EmptyState, StatusPill } from '../components/ui';
import { relativeTime } from '../lib/labels';
import { CheckIcon, IconActionButton } from '../components/ActionButtons';

export function NotificationsPage() {
  const { items, unread, connected, markRead } = useNotifications();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRead(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await markRead(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao marcar notificação');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Comunicação"
        title="Notificações"
        description={
          unread > 0
            ? `${unread} por ler, das ${items.length} mais recentes.`
            : 'As suas notificações, da mais recente para a mais antiga.'
        }
        actions={
          <StatusPill tone={connected ? 'success' : 'muted'}>
            {connected ? 'Ligado em tempo real' : 'Sem ligação'}
          </StatusPill>
        }
      />

      {error ? <AlertMessage tone="error" message={error} /> : null}

      {items.length === 0 ? (
        <EmptyState title="Caixa vazia" description="Ainda não tem notificações." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className={`surface p-4 sm:p-5 ${item.readAt ? '' : 'ring-2 ring-campus-teal/15'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="font-display text-lg font-semibold text-campus-ink">{item.title}</h3>
                <span className="text-xs text-campus-deep/60">{relativeTime(item.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-campus-deep/75">{item.body}</p>
              <div className="mt-4">
                {item.readAt ? (
                  <StatusPill>Lida</StatusPill>
                ) : (
                  <IconActionButton
                    label="Marcar como lida"
                    icon={<CheckIcon />}
                    tone="success"
                    busy={busyId === item.id}
                    onClick={() => void onRead(item.id)}
                  />
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
