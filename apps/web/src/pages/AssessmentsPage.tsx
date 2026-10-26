import { FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  AcademicState,
  AssessmentDto,
  AssessmentOptions,
  AssessmentRoster,
  AssessmentType,
  FinalGradeDto,
  GradeDto,
  GradingMode,
  RoleCode,
  SituacaoAcademica,
} from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { printDocument } from '../lib/print';
import { STATE_LABELS, RECURRENCE_LEGEND, stateBadgeClass } from '../lib/academic';
import { PageIntro } from '../components/PageIntro';
import { SubjectBoardPanel, type BoardMode } from '../components/SubjectBoardPanel';

const STAFF_ROLES: RoleCode[] = ['TEACHER', 'COORDINATOR', 'ADMIN'];

type StaffTab = 'avaliacoes' | BoardMode;

const STAFF_TABS: Array<{ id: StaffTab; label: string }> = [
  { id: 'avaliacoes', label: 'Avaliações' },
  { id: 'frequencia', label: 'Frequência e Dispensa' },
  { id: 'exame', label: 'Exame Normal' },
  { id: 'recorrencia', label: 'Recorrência' },
  { id: 'resultados', label: 'Resultados Finais' },
];

const TYPE_LABELS: Record<AssessmentType, string> = {
  TEST: 'Teste',
  EXAM: 'Exame',
  ASSIGNMENT: 'Trabalho',
  PRACTICAL: 'Prática',
  ORAL: 'Oral',
  OTHER: 'Outro',
  RECURRENCE: 'Recorrência',
};

const GRADING_LABELS: Record<GradingMode, string> = {
  PERCENTAGE: 'Percentagem (0–100%)',
  POINTS: 'Pontos (0–escala)',
  SCALE: 'Escala (0–20 valores)',
};

const SITUACAO_LABELS: Record<SituacaoAcademica, string> = {
  EXCLUIDO: 'Excluído',
  APROVADO: 'Aprovado',
  ADMITIDO_AO_EXAME: 'Admitido ao exame',
  DISPENSADO: 'Dispensado',
};

const SITUACAO_STYLES: Record<SituacaoAcademica, string> = {
  EXCLUIDO: 'bg-red-50 text-red-700',
  APROVADO: 'bg-emerald-50 text-emerald-700',
  ADMITIDO_AO_EXAME: 'bg-amber-50 text-amber-800',
  DISPENSADO: 'bg-sky-50 text-sky-700',
};

function isExamType(type: AssessmentType): boolean {
  return type === 'EXAM' || type === 'RECURRENCE';
}

