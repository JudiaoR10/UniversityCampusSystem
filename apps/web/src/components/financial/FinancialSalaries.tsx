import { useCallback, useState, type FormEvent } from 'react';
import type { EmployeeCategory, EmployeeDto, EmployeeSalaryDto, SalaryChangeRequestDto } from '@smart-campus/shared-types';
import { useAuth } from '../../lib/auth';
import { currentFinancialMonth } from './FinancialMonthlyReports';
import { BusyLabel, date, errorMessage, LoadState, money, SuccessFeedback, useFinancialLoad } from './shared';
import { printSalaryReceipt } from './printReceipts';
import { IconActionButton } from '../ActionButtons';

const categories: Array<{ value: '' | EmployeeCategory; label: string }> = [
  { value: '', label: 'Todas as categorias' }, { value: 'TEACHER', label: 'Docentes' },
  { value: 'TECHNICIAN', label: 'Técnicos' }, { value: 'COORDINATOR', label: 'Coordenadores' },
  { value: 'ADMINISTRATIVE', label: 'Administrativos' }, { value: 'FINANCE', label: 'Financeiros' },
  { value: 'CLEANER', label: 'Agentes de limpeza' }, { value: 'GUARD', label: 'Guardas' },
  { value: 'OTHER', label: 'Outros' },
];
const categoryName = (value: EmployeeCategory) => categories.find(item => item.value === value)?.label ?? value;

export function FinancialSalaries() {
  const { api, user } = useAuth();
  const canOperate = user?.role === 'FINANCE';
  const canApprove = user?.role === 'ADMIN';
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<'' | EmployeeCategory>('');
  const [active, setActive] = useState('');
  const [revision, setRevision] = useState(0);
  const [feedback, setFeedback] = useState('');
  const employeeLoad = useCallback(() => api.financialEmployees({
    q: q.length >= 2 ? q : undefined, category: category || undefined,
    active: active === '' ? undefined : active === 'true', limit: 100,
  }), [api, q, category, active, revision]);
  const requestLoad = useCallback(() => api.salaryChangeRequests({
    status: canApprove ? 'PENDING' : undefined, limit: 100,
  }), [api, canApprove, revision]);
  const employees = useFinancialLoad(employeeLoad);
  const requests = useFinancialLoad(requestLoad);
  const changed = () => setRevision(value => value + 1);
  const list = employees.data?.data ?? [];
  const pending = (requests.data?.data ?? []).filter(item => item.status === 'PENDING');
  const approved = list.filter(item => item.currentSalary !== null).length;

  function clearFilters() {
    setQ(''); setCategory(''); setActive('');
  }

  return <section className="space-y-5" aria-label="Funcionários">
    <SuccessFeedback message={feedback} onClose={() => setFeedback('')} />
    <div className="space-y-1">
      <h2 className="font-display text-2xl font-semibold">Funcionários</h2>
      <p className="text-sm text-campus-deep/75">
        {canOperate
          ? 'Consulte os dados partilhados pelo Core, cadastre pessoal externo e envie propostas salariais para aprovação.'
          : 'Consulte o quadro de pessoal e decida as propostas salariais enviadas pela área Financeira.'}
      </p>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Funcionários encontrados" value={employees.loading ? '…' : String(list.length)} />
      <Metric label="Activos" value={employees.loading ? '…' : String(list.filter(item => item.isActive).length)} />
      <Metric label="Salário aprovado" value={employees.loading ? '…' : String(approved)} />
      <Metric label="Propostas pendentes" value={requests.loading ? '…' : String(pending.length)} accent={pending.length > 0} />
    </div>

    <div data-financial-guide="employees-search" className="surface space-y-3 p-4">
      <h3 className="font-semibold">Pesquisar no quadro de pessoal</h3>
      <div className="grid gap-3 md:grid-cols-[minmax(14rem,2fr)_minmax(11rem,1fr)_minmax(9rem,1fr)_auto] md:items-end">
        <label className="text-sm font-medium">Nome, código ou função
          <input className="field-input" type="search" value={q} onChange={event => setQ(event.target.value)} placeholder="Ex.: docente, guarda, FUNC-001" />
        </label>
        <label className="text-sm font-medium">Categoria
          <select className="field-input" value={category} onChange={event => setCategory(event.target.value as '' | EmployeeCategory)}>
            {categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Estado
          <select className="field-input" value={active} onChange={event => setActive(event.target.value)}>
            <option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option>
          </select>
        </label>
        <button className="btn-secondary" type="button" onClick={clearFilters} disabled={!q && !category && !active}>Limpar filtros</button>
      </div>
    </div>

    {canOperate && <ExternalEmployeeForm api={api} onChanged={changed} onSuccess={setFeedback} />}
    {canApprove && <ApprovalQueue requests={pending} loading={requests.loading} error={requests.error} reload={requests.reload} api={api} onChanged={changed} onSuccess={setFeedback} />}

    <LoadState {...employees} label="A carregar funcionários…" />
    {!employees.loading && !employees.error && !list.length && <p className="surface p-4">Nenhum funcionário corresponde aos filtros.</p>}
    {!!list.length && <div data-financial-guide="employees-list" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map(employee => <EmployeeCard key={employee.employeeKey} employee={employee} canOperate={canOperate} api={api} onChanged={changed} onSuccess={setFeedback} />)}
    </div>}

    <SalaryMonth canOperate={canOperate} employees={list} revision={revision} onChanged={changed} onSuccess={setFeedback} />
  </section>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <article className={`surface border-l-4 p-4 ${accent ? 'border-l-amber-500' : 'border-l-campus-accent'}`}>
    <p className="text-xs font-semibold uppercase tracking-wide text-campus-deep/60">{label}</p>
    <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
  </article>;
}

