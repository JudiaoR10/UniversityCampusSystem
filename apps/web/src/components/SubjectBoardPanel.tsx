import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AcademicState, AssessmentOptions, SubjectBoard, SubjectBoardEntry } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { RECURRENCE_LEGEND, STATE_LABELS, stateBadgeClass } from '../lib/academic';

export type BoardMode = 'frequencia' | 'exame' | 'recorrencia' | 'resultados';

const PAGE_SIZE = 25;

const MODE_TITLES: Record<BoardMode, string> = {
  frequencia: 'Frequência e Dispensa',
  exame: 'Exame Normal',
  recorrencia: 'Recorrência',
  resultados: 'Resultados Finais',
};

const MODE_DESCRIPTIONS: Record<BoardMode, string> = {
  frequencia: 'Média de admissão por estudante, dispensa automática (≥ 14), dispensa ao critério do docente e exclusão por frequência insuficiente (< 10).',
  exame: 'Notas do exame normal. Dispensados e excluídos não têm campo de lançamento.',
  recorrencia: 'Notas do exame de recorrência, apenas para quem está no processo de recorrência.',
  resultados: 'Pauta final por disciplina: admissão, exame, recorrência, nota final e situação.',
};

function describeError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message && !/fetch|network/i.test(err.message)) {
    return err.message;
  }
  return fallback;
}

type Props = {
  mode: BoardMode;
  options: AssessmentOptions | null;
  subjectId: string;
  onSubjectChange: (subjectId: string) => void;
};

