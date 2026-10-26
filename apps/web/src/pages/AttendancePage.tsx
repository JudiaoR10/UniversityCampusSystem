import { FormEvent, useEffect, useMemo, useState } from 'react';
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

const dateFormatter = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' });

type RowInput = { status: AttendanceStatus; note: string };

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

function StaffAttendance() {
  const { api } = useAuth();
  const [sessions, setSessions] = useState<ScheduleDto[]>([]);
  const [summary, setSummary] = useState<AttendanceSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState('');
  const [roster, setRoster] = useState<AttendanceRoster | null>(null);
  const [inputs, setInputs] = useState<Record<string, RowInput>>({});
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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
    setRosterError(null);
    setNotice(null);
    setRosterLoading(true);
    setRoster(null);
    setInputs({});
    try {
      const res = await api.attendanceRoster(scheduleId);
      setRoster(res.data);
      const next: Record<string, RowInput> = {};
      for (const entry of res.data.entries) {
        next[entry.id] = { status: entry.status ?? 'PRESENT', note: entry.note ?? '' };
      }
      setInputs(next);
    } catch (err) {
      setRosterError(describeError(err, 'Não foi possível abrir a pauta de assiduidade.'));
    } finally {
      setRosterLoading(false);
    }
  }

  function onSelect(scheduleId: string) {
    setSelectedId(scheduleId);
    if (scheduleId) {
      void loadRoster(scheduleId);
    } else {
      setRoster(null);
      setInputs({});
    }
  }

  const counts = useMemo(() => {
    const result: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0 };
    for (const row of Object.values(inputs)) result[row.status] += 1;
    return result;
  }, [inputs]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!roster) return;
    setRosterError(null);
    setNotice(null);
    setSaving(true);
    try {
      const records = roster.entries.map((entry) => ({
        studentId: entry.id,
        status: inputs[entry.id]?.status ?? 'PRESENT',
        note: inputs[entry.id]?.note?.trim() || null,
      }));
      await api.markAttendance(roster.schedule.id, { records });
      setNotice('Assiduidade registada com sucesso.');
      await loadRoster(roster.schedule.id);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setRosterError(describeError(err, 'Não foi possível guardar a assiduidade.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Grupo Académico"
        title="Assiduidade"
        description="Registo de presenças, faltas, atrasos e justificações por sessão de horário. Docentes registam nas suas sessões; coordenadores e administradores em todas."
      />

      <div aria-live="polite" className="space-y-2">
        {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
      </div>

      <section className="surface grid gap-3 p-4 sm:p-6">
        <label className="text-xs font-medium text-campus-deep/70">
          Sessão
          <select className="field-input" value={selectedId} onChange={(e) => onSelect(e.target.value)}>
            <option value="">Selecionar sessão de horário</option>
            {sessions.map((schedule) => (
              <option key={schedule.id} value={schedule.id}>
                {sessionLabel(schedule)}
              </option>
            ))}
          </select>
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
                        const status = inp?.status ?? entry.status ?? 'PRESENT';
                        return [
                          entry.studentNumber,
                          entry.fullName ?? '—',
                          STATUS_LABELS[status],
                          inp?.note ?? entry.note ?? '',
                        ];
                      });
                      printDocument({
                        title: 'PAUTA DE ASSIDUIDADE',
                        subtitle: `${roster.schedule.subject?.name ?? roster.schedule.title}`,
                        eyebrow: 'UNIVERSIDADE JOSÉ ANTÓNIO ECHEVERRÍA - UJAE',
                        meta: [
                          `Disciplina: ${roster.schedule.subject?.name ?? '—'}`,
                          `Turma/Curso: ${roster.schedule.course?.name ?? roster.schedule.course?.code ?? '—'}`,
                          `Data: ${dateFormatter.format(new Date(roster.schedule.startsAt))}`,
                          `Hora: ${timeFormatter.format(new Date(roster.schedule.startsAt))} – ${timeFormatter.format(new Date(roster.schedule.endsAt))}`,
                          `Docente: ${(roster.schedule as any).teacher?.user?.fullName ?? '—'}`,
                        ],
                        columns: ['Nº', 'Nome do Estudante', 'Estado', 'Observação'],
                        rows,
                        emptyMessage: 'Sem estudantes para apresentar.',
                        footer: 'O Docente Responsável ___________________________   Data ____/____/______   Assinatura e Carimbo',
                      });
                    }}
                  >
                    Imprimir pauta de assiduidade
                  </button>
                </div>
              </div>

              {roster.entries.length === 0 ? (
                <p className="text-sm text-campus-deep/70">Não há estudantes inscritos no curso desta sessão.</p>
              ) : (
                <div className="table-scroll">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-campus-mist/80 text-campus-deep">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Nº</th>
                        <th className="px-3 py-2 font-semibold">Estudante</th>
                        <th className="px-3 py-2 font-semibold">Estado</th>
                        <th className="px-3 py-2 font-semibold">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster.entries.map((entry) => (
                        <tr key={entry.id} className="border-t border-campus-line/70">
                          <td className="px-3 py-2 whitespace-nowrap font-medium">{entry.studentNumber}</td>
                          <td className="px-3 py-2">{entry.fullName ?? '—'}</td>
                          <td className="px-3 py-2">
                            <select
                              className="field-input !mt-0"
                              aria-label={`Estado de ${entry.studentNumber}`}
                              value={inputs[entry.id]?.status ?? 'PRESENT'}
                              onChange={(e) =>
                                setInputs((prev) => ({
                                  ...prev,
                                  [entry.id]: { status: e.target.value as AttendanceStatus, note: prev[entry.id]?.note ?? '' },
                                }))
                              }
                            >
                              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              className="field-input !mt-0"
                              aria-label={`Observação de ${entry.studentNumber}`}
                              value={inputs[entry.id]?.note ?? ''}
                              onChange={(e) =>
                                setInputs((prev) => ({
                                  ...prev,
                                  [entry.id]: { status: prev[entry.id]?.status ?? 'PRESENT', note: e.target.value },
                                }))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {rosterError ? <p className="text-sm text-red-700">{rosterError}</p> : null}

              <div className="flex justify-end">
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving || roster.entries.length === 0}>
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
  const [records, setRecords] = useState<Array<{ id: string; status: AttendanceStatus; note: string | null; recordedAt: string; classSchedule?: { title: string; startsAt: string } }>>([]);
  const [summary, setSummary] = useState<AttendanceSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.attendance(), api.attendanceSummary()])
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
  }, [api]);

  const own = summary[0];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Grupo Académico"
        title="Assiduidade"
        description="O teu registo de presenças, faltas, atrasos e justificações por sessão de horário."
      />

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

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
                  {records.map((record) => (
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
