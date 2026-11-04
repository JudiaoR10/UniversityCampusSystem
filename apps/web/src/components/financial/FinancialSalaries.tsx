import { useCallback, useState, type FormEvent } from 'react';
import type { TeacherIdentitySummaryDto, TeacherSalaryDto } from '@smart-campus/shared-types';
import { useAuth } from '../../lib/auth';
import { currentFinancialMonth } from './FinancialMonthlyReports';
import { date, errorMessage, LoadState, money, Pagination, useFinancialLoad } from './shared';

export function FinancialSalaries() {
  const { user } = useAuth();
  const canWrite = user?.role === 'FINANCE';
  const [month, setMonth] = useState(currentFinancialMonth);
  return <section className="space-y-4" aria-label="Salários dos docentes">
    <h2 className="font-display text-xl font-semibold">Salários dos docentes</h2>
    <p className="text-sm text-campus-deep/75">{canWrite ? 'Registe o valor mensal e confirme o pagamento já efectuado. Os dados académicos pertencem ao módulo Estudantes e Docentes.' : 'Consulta de salários. Apenas Finance pode criar, editar ou registar pagamentos salariais.'}</p>
    <label className="block max-w-xs text-sm font-medium">Período salarial<input className="field-input" type="month" min="2000-01" max="2100-12" required value={month} onChange={event => setMonth(event.target.value)} /></label>
    {/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month) ? <SalaryMonth key={month} month={month} canWrite={canWrite} /> : <p>Seleccione um mês válido.</p>}
  </section>;
}

function SalaryMonth({ month, canWrite }: { month: string; canWrite: boolean }) {
  const { api } = useAuth();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<{ salary: TeacherSalaryDto; action: 'edit' | 'pay' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(() => api.financialSalaries({ month, offset, limit: 20 }), [api, month, offset]);
  const result = useFinancialLoad(load);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError(''); setMessage('');
    try {
      if (selected.action === 'edit') await api.updateSalary(selected.salary.id, { amount: Number(fields.amount), notes: fields.notes, expectedUpdatedAt: selected.salary.updatedAt });
      else await api.paySalary(selected.salary.id, { ...fields, amountPaid: selected.salary.amount, expectedUpdatedAt: selected.salary.updatedAt });
      setSelected(null); setMessage('Operação salarial registada.'); result.reload();
    } catch (e) { setError(errorMessage(e)); result.reload(); }
    finally { setBusy(false); }
  }
  return <>
    {canWrite && <NewSalary month={month} onCreated={() => { result.reload(); setOffset(0); }} />}
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Salários de {month}</h3><button className="btn-secondary" disabled={busy || result.loading} onClick={() => { setSelected(null); setError(''); result.reload(); }}>Actualizar lista</button></div>
    <LoadState {...result} />
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {message && <p role="status">{message}</p>}
    {result.data && <>
      {!result.data.data.length && <p>Não existem salários registados para este período.</p>}
      {result.data.data.map(salary => <article key={salary.id} className="surface space-y-3 p-4">
        <div className="flex flex-wrap justify-between gap-3"><h4 className="font-semibold">{salary.teacher.fullName} · {salary.teacher.employeeCode}</h4><strong>{money(salary.amount)}</strong></div>
        <p>{salary.status === 'PAID' ? `Pago em ${date(salary.paidAt!)} · Referência: ${salary.referenceCode}` : 'Pagamento pendente'}</p>
        {salary.notes && <p className="break-words whitespace-pre-wrap">{salary.notes}</p>}
        {canWrite && salary.status === 'PENDING' && <div className="flex flex-wrap gap-3"><button className="btn-secondary" disabled={busy} onClick={() => { setSelected({ salary, action: 'edit' }); setError(''); setMessage(''); }}>Editar salário</button><button className="btn-primary" disabled={busy} onClick={() => { setSelected({ salary, action: 'pay' }); setError(''); setMessage(''); }}>Registar pagamento salarial</button></div>}
      </article>)}
      <Pagination offset={offset} hasMore={!!result.data.meta.hasMore} loading={result.loading || busy} onChange={value => { setOffset(value); setSelected(null); }} />
    </>}
    {canWrite && selected && <form key={`${selected.salary.id}:${selected.action}`} className="surface space-y-4 p-4" onSubmit={submit}>
      <h3 className="font-display text-xl font-semibold">{selected.action === 'edit' ? 'Editar salário' : 'Confirmar pagamento salarial'} — {selected.salary.teacher.fullName}</h3>
      {selected.action === 'edit' ? <><AmountField value={selected.salary.amount} disabled={busy} /><label className="block text-sm font-medium">Observações<textarea className="field-input" name="notes" maxLength={500} defaultValue={selected.salary.notes} disabled={busy} /></label></> : <>
        <p>Pagamento integral de {money(selected.salary.amount)}. Este registo confirma um pagamento efectuado; não transfere dinheiro. Após confirmação, o salário deixa de ser editável.</p>
        <div><label htmlFor="salary-method" className="text-sm font-medium">Método do pagamento salarial</label><select id="salary-method" className="field-input" name="paymentMethod" disabled={busy}><option value="BANK_TRANSFER">Transferência bancária</option><option value="CASH_DEPOSIT">Depósito</option><option value="MOBILE_MONEY">Carteira móvel</option><option value="POS">POS</option></select></div>
        <label className="block text-sm font-medium">Referência do pagamento salarial<input className="field-input" name="referenceCode" minLength={4} maxLength={80} required disabled={busy} /></label>
      </>}
      <div className="flex flex-wrap gap-3"><button className="btn-primary" disabled={busy}>{selected.action === 'edit' ? 'Guardar salário' : 'Confirmar pagamento salarial'}</button><button className="btn-secondary" type="button" disabled={busy} onClick={() => setSelected(null)}>Cancelar</button></div>
    </form>}
  </>;
}

