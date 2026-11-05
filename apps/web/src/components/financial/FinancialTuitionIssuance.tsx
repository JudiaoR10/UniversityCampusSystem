import { useEffect, useState, type FormEvent } from 'react';
import type { CourseDto } from '@smart-campus/shared-types';
import { useAuth } from '../../lib/auth';
import { SelectField } from '../SelectField';
import { errorMessage } from './shared';

export function FinancialTuitionIssuance({ onCreated }: { onCreated: () => void }) {
  const { api, user } = useAuth();
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const year = String(new Date().getFullYear());

  useEffect(() => {
    let active = true;
    api.courses().then((res) => {
      if (active) setCourses(res.data);
    }).catch((e: unknown) => {
      if (active) setError(errorMessage(e));
    });
    return () => { active = false; };
  }, [api]);

  if (user?.role !== 'FINANCE' && user?.role !== 'ADMIN') return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await api.createDebtsFromEnrolments({
        courseId: String(fields.courseId),
        academicYear: String(fields.academicYear).trim(),
        amount: Number(fields.amount),
        dueDate: new Date(String(fields.dueDate)).toISOString(),
        title: String(fields.title).trim() || undefined,
      });
      setMessage(`Emitidas ${result.data.created} propinas. ${result.data.skipped} matrículas já tinham esta cobrança em aberto.`);
      form.reset();
      onCreated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" aria-label="Emissão de propina">
      <h2 className="font-display text-xl font-semibold">Emissão de propina por matrícula</h2>
      <p className="text-sm text-campus-deep/75">
        Cria uma dívida de propina para cada matrícula activa no curso e ano lectivo. Matrículas que já têm a mesma cobrança em aberto são ignoradas.
      </p>
      {error && <p role="alert" className="alert-error">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-campus-teal/10 px-3 py-2 text-sm text-campus-teal">{message}</p>}
      <form className="surface grid gap-4 p-4 sm:p-5 md:grid-cols-2" onSubmit={(e) => void submit(e)}>
        <div className="min-w-0 text-sm font-medium">
          <label htmlFor="tuition-course">Curso</label>
          <SelectField
            id="tuition-course"
            name="courseId"
            required
            disabled={busy || !courses.length}
            placeholder="Seleccionar curso"
            options={courses.map((course) => ({ value: course.id, label: `${course.code} · ${course.name}` }))}
          />
        </div>
        <label className="min-w-0 text-sm font-medium">
          Ano lectivo
          <input className="field-input" name="academicYear" required minLength={4} maxLength={20} defaultValue={year} disabled={busy} />
        </label>
        <label className="min-w-0 text-sm font-medium">
          Valor (MZN)
          <input className="field-input" name="amount" type="number" min="0.01" max="1000000" step="0.01" required disabled={busy} />
        </label>
        <label className="min-w-0 text-sm font-medium">
          Vencimento
          <input className="field-input" name="dueDate" type="datetime-local" required disabled={busy} />
        </label>
        <label className="min-w-0 text-sm font-medium md:col-span-2">
          Descrição (opcional)
          <input className="field-input" name="title" minLength={3} maxLength={120} placeholder={`Propina ${year}`} disabled={busy} />
        </label>
        <button className="btn-primary self-end" disabled={busy || !courses.length}>Emitir propinas</button>
      </form>
    </section>
  );
}
