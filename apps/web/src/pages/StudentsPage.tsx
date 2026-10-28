import { type FormEvent, useEffect, useState } from 'react';
import type { CourseDto, StudentProfileDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { AlertMessage, type AlertState } from '../components/AlertMessage';
import { useConfirm } from '../components/ConfirmDialog';
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
  const [alert, setAlert] = useState<AlertState | null>(null);
  const { confirm, dialog } = useConfirm();

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
    const confirmed = await confirm({
      title: 'Guardar contacto',
      message: 'Actualizar o número de telefone associado ao seu perfil?',
      details: [{ label: 'Telefone', value: phone }],
      confirmLabel: 'Guardar',
    });
    if (!confirmed) return;
    setSaving(true);
    setAlert(null);
    try {
      const res = await api.students.updateOwn({ phone });
      setState({ status: 'ok', data: res.data });
      setAlert({ tone: 'success', message: 'Contacto actualizado com sucesso.' });
    } catch (error) {
      setAlert({ tone: 'error', message: messageOf(error) });
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
          description="Perfil académico."
        />
        <AlertMessage tone="error" message={state.message} />
      </div>
    );
  }

  const student = state.data;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Área do estudante"
        title="O meu perfil"
        description="Perfil académico."
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
        {alert ? <AlertMessage {...alert} /> : null}
      </form>

      {dialog}
    </div>
  );
}

function StudentsDirectory({ canManage }: { canManage: boolean }) {
  const { api } = useAuth();
  const [students, setStudents] = useState<StudentProfileDto[]>([]);
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
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
      setAlert({ tone: 'error', message: messageOf(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [api]);

  async function create(event: FormEvent) {
    event.preventDefault();
    const course = courses.find((item) => item.id === form.courseId);
    const confirmed = await confirm({
      title: 'Criar estudante',
      message: 'Confirma a criação da conta de acesso e do perfil de estudante com estes dados?',
      details: [
        { label: 'Nome', value: form.fullName },
        { label: 'Email', value: form.email },
        { label: 'Nº de estudante', value: form.studentNumber },
        { label: 'Curso', value: course ? `${course.code} — ${course.name}` : '—' },
      ],
      confirmLabel: 'Criar estudante',
    });
    if (!confirmed) return;
    setAlert(null);
    setSubmitting(true);
    try {
      await api.students.create({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        studentNumber: form.studentNumber,
        courseId: form.courseId,
        yearOfStudy: form.yearOfStudy ? Number(form.yearOfStudy) : undefined,
        phone: form.phone || undefined,
      });
      setAlert({
        tone: 'success',
        message: 'Estudante criado com sucesso.',
      });
      setForm({
        email: '',
        password: '',
        fullName: '',
        studentNumber: '',
        courseId: '',
        yearOfStudy: '1',
        phone: '',
      });
      setLoading(true);
      await load();
    } catch (err) {
      setAlert({ tone: 'error', message: messageOf(err) });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(student: StudentProfileDto) {
    const confirmed = await confirm({
      title: 'Remover estudante',
      message: 'O perfil e a conta de acesso associada serão eliminados em definitivo.',
      details: [
        { label: 'Nº de estudante', value: student.studentNumber },
        { label: 'Nome', value: student.user.fullName },
      ],
      confirmLabel: 'Remover',
    });
    if (!confirmed) return;
    setAlert(null);
    try {
      await api.students.remove(student.id);
      setAlert({ tone: 'success', message: 'Estudante removido com sucesso.' });
      setLoading(true);
      await load();
    } catch (err) {
      setAlert({ tone: 'error', message: messageOf(err) });
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Gestão académica"
        title="Estudantes"
        description="Criar perfil de estudante"
      />

      {canManage ? (
        <form onSubmit={create} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
          <input
            className="field-input !mt-0"
            type="email"
            placeholder="Email da conta"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
          <input
            className="field-input !mt-0"
            type="password"
            placeholder="Password (mín. 8)"
            minLength={8}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
          <input
            className="field-input !mt-0"
            placeholder="Nome completo"
            value={form.fullName}
            onChange={(event) => setForm({ ...form, fullName: event.target.value })}
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

      {alert ? <AlertMessage {...alert} /> : null}

      {dialog}

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
                        onClick={() => void remove(student)}
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