export function SubjectBoardPanel({ mode, options, subjectId, onSubjectChange }: Props) {
  const { api } = useAuth();
  const subjects = options?.subjects ?? [];

  const [board, setBoard] = useState<SubjectBoard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [exemptingId, setExemptingId] = useState<string | null>(null);
  /** Nota de dispensa (0–20) por estudante, escolhida pelo docente. */
  const [exemptionInputs, setExemptionInputs] = useState<Record<string, string>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [rulesForm, setRulesForm] = useState({ requiredTestCount: '', recurrenceMinAdmission: '' });
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    setInputs({});
    setSearch('');
    setStateFilter('');
    setPage(1);
    setNotice(null);
    setError(null);
  }, [subjectId, mode]);

  useEffect(() => {
    let cancelled = false;
    if (!subjectId) {
      setBoard(null);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .subjectBoard(subjectId)
      .then((res) => {
        if (!cancelled) setBoard(res.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err, 'Não foi possível carregar o quadro da disciplina.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, subjectId, reloadKey]);

  useEffect(() => {
    if (!board) return;
    setRulesForm({
      requiredTestCount: board.rules.requiredTestCount === null ? '' : String(board.rules.requiredTestCount),
      recurrenceMinAdmission:
        board.rules.recurrenceMinAdmission === null ? '' : String(board.rules.recurrenceMinAdmission),
    });
    const next: Record<string, string> = {};
    const nextExemptions: Record<string, string> = {};
    for (const entry of board.entries) {
      const grade =
        mode === 'exame' ? entry.exam.grade : mode === 'recorrencia' ? entry.recurrence.grade : null;
      next[entry.studentProfileId] = grade === null ? '' : String(grade);
      // Sugestão pré-preenchida: nota de dispensa escolhida ou admissão actual.
      nextExemptions[entry.studentProfileId] =
        entry.exemptionGrade != null
          ? String(entry.exemptionGrade)
          : entry.admissionGrade !== null
            ? String(Math.round(entry.admissionGrade))
            : '';
    }
    setInputs(next);
    setExemptionInputs(nextExemptions);
  }, [board, mode]);

  const filtered = useMemo(() => {
    if (!board) return [] as SubjectBoardEntry[];
    const query = search.trim().toLowerCase();
    return board.entries.filter((entry) => {
      const matchesSearch =
        !query ||
        entry.studentNumber.toLowerCase().includes(query) ||
        (entry.fullName ?? '').toLowerCase().includes(query);
      const matchesState = !stateFilter || entry.state === stateFilter;
      return matchesSearch && matchesState;
    });
  }, [board, search, stateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const statesPresent = useMemo(() => {
    if (!board) return [] as AcademicState[];
    const unique = new Set<AcademicState>();
    for (const entry of board.entries) {
      if (entry.state) unique.add(entry.state);
    }
    return [...unique];
  }, [board]);

  const epoch = mode === 'exame' ? board?.examAssessment ?? null : mode === 'recorrencia' ? board?.recurrenceAssessment ?? null : null;

  async function reload() {
    setReloadKey((key) => key + 1);
  }

  async function saveRules(event: FormEvent) {
    event.preventDefault();
    if (!subjectId) return;
    setSavingRules(true);
    setNotice(null);
    setError(null);
    try {
      const requiredTestCount = rulesForm.requiredTestCount.trim() === '' ? null : Number(rulesForm.requiredTestCount);
      const recurrenceMinAdmission =
        rulesForm.recurrenceMinAdmission.trim() === '' ? null : Number(rulesForm.recurrenceMinAdmission);
      if (requiredTestCount !== null && (!Number.isInteger(requiredTestCount) || requiredTestCount < 1)) {
        throw new Error('O número de testes deve ser um inteiro ≥ 1 (ou vazio).');
      }
      if (recurrenceMinAdmission !== null && (recurrenceMinAdmission < 0 || recurrenceMinAdmission > 20)) {
        throw new Error('O mínimo de admissão para recorrência deve estar entre 0 e 20 (ou vazio).');
      }
      await api.setSubjectRules(subjectId, { requiredTestCount, recurrenceMinAdmission });
      setNotice('Regras da disciplina guardadas.');
      await reload();
    } catch (err) {
      setError(describeError(err, 'Não foi possível guardar as regras da disciplina.'));
    } finally {
      setSavingRules(false);
    }
  }

  async function togglePublication() {
    if (!subjectId || !board) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const res = await api.publishResults(subjectId, !board.rules.published);
      setNotice(
        res.data.published
          ? `Resultados de ${res.data.subjectCode} publicados.`
          : `Pauta de ${res.data.subjectCode} reaberta para correcção.`,
      );
      await reload();
    } catch (err) {
      setError(describeError(err, 'Não foi possível alterar a publicação dos resultados.'));
    } finally {
      setSaving(false);
    }
  }

  async function createEpoch(kind: 'EXAM' | 'RECURRENCE') {
    if (!subjectId) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await api.createAssessment({
        subjectId,
        title: kind === 'EXAM' ? 'Exame Normal' : 'Exame de Recorrência',
        type: kind,
        gradingMode: 'SCALE',
        maxScore: 20,
        weight: kind === 'EXAM' ? 10 : 5,
        date: null,
      });
      setNotice(kind === 'EXAM' ? 'Época de exame normal criada.' : 'Época de recorrência criada.');
      await reload();
    } catch (err) {
      setError(describeError(err, 'Não foi possível criar a época de avaliação.'));
    } finally {
      setSaving(false);
    }
  }

  async function saveEpochGrades(event: FormEvent) {
    event.preventDefault();
    if (!board || !epoch) return;
    const isExamMode = mode === 'exame';
    const editableRows = board.entries.filter((entry) =>
      isExamMode ? entry.exam.editable : entry.recurrence.editable,
    );
    const grades: Array<{ studentId: string; value: number }> = [];
    for (const entry of editableRows) {
      const raw = (inputs[entry.studentProfileId] ?? '').trim();
      if (raw === '') continue;
      const value = Number(raw.replace(',', '.'));
      if (!Number.isFinite(value) || value < 0 || value > 20) {
        setError(`A nota de ${entry.studentNumber} deve estar entre 0 e 20.`);
        return;
      }
      grades.push({ studentId: entry.studentProfileId, value });
    }
    if (grades.length === 0) {
      setError('Introduz pelo menos uma nota antes de guardar.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api.upsertGrades(epoch.id, { grades });
      setNotice(isExamMode ? 'Notas do exame normal guardadas.' : 'Notas de recorrência guardadas.');
      await reload();
    } catch (err) {
      setError(describeError(err, 'Não foi possível guardar as notas.'));
    } finally {
      setSaving(false);
    }
  }

  /** Dispensa ao critério do docente: escolhe a nota, marca/anula e recalcula o quadro. */
  async function toggleExemption(entry: SubjectBoardEntry) {
    if (!subjectId) return;
    let grade: number | null = null;
    if (!entry.exempted) {
      const raw = (exemptionInputs[entry.studentProfileId] ?? '').trim();
      if (raw === '') {
        setError(`Escolhe a nota de dispensa de ${entry.studentNumber} (0–20).`);
        return;
      }
      grade = Number(raw.replace(',', '.'));
      if (!Number.isFinite(grade) || grade < 0 || grade > 20) {
        setError(`A nota de dispensa de ${entry.studentNumber} deve estar entre 0 e 20.`);
        return;
      }
    }
    setExemptingId(entry.studentProfileId);
    setNotice(null);
    setError(null);
    try {
      await api.setSubjectExemption(subjectId, {
        studentId: entry.studentProfileId,
        exempted: !entry.exempted,
        grade: entry.exempted ? undefined : grade,
      });
      setNotice(
        entry.exempted
          ? 'Dispensa anulada.'
          : `Estudante dispensado com nota ${String(grade).replace('.', ',')}.`,
      );
      await reload();
    } catch (err) {
      setError(describeError(err, 'Não foi possível actualizar a dispensa.'));
    } finally {
      setExemptingId(null);
    }
  }

  const counters = board?.counters ?? null;
  const counterChips: Array<{ label: string; value: number }> = counters
    ? {
        frequencia: [
          { label: 'Total', value: counters.total },
          { label: 'Pendentes', value: counters.pendentes },
          { label: 'Dispensados', value: counters.dispensados },
          { label: 'Excluídos', value: counters.excluidos },
        ],
        exame: [
          { label: 'Admitidos ao exame', value: counters.admitidosExame },
          { label: 'Dispensados', value: counters.dispensados },
          { label: 'Excluídos', value: counters.excluidos },
          { label: 'Aprovados no exame', value: counters.aprovadosExame },
          { label: 'Reprovados no exame', value: counters.reprovadosExame },
        ],
        recorrencia: [
          { label: 'Elegíveis', value: counters.elegiveisRecorrencia },
          { label: 'Admitidos', value: counters.admitidosRecorrencia },
          { label: 'Aprovados', value: counters.aprovadosRecorrencia },
          { label: 'Reprovados', value: counters.reprovadosRecorrencia },
          { label: 'Não elegíveis', value: counters.naoElegiveis },
          { label: 'Em revisão', value: counters.emRevisao },
        ],
        resultados: [
          { label: 'Total', value: counters.total },
          { label: 'Pendentes', value: counters.pendentes },
          { label: 'Dispensados', value: counters.dispensados },
          { label: 'Aprovados no exame', value: counters.aprovadosExame },
          { label: 'Aprovados na recorrência', value: counters.aprovadosRecorrencia },
        ],
      }[mode]
    : [];

  const continuousColumns = board?.entries[0]?.continuous ?? [];

  return (
    <section className="surface space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-campus-ink">{MODE_TITLES[mode]}</h2>
          <p className="text-xs text-campus-deep/70">{MODE_DESCRIPTIONS[mode]}</p>
        </div>
        <label className="text-xs font-medium text-campus-deep/70">
          Disciplina do quadro
          <select
            className="field-input"
            value={subjectId}
            onChange={(e) => onSubjectChange(e.target.value)}
          >
            <option value="">Selecionar disciplina</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div aria-live="polite" className="space-y-2">
        {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
      </div>

      {!subjectId ? (
        <p className="text-sm text-campus-deep/70">Seleciona uma disciplina para ver o quadro académico.</p>
      ) : loading ? (
        <p className="text-sm text-campus-deep/70">A carregar quadro da disciplina...</p>
      ) : !board ? null : (
        <>
          <div className="flex flex-wrap gap-2">
            {counterChips.map((chip) => (
              <span
                key={chip.label}
                className="rounded-full bg-campus-mist px-3 py-1 text-xs font-semibold text-campus-deep"
              >
                {chip.label}: {chip.value}
              </span>
            ))}
          </div>

          <div className="grid gap-3 rounded-xl border border-campus-line/70 p-3 lg:grid-cols-3">
            <form onSubmit={saveRules} className="space-y-2 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-campus-deep/70">
                Regras da disciplina
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-campus-deep/70">
                  Testes exigidos
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="field-input !mt-0 w-24"
                    value={rulesForm.requiredTestCount}
                    onChange={(e) => setRulesForm({ ...rulesForm, requiredTestCount: e.target.value })}
                    placeholder="—"
                  />
                </label>
                <label className="text-xs text-campus-deep/70">
                  Mínimo para recorrência (0–20)
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step="0.5"
                    className="field-input !mt-0 w-28"
                    value={rulesForm.recurrenceMinAdmission}
                    onChange={(e) => setRulesForm({ ...rulesForm, recurrenceMinAdmission: e.target.value })}
                    placeholder="—"
                  />
                </label>
                <button type="submit" className="btn-secondary !px-3 !py-1.5 text-xs" disabled={savingRules}>
                  {savingRules ? 'A guardar...' : 'Guardar regras'}
                </button>
              </div>
              <p className="text-xs text-campus-deep/60">
                {!board.rules.rulesConfigured
                  ? 'Critérios de recorrência ainda não configurados — a publicação fica bloqueada até definires o mínimo.'
                  : 'Critérios de recorrência configurados.'}
              </p>
            </form>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-campus-deep/70">Publicação</p>
              <p className="text-xs text-campus-deep/70">
                {board.rules.published
                  ? `Pauta publicada${board.rules.publishedAt ? ` em ${new Date(board.rules.publishedAt).toLocaleDateString('pt-PT')}` : ''} — notas bloqueadas até reabrir.`
                  : 'Pauta em aberto — notas editáveis.'}
              </p>
              <button
                type="button"
                className="btn-secondary !px-3 !py-1.5 text-xs"
                onClick={() => void togglePublication()}
                disabled={saving}
              >
                {saving ? 'A processar...' : board.rules.published ? 'Reabrir pauta' : 'Publicar resultados'}
              </button>
            </div>
          </div>

          {mode === 'exame' && !board.examAssessment ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Ainda não existe época de exame normal nesta disciplina.{' '}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => void createEpoch('EXAM')}
                disabled={saving}
              >
                Criar época de exame normal
              </button>
            </p>
          ) : null}

          {mode === 'recorrencia' && !board.recurrenceAssessment ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Ainda não existe época de recorrência nesta disciplina.{' '}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => void createEpoch('RECURRENCE')}
                disabled={saving}
              >
                Criar época de recorrência
              </button>
            </p>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-campus-deep/70">
              Pesquisar estudante
              <input
                className="field-input !mt-0 w-56"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Nº ou nome"
              />
            </label>
            <label className="text-xs font-medium text-campus-deep/70">
              Estado
              <select
                className="field-input !mt-0 w-56"
                value={stateFilter}
                onChange={(e) => {
                  setStateFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos os estados</option>
                {statesPresent.map((state) => (
                  <option key={state} value={state}>
                    {STATE_LABELS[state]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-campus-deep/70">
              {filtered.length} de {board.counters.total} estudantes
            </p>
          </div>

          {mode === 'exame' || mode === 'recorrencia' ? (
            <form onSubmit={saveEpochGrades} className="space-y-3">
              <div className="table-scroll">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-campus-mist/80 text-campus-deep">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Nº</th>
                      <th className="px-3 py-2 font-semibold">Estudante</th>
                      <th className="px-3 py-2 font-semibold">Admissão</th>
                      <th className="px-3 py-2 font-semibold">
                        {mode === 'exame' ? 'Nota de exame' : 'Nota de recorrência'}
                      </th>
                      <th className="px-3 py-2 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((entry) => {
                      const slot = mode === 'exame' ? entry.exam : entry.recurrence;
                      return (
                        <tr key={entry.studentProfileId} className="border-t border-campus-line/70">
                          <td className="px-3 py-2 whitespace-nowrap font-medium">{entry.studentNumber}</td>
                          <td className="px-3 py-2">{entry.fullName ?? '—'}</td>
                          <td className="px-3 py-2">{entry.admissionGrade === null ? '—' : `Admissão ${entry.admissionGrade}`}</td>
                          <td className="px-3 py-2">
                            {slot.editable ? (
                              <input
                                className="field-input !mt-0 w-24"
                                inputMode="decimal"
                                aria-label={`Nota de ${mode === 'exame' ? 'exame' : 'recorrência'} de ${entry.studentNumber}`}
                                value={inputs[entry.studentProfileId] ?? ''}
                                onChange={(e) =>
                                  setInputs((prev) => ({ ...prev, [entry.studentProfileId]: e.target.value }))
                                }
                              />
                            ) : (
                              <span className="text-xs text-campus-deep/60">{slot.blockedReason ?? '—'}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${stateBadgeClass(entry.state)}`}
                            >
                              {entry.state ? STATE_LABELS[entry.state] : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {pageRows.length === 0 ? (
                <p className="text-sm text-campus-deep/70">Nenhum estudante corresponde aos filtros.</p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-campus-deep/70">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Seguinte
                  </button>
                </div>
                <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs" disabled={saving}>
                  {saving
                    ? 'A guardar...'
                    : mode === 'exame'
                      ? 'Guardar notas de exame'
                      : 'Guardar notas de recorrência'}
                </button>
              </div>
              {mode === 'recorrencia' ? (
                <p className="text-xs text-campus-deep/70">{RECURRENCE_LEGEND}</p>
              ) : null}
            </form>
          ) : (
            <div className="table-scroll">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-campus-mist/80 text-campus-deep">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Nº</th>
                    <th className="px-3 py-2 font-semibold">Estudante</th>
                    {mode === 'frequencia'
                      ? continuousColumns.map((c) => (
                          <th key={c.assessmentId} className="px-3 py-2 font-semibold">
                            {c.title} ({c.weight})
                          </th>
                        ))
                      : null}
                    <th className="px-3 py-2 font-semibold">Admissão</th>
                    {mode === 'frequencia' ? (
                      <th className="px-3 py-2 font-semibold">Dispensa</th>
                    ) : null}
                    {mode === 'resultados' ? (
                      <>
                        <th className="px-3 py-2 font-semibold">Exame</th>
                        <th className="px-3 py-2 font-semibold">Recorrência</th>
                        <th className="px-3 py-2 font-semibold">Final</th>
                      </>
                    ) : null}
                    <th className="px-3 py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((entry) => (
                    <tr key={entry.studentProfileId} className="border-t border-campus-line/70">
                      <td className="px-3 py-2 whitespace-nowrap font-medium">{entry.studentNumber}</td>
                      <td className="px-3 py-2">{entry.fullName ?? '—'}</td>
                      {mode === 'frequencia'
                        ? entry.continuous.map((c) => (
                            <td key={c.assessmentId} className="px-3 py-2">
                              {c.value === null ? '—' : c.value}
                            </td>
                          ))
                        : null}
                      <td className="px-3 py-2">
                        {entry.admissionGrade === null ? '—' : `Admissão ${entry.admissionGrade}`}
                      </td>
                       {mode === 'frequencia' ? (
                         <td className="px-3 py-2">
                           {entry.exempted ? (
                             <div className="space-y-1">
                               <span className="text-xs text-campus-deep/60">
                                 {entry.exemptionGrade != null
                                   ? `Dispensado com nota ${entry.exemptionGrade} (pelo docente)`
                                   : 'Dispensado pelo docente (nota de admissão)'}
                               </span>
                               <div className="flex items-center gap-2">
                                 <button
                                   type="button"
                                   className="btn-secondary !px-3 !py-1.5 text-xs"
                                   onClick={() => void toggleExemption(entry)}
                                   disabled={exemptingId !== null}
                                 >
                                   {exemptingId === entry.studentProfileId ? 'A processar...' : 'Anular dispensa'}
                                 </button>
                               </div>
                             </div>
                           ) : (
                             <div className="flex items-center gap-2">
                               <input
                                 className="field-input !mt-0 w-20"
                                 inputMode="decimal"
                                 aria-label={`Nota de dispensa de ${entry.studentNumber}`}
                                 placeholder="Nota"
                                 value={exemptionInputs[entry.studentProfileId] ?? ''}
                                 onChange={(e) =>
                                   setExemptionInputs((prev) => ({ ...prev, [entry.studentProfileId]: e.target.value }))
                                 }
                               />
                               <button
                                 type="button"
                                 className="btn-secondary !px-3 !py-1.5 text-xs"
                                 onClick={() => void toggleExemption(entry)}
                                 disabled={exemptingId !== null}
                               >
                                 {exemptingId === entry.studentProfileId ? 'A processar...' : 'Dispensar'}
                               </button>
                             </div>
                           )}
                         </td>
                       ) : null}
                      {mode === 'resultados' ? (
                        <>
                          <td className="px-3 py-2">
                            {entry.exam.grade === null ? '—' : `Exame ${entry.exam.grade}`}
                          </td>
                          <td className="px-3 py-2">
                            {entry.recurrence.asterisk
                              ? '*'
                              : entry.recurrence.grade === null
                                ? '—'
                                : `Recorrência ${entry.recurrence.grade}`}
                          </td>
                          <td className="px-3 py-2 font-semibold">{entry.finalGrade === null ? '—' : entry.finalGrade}</td>
                        </>
                      ) : null}
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${stateBadgeClass(entry.state)}`}
                        >
                          {entry.state ? STATE_LABELS[entry.state] : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pageRows.length === 0 ? (
                <p className="px-3 py-4 text-sm text-campus-deep/70">Nenhum estudante corresponde aos filtros.</p>
              ) : null}
              <div className="flex items-center gap-2 px-3 py-3">
                <button
                  type="button"
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  Anterior
                </button>
                <span className="text-xs text-campus-deep/70">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Seguinte
                </button>
              </div>
              {mode === 'resultados' ? (
                <p className="border-t border-campus-line/70 px-3 py-3 text-xs text-campus-deep/70">
                  {RECURRENCE_LEGEND}
                </p>
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}
