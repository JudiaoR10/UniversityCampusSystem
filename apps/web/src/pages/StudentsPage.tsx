import { type FormEvent, useEffect, useState } from 'react';
import type { CourseDto, StudentProfileDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';

const statusLabel: Record<StudentProfileDto['status'], string> = {
  ACTIVE: 'Activo',
  SUSPENDED: 'Suspenso',
  GRADUATED: 'Graduado',
  WITHDRAWN: 'Desistente',
};

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function StudentsPage() {
  const { user } = useAuth();
  const isStaff = !!user && ['ADMIN', 'COORDINATOR', 'TEACHER'].includes(user.role);
  const canManage = !!user && ['ADMIN', 'COORDINATOR'].includes(user.role);

  return isStaff ? <StudentsDirectory canManage={canManage} /> : <OwnStudentProfile />;
}

function OwnStudentProfile() {
  const { api } = useAuth();
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error'; message: string } | { status: 'ok'; data: StudentProfileDto }
  >({ status: 'loading' });
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.students
      .getMe()
      .then((res) => {
        if (cancelled) return;
        setState({ status: 'ok', data: res.data });
        setPhone(res.data.phone ?? '');
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: messageOf(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await api.students.updateOwn({ phone });
      setState({ status: 'ok', data: res.data });
      setFeedback('Contacto actualizado.');
    } catch (error) {
      setFeedback(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  if (state.status === 'loading') {
    return <p className="text-campus-deep/70">A carregar o seu perfil…</p>;
  }

  if (state.status === 'error') {
    return (
      <div className="space-y-6">
        <PageIntro
          eyebrow="Área do estudante"
          title="O meu perfil"
          description="Perfil académico associado à sua conta do Core."
        />
        <p className="surface p-5 text-sm text-red-700">{state.message}</p>
      </div>
    );
  }

  const student = state.data;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Área do estudante"
        title="O meu perfil"
        description="Perfil académico associado à sua conta do Core."
      />

      <section className="surface grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Número de estudante" value={student.studentNumber} />
        <Field label="Estado" value={statusLabel[student.status]} />
        <Field
          label="Curso"
          value={student.course ? `${student.course.code} — ${student.course.name}` : 'Sem curso associado'}
        />
        <Field label="Ano de estudo" value={student.yearOfStudy ?? '—'} />
      </section>

      <form onSubmit={save} className="surface space-y-3 p-5 sm:max-w-md">
        <h2 className="font-display text-lg font-semibold text-campus-ink">Contacto</h2>
        <label className="block text-sm font-medium text-campus-ink">
          Telefone
          <input
            className="field-input"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+258 84 000 0000"
            required
          />
        </label>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'A guardar…' : 'Guardar contacto'}
        </button>
        {feedback ? <p className="text-sm text-campus-deep/70">{feedback}</p> : null}
      </form>
    </div>
  );
}

function StudentsDirectory({ canManage }: { canManage: boolean }) {
  const { api } = useAuth();
  const [students, setStudents] = useState<StudentProfileDto[]>([]);
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    userId: '',
    studentNumber: '',
    courseId: '',
    yearOfStudy: '1',
    phone: '',
  });

  async function load() {
    try {
      const [resStudents, resCourses] = await Promise.all([api.students.list(), api.courses()]);
      setStudents(resStudents.data);
      setCourses(resCourses.data);
      const first = resCourses.data[0];
      setForm((current) =>
        current.courseId || !first ? current : { ...current, courseId: first.id },
      );
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [api]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.students.create({
        userId: form.userId,
        studentNumber: form.studentNumber,
        courseId: form.courseId,
        yearOfStudy: form.yearOfStudy ? Number(form.yearOfStudy) : undefined,
        phone: form.phone || undefined,
      });
      setForm({ userId: '', studentNumber: '', courseId: '', yearOfStudy: '1', phone: '' });
      setLoading(true);
      await load();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Remover este perfil de estudante?')) return;
    try {
      await api.students.remove(id);
      setLoading(true);
      await load();
    } catch (err) {
      setError(messageOf(err));
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Gestão académica"
        title="Estudantes"
        description="Perfis de estudante ligados aos utilizadores do Core e ao curso da gestão académica."
      />

      {canManage ? (
        <form onSubmit={create} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-6">
          <input
            className="field-input !mt-0"
            placeholder="userId"
            value={form.userId}
            onChange={(event) => setForm({ ...form, userId: event.target.value })}
            required
          />
          <input
            className="field-input !mt-0"
            placeholder="Nº de estudante"
            value={form.studentNumber}
            onChange={(event) => setForm({ ...form, studentNumber: event.target.value })}
            required
          />
          <select
            className="field-input !mt-0"
            aria-label="Curso"
            value={form.courseId}
            onChange={(event) => setForm({ ...form, courseId: event.target.value })}
            required
          >
            <option value="" disabled>
              {courses.length === 0 ? 'Sem cursos disponíveis' : 'Selecionar curso'}
            </option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} — {course.name}
              </option>
            ))}
          </select>
          <input
            className="field-input !mt-0"
            type="number"
            min={1}
            max={10}
            placeholder="Ano"
            value={form.yearOfStudy}
            onChange={(event) => setForm({ ...form, yearOfStudy: event.target.value })}
          />
          <input
            className="field-input !mt-0"
            placeholder="Telefone (opcional)"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
          />
          <button type="submit" className="btn-primary" disabled={submitting || !form.courseId}>
            {submitting ? 'A criar…' : 'Criar perfil'}
          </button>
        </form>
      ) : null}

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-campus-deep/70">A carregar estudantes…</p>
      ) : students.length === 0 ? (
        <p className="surface p-5 text-sm text-campus-deep/70">Ainda não há estudantes registados.</p>
      ) : (
        <div className="table-scroll surface">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="bg-campus-mist">
              <tr>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Curso</th>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">Estado</th>
                {canManage ? <th className="px-4 py-3">Acções</th> : null}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-t border-campus-line/70">
                  <td className="px-4 py-3 font-mono text-xs">{student.studentNumber}</td>
                  <td className="px-4 py-3">{student.user.fullName}</td>
                  <td className="px-4 py-3">{student.course?.code ?? '—'}</td>
                  <td className="px-4 py-3">{student.yearOfStudy ?? '—'}</td>
                  <td className="px-4 py-3">{statusLabel[student.status]}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="rounded-lg border border-campus-line px-2.5 py-1 text-xs hover:bg-campus-mist"
                        onClick={() => void remove(student.id)}
                      >
                        Remover
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-campus-deep/55">{label}</p>
      <p className="mt-1 text-sm font-medium text-campus-ink">{value}</p>
    </div>
  );
}
