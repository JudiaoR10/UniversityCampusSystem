import { useCallback, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { date, errorMessage, LoadState, Pagination, useFinancialLoad } from './shared';

export function FinancialNotifications({ studentId, manager }: { studentId: string; manager: boolean }) {
  const { api } = useAuth();
  const [offset, setOffset] = useState(0);
  const load = useCallback(() => api.financialNotifications(studentId, { offset, limit: 20 }), [api, studentId, offset]);
  const result = useFinancialLoad(load);
  return <section className="space-y-4" aria-label="Avisos financeiros">
    <h2 className="font-display text-xl font-semibold">Avisos financeiros</h2>
    <LoadState {...result} />
    {result.data && <>
      {!result.data.data.length && <p>Não existem avisos nesta página.</p>}
      {result.data.data.map(notice => <article className="surface space-y-3 p-4" key={notice.id}>
        <h3 className="font-semibold">{notice.title}</h3><p className="break-words whitespace-pre-wrap">{notice.message}</p><p className="text-sm text-campus-deep/75">{date(notice.createdAt)}</p>
        {manager && <Delivery id={notice.id} />}
      </article>)}
      <Pagination offset={offset} hasMore={result.data.data.length === 20} loading={result.loading} onChange={setOffset} />
    </>}
  </section>;
}

function Delivery({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return <div><button className="btn-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>Estado de envio</button>{open && <DeliveryDetails id={id} />}</div>;
}

function DeliveryDetails({ id }: { id: string }) {
  const { api } = useAuth();
  const load = useCallback(() => api.financialDelivery(id), [api, id]);
  const result = useFinancialLoad(load);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function retry() {
    if (busy) return;
    setBusy(true); setError('');
    try { await api.retryFinancialDelivery(id); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); result.reload(); }
  }
  const labels: Record<string, string> = { LOCAL_ONLY: 'Disponível apenas no sistema', PENDING: 'Pendente', PROCESSING: 'A enviar', SENT: 'Aceite pelo serviço de notificações', FAILED: 'Falha no envio' };
  const delivery = result.data?.data;
  return <div className="mt-3 space-y-3">
    <LoadState {...result} />
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {delivery && <><p>{labels[delivery.deliveryStatus]} · Tentativas: {delivery.attempts}</p>
      {['PENDING', 'FAILED'].includes(delivery.deliveryStatus) && <button className="btn-secondary" disabled={busy} onClick={() => void retry()}>Reenviar aviso</button>}
      <p className="text-sm text-campus-deep/75">O estado de envio não confirma a leitura pelo estudante.</p>
    </>}
  </div>;
}
