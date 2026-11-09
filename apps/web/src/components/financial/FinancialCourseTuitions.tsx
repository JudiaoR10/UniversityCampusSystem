import { useCallback, useMemo, useState, type FormEvent } from 'react';
import type { CourseTuitionDto } from '@smart-campus/shared-types';
import { useAuth } from '../../lib/auth';
import { BusyLabel, date, errorMessage, LoadState, money, SuccessFeedback, useFinancialLoad } from './shared';

export function FinancialCourseTuitions() {
  const { api, user } = useAuth();
  const canWrite = user?.role === 'FINANCE';
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [revision, setRevision] = useState(0);
  const [feedback, setFeedback] = useState('');
  const load = useCallback(() => api.courseTuitions(), [api, revision]);
  const result = useFinancialLoad(load);
  const rows = useMemo(() => (result.data?.data ?? []).filter(course => {
    const matchesText = !q || `${course.courseCode} ${course.courseName} ${course.departmentName}`.toLocaleLowerCase('pt').includes(q.toLocaleLowerCase('pt'));
    const matchesStatus = !status || (status === 'configured' ? course.amount !== null : course.amount === null);
    return matchesText && matchesStatus;
  }), [result.data, q, status]);
  const configured = (result.data?.data ?? []).filter(course => course.amount !== null).length;
  return <section className="space-y-5" aria-label="Mensalidades por curso">
    <SuccessFeedback message={feedback} onClose={() => setFeedback('')} />
    <div>
      <h2 className="font-display text-2xl font-semibold">Mensalidades por curso</h2>
      <p className="text-sm text-campus-deep/75">
        Os cursos são partilhados pelo módulo académico. {canWrite ? 'A área Financeira define os respectivos valores mensais.' : 'Consulta dos valores definidos pela área Financeira.'}
      </p>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Metric label="Cursos" value={result.loading ? '…' : String(result.data?.data.length ?? 0)} />
      <Metric label="Com mensalidade" value={result.loading ? '…' : String(configured)} />
      <Metric label="Por configurar" value={result.loading ? '…' : String((result.data?.data.length ?? 0) - configured)} />
    </div>
    <div className="surface grid gap-3 p-4 md:grid-cols-[2fr_1fr_auto] md:items-end">
      <label className="text-sm font-medium">Curso ou departamento<input className="field-input" type="search" value={q} onChange={event => setQ(event.target.value)} /></label>
      <label className="text-sm font-medium">Estado<select className="field-input" value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos</option><option value="configured">Configurada</option><option value="missing">Por configurar</option></select></label>
      <button className="btn-secondary" disabled={!q && !status} onClick={() => { setQ(''); setStatus(''); }}>Limpar filtros</button>
    </div>
    <LoadState {...result} label="A carregar cursos e mensalidades…" />
    {!result.loading && !result.error && !rows.length && <p className="surface p-4">Nenhum curso corresponde aos filtros.</p>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(course => <CourseCard key={course.courseId} course={course} canWrite={canWrite} api={api} onChanged={() => setRevision(value => value + 1)} onSuccess={setFeedback} />)}
    </div>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="surface border-l-4 border-l-campus-accent p-4"><p className="text-xs font-semibold uppercase tracking-wide text-campus-deep/60">{label}</p><p className="mt-1 font-display text-2xl font-semibold">{value}</p></article>;
}

function CourseCard({ course, canWrite, api, onChanged, onSuccess }: {
  course: CourseTuitionDto; canWrite: boolean; api: ReturnType<typeof useAuth>['api']; onChanged: () => void; onSuccess: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setBusy(true); setError('');
    try {
      await api.updateCourseTuition(course.courseId, { amount: Number(fields.amount), notes: String(fields.notes) });
      onSuccess('Mensalidade actualizada.'); setEditing(false); onChanged();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  return <article className="surface flex h-full flex-col gap-4 p-5">
    <div><span className="text-xs font-semibold uppercase tracking-wide text-campus-accent">{course.courseCode}</span><h3 className="font-display text-lg font-semibold">{course.courseName}</h3><p className="text-sm text-campus-deep/65">{course.departmentName}</p></div>
    <div className="rounded-lg bg-campus-mist/70 p-3"><span className="block text-xs uppercase tracking-wide text-campus-deep/60">Mensalidade</span><strong className="text-xl">{course.amount === null ? 'Por configurar' : money(course.amount)}</strong></div>
    {course.notes && <p className="text-sm">{course.notes}</p>}
    {course.updatedAt && <p className="text-xs text-campus-deep/60">Actualizada em {date(course.updatedAt)}</p>}
    {canWrite && <button className="btn-secondary mt-auto" onClick={() => setEditing(value => !value)}>{course.amount === null ? 'Definir mensalidade' : 'Alterar mensalidade'}</button>}
    {editing && <form className="space-y-3 border-t border-campus-line pt-3" onSubmit={submit}>
      <label className="block text-sm font-medium">Mensalidade (MZN)<input className="field-input" name="amount" type="number" min="0.01" max="1000000" step="0.01" defaultValue={course.amount ?? undefined} required disabled={busy} /></label>
      <label className="block text-sm font-medium">Observações<textarea className="field-input" name="notes" maxLength={500} defaultValue={course.notes} disabled={busy} /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary" disabled={busy}><BusyLabel busy={busy} busyText="A guardar…">Guardar mensalidade</BusyLabel></button>
    </form>}
  </article>;
}
