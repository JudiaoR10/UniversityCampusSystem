import { useState } from 'react';
import { useNotifications } from '../lib/useNotifications';

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
      <section className="rounded-2xl border border-campus-line bg-white/85 p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">Notificações</h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              connected
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-campus-line bg-campus-mist/60 text-campus-deep/60'
            }`}
            title={connected ? 'Ligado em tempo real (SSE)' : 'Sem ligação em tempo real — a actualizar a cada 60 s'}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${connected ? 'animate-pulse bg-emerald-500' : 'bg-campus-deep/30'}`}
            />
            {connected ? 'Ligado em tempo real' : 'Sem ligação'}
          </span>
        </div>
        <p className="mt-1 text-sm text-campus-deep/75">
          {unread > 0
            ? `${unread} por ler, das ${items.length} mais recentes.`
            : 'As tuas notificações, da mais recente para a mais antiga.'}
        </p>
      </section>

      {error ? <p className="text-red-700">{error}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-campus-deep/70">Não tens notificações.</p>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <article
              key={n.id}
              className={`rounded-2xl border p-4 shadow-panel ${
                n.readAt ? 'border-campus-line bg-white' : 'border-campus-teal bg-white ring-2 ring-campus-teal/15'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{n.title}</h3>
                <span className="text-xs text-campus-deep/60">{new Date(n.createdAt).toLocaleString('pt-PT')}</span>
              </div>
              <p className="mt-1 text-sm text-campus-deep/75">{n.body}</p>
              <div className="mt-3 text-xs">
                {n.readAt ? (
                  <span className="text-campus-deep/60">Lida</span>
                ) : (
                  <button type="button" disabled={busyId === n.id} onClick={() => onRead(n.id)} className="btn-primary">
                    {busyId === n.id ? 'A marcar…' : 'Marcar como lida'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