function SituacaoBadge({ situacao }: { situacao: SituacaoAcademica | null }) {
  if (!situacao) {
    return <span className="text-xs text-campus-deep/60">Em aberto</span>;
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${SITUACAO_STYLES[situacao]}`}>
      {SITUACAO_LABELS[situacao]}
    </span>
  );
}

const dateFormatter = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });

type AssessmentForm = {
  title: string;
  subjectId: string;
  type: AssessmentType;
  gradingMode: GradingMode;
  maxScore: string;
  weight: string;
  date: string;
};

const emptyForm: AssessmentForm = {
  title: '',
  subjectId: '',
  type: 'TEST',
  gradingMode: 'PERCENTAGE',
  maxScore: '20',
  weight: '1',
  date: '',
};

type GradeInput = { value: string; comment: string };

function describeError(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message && !/fetch|network/i.test(err.message)) {
    return err.message;
  }
  return fallback;
}

function gradeRange(gradingMode: GradingMode, maxScore: number): string {
      if (gradingMode === 'PERCENTAGE') return '0 a 20';
      if (gradingMode === 'POINTS') return `0 a ${maxScore}`;
      return '0 a 20';
}

function formatValue(value: number, gradingMode: GradingMode, maxScore: number): string {
  if (gradingMode === 'PERCENTAGE') return `${value}/20`;
  if (gradingMode === 'POINTS') return `${value}/${maxScore}`;
  return `${value}/20`;
}

/** Fórmula visível da nota final (o cálculo é decidido pelo backend). */
function calculoTexto(subject: {
  admissionGrade: number | null;
  examGrade: number | null;
  recurrenceGrade?: number | null;
  usedExam: boolean;
  state?: AcademicState | null;
}): string {
  if (subject.admissionGrade === null) return '—';
  if (subject.recurrenceGrade !== null && subject.recurrenceGrade !== undefined) {
    return `Admissão ${subject.admissionGrade} + Recorrência ${subject.recurrenceGrade} → (A+R)/2`;
  }
  if (subject.state === 'ADMITIDO_RECORRENCIA' && subject.examGrade !== null) {
    return `Admissão ${subject.admissionGrade} + Exame ${subject.examGrade} → (A+E)/2 · Aguarda recorrência`;
  }
  if (subject.usedExam && subject.examGrade !== null) {
    return `Admissão ${subject.admissionGrade} + Exame ${subject.examGrade} → (A+E)/2`;
  }
  if (subject.state === 'ADMITIDO_AO_EXAME') {
    return `Admissão ${subject.admissionGrade} · Aguarda exame normal`;
  }
  return `Admissão ${subject.admissionGrade}`;
}

function StaffAssessments() {
  const { api } = useAuth();
  const [assessments, setAssessments] = useState<AssessmentDto[]>([]);
  const [options, setOptions] = useState<AssessmentOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<AssessmentForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [roster, setRoster] = useState<AssessmentRoster | null>(null);
  const [inputs, setInputs] = useState<Record<string, GradeInput>>({});
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [savingGrades, setSavingGrades] = useState(false);
  const [creating, setCreating] = useState(false);

  const [tab, setTab] = useState<StaffTab>('avaliacoes');
  const [boardSubjectId, setBoardSubjectId] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .assessmentOptions()
      .then((res) => {
        if (!cancelled) setOptions(res.data);
      })
      .catch(() => {
        if (!cancelled) setOptions(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .assessments()
      .then((res) => {
        if (!cancelled) setAssessments(res.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err, 'Não foi possível carregar as avaliações.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, reloadKey]);

  const selected = roster?.assessment ?? null;
  const selectedRange = selected ? gradeRange(selected.gradingMode, selected.maxScore) : '';
  const isEditing = editingId !== null;

  function buildPayload(): { payload?: Record<string, unknown>; error?: string } {
    if (form.title.trim().length < 3) {
      return { error: 'O título deve ter pelo menos 3 caracteres.' };
    }
    if (!isEditing && !form.subjectId) {
      return { error: 'Seleciona a disciplina.' };
    }
    const weight = Number(form.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      return { error: 'O peso deve ser um número positivo.' };
    }
    const maxScore = Number(form.maxScore);
    if (form.gradingMode === 'POINTS' && (!Number.isFinite(maxScore) || maxScore <= 0)) {
      return { error: 'A escala de pontos deve ser um número positivo.' };
    }

    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      type: form.type,
      gradingMode: form.gradingMode,
      maxScore: form.gradingMode === 'POINTS' ? maxScore : form.gradingMode === 'SCALE' ? 20 : 100,
      weight,
      date: form.date ? new Date(form.date).toISOString() : null,
    };
    if (!isEditing) payload.subjectId = form.subjectId;
    return { payload };
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFormError(null);
  }

  function startEdit(assessment: AssessmentDto) {
    setNotice(null);
    setFormError(null);
    setEditingId(assessment.id);
    setForm({
      title: assessment.title,
      subjectId: assessment.subject?.id ?? '',
      type: assessment.type,
      gradingMode: assessment.gradingMode,
      maxScore: String(assessment.maxScore),
      weight: String(assessment.weight),
      date: assessment.date ? assessment.date.slice(0, 10) : '',
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    const { payload, error } = buildPayload();
    if (!payload) {
      setFormError(error ?? 'Confirma os campos assinalados.');
      return;
    }

    setCreating(true);
    try {
      if (editingId) {
        await api.updateAssessment(editingId, payload);
        setNotice('Avaliação atualizada com sucesso.');
      } else {
        await api.createAssessment(payload);
        setNotice('Avaliação criada com sucesso.');
      }
      resetForm();
      setReloadKey((key) => key + 1);
    } catch (err) {
      setFormError(
        describeError(
          err,
          isEditing
            ? 'Não foi possível atualizar a avaliação. Confirma os campos.'
            : 'Não foi possível criar a avaliação. Confirma os campos.',
        ),
      );
    } finally {
      setCreating(false);
    }
  }

  async function openRoster(assessment: AssessmentDto) {
    setRosterError(null);
    setNotice(null);
    setRosterLoading(true);
    setRoster(null);
    setInputs({});
    try {
      const res = await api.assessmentRoster(assessment.id);
      setRoster(res.data);
      const next: Record<string, GradeInput> = {};
      for (const entry of res.data.entries) {
        next[entry.studentProfileId] = {
          value: entry.value === null ? '' : String(entry.value),
          comment: entry.comment ?? '',
        };
      }
      setInputs(next);
    } catch (err) {
      setRosterError(describeError(err, 'Não foi possível abrir a pauta de notas.'));
    } finally {
      setRosterLoading(false);
    }
  }

  function closeRoster() {
    setRoster(null);
    setInputs({});
    setRosterError(null);
  }

  function printRoster() {
    if (!selected || !roster) return;
    const rows = roster.entries.map((entry) => {
      const blocked = isExamType(selected.type) && entry.situacao === 'DISPENSADO';
      return [
        entry.studentNumber,
        entry.fullName ?? '—',
        entry.value === null || blocked ? '—' : formatValue(entry.value, selected.gradingMode, selected.maxScore),
        entry.situacao ? SITUACAO_LABELS[entry.situacao] : 'Em aberto',
        entry.comment ?? '',
      ];
    });
    printDocument({
      title: `PAUTA DE NOTAS - ${selected.title.toUpperCase()}`,
      subtitle: `${selected.subject?.code ?? ''} ${selected.subject?.name ?? 'Disciplina'}`.trim(),
      eyebrow: 'UNIVERSIDADE JOSÉ ANTÓNIO ECHEVERRÍA - UJAE',
      meta: [
        `Disciplina: ${selected.subject?.name ?? '—'}`,
        `Tipo de Avaliação: ${TYPE_LABELS[selected.type]}`,
        `Modo de Avaliação: ${GRADING_LABELS[selected.gradingMode]}`,
        `Escala/Intervalo: ${selectedRange}`,
        `Peso: ${selected.weight}`,
        selected.date ? `Data da Avaliação: ${dateFormatter.format(new Date(selected.date))}` : `Data de Impressão: ${dateFormatter.format(new Date())}`,
      ].filter(Boolean),
      columns: ['Nº', 'Nome do Estudante', `Nota (${selectedRange})`, 'Situação Académica', 'Observações'],
      rows,
      emptyMessage: 'Não há estudantes inscritos no curso desta disciplina.',
      footer: 'O Docente Responsável ___________________________   Data ____/____/______   Assinatura e Carimbo',
    });
  }

  async function saveGrades(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setRosterError(null);
    setSavingGrades(true);

    const payload: Array<{ studentId: string; value: number; comment?: string | null }> = [];
    for (const entry of roster!.entries) {
      // Estudante dispensado não recebe nota de exame/recorrência — sem opção de lançamento.
      if (isExamType(selected.type) && entry.situacao === 'DISPENSADO') continue;
      const raw = inputs[entry.studentProfileId]?.value ?? '';
      if (raw.trim() === '') continue;
      const value = Number(raw.replace(',', '.'));
      if (!Number.isFinite(value)) {
        setRosterError(`Nota inválida para o estudante ${entry.studentNumber}.`);
        setSavingGrades(false);
        return;
      }
      const [min, max] = selected.gradingMode === 'PERCENTAGE' ? [0, 100] : selected.gradingMode === 'POINTS' ? [0, selected.maxScore] : [0, 20];
      if (value < min || value > max) {
        setRosterError(`A nota de ${entry.studentNumber} deve estar entre ${min} e ${max}.`);
        setSavingGrades(false);
        return;
      }
      payload.push({ studentId: entry.studentProfileId, value, comment: inputs[entry.studentProfileId]?.comment?.trim() || null });
    }

    if (payload.length === 0) {
      setRosterError('Introduz pelo menos uma nota antes de guardar.');
      setSavingGrades(false);
      return;
    }

    try {
      await api.upsertGrades(selected.id, { grades: payload });
      setNotice('Notas guardadas com sucesso.');
      await openRoster(selected);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setRosterError(describeError(err, 'Não foi possível guardar as notas.'));
    } finally {
      setSavingGrades(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Grupo Académico"
        title="Avaliações e notas"
        description="Criação de avaliações e lançamento de notas. Docentes gerem as suas avaliações; coordenadores e administradores gerem todas."
      />

      <div role="tablist" aria-label="Secções de avaliações" className="flex flex-wrap gap-2">
        {STAFF_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === item.id
                ? 'bg-campus-deep text-white'
                : 'bg-campus-mist text-campus-deep hover:bg-campus-line/70'
            }`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="space-y-2">
        {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p> : null}
      </div>

      <div hidden={tab !== 'avaliacoes'}>
        <form onSubmit={onSubmit} className="surface grid gap-3 p-4 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-campus-ink">
          {isEditing ? 'Editar avaliação' : 'Nova avaliação'}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-campus-deep/70">
            Título
            <input
              className="field-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex.: Teste 1 — Projecto"
              required
            />
          </label>
          <label className="text-xs font-medium text-campus-deep/70">
            Disciplina
            <select
              className="field-input disabled:opacity-60"
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              disabled={isEditing}
              required
            >
              <option value="">Selecionar disciplina</option>
              {options?.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-campus-deep/70">
            Tipo
            <select className="field-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AssessmentType })}>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-campus-deep/70">
            Modo de nota
            <select
              className="field-input"
              value={form.gradingMode}
              onChange={(e) => setForm({ ...form, gradingMode: e.target.value as GradingMode })}
            >
              {Object.entries(GRADING_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {form.gradingMode === 'POINTS' ? (
            <label className="text-xs font-medium text-campus-deep/70">
              Escala de pontos
              <input
                type="number"
                min={1}
                step="0.5"
                className="field-input"
                value={form.maxScore}
                onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
              />
            </label>
          ) : null}
          <label className="text-xs font-medium text-campus-deep/70">
            Peso
            <input
              type="number"
              min={0.1}
              step="0.1"
              className="field-input"
              value={form.weight}
              onChange={(e) => setForm({ ...form, weight: e.target.value })}
              required
            />
          </label>
          <label className="text-xs font-medium text-campus-deep/70">
            Data (opcional)
            <input type="date" className="field-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
        </div>

        {formError ? <p className="text-sm text-red-700">{formError}</p> : null}

        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          {isEditing ? (
            <button type="button" className="btn-secondary w-full sm:w-auto" onClick={resetForm}>
              Cancelar edição
            </button>
          ) : null}
          <button type="submit" className="btn-primary w-full sm:w-auto" disabled={creating}>
            {creating ? (isEditing ? 'A guardar...' : 'A criar...') : (isEditing ? 'Guardar alterações' : 'Criar avaliação')}
          </button>
        </div>
      </form>

      {roster || rosterLoading ? (
        <section className="surface p-4 sm:p-6">
          {rosterLoading ? (
            <p className="text-sm text-campus-deep/70">A carregar pauta...</p>
          ) : selected ? (
            <form onSubmit={saveGrades} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold text-campus-ink">Pauta de notas — {selected.title}</h2>
                  <p className="text-xs text-campus-deep/70">
                    {selected.subject?.name ?? 'Disciplina'} · {GRADING_LABELS[selected.gradingMode]} · intervalo {selectedRange}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-secondary" onClick={printRoster}>
                    Imprimir pauta
                  </button>
                  <button type="button" className="btn-secondary" onClick={closeRoster}>
                    Fechar pauta
                  </button>
                </div>
              </div>

              {roster && roster.entries.length === 0 ? (
                <p className="text-sm text-campus-deep/70">Não há estudantes inscritos no curso desta disciplina.</p>
              ) : (
                <div className="table-scroll">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-campus-mist/80 text-campus-deep">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Nº</th>
                        <th className="px-3 py-2 font-semibold">Estudante</th>
                        <th className="px-3 py-2 font-semibold">Situação</th>
                        <th className="px-3 py-2 font-semibold">Nota ({selectedRange})</th>
                        <th className="px-3 py-2 font-semibold">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roster?.entries.map((entry) => {
                        const blocked = isExamType(selected.type) && entry.situacao === 'DISPENSADO';

                        const blockedInput = blocked;
                        return (
                          <tr key={entry.studentProfileId} className="border-t border-campus-line/70">
                            <td className="px-3 py-2 whitespace-nowrap font-medium">{entry.studentNumber}</td>
                            <td className="px-3 py-2">{entry.fullName ?? '—'}</td>
                            <td className="px-3 py-2">
                              <SituacaoBadge situacao={entry.situacao} />
                            </td>
                            <td className="px-3 py-2">
                              {blockedInput ? (
                                <span className="text-xs text-campus-deep/60">Dispensado — sem exame/recorrência</span>
                              ) : (
                                <input
                                  className="field-input !mt-0 w-28"
                                  inputMode="decimal"
                                  aria-label={`Nota de ${entry.studentNumber}`}
                                  value={inputs[entry.studentProfileId]?.value ?? ''}
                                  onChange={(e) =>
                                    setInputs((prev) => ({
                                      ...prev,
                                      [entry.studentProfileId]: { value: e.target.value, comment: prev[entry.studentProfileId]?.comment ?? '' },
                                    }))
                                  }
                                />
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                className="field-input !mt-0"
                                aria-label={`Observação de ${entry.studentNumber}`}
                                value={inputs[entry.studentProfileId]?.comment ?? ''}
                                disabled={blockedInput}
                                onChange={(e) =>
                                  setInputs((prev) => ({
                                    ...prev,
                                    [entry.studentProfileId]: { value: prev[entry.studentProfileId]?.value ?? '', comment: e.target.value },
                                  }))
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {roster?.entries.some(e => e.situacao === 'ADMITIDO_AO_EXAME') && selected && (selected.type === 'EXAM' || selected.type === 'RECURRENCE') ? (
                <div className="border-t border-campus-line/70 pt-4">
                  <h3 className="font-display text-base font-semibold text-campus-ink">Notas de Exame / Recorrência</h3>
                  <p className="text-xs text-campus-deep/70 mb-2">Apenas para estudantes admitidos ao exame. Estudantes dispensados não podem ser lançados.</p>
                  <div className="table-scroll">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="bg-campus-mist/80 text-campus-deep">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Nº</th>
                          <th className="px-3 py-2 font-semibold">Estudante</th>
                          <th className="px-3 py-2 font-semibold">Situação</th>
                          <th className="px-3 py-2 font-semibold">Nota ({selectedRange})</th>
                          <th className="px-3 py-2 font-semibold">Observação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.entries.filter(e => e.situacao === 'ADMITIDO_AO_EXAME').map((entry) => (
                          <tr key={`exam-${entry.studentProfileId}`} className="border-t border-campus-line/70">
                            <td className="px-3 py-2 whitespace-nowrap font-medium">{entry.studentNumber}</td>
                            <td className="px-3 py-2">{entry.fullName ?? '—'}</td>
                            <td className="px-3 py-2"><SituacaoBadge situacao={entry.situacao} /></td>
                            <td className="px-3 py-2">
                              <input className="field-input !mt-0 w-28" inputMode="decimal" value={inputs[entry.studentProfileId]?.value ?? ''} onChange={(e) => setInputs((prev) => ({ ...prev, [entry.studentProfileId]: { value: e.target.value, comment: prev[entry.studentProfileId]?.comment ?? '' } }))} />
                            </td>
                            <td className="px-3 py-2">
                              <input className="field-input !mt-0" value={inputs[entry.studentProfileId]?.comment ?? ''} onChange={(e) => setInputs((prev) => ({ ...prev, [entry.studentProfileId]: { value: prev[entry.studentProfileId]?.value ?? '', comment: e.target.value } }))} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {rosterError ? <p className="text-sm text-red-700">{rosterError}</p> : null}

              <div className="flex justify-end">
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={savingGrades}>
                  {savingGrades ? 'A guardar...' : 'Guardar notas'}
                </button>
              </div>
            </form>
          ) : null}
        </section>
      ) : null}

      {loading ? (
        <div className="surface p-6 text-sm text-campus-deep/70">A carregar avaliações...</div>
      ) : error ? null : assessments.length === 0 ? (
        <div className="surface p-6 text-sm text-campus-deep/70">Ainda não há avaliações registadas.</div>
      ) : (
        <section className="surface table-scroll">
          <table className="min-w-[760px] text-left text-sm">
            <thead className="bg-campus-mist/80 text-campus-deep">
              <tr>
                <th className="px-4 py-3 font-semibold">Título</th>
                <th className="px-4 py-3 font-semibold">Disciplina</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Modo</th>
                <th className="px-4 py-3 font-semibold">Peso</th>
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((assessment) => (
                <tr key={assessment.id} className="border-t border-campus-line/70">
                  <td className="px-4 py-3 font-medium">{assessment.title}</td>
                  <td className="px-4 py-3">{assessment.subject?.name ?? assessment.subject?.code ?? '—'}</td>
                  <td className="px-4 py-3">{TYPE_LABELS[assessment.type]}</td>
                  <td className="px-4 py-3">{GRADING_LABELS[assessment.gradingMode]}</td>
                  <td className="px-4 py-3">{assessment.weight}</td>
                  <td className="px-4 py-3">{assessment.date ? dateFormatter.format(new Date(assessment.date)) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary !px-3 !py-1.5" onClick={() => void openRoster(assessment)}>
                        Lançar notas
                      </button>
                      <button
                        type="button"
                        className="btn-secondary !px-3 !py-1.5"
                        disabled={assessment.hasGrades || (assessment.gradesCount ?? 0) > 0}
                        title={
                          assessment.hasGrades || (assessment.gradesCount ?? 0) > 0
                            ? 'Não é possível editar: já existem notas lançadas para esta avaliação.'
                            : 'Editar avaliação'
                        }
                        onClick={() => {
                          if (assessment.hasGrades || (assessment.gradesCount ?? 0) > 0) {
                            setNotice('Não é possível editar esta avaliação porque já foram lançadas notas.');
                            return;
                          }
                          startEdit(assessment);
                        }}
                      >
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {options && options.subjects.length > 0 ? (
        <section className="surface p-4 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-campus-ink">Número de testes por disciplina</h2>
          <p className="text-xs text-campus-deep/70 mb-4">
            Define quantos testes o estudante precisa de ter com nota para a situação final aparecer.
            Deixa em branco para usar a regra dos 100% dos pesos.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {options.subjects.map((s) => (
              <div key={s.id} className="rounded-xl border border-campus-line/70 p-3">
                <p className="text-sm font-medium text-campus-ink">{s.code} — {s.name}</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="field-input !mt-0 w-20"
                    value={s.requiredTestCount ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value);
                      setOptions((prev) => prev ? { ...prev, subjects: prev.subjects.map((x) => x.id === s.id ? { ...x, requiredTestCount: val } : x) } : prev);
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                    onClick={async () => {
                      try {
                        await api.setRequiredTestCount(s.id, s.requiredTestCount);
                        setNotice(`Número de testes de ${s.code} guardado.`);
                      } catch (err) {
                        setError(describeError(err, 'Não foi possível guardar o número de testes.'));
                      }
                    }}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      </div>

      {tab !== 'avaliacoes' ? (
        <SubjectBoardPanel
          mode={tab}
          options={options}
          subjectId={boardSubjectId}
          onSubjectChange={setBoardSubjectId}
        />
      ) : null}
    </div>
  );
}

function StudentAssessments() {
  const { api, user } = useAuth();
  const [finalGrades, setFinalGrades] = useState<FinalGradeDto[]>([]);
  const [grades, setGrades] = useState<GradeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([api.myFinalGrades(), api.myGrades()])
      .then(([finalRes, gradesRes]) => {
        if (cancelled) return;
        setFinalGrades(finalRes.data);
        setGrades(gradesRes.data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err, 'Não foi possível carregar as tuas notas.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  // Mostra todas as disciplinas com frequência completa — mesmo sem nota final
  // (ex.: admitido ao exame, aguarda nota de exame ou recorrência).
  const listed = useMemo(() => finalGrades.filter((g) => g.complete), [finalGrades]);

  /** Texto da coluna Recorrência na pauta do estudante. */
  function recurrenceCellText(subject: FinalGradeDto): string {
    if (subject.state === 'APROVADO_EXAME') return '*';
    if (subject.recurrenceGrade !== null && subject.recurrenceGrade !== undefined) {
      return String(subject.recurrenceGrade);
    }
    if (subject.state === 'ADMITIDO_RECORRENCIA') return 'Aguarda recorrência';
    return '—';
  }

  function printMyNotes() {
    const finalRows = listed.map((g) => [
      `${g.subjectCode} — ${g.subjectName}`,
      g.finalGrade === null ? '—' : String(g.finalGrade),
      g.admissionGrade !== null ? `Admissão ${g.admissionGrade}` : '—',
      g.examGrade === null ? '—' : String(g.examGrade),
      recurrenceCellText(g),
      g.state ? STATE_LABELS[g.state] : '—',
      `${g.gradedAssessments}/${g.assessments}`,
    ]);
    const gradeRows = grades.map((g) => [
      g.assessment?.title ?? '—',
      g.assessment ? TYPE_LABELS[g.assessment.type] : '—',
      String(Math.round(g.value)),
      g.assessment ? String(g.assessment.weight) : '—',
    ]);
    printDocument({
      title: 'Mapa de notas do estudante',
      subtitle: user?.fullName ?? '',
      sections: [
        {
          heading: 'Notas por disciplina',
          columns: ['Disciplina', 'Nota final', 'Admissão', 'Exame', 'Recorrência', 'Situação', 'Avaliações'],
          rows: finalRows,
          emptyMessage: 'Sem disciplinas com a frequência completa.',
        },
        {
          heading: 'Notas por avaliação',
          columns: ['Avaliação', 'Tipo', 'Nota', 'Peso'],
          rows: gradeRows,
          emptyMessage: 'Ainda não há notas lançadas.',
        },
      ],
    });
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Grupo Académico"
        title="Avaliações e notas"
        description="Notas por disciplina (admissão, exames e situação) e detalhe das avaliações lançadas pelos docentes."
      />

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="surface p-6 text-sm text-campus-deep/70">A carregar notas...</div>
      ) : error ? null : (
        <>
          <div className="flex justify-end">
            <button type="button" className="btn-secondary" onClick={printMyNotes}>
              Imprimir notas
            </button>
          </div>
          {listed.length > 0 ? (
            <section className="surface table-scroll">
              <h2 className="border-b border-campus-line/70 px-4 py-3 font-display text-base font-semibold text-campus-ink">
                Notas por disciplina
              </h2>
               <table className="min-w-[640px] text-left text-sm">
                 <thead className="bg-campus-mist/80 text-campus-deep">
                   <tr>
                     <th className="px-4 py-3 font-semibold">Disciplina</th>
                     <th className="px-4 py-3 font-semibold">Admissão</th>
                     <th className="px-4 py-3 font-semibold">Exame Normal</th>
                     <th className="px-4 py-3 font-semibold">Exame de Recorrência</th>
                     <th className="px-4 py-3 font-semibold">Nota final</th>
                     <th className="px-4 py-3 font-semibold">Situação</th>
                     <th className="px-4 py-3 font-semibold">Cálculo</th>
                   </tr>
                 </thead>
                 <tbody>
                   {listed.map((subject) => (
                     <tr key={subject.subjectId} className="border-t border-campus-line/70">
                       <td className="px-4 py-3 font-medium">
                         {subject.subjectCode} — {subject.subjectName}
                       </td>
                       <td className="px-4 py-3">
                         <span className="font-semibold">Admissão {subject.admissionGrade ?? '—'}</span>
                       </td>
                       <td className="px-4 py-3">
                         <span className="font-semibold">Exame {subject.examGrade ?? '—'}</span>
                       </td>
                       <td className="px-4 py-3">
                         <span className="font-semibold">{recurrenceCellText(subject)}</span>
                       </td>
                       <td className="px-4 py-3">
                         <span className="font-bold text-campus-ink">{subject.finalGrade ?? '—'}</span>
                       </td>
                       <td className="px-4 py-3">
                         {subject.state ? (
                           <>
                             <span
                               className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${stateBadgeClass(subject.state)}`}
                             >
                               {STATE_LABELS[subject.state]}
                             </span>
                             {subject.stateReason ? (
                               <span className="mt-1 block text-xs text-campus-deep/60">{subject.stateReason}</span>
                             ) : null}
                           </>
                         ) : (
                           <SituacaoBadge situacao={subject.status} />
                         )}
                       </td>
                       <td className="px-4 py-3 text-campus-deep/70">
                         <span className="text-xs">{calculoTexto(subject)}</span>
                         <span className="mt-0.5 block text-xs text-campus-deep/60">
                           {subject.breakdown.map((b) => `${b.title} (${b.weight})`).join(' · ')}
                         </span>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
               {listed.some((subject) => subject.state === 'APROVADO_EXAME') ? (
                 <p className="border-t border-campus-line/70 px-4 py-3 text-xs text-campus-deep/70">
                   {RECURRENCE_LEGEND}
                 </p>
               ) : null}
            </section>
          ) : null}

          <section className="surface table-scroll">
            <h2 className="border-b border-campus-line/70 px-4 py-3 font-display text-base font-semibold text-campus-ink">
              Notas por avaliação
            </h2>
            {grades.length === 0 ? (
              <p className="px-4 py-6 text-sm text-campus-deep/70">Ainda não tens notas lançadas.</p>
            ) : (
              <table className="min-w-[640px] text-left text-sm">
                <thead className="bg-campus-mist/80 text-campus-deep">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Avaliação</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Nota</th>
                    <th className="px-4 py-3 font-semibold">Peso</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((grade) => (
                    <tr key={grade.id} className="border-t border-campus-line/70">
                      <td className="px-4 py-3 font-medium">{grade.assessment?.title ?? '—'}</td>
                      <td className="px-4 py-3">{grade.assessment ? TYPE_LABELS[grade.assessment.type] : '—'}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-campus-ink">{Math.round(grade.value)}</span>
                      </td>
                      <td className="px-4 py-3">{grade.assessment?.weight ?? '—'}</td>
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

export function AssessmentsPage() {
  const { user } = useAuth();
  const isStaff = Boolean(user && STAFF_ROLES.includes(user.role));
  return isStaff ? <StaffAssessments /> : <StudentAssessments />;
}
