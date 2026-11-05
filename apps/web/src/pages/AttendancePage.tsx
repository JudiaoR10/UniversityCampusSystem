import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AttendanceRoster,
  AttendanceStatus,
  AttendanceSummaryDto,
  RoleCode,
  ScheduleDto,
} from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { printDocument } from '../lib/print';
import { PageIntro } from '../components/PageIntro';
import { SelectField } from '../components/SelectField';

const STAFF_ROLES: RoleCode[] = ['TEACHER', 'COORDINATOR', 'ADMIN'];

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Presente',
  ABSENT: 'Falta',
  LATE: 'Atraso',
  JUSTIFIED: 'Justificada',
};

const STATUS_BADGES: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  ABSENT: 'bg-red-50 text-red-700',
  LATE: 'bg-amber-50 text-amber-700',
  JUSTIFIED: 'bg-sky-50 text-sky-700',
};

const MARK_CYCLE: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'JUSTIFIED'];
const MARK_LETTERS: Record<AttendanceStatus, string> = { PRESENT: 'P', ABSENT: 'F', JUSTIFIED: 'J', LATE: 'A' };
const MARK_STYLES: Record<AttendanceStatus, string> = {
  PRESENT: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-100',
  ABSENT: 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400 hover:bg-rose-100',
  JUSTIFIED: 'border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-400 hover:bg-sky-100',
  LATE: 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100',
};

function nextMark(status: AttendanceStatus | null): AttendanceStatus {
  return MARK_CYCLE[(MARK_CYCLE.indexOf(status ?? 'LATE') + 1) % MARK_CYCLE.length];
}

const dateFormatter = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' });

type RowInput = { status: AttendanceStatus | null; note: string };

function describeError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message && !/fetch|network/i.test(err.message)) {
    return err.message;
  }
  return fallback;
}

