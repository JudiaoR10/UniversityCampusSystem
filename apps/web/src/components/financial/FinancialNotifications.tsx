import { useCallback, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { date, errorMessage, LoadState, Pagination, useFinancialLoad } from './shared';
import { IconActionButton } from '../ActionButtons';
import { SelectField } from '../SelectField';

export function FinancialNotifications({ studentId, manager }: { studentId?: string; manager: boolean }) {
  if (manager && !studentId) return <CampusNotificationQueue />;
  if (!studentId) return null;
  return <StudentNotifications studentId={studentId} manager={manager} />;
}

function StudentNotifications({ studentId, manager }: { studentId: string; manager: boolean }) {
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

function CampusNotificationQueue() {
  const { api } = useAuth();
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'' | 'FAILED' | 'PENDING' | 'SENT' | 'LOCAL_ONLY'>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(() => api.financialNotificationQueue({ offset, limit: 20, deliveryStatus: status || undefined }), [api, offset, status]);
  const result = useFinancialLoad(load);
  async function retryFailed() {
    if (busy) return;
    setBusy(true); setError('');
    try { await api.retryFailedNotifications(); result.reload(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  const labels: Record<string, string> = { LOCAL_ONLY: 'Apenas no sistema', PENDING: 'Pendente', PROCESSING: 'A enviar', SENT: 'Enviado', FAILED: 'Falhou' };
  return <section className="space-y-4" aria-label="Avisos financeiros">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="font-display text-xl font-semibold">Fila de avisos do campus</h2>
      <label className="min-w-[16rem] text-sm font-medium">Estado de envio
        <SelectField value={status} disabled={busy} onChange={(value) => { setStatus(value as typeof status); setOffset(0); }} options={[
          { value: '', label: 'Todos' },
          { value: 'FAILED', label: 'Falhou' },
          { value: 'PENDING', label: 'Pendente' },
          { value: 'SENT', label: 'Enviado' },
          { value: 'LOCAL_ONLY', label: 'Apenas no sistema' },
        ]} />
      </label>
      <IconActionButton label="Reenviar falhados" disabled={busy || result.loading} onClick={() => void retryFailed()} />
    </div>
    <LoadState {...result} />
    {error && <p role="alert" className="alert-error">{error}</p>}
    {result.data && <>
      {!result.data.data.length && <p>Não existem avisos nesta página.</p>}
      {result.data.data.map(notice => <article className="surface space-y-3 p-4" key={notice.id}>
        <div className="flex flex-wrap justify-between gap-3">
          <h3 className="font-semibold">{notice.title}</h3>
          <span>{labels[notice.deliveryStatus] ?? notice.deliveryStatus}</span>
        </div>
        <p>{notice.student.fullName} · {notice.student.studentNumber ?? 'Sem matrícula'}</p>
        <p className="break-words whitespace-pre-wrap">{notice.message}</p>
        <p className="text-sm text-campus-deep/75">{date(notice.createdAt)} · Tentativas: {notice.attempts}{notice.lastError ? ` · ${notice.lastError}` : ''}</p>
        <Delivery id={notice.id} />
      </article>)}
      <Pagination offset={offset} hasMore={!!result.data.meta.hasMore} loading={result.loading || busy} onChange={setOffset} />
    </>}
  </section>;
}

function Delivery({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return <div><button className="btn-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>Estado de envio</button>{open && <DeliveryDetails id={id} />}</div>;
}

function DeliveryDetails({ id }: { id: string }) {
  const { api, user } = useAuth();
  const canRetry = user?.role === 'FINANCE';
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
      {canRetry && ['PENDING', 'FAILED'].includes(delivery.deliveryStatus) && <IconActionButton label={busy ? 'A reenviar aviso' : 'Reenviar aviso'} disabled={busy} onClick={() => void retry()} />}
      <p className="text-sm text-campus-deep/75">O estado de envio não confirma a leitura pelo estudante.</p>
    </>}
  </div>;
}
