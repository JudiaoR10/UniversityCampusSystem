import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { AlertMessage } from '../components/AlertMessage';
import { EmptyState, LoadingState } from '../components/ui';

export function AuditPage() {
  const { api, user } = useAuth();
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const allowed = !!user && ['ADMIN', 'COORDINATOR'].includes(user.role);

  useEffect(() => {
    if (!allowed) return;
    api
      .auditEvents()
      .then((res) => setEvents(res.data as Array<Record<string, unknown>>))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api, allowed]);

  if (user && !allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Governação"
        title="Auditoria"
        description="Registo de acções relevantes, com correlationId partilhado entre o pedido HTTP e o evento."
      />
      {error ? <AlertMessage tone="error" message={error} /> : null}
      {loading ? (
        <LoadingState label="A carregar eventos…" />
      ) : events.length === 0 ? (
        <EmptyState title="Sem eventos" description="Ainda não há actividade auditável para mostrar." />
      ) : (
        <div className="table-scroll surface">
          <table className="min-w-[640px]">
            <thead>
              <tr>
                <th>Acção</th>
                <th>Recurso</th>
                <th>Correlation</th>
                <th>Quando</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={String(event.id)}>
                  <td className="font-medium text-campus-ink">{String(event.action)}</td>
                  <td>{String(event.resource)}</td>
                  <td className="font-mono text-xs text-campus-deep/70">{String(event.correlationId)}</td>
                  <td className="text-campus-deep/70">{new Date(String(event.createdAt)).toLocaleString('pt-PT')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