function SummaryTable({ summary }: { summary: AttendanceSummaryDto[] }) {
  if (summary.length === 0) {
    return <p className="px-4 py-6 text-sm text-campus-deep/70">Ainda não há registos de assiduidade.</p>;
  }
  return (
    <div className="table-scroll">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-campus-mist/80 text-campus-deep">
          <tr>
            <th className="px-4 py-3 font-semibold">Nº</th>
            <th className="px-4 py-3 font-semibold">Estudante</th>
            <th className="px-4 py-3 font-semibold">Presenças</th>
            <th className="px-4 py-3 font-semibold">Faltas</th>
            <th className="px-4 py-3 font-semibold">Atrasos</th>
            <th className="px-4 py-3 font-semibold">Justificadas</th>
            <th className="px-4 py-3 font-semibold">Total</th>
            <th className="px-4 py-3 font-semibold">Assiduidade</th>
          </tr>
        </thead>
        <tbody>
          {summary.map((row) => (
            <tr key={row.studentProfileId} className="border-t border-campus-line/70">
              <td className="px-4 py-3 whitespace-nowrap font-medium">{row.studentNumber}</td>
              <td className="px-4 py-3">{row.fullName ?? '—'}</td>
              <td className="px-4 py-3">{row.present}</td>
              <td className="px-4 py-3">{row.absent}</td>
              <td className="px-4 py-3">{row.late}</td>
              <td className="px-4 py-3">{row.justified}</td>
              <td className="px-4 py-3">{row.total}</td>
              <td className="px-4 py-3">
                <span className="font-semibold">{row.attendanceRate}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sessionDay(startsAt: string) {
  const date = new Date(startsAt);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function StaffAttendance() {
  const { api } = useAuth();
  const [sessions, setSessions] = useState<ScheduleDto[]>([]);
  const [summary, setSummary] = useState<AttendanceSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [roster, setRoster] = useState<AttendanceRoster | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, RowInput>>>({});
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const rosterRequestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.attendanceSessions(), api.attendanceSummary()])
      .then(([sessionsRes, summaryRes]) => {
        if (cancelled) return;
        setSessions(sessionsRes.data);
        setSummary(summaryRes.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err, 'Não foi possível carregar as sessões de assiduidade.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, reloadKey]);

  const sessionLabel = (schedule: ScheduleDto) =>
    `${schedule.title} — ${dateFormatter.format(new Date(schedule.startsAt))} · ${timeFormatter.format(new Date(schedule.startsAt))}`;

  async function loadRoster(scheduleId: string) {
    const requestId = ++rosterRequestId.current;
    setRosterError(null);
    setRosterLoading(true);
    setRoster(null);
    try {
      const res = await api.attendanceRoster(scheduleId);
      if (requestId !== rosterRequestId.current) return;
      setRoster(res.data);
    } catch (err) {
      if (requestId === rosterRequestId.current) {
        setRosterError(describeError(err, 'Não foi possível abrir a pauta de assiduidade.'));
      }
    } finally {
      if (requestId === rosterRequestId.current) setRosterLoading(false);
    }
  }

  function onSelect(scheduleId: string) {
    setNotice(null);
    setSelectedId(scheduleId);
    if (scheduleId) {
      void loadRoster(scheduleId);
    } else {
      rosterRequestId.current += 1;
      setRosterLoading(false);
      setRoster(null);
    }
  }

  const semesterSessions = roster?.semester?.sessions.length ? roster.semester.sessions : roster ? [roster.schedule] : [];

  const savedInputs = useMemo(() => {
    const result = new Map<string, Map<string, RowInput>>();
    for (const record of roster?.semester?.records ?? []) {
      const day = result.get(record.scheduleId) ?? new Map<string, RowInput>();
      day.set(record.studentId, { status: record.status, note: record.note ?? '' });
      result.set(record.scheduleId, day);
    }
    if (roster) result.set(roster.schedule.id, new Map(roster.entries.map((entry) => [entry.id, {
      status: entry.marked === false ? null : entry.status ?? null, note: entry.note ?? '',
    }])));
    return result;
  }, [roster]);

  function dayInput(scheduleId: string, studentId: string): RowInput {
    return drafts[scheduleId]?.[studentId] ?? savedInputs.get(scheduleId)?.get(studentId) ?? { status: null, note: '' };
  }

  function updateDay(scheduleId: string, studentId: string, update: Partial<RowInput>) {
    const current = dayInput(scheduleId, studentId);
    setNotice(null);
    setDrafts((prev) => ({ ...prev, [scheduleId]: { ...prev[scheduleId], [studentId]: { ...current, ...prev[scheduleId]?.[studentId], ...update } } }));
  }

  const inputs = Object.fromEntries((roster?.entries ?? []).map((entry) => [entry.id, dayInput(selectedId, entry.id)]));
  const counts: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0 };
  for (const row of Object.values(inputs)) if (row.status) counts[row.status] += 1;
  const pendingCount = Object.values(drafts).reduce((total, day) => total + Object.keys(day).length, 0);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!roster || pendingCount === 0) return;
    setRosterError(null);
    setNotice(null);
    if (Object.values(drafts).some((day) => Object.values(day).some((row) => !row.status))) {
      setRosterError('Escolha P, F ou J para as observações alteradas antes de guardar.');
      return;
    }
    setSaving(true);
    let savedDays = 0;
    try {
      for (const [scheduleId, entries] of Object.entries(drafts)) {
        const records = Object.entries(entries).flatMap(([studentId, row]) => row.status ? [{ studentId, status: row.status, note: row.note.trim() || null }] : []);
        if (records.length === 0) continue;
        await api.markAttendance(scheduleId, { records });
        savedDays += 1;
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[scheduleId];
          return next;
        });
      }
      setNotice('Assiduidade registada com sucesso. Cada dia foi guardado separadamente.');
      await loadRoster(roster.schedule.id);
      setReloadKey((key) => key + 1);
    } catch (err) {
      if (savedDays > 0) {
        await loadRoster(roster.schedule.id);
        setReloadKey((key) => key + 1);
      }
      setRosterError(describeError(err, 'Não foi possível guardar todas as alterações. Os dias pendentes continuam disponíveis para tentar novamente.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Grupo Académico"
        title="Assiduidade"
        description="Escolha o dia da aula, marque a turma inteira e consulte as presenças do semestre. Guarde todos os estudantes de uma só vez."
      />

      <div aria-live="polite" className="space-y-2">
        {error ? <p className="alert-error">{error}</p> : null}
        {notice ? <p className="alert-success">{notice}</p> : null}
      </div>

      <section className="surface grid gap-3 p-4 sm:p-6">
        <label className="text-xs font-medium text-campus-deep/70">
          Dia da aula
          <input type="date" className="field-input" value={selectedDay} disabled={saving || loading}
            onChange={(event) => {
              const day = event.target.value;
              setSelectedDay(day);
              const matches = sessions.filter((session) => sessionDay(session.startsAt) === day);
              onSelect(matches[0]?.id ?? '');
            }} />
        </label>
        {selectedDay && !sessions.some((session) => sessionDay(session.startsAt) === selectedDay) ? (
          <p className="text-sm text-campus-deep/70">Não há aulas agendadas neste dia.</p>
        ) : null}
        {!loading && sessions.length === 0 ? <p className="text-sm text-campus-deep/70">Ainda não há aulas agendadas.</p> : null}
        <label className="text-xs font-medium text-campus-deep/70">
          Sessão
          <SelectField
            value={selectedId}
            disabled={saving || loading}
            onChange={onSelect}
            placeholder="Seleccionar sessão de horário"
            options={sessions.filter((session) => !selectedDay || sessionDay(session.startsAt) === selectedDay).map((schedule) => ({ value: schedule.id, label: sessionLabel(schedule) }))}
          />
        </label>

        {selectedId ? (
          rosterLoading ? (
            <p className="text-sm text-campus-deep/70">A carregar pauta...</p>
          ) : roster ? (
            <form onSubmit={onSave} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold text-campus-ink">
                    {roster.schedule.subject?.name ?? roster.schedule.title}
                  </h2>
                  <p className="text-xs text-campus-deep/70">
                    {roster.schedule.course?.code} · {dateFormatter.format(new Date(roster.schedule.startsAt))} ·{' '}
                    {timeFormatter.format(new Date(roster.schedule.startsAt))}–
                    {timeFormatter.format(new Date(roster.schedule.endsAt))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs text-campus-deep/70">
                    {counts.PRESENT} presentes · {counts.ABSENT} faltas · {counts.LATE} atrasos · {counts.JUSTIFIED} justificadas
                  </p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      if (!roster) return;
                      const rows = roster.entries.map((entry) => {
                        const inp = inputs[entry.id];
                        const status = inp?.status;
                        return [
                          entry.studentNumber,
                          entry.fullName ?? '—',
                          status ? STATUS_LABELS[status] : 'Por registar',
                          inp?.note ?? entry.note ?? '',
                        ];
                      });
                      const semesterSections = [];
                      for (let offset = 0; offset < semesterSessions.length; offset += 10) {
                        const days = semesterSessions.slice(offset, offset + 10);
                        semesterSections.push({
                          heading: `Presenças do semestre · aulas ${offset + 1}–${offset + days.length}`,
                          columns: ['Estudante / Nº', ...days.map((day) => `${new Date(day.startsAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}\n${timeFormatter.format(new Date(day.startsAt))}`)],
                          rows: roster.entries.map((entry) => [
                            `${entry.fullName ?? '—'}\n${entry.studentNumber}`,
                            ...days.map((day) => {
                              const status = dayInput(day.id, entry.id).status;
                              return status ? MARK_LETTERS[status] : '—';
                            }),
                          ]),
                          emptyMessage: 'Sem estudantes para apresentar.',
                        });
                      }
                      printDocument({
                        title: roster.semester ? 'Pauta de assiduidade do semestre' : 'Pauta de assiduidade',
                        orientation: roster.semester ? 'landscape' : 'portrait',
                        summary: [{ label: 'Estudantes', value: String(roster.entries.length) }, { label: 'Aulas no semestre', value: String(semesterSessions.length) }],
                        subtitle: `${roster.schedule.subject?.name ?? roster.schedule.title}`,
                        eyebrow: 'UNIVERSIDADE JOSÉ ANTÓNIO ECHEVERRÍA - UJAE',
                        meta: [
                          `Disciplina: ${roster.schedule.subject?.name ?? '—'}`,
                          `Turma/Curso: ${roster.schedule.course?.name ?? roster.schedule.course?.code ?? '—'}`,
                          `Data: ${dateFormatter.format(new Date(roster.schedule.startsAt))}`,
                          `Hora: ${timeFormatter.format(new Date(roster.schedule.startsAt))} – ${timeFormatter.format(new Date(roster.schedule.endsAt))}`,
                          ...(roster.semester ? [`Semestre: ${roster.semester.number}º / ${roster.semester.year}`] : []),
                        ],
                        sections: [...(roster.semester ? semesterSections : []), { heading: 'Pauta do dia seleccionado', columns: ['Nº', 'Nome do Estudante', 'Estado', 'Observação'], rows }],
                        footer: 'P: presença · F: falta · J: justificada · A: atraso · —: por registar. Inclui as alterações apresentadas no ecrã; guarde a pauta para confirmar o registo.',
                        emptyMessage: 'Sem estudantes para apresentar.',
                        signatures: ['Docente responsável', 'Coordenação / Secretariado'],
                      });
                    }}
                  >
                    Imprimir pauta de assiduidade
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-campus-line/80">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-campus-line/70 bg-campus-mist/40 px-4 py-4 sm:px-5">
                  <div>
                    <h3 className="font-display text-base font-semibold text-campus-ink">{roster.semester ? `Presenças do ${roster.semester.number}º semestre de ${roster.semester.year}` : 'Pauta da turma'} <span className="ml-2 rounded-full bg-white px-2.5 py-1 text-xs text-campus-deep/70">{roster.entries.length} estudantes</span></h3>
                    <p id="attendance-mark-help" className="mt-2 text-xs leading-relaxed text-campus-deep/70">Cada botão corresponde a um estudante e a uma aula. Clique para alternar: P · Presença → F · Falta → J · Justificada. — indica uma aula por registar.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['PRESENT', 'ABSENT'] as AttendanceStatus[]).map((status) => (
                      <button key={status} type="button" className="btn-secondary !text-xs" disabled={saving || roster.entries.length === 0}
                        onClick={() => { for (const entry of roster.entries) updateDay(selectedId, entry.id, { status }); }}>
                        {status === 'PRESENT' ? 'Marcar todos presentes' : 'Marcar todos com falta'}
                      </button>
                    ))}
                  </div>
                </div>

                {roster.entries.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-campus-deep/70">Não há estudantes inscritos no curso desta sessão.</p>
                ) : (
                  <div className="table-scroll max-h-[640px]" role="region" aria-label="Pauta de presenças do semestre" tabIndex={0}>
                    <table className="w-full border-separate border-spacing-0 text-left text-sm">
                      <thead className="sticky top-0 z-20">
                        <tr>
                          <th className="sticky left-0 z-30 min-w-[220px] border-b border-campus-line bg-white px-4 py-4 text-xs font-semibold text-campus-deep sm:px-5">Estudante</th>
                          {semesterSessions.map((session) => (
                            <th key={session.id} className={`min-w-[88px] border-b border-campus-line px-2 py-3 text-center ${session.id === selectedId ? 'bg-sky-50' : 'bg-campus-mist'}`}>
                              <button type="button" disabled={saving} aria-pressed={session.id === selectedId}
                                aria-label={`Seleccionar aula de ${dateFormatter.format(new Date(session.startsAt))} às ${timeFormatter.format(new Date(session.startsAt))}`}
                                className={`rounded-xl px-2 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-campus-deep ${session.id === selectedId ? 'bg-sky-100 text-sky-800' : 'text-campus-deep/70 hover:bg-white'}`}
                                onClick={() => { if (session.id !== selectedId) { setSelectedDay(sessionDay(session.startsAt)); onSelect(session.id); } }}>
                                <span className="block text-sm font-bold tabular-nums">{new Date(session.startsAt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}</span>
                                <span className="mt-1 block text-[10px] font-medium">{timeFormatter.format(new Date(session.startsAt))}</span>
                                {session.id === selectedId ? <span className="mt-1 block text-[9px] font-semibold uppercase tracking-wide">Em edição</span> : null}
                              </button>
                            </th>
                          ))}
                          <th className="sticky right-0 z-30 min-w-[80px] border-b border-l border-campus-line bg-rose-50 px-3 py-4 text-center text-xs font-semibold text-rose-700">Faltas<span className="mt-1 block text-[10px] font-normal">no semestre</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.entries.map((entry) => {
                          const absences = semesterSessions.filter((session) => (
                            dayInput(session.id, entry.id).status
                          ) === 'ABSENT').length;
                          return (
                            <tr key={entry.id} className="group">
                              <td className="sticky left-0 z-10 border-b border-campus-line/60 bg-white px-4 py-4 group-hover:bg-slate-50 sm:px-5">
                                <div className="flex items-center gap-3">
                                  <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-campus-mist font-display text-xs font-semibold text-campus-deep/70">
                                    {(entry.fullName ?? entry.studentNumber).split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('')}
                                  </span>
                                  <div>
                                    <p className="font-semibold text-campus-ink">{entry.fullName ?? 'Estudante'}</p>
                                    <p className="mt-1 text-xs tabular-nums text-campus-deep/60">{entry.studentNumber}</p>
                                  </div>
                                </div>
                                <details className="mt-2 text-xs text-campus-deep/60">
                                  <summary className="cursor-pointer py-1">Observação do dia{inputs[entry.id]?.note ? ' · 1 nota' : ''}</summary>
                                  <input className="field-input !rounded-xl !text-xs" placeholder="Adicionar nota…" disabled={saving}
                                    aria-label={`Observação de ${entry.studentNumber}`} value={inputs[entry.id]?.note ?? ''}
                                    onChange={(e) => updateDay(selectedId, entry.id, { note: e.target.value })} />
                                </details>
                              </td>
                              {semesterSessions.map((session) => {
                                const editing = session.id === selectedId;
                                const status = dayInput(session.id, entry.id).status;
                                return (
                                  <td key={session.id} className={`border-b border-campus-line/60 px-2 py-3 text-center ${editing ? 'bg-sky-50/60' : 'group-hover:bg-campus-mist/20'}`}>
                                    <button type="button" disabled={saving}
                                      aria-label={`${status ? STATUS_LABELS[status] : 'Por registar'} — ${entry.studentNumber}. Alterar para ${STATUS_LABELS[nextMark(status)]} · ${dateFormatter.format(new Date(session.startsAt))} · ${timeFormatter.format(new Date(session.startsAt))}`}
                                      aria-describedby="attendance-mark-help"
                                      title={`Clique para marcar: ${STATUS_LABELS[nextMark(status)]}`}
                                      className={`inline-flex h-14 w-14 flex-col items-center justify-center rounded-2xl border shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-campus-deep focus-visible:ring-offset-2 active:scale-95 disabled:opacity-50 ${status ? MARK_STYLES[status] : 'border-dashed border-campus-line bg-white text-campus-deep/40 hover:bg-campus-mist'}`}
                                      onClick={() => updateDay(session.id, entry.id, { status: nextMark(dayInput(session.id, entry.id).status) })}>
                                      <span className="font-display text-xl font-bold leading-none">{status ? MARK_LETTERS[status] : '—'}</span>
                                      {status ? <span className="mt-1 text-[8px] font-semibold">{STATUS_LABELS[status]}</span> : null}
                                    </button>
                                  </td>
                                );
                              })}
                              <td className="sticky right-0 z-10 border-b border-l border-campus-line/60 bg-rose-50/95 px-3 py-4 text-center">
                                <span aria-label={`Faltas de ${entry.studentNumber}: ${absences}`} className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl bg-white px-2 font-display text-lg font-bold tabular-nums text-rose-700 shadow-sm">{absences}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-campus-mist/30 px-4 py-3 text-[11px] text-campus-deep/60">
                  <p>{semesterSessions.length} aulas agendadas · {roster.semester?.number === 1 ? 'Janeiro–Junho' : roster.semester ? 'Julho–Dezembro' : 'Aula seleccionada'}</p>
                  <p>{pendingCount} alterações por guardar. Cada dia tem o seu próprio registo.</p>
                </div>
              </div>

              {rosterError ? <p className="text-sm text-red-700">{rosterError}</p> : null}

              <div className="flex justify-end">
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving || roster.entries.length === 0 || pendingCount === 0}>
                  {saving ? 'A guardar...' : 'Guardar assiduidade'}
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-red-700">{rosterError ?? 'Não foi possível abrir a pauta.'}</p>
          )
        ) : null}
      </section>

      <section className="surface table-scroll">
        <h2 className="border-b border-campus-line/70 px-4 py-3 font-display text-base font-semibold text-campus-ink">
          Resumo de assiduidade
        </h2>
        {loading ? <p className="px-4 py-6 text-sm text-campus-deep/70">A carregar resumo...</p> : <SummaryTable summary={summary} />}
      </section>
    </div>
  );
}

function StudentAttendance() {
  const { api } = useAuth();
  const [page, setPage] = useState(0);
  const [records, setRecords] = useState<Array<{ id: string; status: AttendanceStatus; note: string | null; recordedAt: string; classSchedule?: { title: string; startsAt: string } }>>([]);
  const [summary, setSummary] = useState<AttendanceSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.attendance({ offset: String(page * 50), limit: '51' }), api.attendanceSummary()])
      .then(([recordsRes, summaryRes]) => {
        if (cancelled) return;
        setRecords(recordsRes.data);
        setSummary(summaryRes.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err, 'Não foi possível carregar a tua assiduidade.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, page]);

  const own = summary[0];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Grupo Académico"
        title="Assiduidade"
        description="O teu registo de presenças, faltas, atrasos e justificações por sessão de horário."
      />

      {error ? <p className="alert-error">{error}</p> : null}

      {loading ? (
        <div className="surface p-6 text-sm text-campus-deep/70">A carregar assiduidade...</div>
      ) : error ? null : (
        <>
          {own ? (
            <section className="surface grid gap-3 p-4 sm:grid-cols-5 sm:p-6">
              {(
                [
                  ['Presenças', own.present],
                  ['Faltas', own.absent],
                  ['Atrasos', own.late],
                  ['Justificadas', own.justified],
                  ['Assiduidade', `${own.attendanceRate}%`],
                ] as Array<[string, number | string]>
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl bg-campus-mist/70 px-4 py-3">
                  <p className="eyebrow">{label}</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-campus-ink">{value}</p>
                </div>
              ))}
            </section>
          ) : null}

          <section className="surface table-scroll">
            <h2 className="border-b border-campus-line/70 px-4 py-3 font-display text-base font-semibold text-campus-ink">
              Registos
            </h2>
            {records.length === 0 ? (
              <p className="px-4 py-6 text-sm text-campus-deep/70">Ainda não há registos de assiduidade.</p>
            ) : (
              <table className="min-w-[560px] text-left text-sm">
                <thead className="bg-campus-mist/80 text-campus-deep">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Sessão</th>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Estado</th>
                    <th className="px-4 py-3 font-semibold">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {records.slice(0, 50).map((record) => (
                    <tr key={record.id} className="border-t border-campus-line/70">
                      <td className="px-4 py-3 font-medium">{record.classSchedule?.title ?? '—'}</td>
                      <td className="px-4 py-3">
                        {record.classSchedule ? dateFormatter.format(new Date(record.classSchedule.startsAt)) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-lg px-2 py-1 text-xs font-medium ${STATUS_BADGES[record.status]}`}>
                          {STATUS_LABELS[record.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-campus-deep/70">{record.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-campus-line/70 px-4 py-3">
              <button className="btn-secondary" disabled={loading || page === 0} onClick={() => setPage((value) => value - 1)}>Anterior</button>
              <span className="text-sm" aria-live="polite">Página {page + 1}</span>
              <button className="btn-secondary" disabled={loading || records.length <= 50} onClick={() => setPage((value) => value + 1)}>Seguinte</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function AttendancePage() {
  const { user } = useAuth();
  const isStaff = Boolean(user && STAFF_ROLES.includes(user.role));
  return isStaff ? <StaffAttendance /> : <StudentAttendance />;
}
