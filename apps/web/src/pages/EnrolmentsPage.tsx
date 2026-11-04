import { type FormEvent, useEffect, useState } from 'react';
import type {
  EnrolmentStatus,
  StudentProfileDto,
  SubjectDto,
  SubjectEnrolmentDto,
} from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { AlertMessage, type AlertState } from '../components/AlertMessage';
import { useConfirm } from '../components/ConfirmDialog';
import { PageIntro } from '../components/PageIntro';

const statusLabel: Record<EnrolmentStatus, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Activa',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Concluída',
};

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function EnrolmentsPage() {
  const { user, api } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const canManage = user?.role === 'ADMIN' || user?.role === 'COORDINATOR';
  const canComplete = user?.role === 'COORDINATOR';

  const [enrolments, setEnrolments] = useState<SubjectEnrolmentDto[]>([]);
  const [students, setStudents] = useState<StudentProfileDto[]>([]);
  const [subjects, setSubjects] = useState<SubjectDto[]>([]);
  const [ownStudentId, setOwnStudentId] = useState<string | null>(null);
  const [ownCourseId, setOwnCourseId] = useState<string | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { confirm, dialog } = useConfirm();
  const [form, setForm] = useState({ studentId: '', subjectId: '', academicYear: '2026' });

  async function loadList() {
    try {
      const res = await api.enrolments.list();
      setEnrolments(res.data);
    } catch (err) {
      setAlert({ tone: 'error', message: messageOf(err) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [list, own, studentList] = await Promise.all([
          api.enrolments.list(),
          isStudent ? api.students.getMe().then((res) => res.data).catch(() => null) : Promise.resolve(null),
          isStudent
            ? Promise.resolve([] as StudentProfileDto[])
            : api.students.list().then((res) => res.data),
        ]);
        if (cancelled) return;
        setEnrolments(list.data);
        setStudents(studentList);
        setOwnStudentId(own?.id ?? null);
        setOwnCourseId(own?.course?.id ?? null);
      } catch (err) {
        if (!cancelled) setAlert({ tone: 'error', message: messageOf(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api, isStudent]);

  const selectedStudent = isStudent ? null : students.find((s) => s.id === form.studentId);
  const courseId = isStudent ? ownCourseId : (selectedStudent?.course?.id ?? null);

  useEffect(() => {
    if (!courseId) {
      setSubjects([]);
      return;
    }
    let cancelled = false;
    setLoadingSubjects(true);
    api
      .subjects(courseId)
      .then((res) => {
        if (!cancelled) setSubjects(res.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setAlert({ tone: 'error', message: messageOf(err) });
      })
      .finally(() => {
        if (!cancelled) setLoadingSubjects(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, courseId]);

  async function create(event: FormEvent) {
    event.preventDefault();
    const studentId = isStudent ? ownStudentId : form.studentId;
    if (!studentId) {
      setAlert({
        tone: 'error',
        message: 'Perfil de estudante não encontrado para este utilizador.',
      });
      return;
    }
    const subject = subjects.find((item) => item.id === form.subjectId);
    const studentName = isStudent
      ? (user?.fullName ?? 'O meu perfil')
      : (selectedStudent?.user.fullName ?? '—');
    const confirmed = await confirm({
      title: 'Nova inscrição',
      message: 'Confirma a inscrição com estes dados? Fica pendente até ser activada.',
      details: [
        { label: 'Estudante', value: studentName },
        { label: 'Disciplina', value: subject ? `${subject.code} — ${subject.name}` : '—' },
        { label: 'Ano lectivo', value: form.academicYear },
      ],
      confirmLabel: 'Inscrever',
    });
    if (!confirmed) return;
    setAlert(null);
    setSubmitting(true);
    try {
      await api.enrolments.create({
        studentId,
        subjectId: form.subjectId,
        academicYear: Number(form.academicYear),
      });
      setAlert({
        tone: 'success',
        message: 'Inscrição criada com estado pendente, à espera de activação.',
      });
      setForm({ ...form, subjectId: '' });
      setLoading(true);
      await loadList();
    } catch (err) {
      setAlert({ tone: 'error', message: messageOf(err) });
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(enrolment: SubjectEnrolmentDto, status: EnrolmentStatus) {
    const labels: Record<EnrolmentStatus, { title: string; message: string }> = {
      PENDING: { title: 'Reabrir inscrição', message: 'Passar a inscrição para pendente?' },
      ACTIVE: {
        title: 'Activar inscrição',
        message: 'Confirmar a activação desta inscrição pendente?',
      },
      COMPLETED: {
        title: 'Concluir inscrição',
        message: 'A inscrição passa a concluída e deixa de poder mudar de estado.',
      },
      CANCELLED: {
        title: 'Cancelar inscrição',
        message: 'A inscrição fica cancelada e deixa de poder mudar de estado.',
      },
    };
    const confirmed = await confirm({
      ...labels[status],
      details: [
        { label: 'Estudante', value: enrolment.student.fullName },
        {
          label: 'Disciplina',
          value: `${enrolment.subject.code} — ${enrolment.subject.name}`,
        },
        { label: 'Novo estado', value: statusLabel[status] },
      ],
      confirmLabel: labels[status].title,
    });
    if (!confirmed) return;
    setAlert(null);
    try {
      await api.enrolments.updateStatus(enrolment.id, status);
      setAlert({
        tone: 'success',
        message: `Inscrição actualizada para "${statusLabel[status]}".`,
      });
      await loadList();
    } catch (err) {
      setAlert({ tone: 'error', message: messageOf(err) });
    }
  }

  async function remove(enrolment: SubjectEnrolmentDto) {
    const confirmed = await confirm({
      title: 'Eliminar inscrição',
      message: 'Esta inscrição será eliminada em definitivo.',
      details: [
        { label: 'Estudante', value: enrolment.student.fullName },
        {
          label: 'Disciplina',
          value: `${enrolment.subject.code} — ${enrolment.subject.name}`,
        },
      ],
      confirmLabel: 'Eliminar',
    });
    if (!confirmed) return;
    setAlert(null);
    try {
      await api.enrolments.remove(enrolment.id);
      setAlert({ tone: 'success', message: 'Inscrição eliminada.' });
      await loadList();
    } catch (err) {
      setAlert({ tone: 'error', message: messageOf(err) });
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Gestão académica"
        title="Inscrições em disciplinas"
        description="Inscrições por estudante, disciplina e ano lectivo"
      />

      {!isStudent || ownStudentId ? (
        <form onSubmit={create} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
          {isStudent ? null : (
            <select
              className="field-input !mt-0"
              aria-label="Estudante"
              value={form.studentId}
              onChange={(event) =>
                setForm({ ...form, studentId: event.target.value, subjectId: '' })
              }
              required
            >
              <option value="" disabled>
                {students.length === 0 ? 'Sem estudantes registados' : 'Selecionar estudante'}
              </option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.studentNumber} — {student.user.fullName}
                  {student.course ? ` (${student.course.code})` : ''}
                </option>
              ))}
            </select>
          )}
          <select
            className="field-input !mt-0"
            aria-label="Disciplina"
            value={form.subjectId}
            onChange={(event) => setForm({ ...form, subjectId: event.target.value })}
            disabled={!courseId || loadingSubjects}
            required
          >
            <option value="" disabled>
              {isStudent && !ownCourseId
                ? 'O seu perfil não tem curso associado'
                : !courseId
                  ? 'Escolha primeiro o estudante'
                  : loadingSubjects
                    ? 'A carregar disciplinas…'
                    : subjects.length === 0
                      ? 'Sem disciplinas no curso'
                      : 'Selecionar disciplina'}
            </option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.code} — {subject.name}
              </option>
            ))}
          </select>
          <input
            className="field-input !mt-0"
            type="number"
            min={2000}
            max={2100}
            placeholder="Ano lectivo"
            value={form.academicYear}
            onChange={(event) => setForm({ ...form, academicYear: event.target.value })}
            required
          />
          <button type="submit" className="btn-primary" disabled={submitting || !form.subjectId}>
            {submitting ? 'A inscrever…' : 'Inscrever'}
          </button>
        </form>
      ) : (
        <p className="surface p-4 text-sm text-campus-deep/70">
          Ainda não tem perfil de estudante; contacte a coordenação para poder inscrever-se.
        </p>
      )}

      {alert ? <AlertMessage {...alert} /> : null}

      {dialog}

      {loading ? (
        <p className="text-campus-deep/70">A carregar inscrições…</p>
      ) : enrolments.length === 0 ? (
        <p className="surface p-5 text-sm text-campus-deep/70">Ainda não há inscrições.</p>
      ) : (
        <div className="table-scroll surface">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-campus-mist">
              <tr>
                <th className="px-4 py-3">Estudante</th>
                <th className="px-4 py-3">Disciplina</th>
                <th className="px-4 py-3">Ano</th>
                <th className="px-4 py-3">Estado</th>
                {canManage ? <th className="px-4 py-3">Acções</th> : null}
              </tr>
            </thead>
            <tbody>
              {enrolments.map((enrolment) => (
                <tr key={enrolment.id} className="border-t border-campus-line/70">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs">{enrolment.student.studentNumber}</span>
                    <span className="ml-2">{enrolment.student.fullName}</span>
                  </td>
                  <td className="px-4 py-3">
                    {enrolment.subject.code} — {enrolment.subject.name}
                  </td>
                  <td className="px-4 py-3">{enrolment.academicYear}</td>
                  <td className="px-4 py-3">{statusLabel[enrolment.status]}</td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {enrolment.status === 'PENDING' ? (
                          <Action label="Activar" onClick={() => void changeStatus(enrolment, 'ACTIVE')} />
                        ) : null}
                        {enrolment.status === 'ACTIVE' && canComplete ? (
                          <Action label="Concluir" onClick={() => void changeStatus(enrolment, 'COMPLETED')} />
                        ) : null}
                        {enrolment.status === 'PENDING' || enrolment.status === 'ACTIVE' ? (
                          <Action
                            label="Cancelar"
                            onClick={() => void changeStatus(enrolment, 'CANCELLED')}
                          />
                        ) : null}
                        <Action label="Eliminar" onClick={() => void remove(enrolment)} />
                      </div>
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

function Action({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="rounded-lg border border-campus-line px-2.5 py-1 text-xs hover:bg-campus-mist"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