function AmountField({ value, disabled }: { value?: number; disabled: boolean }) {
  return <label className="block text-sm font-medium">Valor do salário (MZN)<input className="field-input" name="amount" type="number" min="0.01" max="1000000" step="0.01" required defaultValue={value} disabled={disabled} /></label>;
}

function NewSalary({ month, onCreated }: { month: string; onCreated: () => void }) {
  const { api } = useAuth();
  const [open, setOpen] = useState(false);
  return <div><button className="btn-secondary" aria-expanded={open} onClick={() => setOpen(!open)}>Novo salário mensal</button>{open && <NewSalaryForm key={month} month={month} api={api} onCreated={onCreated} />}</div>;
}

function NewSalaryForm({ month, api, onCreated }: { month: string; api: ReturnType<typeof useAuth>['api']; onCreated: () => void }) {
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [teacher, setTeacher] = useState<TeacherIdentitySummaryDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(() => api.financialTeachers({ q: q || undefined, offset, limit: 20 }), [api, q, offset]);
  const result = useFinancialLoad(load);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teacher || busy) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setBusy(true); setError(''); setMessage('');
    try {
      await api.createSalary({ teacherId: teacher.teacherId, month, amount: Number(fields.amount), notes: String(fields.notes) });
      form.reset(); setTeacher(null); setMessage('Salário mensal registado.'); onCreated();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <div className="surface mt-4 space-y-4 p-4">
    <h3 className="font-semibold">Novo salário — {month}</h3>
    <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); setQ(String(new FormData(event.currentTarget).get('q')).trim()); setOffset(0); }}>
      <label className="flex-1 text-sm font-medium">Nome ou código do docente<input className="field-input" name="q" type="search" minLength={2} maxLength={100} disabled={busy} /></label><button className="btn-secondary" disabled={busy || result.loading}>Pesquisar docente</button>
    </form>
    <LoadState {...result} />
    {result.data && <>
      {!result.data.data.length && <p>Não foram encontrados docentes. O cadastro é feito no módulo Estudantes e Docentes.</p>}
      <ul className="divide-y divide-campus-line">{result.data.data.map(item => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={item.teacherId}><span>{item.fullName} · {item.employeeCode}{!item.isActive && ' · Conta inactiva'}</span><button className="btn-secondary" disabled={busy} onClick={() => setTeacher(item)}>Seleccionar docente <span className="sr-only">{item.fullName}</span></button></li>)}</ul>
      <Pagination offset={offset} hasMore={!!result.data.meta.hasMore} loading={result.loading || busy} onChange={setOffset} />
    </>}
    {error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status">{message}</p>}
    {teacher && <form className="space-y-4" onSubmit={submit}><p className="font-medium">Docente seleccionado: {teacher.fullName} · {teacher.employeeCode}</p><AmountField disabled={busy} /><label className="block text-sm font-medium">Observações<textarea className="field-input" name="notes" maxLength={500} disabled={busy} /></label><button className="btn-primary" disabled={busy}>Registar salário</button></form>}
  </div>;
}
