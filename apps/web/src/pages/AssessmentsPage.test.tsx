import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  AssessmentDto,
  AssessmentRoster,
  FinalGradeDto,
  GradeDto,
  SubjectBoard,
} from '@smart-campus/shared-types';

const useAuthMock = vi.fn();
const { printDocumentMock } = vi.hoisted(() => ({ printDocumentMock: vi.fn() }));

vi.mock('../lib/auth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../lib/print', () => ({
  printDocument: printDocumentMock,
}));

import { AssessmentsPage } from './AssessmentsPage';

const sampleAssessment: AssessmentDto = {
  id: 'assessment-1',
  title: 'Teste 1 — Projeto',
  description: null,
  type: 'TEST',
  gradingMode: 'PERCENTAGE',
  maxScore: 100,
  weight: 1,
  date: '2026-11-10T00:00:00.000Z',
  subjectId: 'subject-1',
  subject: { id: 'subject-1', code: 'PTP3', name: 'Projeto' },
  createdById: 'user-1',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const sampleRoster: AssessmentRoster = {
  assessment: sampleAssessment,
  entries: [
    {
      studentProfileId: 'student-1',
      studentNumber: 'EST-2026-001',
      fullName: 'Estudante Demo',
      value: null,
      valuePercent: null,
      comment: null,
      situacao: null,
    },
  ],
};

const sampleGrade: GradeDto = {
  id: 'grade-1',
  assessmentId: 'assessment-1',
  studentId: 'student-1',
  value: 15,
  valuePercent: 15,
  comment: null,
  gradedById: 'user-1',
  assessment: { id: 'assessment-1', title: 'Teste 1 — Projeto', type: 'TEST', gradingMode: 'PERCENTAGE', maxScore: 100, weight: 1, subjectId: 'subject-1' },
  createdAt: '2026-10-02T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
};

const sampleFinal: FinalGradeDto = {
  subjectId: 'subject-1',
  subjectCode: 'PTP3',
  subjectName: 'Projeto',
  requiredTestCount: 2,
  finalGrade: 16,
  admissionGrade: 16,
  examGrade: null,
  recurrenceGrade: null,
  usedExam: false,
  status: 'DISPENSADO',
  state: 'DISPENSADO',
  stateReason: null,
  recurrenceEligible: false,
  complete: true,
  totalWeight: 1,
  gradedAssessments: 1,
  assessments: 1,
  breakdown: [{ assessmentId: 'assessment-1', title: 'Teste 1 — Projeto', weight: 1, value: 15, valuePercent: 15 }],
};

/** Frequência completa (10–13) ainda sem nota de exame: aparece na pauta, aguarda exame. */
const sampleFinalAdmitted: FinalGradeDto = {
  ...sampleFinal,
  finalGrade: null,
  admissionGrade: 12,
  status: null,
  state: 'ADMITIDO_AO_EXAME',
};

/** Reprovou o exame e é elegível para recorrência (mínimo de admissão cumprido): sem nota final até à recorrência. */
const sampleFinalEligibleRecurrence: FinalGradeDto = {
  ...sampleFinal,
  finalGrade: null,
  admissionGrade: 10,
  examGrade: 8,
  usedExam: true,
  status: 'EXCLUIDO',
  state: 'ADMITIDO_RECORRENCIA',
  stateReason: null,
  recurrenceEligible: true,
};

/** Nota de recorrência já lançada e aprovada: fórmula (A+R)/2. */
const sampleFinalWithRecurrence: FinalGradeDto = {
  ...sampleFinal,
  finalGrade: 13,
  admissionGrade: 10,
  examGrade: 8,
  recurrenceGrade: 16,
  usedExam: true,
  status: 'APROVADO',
  state: 'APROVADO_RECORRENCIA',
  stateReason: null,
  recurrenceEligible: true,
};

const sampleFinalWithExam: FinalGradeDto = {
  ...sampleFinal,
  finalGrade: 13,
  admissionGrade: 10,
  examGrade: 16,
  usedExam: true,
  status: 'APROVADO',
  state: 'APROVADO_EXAME',
  recurrenceEligible: false,
  breakdown: [
    { assessmentId: 'assessment-1', title: 'Teste 1 — Projeto', weight: 1, value: 50, valuePercent: 50 },
    { assessmentId: 'assessment-exam', title: 'Exame Final', weight: 50, value: 16, valuePercent: 80 },
  ],
};

const sampleBoard: SubjectBoard = {
  rules: {
    subjectId: 'subject-1',
    subjectCode: 'PTP3',
    subjectName: 'Projeto',
    requiredTestCount: 2,
    recurrenceMinAdmission: 7,
    rulesConfigured: true,
    published: false,
    publishedAt: null,
    hasExamEpoch: true,
    hasRecurrenceEpoch: true,
  },
  examAssessment: { id: 'assessment-exam', title: 'Exame Normal', gradingMode: 'SCALE', maxScore: 20 },
  recurrenceAssessment: { id: 'assessment-rec', title: 'Recorrência', gradingMode: 'SCALE', maxScore: 20 },
  counters: {
    total: 3,
    pendentes: 0,
    dispensados: 1,
    excluidos: 0,
    admitidosExame: 0,
    aprovadosExame: 1,
    reprovadosExame: 0,
    admitidosRecorrencia: 1,
    elegiveisRecorrencia: 1,
    aprovadosRecorrencia: 0,
    reprovadosRecorrencia: 0,
    naoElegiveis: 0,
    emRevisao: 0,
  },
  entries: [
    {
      studentProfileId: 'student-1',
      studentNumber: 'EST-2026-001',
      fullName: 'Estudante Demo',
      continuous: [{ assessmentId: 'assessment-1', title: 'Teste 1', weight: 50, value: 16 }],
      admissionGrade: 16,
      admissionPercent: 80,
      complete: true,
      state: 'DISPENSADO',
      stateReason: null,
      status: 'DISPENSADO',
      exam: {
        assessmentId: 'assessment-exam',
        grade: null,
        valuePercent: null,
        comment: null,
        editable: false,
        blockedReason: 'Dispensado — sem exame/recorrência',
      },
      recurrence: {
        assessmentId: 'assessment-rec',
        grade: null,
        valuePercent: null,
        comment: null,
        asterisk: false,
        editable: false,
        blockedReason: 'Dispensado — sem exame/recorrência',
      },
      finalGrade: 16,
      finalPercent: 80,
    },
    {
      studentProfileId: 'student-2',
      studentNumber: 'EST-2026-002',
      fullName: 'Estudante Elegível',
      continuous: [{ assessmentId: 'assessment-1', title: 'Teste 1', weight: 50, value: 10 }],
      admissionGrade: 10,
      admissionPercent: 50,
      complete: true,
      state: 'ADMITIDO_RECORRENCIA',
      stateReason: null,
      status: 'EXCLUIDO',
      exam: {
        assessmentId: 'assessment-exam',
        grade: 8,
        valuePercent: 40,
        comment: null,
        editable: true,
        blockedReason: null,
      },
      recurrence: {
        assessmentId: 'assessment-rec',
        grade: null,
        valuePercent: null,
        comment: null,
        asterisk: false,
        editable: true,
        blockedReason: null,
      },
      finalGrade: null,
      finalPercent: null,
    },
    {
      studentProfileId: 'student-3',
      studentNumber: 'EST-2026-003',
      fullName: 'Estudante Aprovado',
      continuous: [{ assessmentId: 'assessment-1', title: 'Teste 1', weight: 50, value: 10 }],
      admissionGrade: 10,
      admissionPercent: 50,
      complete: true,
      state: 'APROVADO_EXAME',
      stateReason: null,
      status: 'APROVADO',
      exam: {
        assessmentId: 'assessment-exam',
        grade: 16,
        valuePercent: 80,
        comment: null,
        editable: true,
        blockedReason: null,
      },
      recurrence: {
        assessmentId: 'assessment-rec',
        grade: null,
        valuePercent: null,
        comment: null,
        asterisk: true,
        editable: false,
        blockedReason: '* Aprovado no exame normal — não necessita de recorrência',
      },
      finalGrade: 13,
      finalPercent: 65,
    },
  ],
};

function buildApi(overrides: Record<string, unknown> = {}) {
  return {
    assessments: vi.fn().mockResolvedValue({ data: [sampleAssessment], meta: {} }),
    assessmentOptions: vi.fn().mockResolvedValue({
      data: { subjects: [{ id: 'subject-1', code: 'PTP3', name: 'Projeto', courseId: 'course-1' }] },
      meta: {},
    }),
    assessmentRoster: vi.fn().mockResolvedValue({ data: sampleRoster, meta: {} }),
    upsertGrades: vi.fn().mockResolvedValue({ data: [sampleGrade], meta: {} }),
    createAssessment: vi.fn().mockResolvedValue({ data: sampleAssessment, meta: {} }),
    updateAssessment: vi.fn().mockResolvedValue({ data: sampleAssessment, meta: {} }),
    myGrades: vi.fn().mockResolvedValue({ data: [sampleGrade], meta: {} }),
    myFinalGrades: vi.fn().mockResolvedValue({ data: [sampleFinal], meta: {} }),
    subjectBoard: vi.fn().mockResolvedValue({ data: sampleBoard, meta: {} }),
    setSubjectRules: vi.fn().mockResolvedValue({
      data: {
        id: 'subject-1',
        code: 'PTP3',
        name: 'Projeto',
        requiredTestCount: 2,
        recurrenceMinAdmission: 7,
        resultsPublishedAt: null,
      },
      meta: {},
    }),
    publishResults: vi.fn().mockResolvedValue({
      data: {
        subjectId: 'subject-1',
        subjectCode: 'PTP3',
        subjectName: 'Projeto',
        published: true,
        publishedAt: '2026-10-19T10:00:00.000Z',
      },
      meta: {},
    }),
    setSubjectExemption: vi.fn().mockResolvedValue({
      data: { subjectId: 'subject-1', studentId: 'student-1', exempted: true },
      meta: {},
    }),
    ...overrides,
  };
}

function setAuth(role: string, api = buildApi()) {
  useAuthMock.mockReturnValue({ user: { id: 'user-1', role }, api });
  return api;
}

describe('AssessmentsPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    printDocumentMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('estudante vê as notas por disciplina (nota inteira + estado, sem rótulo de pauta final) e as notas por avaliação', async () => {
    setAuth('STUDENT');
    render(<AssessmentsPage />);

    expect(await screen.findByText('Notas por disciplina')).toBeInTheDocument();
    expect(screen.queryByText('Pauta final')).not.toBeInTheDocument();
    expect(screen.getByText('PTP3 — Projeto')).toBeInTheDocument();
    // Nota inteira (sem "14/20" nem "%") e estado calculado visíveis.
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('Dispensado')).toBeInTheDocument();
    expect(screen.queryByText(/16%/)).not.toBeInTheDocument();
    expect(screen.getByText('Notas por avaliação')).toBeInTheDocument();
    expect(screen.getByText('Teste 1 — Projeto')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('estudante com exame vê o cálculo (admissão + exame) / 2, a nota final e o asterisco da recorrência', async () => {
    setAuth('STUDENT', buildApi({ myFinalGrades: vi.fn().mockResolvedValue({ data: [sampleFinalWithExam], meta: {} }) }));
    render(<AssessmentsPage />);

    expect(await screen.findByText('Notas por disciplina')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByText('Admissão 10 + Exame 16 → (A+E)/2')).toBeInTheDocument();
    expect(screen.getByText('Aprovado no exame normal')).toBeInTheDocument();
    // Aprovado no exame normal: recorrência mostra apenas "*" com legenda.
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByText('* Aprovado no exame normal — não necessita de recorrência')).toBeInTheDocument();
  });

  it('estudante admitido ao exame vê a disciplina antes da nota do exame (Exame —, nota final —)', async () => {
    setAuth('STUDENT', buildApi({ myFinalGrades: vi.fn().mockResolvedValue({ data: [sampleFinalAdmitted], meta: {} }) }));
    render(<AssessmentsPage />);

    expect(await screen.findByText('Notas por disciplina')).toBeInTheDocument();
    expect(screen.getByText('PTP3 — Projeto')).toBeInTheDocument();
    expect(screen.getByText('Admissão 12')).toBeInTheDocument();
    expect(screen.getByText('Exame —')).toBeInTheDocument();
    expect(screen.getByText('Admitido ao exame')).toBeInTheDocument();
    // Ainda não há nota final: recorrência e nota final mostram apenas "—".
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Admissão 12 · Aguarda exame normal')).toBeInTheDocument();
  });

  it('estudante elegível a recorrência vê "Aguarda recorrência" e ainda sem nota final', async () => {
    setAuth('STUDENT', buildApi({ myFinalGrades: vi.fn().mockResolvedValue({ data: [sampleFinalEligibleRecurrence], meta: {} }) }));
    render(<AssessmentsPage />);

    expect(await screen.findByText('Notas por disciplina')).toBeInTheDocument();
    expect(screen.getByText('Aguarda recorrência')).toBeInTheDocument();
    expect(screen.getByText('Admitido à recorrência')).toBeInTheDocument();
    expect(screen.getByText('Admissão 10 + Exame 8 → (A+E)/2 · Aguarda recorrência')).toBeInTheDocument();
    // A média do exame é provisória: nota final só depois da recorrência.
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('9')).not.toBeInTheDocument();
  });

  it('estudante com recorrência lançada vê a nota de recorrência e a fórmula (A+R)/2', async () => {
    setAuth('STUDENT', buildApi({ myFinalGrades: vi.fn().mockResolvedValue({ data: [sampleFinalWithRecurrence], meta: {} }) }));
    render(<AssessmentsPage />);

    expect(await screen.findByText('Notas por disciplina')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('Admissão 10 + Recorrência 16 → (A+R)/2')).toBeInTheDocument();
    expect(screen.getByText('Aprovado na recorrência')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
  });

  it('docente vê o formulário de criação e a lista de avaliações', async () => {
    const api = setAuth('TEACHER');
    render(<AssessmentsPage />);

    expect(await screen.findByText('Nova avaliação')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar avaliação' })).toBeInTheDocument();
    await waitFor(() => expect(api.assessmentOptions).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Lançar notas' })).toBeInTheDocument();
  });

  it('docente abre a pauta, lança uma nota e guarda', async () => {
    const api = setAuth('TEACHER');
    render(<AssessmentsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Lançar notas' }));
    expect(await screen.findByText('Pauta de notas — Teste 1 — Projeto')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nota de EST-2026-001'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar notas' }));

    await waitFor(() =>
      expect(api.upsertGrades).toHaveBeenCalledWith(
        'assessment-1',
        expect.objectContaining({ grades: [{ studentId: 'student-1', value: 15, comment: null }] }),
      ),
    );
  });

  it('docente não tem opção de lançar exame/recorrência a estudante dispensado', async () => {
    const examRoster: AssessmentRoster = {
      assessment: { ...sampleAssessment, id: 'assessment-exam', title: 'Exame Final', type: 'EXAM' },
      entries: [
        {
          studentProfileId: 'student-1',
          studentNumber: 'EST-2026-001',
          fullName: 'Estudante Demo',
          value: null,
          valuePercent: null,
          comment: null,
          situacao: 'DISPENSADO',
        },
      ],
    };
    setAuth('TEACHER', buildApi({ assessmentRoster: vi.fn().mockResolvedValue({ data: examRoster, meta: {} }) }));
    render(<AssessmentsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Lançar notas' }));
    expect(await screen.findByText('Pauta de notas — Exame Final')).toBeInTheDocument();
    expect(screen.getByText('Dispensado')).toBeInTheDocument();
    expect(screen.getByText('Dispensado — sem exame/recorrência')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nota de EST-2026-001')).not.toBeInTheDocument();
  });

  it('docente edita uma avaliação e guarda as alterações', async () => {
    const api = setAuth('TEACHER');
    render(<AssessmentsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    expect(await screen.findByText('Editar avaliação')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Teste 1 — Revisão' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar alterações' }));

    await waitFor(() =>
      expect(api.updateAssessment).toHaveBeenCalledWith(
        'assessment-1',
        expect.objectContaining({ title: 'Teste 1 — Revisão' }),
      ),
    );
  });

  it('mostra erro amigável quando a API de avaliações falha', async () => {
    setAuth('TEACHER', buildApi({ assessments: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) }));
    render(<AssessmentsPage />);

    expect(await screen.findByText('Não foi possível carregar as avaliações.')).toBeInTheDocument();
  });

  it('docente imprime a pauta de notas da avaliação aberta', async () => {
    setAuth('TEACHER');
    render(<AssessmentsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Lançar notas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Imprimir pauta' }));

    expect(printDocumentMock).toHaveBeenCalledTimes(1);
    const doc = printDocumentMock.mock.calls[0][0];
    expect(doc.title).toBe('PAUTA DE NOTAS - TESTE 1 — PROJETO');
    expect(doc.columns).toContain('Nome do Estudante');
    expect(doc.rows[0][1]).toBe('Estudante Demo');
  });

  it('estudante imprime o seu mapa de notas', async () => {
    setAuth('STUDENT');
    render(<AssessmentsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Imprimir notas' }));

    expect(printDocumentMock).toHaveBeenCalledTimes(1);
    const doc = printDocumentMock.mock.calls[0][0];
    expect(doc.title).toBe('Mapa de notas do estudante');
    expect(doc.sections).toHaveLength(2);
    expect(doc.sections[0].rows[0][0]).toBe('PTP3 — Projeto');
  });

  it('docente vê os 5 separadores e o quadro de Frequência e Dispensa com contagens e estados', async () => {
    const api = setAuth('TEACHER');
    render(<AssessmentsPage />);

    expect(await screen.findAllByRole('tab')).toHaveLength(5);
    fireEvent.click(screen.getByRole('tab', { name: 'Frequência e Dispensa' }));
    fireEvent.change(await screen.findByLabelText('Disciplina do quadro'), { target: { value: 'subject-1' } });

    await waitFor(() => expect(api.subjectBoard).toHaveBeenCalledWith('subject-1'));
    expect(await screen.findByText('Dispensados: 1')).toBeInTheDocument();
    expect(screen.getByText('Pendentes: 0')).toBeInTheDocument();
    expect(screen.getByText('Excluídos: 0')).toBeInTheDocument();
    // Badge na tabela (o <option> do filtro de estado repete o mesmo texto).
    expect((await screen.findAllByText('Admitido à recorrência')).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Admissão 16')).toBeInTheDocument();
  });

  it('separador Exame Normal não permite nota a estudante dispensado', async () => {
    setAuth('TEACHER');
    render(<AssessmentsPage />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Exame Normal' }));
    fireEvent.change(await screen.findByLabelText('Disciplina do quadro'), { target: { value: 'subject-1' } });

    expect(await screen.findByText('Dispensado — sem exame/recorrência')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nota de exame de EST-2026-001')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nota de exame de EST-2026-002')).toBeInTheDocument();
  });

  it('separador Recorrência mostra a legenda do asterisco e campo apenas para elegíveis', async () => {
    setAuth('TEACHER');
    render(<AssessmentsPage />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Recorrência' }));
    fireEvent.change(await screen.findByLabelText('Disciplina do quadro'), { target: { value: 'subject-1' } });

    // Aparece na legenda e na célula bloqueada do estudante aprovado no exame.
    expect(
      (await screen.findAllByText('* Aprovado no exame normal — não necessita de recorrência')).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Nota de recorrência de EST-2026-002')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nota de recorrência de EST-2026-003')).not.toBeInTheDocument();
  });

  it('separador Resultados Finais publica a pauta da disciplina', async () => {
    const api = setAuth('TEACHER');
    render(<AssessmentsPage />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Resultados Finais' }));
    fireEvent.change(await screen.findByLabelText('Disciplina do quadro'), { target: { value: 'subject-1' } });
    await waitFor(() => expect(api.subjectBoard).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole('button', { name: 'Publicar resultados' }));
    await waitFor(() => expect(api.publishResults).toHaveBeenCalledWith('subject-1', true));
    expect(await screen.findByText('Resultados de PTP3 publicados.')).toBeInTheDocument();
  });

  it('docente guarda as regras da disciplina (testes exigidos e mínimo de recorrência)', async () => {
    const api = setAuth('TEACHER');
    render(<AssessmentsPage />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Frequência e Dispensa' }));
    fireEvent.change(await screen.findByLabelText('Disciplina do quadro'), { target: { value: 'subject-1' } });
    await waitFor(() => expect(api.subjectBoard).toHaveBeenCalled());

    // Espera o formulário de regras sincronizado com o quadro carregado.
    const reqInput = await screen.findByLabelText('Testes exigidos');
    const minInput = await screen.findByLabelText('Mínimo para recorrência (0–20)');
    await waitFor(() => {
      expect(minInput).toHaveValue(7);
      expect(reqInput).toHaveValue(2);
    });
    fireEvent.change(minInput, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar regras' }));

    await waitFor(() =>
      expect(api.setSubjectRules).toHaveBeenCalledWith('subject-1', {
        requiredTestCount: 2,
        recurrenceMinAdmission: 12,
      }),
    );
    expect(await screen.findByText('Regras da disciplina guardadas.')).toBeInTheDocument();
  });

  it('docente dispensa estudante ao seu critério no quadro de Frequência e Dispensa', async () => {
    const boardSemDispensa: SubjectBoard = {
      ...sampleBoard,
      entries: sampleBoard.entries.map((entry) =>
        entry.studentProfileId === 'student-1'
          ? {
              ...entry,
              state: 'PENDENTE',
              status: null,
              exempted: false,
              stateReason: null,
              admissionGrade: 12,
              exemptionGrade: null,
              exam: {
                assessmentId: 'assessment-exam',
                grade: null,
                valuePercent: null,
                comment: null,
                editable: true,
                blockedReason: null,
              },
              recurrence: {
                assessmentId: 'assessment-rec',
                grade: null,
                valuePercent: null,
                comment: null,
                asterisk: false,
                editable: true,
                blockedReason: null,
              },
              finalGrade: null,
            }
          : entry,
      ),
    };
    const api = setAuth(
      'TEACHER',
      buildApi({
        subjectBoard: vi.fn().mockResolvedValue({ data: boardSemDispensa, meta: {} }),
      }),
    );
    render(<AssessmentsPage />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Frequência e Dispensa' }));
    fireEvent.change(await screen.findByLabelText('Disciplina do quadro'), { target: { value: 'subject-1' } });
    await waitFor(() => expect(api.subjectBoard).toHaveBeenCalled());
    // Espera o quadro renderizado com o input de dispensa pré-preenchido com a admissão (12).
    await screen.findByDisplayValue('12');

    fireEvent.change(screen.getByLabelText('Nota de dispensa de EST-2026-001'), { target: { value: '16' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Dispensar' })[0]);

    await waitFor(() =>
      expect(api.setSubjectExemption).toHaveBeenCalledWith('subject-1', {
        studentId: 'student-1',
        exempted: true,
        grade: 16,
      }),
    );
    expect(await screen.findByText('Estudante dispensado com nota 16.')).toBeInTheDocument();
  });

  it('docente anula a dispensa quando o quadro marca o estudante como dispensado pelo docente', async () => {
    const boardComDispensa: SubjectBoard = {
      ...sampleBoard,
      entries: sampleBoard.entries.map((entry, index) =>
        index === 0 ? { ...entry, exempted: true, state: 'DISPENSADO', stateReason: 'Dispensado pelo docente' } : entry,
      ),
    };
    const api = setAuth(
      'TEACHER',
      buildApi({
        subjectBoard: vi.fn().mockResolvedValue({ data: boardComDispensa, meta: {} }),
      }),
    );
    render(<AssessmentsPage />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Frequência e Dispensa' }));
    fireEvent.change(await screen.findByLabelText('Disciplina do quadro'), { target: { value: 'subject-1' } });
    await waitFor(() => expect(api.subjectBoard).toHaveBeenCalled());

    fireEvent.click(await screen.findByRole('button', { name: 'Anular dispensa' }));

    await waitFor(() =>
      expect(api.setSubjectExemption).toHaveBeenCalledWith('subject-1', {
        studentId: 'student-1',
        exempted: false,
      }),
    );
    expect(await screen.findByText('Dispensa anulada.')).toBeInTheDocument();
  });

  it('estudante dispensado pelo docente não vê legenda de exame nem dados de exame', async () => {
    const dispensadoManual: FinalGradeDto = {
      ...sampleFinal,
      admissionGrade: 11,
      finalGrade: 11,
      examGrade: null,
      recurrenceGrade: null,
      usedExam: false,
      state: 'DISPENSADO',
      status: 'DISPENSADO',
      stateReason: 'Dispensado pelo docente',
      exempted: true,
    };
    setAuth(
      'STUDENT',
      buildApi({
        myFinalGrades: vi.fn().mockResolvedValue({ data: [dispensadoManual], meta: {} }),
      }),
    );
    render(<AssessmentsPage />);

    expect(await screen.findByText('Notas por disciplina')).toBeInTheDocument();
    expect(screen.getByText('Dispensado')).toBeInTheDocument();
    expect(screen.getByText('Dispensado pelo docente')).toBeInTheDocument();
    // Sem nada de exame: célula vazia e ausência total da legenda do asterisco.
    expect(screen.getByText('Exame —')).toBeInTheDocument();
    expect(screen.queryByText('* Aprovado no exame normal — não necessita de recorrência')).not.toBeInTheDocument();
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('impressão do estudante usa "Notas por disciplina" e nunca "Pauta final"', async () => {
    setAuth('STUDENT');
    render(<AssessmentsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Imprimir notas' }));
    const sections = printDocumentMock.mock.calls[0][0].sections as Array<{ heading: string }>;
    expect(sections[0].heading).toBe('Notas por disciplina');
    expect(sections.some((s) => s.heading === 'Pauta final')).toBe(false);
  });
});
