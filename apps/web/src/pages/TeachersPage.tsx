import { type FormEvent, useEffect, useState } from 'react';
import type { DepartmentDto, TeacherProfileDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { AlertMessage, type AlertState } from '../components/AlertMessage';
import { useConfirm } from '../components/ConfirmDialog';
import { PageIntro } from '../components/PageIntro';
import { EmptyState, StatusPill } from '../components/ui';
import { SelectField } from '../components/SelectField';
import { DeleteAction, EditAction, TableActions } from '../components/ActionButtons';

const statusLabel: Record<TeacherProfileDto['status'], string> = {
  ACTIVE: 'Activo',
  ON_LEAVE: 'Em licença',
  INACTIVE: 'Inactivo',
};

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function TeachersPage() {
  const { user, api } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isTeacher = user?.role === 'TEACHER';

  const [teachers, setTeachers] = useState<TeacherProfileDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [own, setOwn] = useState<TeacherProfileDto | null>(null);
  const [phone, setPhone] = useState('');
  const [ownAlert, setOwnAlert] = useState<AlertState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    employeeCode: '',
    departmentId: '',
    title: '',
    phone: '',
    status: 'ACTIVE' as TeacherProfileDto['status'],
  });

  async function load() {
    try {
      const [resTeachers, resDepartments] = await Promise.all([api.teachers.list(), api.departments()]);
      setTeachers(resTeachers.data);
      setDepartments(resDepartments.data);
      const first = resDepartments.data[0];
      setForm((current) =>
        current.departmentId || !first ? current : { ...current, departmentId: first.id },
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

  useEffect(() => {
    if (!isTeacher) return;
    let cancelled = false;
    api.teachers
      .getMe()
      .then((res) => {
        if (cancelled) return;
        setOwn(res.data);
        setPhone(res.data.phone ?? '');
      })
      .catch(() => {
        if (!cancelled) setOwn(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api, isTeacher]);

  function resetForm() {
    setEditingId(null);
    setForm({
      email: '',
      password: '',
      fullName: '',
      employeeCode: '',
      departmentId: departments[0]?.id ?? '',
      title: '',
      phone: '',
      status: 'ACTIVE',
    });
  }

  function startEdit(teacher: TeacherProfileDto) {
    setEditingId(teacher.id);
    setForm({
      email: '',
      password: '',
      fullName: teacher.user.fullName,
      employeeCode: teacher.employeeCode,
      departmentId: teacher.departmentId ?? '',
      title: teacher.title ?? '',
      phone: teacher.phone ?? '',
      status: teacher.status,
    });
    setAlert(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const department = departments.find((item) => item.id === form.departmentId);
    const editing = editingId !== null;
    const confirmed = await confirm({
      title: editing ? 'Actualizar docente' : 'Criar docente',
      message: editing
        ? 'Guardar as alterações ao perfil do docente?'
        : 'Criar conta e perfil de docente?',
      details: [
        { label: 'Código', value: form.employeeCode },
        { label: 'Departamento', value: department ? `${department.code} — ${department.name}` : '—' },
      ],
      confirmLabel: editing ? 'Guardar alterações' : 'Criar docente',
    });
    if (!confirmed) return;
    setAlert(null);
    setSubmitting(true);
    try {
      if (editingId) {
        await api.teachers.update(editingId, {
          departmentId: form.departmentId,
          title: form.title || undefined,
          phone: form.phone || null,
          status: form.status,
        });
        setAlert({ tone: 'success', message: 'Docente actualizado com sucesso.' });
      } else {
        await api.teachers.create({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          employeeCode: form.employeeCode,
          departmentId: form.departmentId,
          title: form.title || undefined,
          phone: form.phone || undefined,
        });
        setAlert({
          tone: 'success',
          message: 'Docente criado com sucesso.',
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

  async function saveOwn(event: FormEvent) {
    event.preventDefault();
    const confirmed = await confirm({
      title: 'Guardar contacto',
      message: 'Actualizar o número de telefone associado ao seu perfil?',
      details: [{ label: 'Telefone', value: phone }],
      confirmLabel: 'Guardar',
    });
    if (!confirmed) return;
    setOwnAlert(null);
    setSubmitting(true);
    try {
      const res = await api.teachers.updateOwn({ phone });
      setOwn(res.data);
      setOwnAlert({ tone: 'success', message: 'Contacto actualizado com sucesso.' });
    } catch (err) {
      setOwnAlert({ tone: 'error', message: messageOf(err) });
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(teacher: TeacherProfileDto) {
    const confirmed = await confirm({
      title: 'Remover docente',
      message: 'O perfil de docente será removido. A conta de acesso permanece activa.',
      details: [
        { label: 'Código', value: teacher.employeeCode },
        { label: 'Nome', value: teacher.user.fullName },
      ],
      confirmLabel: 'Remover',
    });
    if (!confirmed) return;
    setAlert(null);
    try {
      await api.teachers.remove(teacher.id);
      setAlert({ tone: 'success', message: 'Docente removido com sucesso.' });
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
        title="Docentes"
        description="Criar perfil de docente"
      />

      {isTeacher && own ? (
        <div className="space-y-6">
          <section className="surface space-y-4 p-5">
            <h2 className="section-title">O meu perfil</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo" value={own.user.fullName} />
              <Field label="Email" value={user?.email ?? '—'} />
              <Field label="Código de docente" value={own.employeeCode} />
              <Field
                label="Departamento"
                value={
                  own.department ? `${own.department.code} — ${own.department.name}` : 'Sem departamento'
                }
              />
              <Field label="Título" value={own.title ?? '—'} />
              <Field label="Estado" value={statusLabel[own.status]} />
              <Field label="Telefone" value={own.phone ?? '—'} />
            </div>
          </section>

          <form onSubmit={saveOwn} className="surface flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
            <div className="min-w-0 flex-1">
              <h2 className="section-title">Contacto</h2>
              <p className="mt-1 text-sm text-campus-deep/70">
                Actualize o número de telefone associado ao seu perfil.
              </p>
            </div>
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
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'A guardar…' : 'Guardar contacto'}
            </button>
            {ownAlert ? <AlertMessage {...ownAlert} /> : null}
          </form>
        </div>
      ) : null}

      {isAdmin ? (
        <form onSubmit={submit} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">{editingId ? 'Editar perfil de docente' : 'Novo perfil de docente'}</h2>
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
            placeholder="Código de docente"
            value={form.employeeCode}
            onChange={(event) => setForm({ ...form, employeeCode: event.target.value })}
            readOnly={editingId !== null}
            title={editingId ? 'O código de docente não pode ser alterado.' : undefined}
            required
          />
          <SelectField
            aria-label="Departamento"
            value={form.departmentId}
            onChange={(departmentId) => setForm({ ...form, departmentId })}
            required
            placeholder={departments.length === 0 ? 'Sem departamentos disponíveis' : 'Seleccionar departamento'}
            options={departments.map((department) => ({
              value: department.id,
              label: `${department.code} — ${department.name}`,
            }))}
          />
          <input
            className="field-input !mt-0"
            placeholder="Título (opcional)"
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
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
              onChange={(status) => setForm({ ...form, status: status as TeacherProfileDto['status'] })}
              options={(Object.keys(statusLabel) as TeacherProfileDto['status'][]).map((status) => ({
                value: status,
                label: statusLabel[status],
              }))}
            />
          ) : null}
          <button type="submit" className="btn-primary" disabled={submitting || !form.departmentId}>
            {submitting ? 'A guardar…' : editingId ? 'Guardar alterações' : 'Criar perfil'}
          </button>
        </form>
      ) : null}

      {alert ? <AlertMessage {...alert} /> : null}

      {dialog}

      {loading ? (
        <p className="text-campus-deep/70">A carregar docentes…</p>
      ) : teachers.length === 0 ? (
        <EmptyState title="Ainda não há docentes" description="Crie o primeiro perfil para o ver neste directório." />
      ) : (
        <div className="table-scroll surface">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="bg-campus-mist">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Departamento</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Estado</th>
                {isAdmin ? <th className="px-4 py-3">Acções</th> : null}
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id} className="border-t border-campus-line/70">
                  <td className="px-4 py-3 font-mono text-xs">{teacher.employeeCode}</td>
                  <td className="px-4 py-3">{teacher.user.fullName}</td>
                  <td className="px-4 py-3">{teacher.department?.code ?? '—'}</td>
                  <td className="px-4 py-3">{teacher.title ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={teacher.status === 'ACTIVE' ? 'success' : teacher.status === 'ON_LEAVE' ? 'warning' : 'muted'}>
                      {statusLabel[teacher.status]}
                    </StatusPill>
                  </td>
                  {isAdmin ? (
                    <td className="px-4 py-3">
                      <TableActions>
                        <EditAction title={`Editar ${teacher.user.fullName}`} onClick={() => startEdit(teacher)} />
                        <DeleteAction label="Remover" title={`Remover ${teacher.user.fullName}`} onClick={() => void remove(teacher)} />
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