function EmployeeCard({ employee, canOperate, api, onChanged, onSuccess }: {
  employee: EmployeeDto; canOperate: boolean; api: ReturnType<typeof useAuth>['api']; onChanged: () => void; onSuccess: (message: string) => void;
}) {
  const [action, setAction] = useState<'proposal' | 'salary' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || busy) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setBusy(true); setError('');
    try {
      if (action === 'proposal') {
        await api.createSalaryChange({
          employeeKey: employee.employeeKey, proposedAmount: Number(fields.proposedAmount),
          reason: String(fields.reason),
        });
        onSuccess('Proposta enviada ao administrador.');
      } else {
        await api.createSalary({
          employeeKey: employee.employeeKey, month: String(fields.month), notes: String(fields.notes),
        });
        onSuccess('Salário mensal gerado com o valor aprovado.');
      }
      form.reset(); setAction(null); onChanged();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <article className="surface flex h-full flex-col gap-4 p-5">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="font-display text-lg font-semibold">{employee.fullName}</h3>
        <p className="text-sm text-campus-deep/70">{employee.employeeCode} · {employee.jobTitle}</p>
      </div>
      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${employee.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>{employee.isActive ? 'Activo' : 'Inactivo'}</span>
    </div>
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div><span className="block text-campus-deep/60">Categoria</span><strong>{categoryName(employee.category)}</strong></div>
      <div><span className="block text-campus-deep/60">Origem</span><strong>{employee.source === 'CORE' ? 'Core' : 'Cadastro externo'}</strong></div>
    </div>
    <div className="rounded-lg bg-campus-mist/70 p-3">
      <span className="block text-xs uppercase tracking-wide text-campus-deep/60">Salário aprovado</span>
      <strong className="text-lg">{employee.currentSalary === null ? 'Por definir' : money(employee.currentSalary)}</strong>
    </div>
    {canOperate && employee.isActive && <div className="mt-auto flex flex-wrap gap-2">
      <button className="btn-secondary" disabled={busy} onClick={() => setAction(action === 'proposal' ? null : 'proposal')}>Propor salário</button>
      <button className="btn-primary" disabled={busy || employee.currentSalary === null} title={employee.currentSalary === null ? 'Aguarda aprovação salarial' : undefined} onClick={() => setAction(action === 'salary' ? null : 'salary')}>Gerar salário mensal</button>
    </div>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {action && <form className="space-y-3 border-t border-campus-line pt-3" onSubmit={submit}>
      {action === 'proposal' ? <>
        <label className="block text-sm font-medium">Novo salário proposto (MZN)
          <input className="field-input" name="proposedAmount" type="number" min="0.01" max="1000000" step="0.01" defaultValue={employee.currentSalary ?? undefined} required disabled={busy} />
        </label>
        <label className="block text-sm font-medium">Justificação da proposta
          <textarea className="field-input" name="reason" minLength={5} maxLength={500} required disabled={busy} />
        </label>
      </> : <>
        <label className="block text-sm font-medium">Mês do salário
          <input className="field-input" name="month" type="month" min="2000-01" max="2100-12" defaultValue={currentFinancialMonth()} required disabled={busy} />
        </label>
        <label className="block text-sm font-medium">Observações
          <textarea className="field-input" name="notes" maxLength={500} disabled={busy} />
        </label>
      </>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}><BusyLabel busy={busy} busyText="A processar…">{action === 'proposal' ? 'Enviar para aprovação' : 'Gerar salário'}</BusyLabel></button>
        <button className="btn-secondary" type="button" disabled={busy} onClick={() => setAction(null)}>Cancelar</button>
      </div>
    </form>}
  </article>;
}

function ExternalEmployeeForm({ api, onChanged, onSuccess }: { api: ReturnType<typeof useAuth>['api']; onChanged: () => void; onSuccess: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setBusy(true); setError('');
    try {
      await api.createExternalEmployee(fields);
      form.reset(); onSuccess('Funcionário adicionado.'); onChanged();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <div className="surface p-4">
    <button className="btn-secondary" aria-expanded={open} onClick={() => setOpen(value => !value)}>Adicionar funcionário externo</button>
    {open && <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={submit}>
      <label className="text-sm font-medium">Código do funcionário<input className="field-input" name="employeeCode" minLength={2} maxLength={30} required disabled={busy} /></label>
      <label className="text-sm font-medium">Nome completo<input className="field-input" name="fullName" minLength={3} maxLength={160} required disabled={busy} /></label>
      <label className="text-sm font-medium">Categoria<select className="field-input" name="category" disabled={busy}><option value="CLEANER">Agente de limpeza</option><option value="GUARD">Guarda</option><option value="ADMINISTRATIVE">Administrativo</option><option value="OTHER">Outro</option></select></label>
      <label className="text-sm font-medium">Função<input className="field-input" name="jobTitle" minLength={2} maxLength={100} required disabled={busy} /></label>
      <div className="md:col-span-2"><button className="btn-primary" disabled={busy}><BusyLabel busy={busy} busyText="A guardar…">Guardar funcionário</BusyLabel></button></div>
      {error && <p role="alert" className="text-red-700 md:col-span-2">{error}</p>}
    </form>}
  </div>;
}

function ApprovalQueue({ requests, loading, error, reload, api, onChanged, onSuccess }: {
  requests: SalaryChangeRequestDto[]; loading: boolean; error: string; reload: () => void;
  api: ReturnType<typeof useAuth>['api']; onChanged: () => void; onSuccess: (message: string) => void;
}) {
  return <section data-financial-guide="salary-approvals" className="surface space-y-4 p-5" aria-label="Aprovações salariais">
    <div><h3 className="font-display text-xl font-semibold">Aprovações salariais</h3><p className="text-sm text-campus-deep/70">As propostas da área Financeira só alteram o salário depois da sua decisão.</p></div>
    <LoadState loading={loading} error={error} reload={reload} label="A carregar propostas…" />
    {!loading && !error && !requests.length && <p>Não existem propostas pendentes.</p>}
    <div className="grid gap-3 lg:grid-cols-2">{requests.map(request => <ApprovalCard key={request.id} request={request} api={api} onChanged={onChanged} onSuccess={onSuccess} />)}</div>
  </section>;
}

function ApprovalCard({ request, api, onChanged, onSuccess }: { request: SalaryChangeRequestDto; api: ReturnType<typeof useAuth>['api']; onChanged: () => void; onSuccess: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function decide(decision: 'APPROVED' | 'REJECTED', form: HTMLFormElement) {
    const reviewNotes = String(new FormData(form).get('reviewNotes') ?? '').trim();
    if (reviewNotes.length < 3) { setError('Indique uma nota de decisão com pelo menos 3 caracteres.'); return; }
    setBusy(true); setError('');
    try { await api.reviewSalaryChange(request.id, { decision, reviewNotes }); onSuccess(decision === 'APPROVED' ? 'Salário aprovado.' : 'Proposta rejeitada.'); onChanged(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <form className="rounded-xl border border-campus-line p-4" onSubmit={event => event.preventDefault()}>
    <h4 className="font-semibold">{request.employee.fullName}</h4>
    <p className="text-sm">{request.employee.employeeCode} · {request.employee.jobTitle}</p>
    <div className="my-3 flex items-center gap-2 text-sm"><span>{request.currentAmount === null ? 'Sem salário' : money(request.currentAmount)}</span><span aria-hidden="true">→</span><strong>{money(request.proposedAmount)}</strong></div>
    <p className="mb-3 text-sm">{request.reason}</p>
    <label className="block text-sm font-medium">Nota da decisão<textarea className="field-input" name="reviewNotes" minLength={3} maxLength={500} required disabled={busy} /></label>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <div className="mt-3 flex gap-2">
      <button className="btn-primary" type="button" disabled={busy} onClick={event => decide('APPROVED', event.currentTarget.form!)}><BusyLabel busy={busy} busyText="A processar…">Aprovar salário</BusyLabel></button>
      <button className="btn-secondary" type="button" disabled={busy} onClick={event => decide('REJECTED', event.currentTarget.form!)}>Rejeitar</button>
    </div>
  </form>;
}

function SalaryMonth({ canOperate, employees, revision, onChanged, onSuccess }: {
  canOperate: boolean; employees: EmployeeDto[]; revision: number; onChanged: () => void; onSuccess: (message: string) => void;
}) {
  const { api } = useAuth();
  const [month, setMonth] = useState(currentFinancialMonth);
  const load = useCallback(() => api.financialSalaries({ month, limit: 100 }), [api, month, revision]);
  const result = useFinancialLoad(load);
  return <section className="surface space-y-4 p-5" aria-label="Pagamentos salariais">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="font-display text-xl font-semibold">Pagamentos salariais</h3><p className="text-sm text-campus-deep/70">Registos gerados a partir do último salário aprovado.</p></div>
      <label className="text-sm font-medium">Período salarial<input className="field-input" type="month" min="2000-01" max="2100-12" value={month} onChange={event => setMonth(event.target.value)} /></label>
    </div>
    <LoadState {...result} label="A carregar pagamentos salariais…" />
    {result.data && !result.data.data.length && <p>Não existem salários gerados para este período.</p>}
    <div className="grid gap-3 lg:grid-cols-2">{result.data?.data.map(salary =>
      <SalaryCard key={salary.id} salary={salary} canOperate={canOperate} api={api} onChanged={() => { result.reload(); onChanged(); }} onSuccess={onSuccess} />
    )}</div>
    {canOperate && !employees.some(item => item.currentSalary !== null) && <p className="text-sm text-campus-deep/70">Envie uma proposta salarial e aguarde a aprovação do administrador para gerar salários mensais.</p>}
  </section>;
}

function SalaryCard({ salary, canOperate, api, onChanged, onSuccess }: {
  salary: EmployeeSalaryDto; canOperate: boolean; api: ReturnType<typeof useAuth>['api']; onChanged: () => void; onSuccess: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError('');
    try {
      await api.paySalary(salary.id, {
        paymentMethod: fields.paymentMethod, referenceCode: fields.referenceCode,
        amountPaid: salary.amount, expectedUpdatedAt: salary.updatedAt,
      });
      setOpen(false); onSuccess('Pagamento registado.'); onChanged();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <article className="rounded-xl border border-campus-line p-4">
    <div className="flex justify-between gap-3"><div><h4 className="font-semibold">{salary.employee.fullName}</h4><p className="text-sm">{salary.employee.employeeCode}</p></div><strong>{money(salary.amount)}</strong></div>
    <p className="mt-2 text-sm">{salary.status === 'PAID' ? `Pago em ${date(salary.paidAt!)} · ${salary.referenceCode}` : 'Pagamento pendente'}</p>
    {canOperate && salary.status === 'PENDING' && <button className="btn-primary mt-3" onClick={() => setOpen(value => !value)}>Registar pagamento salarial</button>}
    {salary.status === 'PAID' && <SalaryReceiptButton id={salary.id} />}
    {open && <form className="mt-3 space-y-3 border-t border-campus-line pt-3" onSubmit={submit}>
      <label className="block text-sm font-medium">Método do pagamento salarial<select className="field-input" name="paymentMethod" disabled={busy}><option value="BANK_TRANSFER">Transferência bancária</option><option value="CASH_DEPOSIT">Depósito</option><option value="MOBILE_MONEY">Carteira móvel</option><option value="POS">POS</option></select></label>
      <label className="block text-sm font-medium">Referência do pagamento salarial<input className="field-input" name="referenceCode" minLength={4} maxLength={80} required disabled={busy} /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary" disabled={busy}><BusyLabel busy={busy} busyText="A confirmar…">Confirmar pagamento salarial</BusyLabel></button>
    </form>}
  </article>;
}

function SalaryReceiptButton({ id }: { id: string }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function print() {
    if (busy) return;
    setBusy(true); setError('');
    try { printSalaryReceipt((await api.salaryReceipt(id)).data); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <div className="mt-3">
    <IconActionButton label="Imprimir comprovativo salarial" disabled={busy} onClick={() => void print()} />
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
