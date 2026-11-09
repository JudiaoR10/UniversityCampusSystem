import { useCallback, useState, type FormEvent } from 'react';
import type { AnalysisRequestStatus, FinancialAnalysisRequestViewDto } from '@smart-campus/shared-types';
import { useAuth } from '../../lib/auth';
import { BusyLabel, date, money, errorMessage, LoadState, Pagination, SuccessFeedback, useFinancialLoad } from './shared';
import { SelectField } from '../SelectField';
import { IconActionButton } from '../ActionButtons';

const statuses = { PENDENTE_ANALISE: 'Pendente de análise', PROCEDENTE: 'Aceite', IMPROCEDENTE: 'Rejeitada' };

export function FinancialAnalysis({ studentId, manager, canResolve, onChanged }: { studentId?: string; manager: boolean; canResolve: boolean; onChanged: () => void }) {
  const { api } = useAuth();
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<AnalysisRequestStatus | ''>(manager ? 'PENDENTE_ANALISE' : '');
  const [selected, setSelected] = useState<FinancialAnalysisRequestViewDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(() => api.financialAnalysisRequests({ studentId, status: status || undefined, offset, limit: 20 }), [api, studentId, status, offset]);
  const result = useFinancialLoad(load);
  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError(''); setMessage('');
    try {
      await api.resolveAnalysisRequest(selected.id, fields);
      setSelected(null); setMessage('Decisão registada.'); result.reload(); onChanged();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4" aria-label="Contestações">
    <SuccessFeedback message={message} onClose={() => setMessage('')} />
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="font-display text-xl font-semibold">{manager ? 'Contestações' : 'As minhas contestações'}</h2>
      <label className="min-w-[16rem] text-sm font-medium">Estado<SelectField value={status} disabled={busy} onChange={(value) => { setStatus(value as AnalysisRequestStatus | ''); setOffset(0); setSelected(null); }} options={[{ value: '', label: 'Todos' }, ...Object.entries(statuses).map(([value, label]) => ({ value, label }))]} /></label>
    </div>
    <LoadState {...result} />
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {result.data && <>
      {!result.data.data.length && <p>Não existem contestações para estes filtros.</p>}
      {result.data.data.map(item => <article className="surface space-y-3 p-4 sm:p-5" key={item.id}>
        <div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold">{item.debt.title} — {money(item.debt.amount)}</h3><span>{statuses[item.status]}</span></div>
        {manager && <p>{item.student.fullName} · {item.student.studentNumber ?? 'Sem matrícula'}</p>}
        <p className="break-words whitespace-pre-wrap">{item.reason}</p>
        <p className="text-sm text-campus-deep/75">Submetida em {date(item.createdAt)} · Prazo de análise: {date(item.slaDueDate)}{item.slaOverdue ? ' · SLA ultrapassado' : ''}</p>
        {item.slaOverdue && <p role="status" className="alert-error">O prazo de análise desta contestação foi ultrapassado.</p>}
        {item.resolutionNotes && <p className="break-words whitespace-pre-wrap"><strong>Decisão:</strong> {item.resolutionNotes}</p>}
        {canResolve && item.status === 'PENDENTE_ANALISE' && <IconActionButton label="Analisar" title={`Analisar ${item.debt.title}`} disabled={busy} onClick={() => { setSelected(item); setError(''); setMessage(''); }} />}
      </article>)}
      <Pagination offset={offset} hasMore={!!result.data.meta.hasMore} loading={result.loading || busy} onChange={n => { setOffset(n); setSelected(null); }} />
    </>}
    {canResolve && selected && <form className="surface space-y-4 p-4 sm:p-5" onSubmit={decide}>
      <h3 className="font-display text-xl font-semibold">Decidir contestação — {selected.debt.title}</h3>
      <p className="text-sm">Aceitar regulariza esta dívida. Rejeitar mantém a cobrança. A decisão não pode ser alterada neste fluxo.</p>
      <div><label htmlFor="analysis-decision" className="block text-sm font-medium">Decisão</label><SelectField id="analysis-decision" name="decision" required disabled={busy} placeholder="Seleccionar decisão" options={[{ value: 'PROCEDENTE', label: 'Aceitar contestação' }, { value: 'IMPROCEDENTE', label: 'Rejeitar contestação' }]} /></div>
      <label className="block text-sm font-medium">Justificação da decisão<textarea className="field-input min-h-28" name="resolutionNotes" minLength={5} maxLength={1000} required disabled={busy} /></label>
      <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={busy}><BusyLabel busy={busy} busyText="A registar…">Registar decisão</BusyLabel></button><button className="btn-secondary" type="button" disabled={busy} onClick={() => setSelected(null)}>Cancelar</button></div>
    </form>}
  </section>;
}
