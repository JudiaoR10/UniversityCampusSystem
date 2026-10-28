import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ScheduleDto, ScheduleFiltersInput, ScheduleOptions } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { printDocument } from '../lib/print';
import { PageIntro } from '../components/PageIntro';

const MANAGE_ROLES = ['COORDINATOR', 'ADMIN'];

type FormState = {
  id: string | null;
  title: string;
  courseId: string;
  subjectId: string;
  teacherId: string;
  roomId: string;
  startsAt: string;
  endsAt: string;
};

const emptyForm: FormState = {
  id: null,
  title: '',
  courseId: '',
  subjectId: '',
  teacherId: '',
  roomId: '',
  startsAt: '',
  endsAt: '',
};

const dateFormatter = new Intl.DateTimeFormat('pt-PT', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' });

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toDateTimeInput(iso: string): string {
  const date = new Date(iso);
  return `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string): string {
  return new Date(value).toISOString();
}

function describeError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message && !/fetch|network/i.test(err.message)) {
    return err.message;
  }
  return fallback;
}

export function SchedulesPage() {
  const { api, user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleDto[]>([]);
  const [options, setOptions] = useState<ScheduleOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ courseId: '', teacherId: '', roomId: '', from: '', to: '' });
  const [reloadKey, setReloadKey] = useState(0);

  const canManage = Boolean(user && MANAGE_ROLES.includes(user.role));

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    api
      .scheduleOptions()
      .then((res) => {
        if (!cancelled) setOptions(res.data);
      })
      .catch(() => {
        if (!cancelled) setOptions(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api, canManage]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const query: ScheduleFiltersInput = {};
    if (filters.courseId) query.courseId = filters.courseId;
    if (filters.teacherId) query.teacherId = filters.teacherId;
    if (filters.roomId) query.roomId = filters.roomId;
    if (filters.from) query.from = new Date(filters.from).toISOString();
    if (filters.to) query.to = new Date(filters.to).toISOString();

    api
      .schedules(query)
      .then((res) => {
        if (!cancelled) setSchedules(res.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            describeError(err, 'Não foi possível carregar os horários. Verifica a ligação e tenta novamente.'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, filters.courseId, filters.teacherId, filters.roomId, filters.from, filters.to, reloadKey]);

  const groups = useMemo(() => {
    const byDay = new Map<string, { label: string; items: ScheduleDto[] }>();
    for (const schedule of schedules) {
      const start = new Date(schedule.startsAt);
      const key = dayKey(start);
      if (!byDay.has(key)) {
        byDay.set(key, { label: dateFormatter.format(start), items: [] });
      }
      byDay.get(key)!.items.push(schedule);
    }
    return [...byDay.values()];
  }, [schedules]);

  const subjectChoices = options?.subjects.filter((s) => !form.courseId || s.courseId === form.courseId) ?? [];

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function printSchedule() {
    const sorted = [...schedules].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
    const rows = sorted.map((schedule) => [
      dateFormatter.format(new Date(schedule.startsAt)),
      `${timeFormatter.format(new Date(schedule.startsAt))} – ${timeFormatter.format(new Date(schedule.endsAt))}`,
      schedule.title,
      schedule.subject?.name ?? schedule.subject?.code ?? '—',
      schedule.teacher?.fullName ?? '—',
      schedule.room ? `${schedule.room.code} — ${schedule.room.name}` : '—',
    ]);
    printDocument({
      title: 'Horário lectivo',
      subtitle: user?.fullName ?? '',
      columns: ['Dia', 'Hora', 'Sessão', 'Disciplina', 'Docente', 'Sala'],
      rows,
      emptyMessage: 'Não há horários para os filtros seleccionados.',
    });
  }

  function startEdit(schedule: ScheduleDto) {
    setNotice(null);
    setFormError(null);
    setForm({
      id: schedule.id,
      title: schedule.title,
      courseId: schedule.courseId,
      subjectId: schedule.subjectId,
      teacherId: schedule.teacherId ?? '',
      roomId: schedule.roomId ?? '',
      startsAt: toDateTimeInput(schedule.startsAt),
      endsAt: toDateTimeInput(schedule.endsAt),
    });
  }

  function cancelEdit() {
    setForm(emptyForm);
    setFormError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    if (form.title.trim().length < 3) {
      setFormError('O título deve ter pelo menos 3 caracteres.');
      return;
    }
    if (!form.courseId || !form.subjectId || !form.startsAt || !form.endsAt) {
      setFormError('Preenche o curso, a disciplina, o início e o fim.');
      return;
    }
    if (new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime()) {
      setFormError('A hora de fim deve ser posterior à hora de início.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      courseId: form.courseId,
      subjectId: form.subjectId,
      teacherId: form.teacherId || null,
      roomId: form.roomId || null,
      startsAt: toIso(form.startsAt),
      endsAt: toIso(form.endsAt),
    };

    try {
      if (form.id) {
        await api.updateSchedule(form.id, payload);
        setNotice('O horário foi atualizado com sucesso.');
      } else {
        await api.createSchedule(payload);
        setNotice('O horário foi criado com sucesso.');
      }
      cancelEdit();
      reload();
    } catch (err) {
      setFormError(describeError(err, 'Não foi possível guardar o horário. Confirma os campos assinalados.'));
    }
  }

  async function onDelete(schedule: ScheduleDto) {
    if (!window.confirm(`Eliminar o horário "${schedule.title}"?`)) return;
    setError(null);
    setNotice(null);
    try {
      await api.deleteSchedule(schedule.id);
      setNotice('O horário foi eliminado com sucesso.');
      if (form.id === schedule.id) cancelEdit();
      reload();
    } catch (err) {
      setError(describeError(err, 'Não foi possível eliminar o horário. Tenta novamente.'));
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Grupo Académico"
        title="Horários"
        description="Consulta de horários lectivos. O coordenador e o administrador podem criar, editar e eliminar sessões."
      />

      <div aria-live="polite" className="space-y-2">
        {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
      </div>

      <div className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-5">
        {canManage ? (
          <>
            <select
              className="field-input !mt-0"
              aria-label="Filtrar por curso"
              value={filters.courseId}
              onChange={(e) => setFilters({ ...filters, courseId: e.target.value })}
            >
              <option value="">Todos os cursos</option>
              {options?.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
            <select
              className="field-input !mt-0"
              aria-label="Filtrar por docente"
              value={filters.teacherId}
              onChange={(e) => setFilters({ ...filters, teacherId: e.target.value })}
            >
              <option value="">Todos os docentes</option>
              {options?.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
            <select
              className="field-input !mt-0"
              aria-label="Filtrar por sala"
              value={filters.roomId}
              onChange={(e) => setFilters({ ...filters, roomId: e.target.value })}
            >
              <option value="">Todas as salas</option>
              {options?.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <label className="text-xs font-medium text-campus-deep/70">
          A partir de (data e hora)
          <input
            type="datetime-local"
            className="field-input"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
        </label>
        <label className="text-xs font-medium text-campus-deep/70">
          Até (data e hora)
          <input
            type="datetime-local"
            className="field-input"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn-secondary" onClick={printSchedule} disabled={schedules.length === 0}>
          Imprimir horário
        </button>
      </div>

      {canManage ? (
        <form onSubmit={onSubmit} className="surface grid gap-3 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-campus-ink">
              {form.id ? 'Editar sessão' : 'Nova sessão de horário'}
            </h2>
            {form.id ? (
              <button type="button" className="btn-secondary" onClick={cancelEdit}>
                Cancelar edição
              </button>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-campus-deep/70">
              Título
              <input
                className="field-input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Aula PTP3 — Projecto"
                required
              />
            </label>
            <label className="text-xs font-medium text-campus-deep/70">
              Curso
              <select
                className="field-input"
                value={form.courseId}
                onChange={(e) => setForm({ ...form, courseId: e.target.value, subjectId: '' })}
                required
              >
                <option value="">Selecionar curso</option>
                {options?.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-campus-deep/70">
              Disciplina
              <select
                className="field-input"
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                required
                disabled={!form.courseId}
              >
                <option value="">Selecionar disciplina</option>
                {subjectChoices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-campus-deep/70">
              Docente
              <select
                className="field-input"
                value={form.teacherId}
                onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              >
                <option value="">Sem docente atribuído</option>
                {options?.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-campus-deep/70">
              Sala
              <select
                className="field-input"
                value={form.roomId}
                onChange={(e) => setForm({ ...form, roomId: e.target.value })}
              >
                <option value="">Sem sala atribuída</option>
                {options?.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-campus-deep/70">
              Início
              <input
                type="datetime-local"
                className="field-input"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                required
              />
            </label>
            <label className="text-xs font-medium text-campus-deep/70">
              Fim
              <input
                type="datetime-local"
                className="field-input"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                required
              />
            </label>
          </div>

          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}

          <div className="flex justify-end">
            <button type="submit" className="btn-primary w-full sm:w-auto">
              {form.id ? 'Guardar alterações' : 'Criar horário'}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <div className="surface p-6 text-sm text-campus-deep/70">A carregar horários...</div>
      ) : error ? null : groups.length === 0 ? (
        <div className="surface p-6 text-sm text-campus-deep/70">Não há horários para mostrar.</div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.label} className="surface table-scroll">
              <h2 className="border-b border-campus-line/70 px-4 py-3 font-display text-base font-semibold capitalize text-campus-ink">
                {group.label}
              </h2>
              <table className="min-w-[720px] text-left text-sm">
                <thead className="bg-campus-mist/80 text-campus-deep">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Hora</th>
                    <th className="px-4 py-3 font-semibold">Sessão</th>
                    <th className="px-4 py-3 font-semibold">Disciplina</th>
                    <th className="px-4 py-3 font-semibold">Docente</th>
                    <th className="px-4 py-3 font-semibold">Sala</th>
                    {canManage ? <th className="px-4 py-3 font-semibold">Ações</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((schedule) => (
                    <tr key={schedule.id} className="border-t border-campus-line/70">
                      <td className="px-4 py-3 whitespace-nowrap font-medium">
                        {timeFormatter.format(new Date(schedule.startsAt))} –{' '}
                        {timeFormatter.format(new Date(schedule.endsAt))}
                      </td>
                      <td className="px-4 py-3">{schedule.title}</td>
                      <td className="px-4 py-3">{schedule.subject?.name ?? schedule.subject?.code ?? '—'}</td>
                      <td className="px-4 py-3">{schedule.teacher?.fullName ?? '—'}</td>
                      <td className="px-4 py-3">{schedule.room ? `${schedule.room.code} — ${schedule.room.name}` : '—'}</td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" className="btn-secondary !px-3 !py-1.5" onClick={() => startEdit(schedule)}>
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn-secondary !px-3 !py-1.5 !text-red-700"
                              onClick={() => void onDelete(schedule)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
