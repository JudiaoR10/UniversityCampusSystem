import { type FormEvent, useEffect, useState } from 'react';
import type { CourseDto, StudentProfileDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { AlertMessage, type AlertState } from '../components/AlertMessage';
import { useConfirm } from '../components/ConfirmDialog';
import { PageIntro } from '../components/PageIntro';
import { EmptyState, StatusPill } from '../components/ui';
import { SelectField } from '../components/SelectField';
import { DeleteAction, EditAction, TableActions } from '../components/ActionButtons';

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
  const { api, user } = useAuth();
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
        <Field label="Nome completo" value={student.user.fullName} />
        <Field label="Email" value={user?.email ?? '—'} />
        <Field label="Número de estudante" value={student.studentNumber} />
        <Field label="Estado" value={statusLabel[student.status]} />
        <Field
          label="Curso"
          value={student.course ? `${student.course.code} — ${student.course.name}` : 'Sem curso associado'}
        />
        <Field label="Ano de estudo" value={student.yearOfStudy ?? '—'} />
        <Field label="Telefone" value={student.phone ?? '—'} />
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    studentNumber: '',
    courseId: '',
    yearOfStudy: '1',
    phone: '',
    status: 'ACTIVE' as StudentProfileDto['status'],
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

  function resetForm() {
    setEditingId(null);
    setForm({
      email: '',
      password: '',
      fullName: '',
      studentNumber: '',
      courseId: courses[0]?.id ?? '',
      yearOfStudy: '1',
      phone: '',
      status: 'ACTIVE',
    });
  }

  function startEdit(student: StudentProfileDto) {
    setEditingId(student.id);
    setForm({
      email: '',
      password: '',
      fullName: student.user.fullName,
      studentNumber: student.studentNumber,
      courseId: student.courseId ?? '',
      yearOfStudy: student.yearOfStudy ? String(student.yearOfStudy) : '',
      phone: student.phone ?? '',
      status: student.status,
    });
    setAlert(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const course = courses.find((item) => item.id === form.courseId);
    const editing = editingId !== null;
    const confirmed = await confirm({
      title: editing ? 'Actualizar perfil de estudante' : 'Criar perfil de estudante',
      message: editing
        ? 'Guardar as alterações ao perfil de estudante?'
        : 'Criar conta de acesso e perfil de estudante?',
      details: [
        { label: 'Nº de estudante', value: form.studentNumber },
        { label: 'Curso', value: course ? `${course.code} — ${course.name}` : '—' },
      ],
      confirmLabel: editing ? 'Guardar alterações' : 'Criar perfil',
    });
    if (!confirmed) return;
    setAlert(null);
    setSubmitting(true);
    try {
      if (editingId) {
        await api.students.update(editingId, {
          courseId: form.courseId,
          yearOfStudy: form.yearOfStudy ? Number(form.yearOfStudy) : null,
          phone: form.phone || null,
          status: form.status,
        });
        setAlert({ tone: 'success', message: 'Estudante actualizado com sucesso.' });
      } else {
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
      }
      resetForm();
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
      message: 'O perfil académico será removido. A conta de acesso permanece activa.',
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
        <form onSubmit={submit} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">{editingId ? 'Editar perfil de estudante' : 'Novo perfil de estudante'}</h2>
            {editingId ? (
              <button type="button" className="btn-ghost" onClick={resetForm}>
                Cancelar edição
              </button>
            ) : null}
          </div>
          {editingId ? null : (
            <>
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
            </>
          )}
          <input
            className="field-input !mt-0"
            placeholder="Nº de estudante"
            value={form.studentNumber}
            onChange={(event) => setForm({ ...form, studentNumber: event.target.value })}
            readOnly={editingId !== null}
            title={editingId ? 'O número de estudante não pode ser alterado.' : undefined}
            required
          />
          <SelectField
            aria-label="Curso"
            value={form.courseId}
            onChange={(courseId) => setForm({ ...form, courseId })}
            required
            placeholder={courses.length === 0 ? 'Sem cursos disponíveis' : 'Seleccionar curso'}
            options={courses.map((course) => ({ value: course.id, label: `${course.code} — ${course.name}` }))}
          />
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
          {editingId ? (
            <SelectField
              aria-label="Estado"
              value={form.status}
              onChange={(status) => setForm({ ...form, status: status as StudentProfileDto['status'] })}
              options={(Object.keys(statusLabel) as StudentProfileDto['status'][]).map((status) => ({
                value: status,
                label: statusLabel[status],
              }))}
            />
          ) : null}
          <button type="submit" className="btn-primary" disabled={submitting || !form.courseId}>
            {submitting ? 'A guardar…' : editingId ? 'Guardar alterações' : 'Criar perfil'}
          </button>
        </form>
      ) : null}

      {alert ? <AlertMessage {...alert} /> : null}

      {dialog}

      {loading ? (
        <p className="text-campus-deep/70">A carregar estudantes…</p>
      ) : students.length === 0 ? (
        <EmptyState title="Ainda não há estudantes" description="Crie o primeiro perfil para o ver neste directório." />
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
                  <td className="px-4 py-3">
                    <StatusPill tone={student.status === 'ACTIVE' ? 'success' : student.status === 'SUSPENDED' ? 'warning' : 'muted'}>
                      {statusLabel[student.status]}
                    </StatusPill>
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <TableActions>
                        <EditAction title={`Editar ${student.user.fullName}`} onClick={() => startEdit(student)} />
                        <DeleteAction label="Remover" title={`Remover ${student.user.fullName}`} onClick={() => void remove(student)} />
                      </TableActions>
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
