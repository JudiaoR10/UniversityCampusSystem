import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RECURRENCE_MIN,
  computeAcademicState,
  computeSubjectFinalResult,
  assertGradeAllowedForState,
  type SubjectAssessmentForFinal,
} from './assessmentService.js';

const S = 'student-1';

function continuous(valuePercent: number, weight: number, id = `c-${valuePercent}-${weight}`): SubjectAssessmentForFinal {
  return { id, title: id, type: 'TEST', weight, grades: [{ studentId: S, value: valuePercent, valuePercent }] };
}

function exam(valuePercent: number, id = 'exam'): SubjectAssessmentForFinal {
  return { id, title: id, type: 'EXAM', weight: 10, grades: [{ studentId: S, value: valuePercent, valuePercent }] };
}

function recurrence(valuePercent: number, id = 'rec'): SubjectAssessmentForFinal {
  return { id, title: id, type: 'RECURRENCE', weight: 5, grades: [{ studentId: S, value: valuePercent, valuePercent }] };
}

describe('computeAcademicState — máquina de estados (dispensa → exame → recorrência)', () => {
  it('frequência incompleta → PENDENTE', () => {
    const { state, reason } = computeAcademicState({
      admissionGrade: null,
      examGrade: null,
      recurrenceGrade: null,
      recurrenceMinAdmission: 7,
      hasRecurrenceEpoch: false,
      examChangedAfterRecurrence: false,
    });
    expect(state).toBe('PENDENTE');
    expect(reason).toContain('Frequência incompleta');
  });

  it('admissão arredondada ≥ 14 → DISPENSADO (13.5 conta como 14)', () => {
    for (const admissionGrade of [13.5, 14, 20]) {
      const { state } = computeAcademicState({
        admissionGrade,
        examGrade: null,
        recurrenceGrade: null,
        recurrenceMinAdmission: 7,
        hasRecurrenceEpoch: false,
        examChangedAfterRecurrence: false,
      });
      expect(state).toBe('DISPENSADO');
    }
  });

  it('admissão < 10 → EXCLUIDO', () => {
    const { state, reason } = computeAcademicState({
      admissionGrade: 9.4,
      examGrade: null,
      recurrenceGrade: null,
      recurrenceMinAdmission: 7,
      hasRecurrenceEpoch: false,
      examChangedAfterRecurrence: false,
    });
    expect(state).toBe('EXCLUIDO');
    expect(reason).toContain('Frequência abaixo de 10');
  });

  it('admissão 10–13 sem exame → ADMITIDO_AO_EXAME', () => {
    const { state } = computeAcademicState({
      admissionGrade: 12,
      examGrade: null,
      recurrenceGrade: null,
      recurrenceMinAdmission: 7,
      hasRecurrenceEpoch: false,
      examChangedAfterRecurrence: false,
    });
    expect(state).toBe('ADMITIDO_AO_EXAME');
  });

  it('(admissão + exame) / 2 ≥ 10 → APROVADO_EXAME', () => {
    const { state } = computeAcademicState({
      admissionGrade: 10,
      examGrade: 16,
      recurrenceGrade: null,
      recurrenceMinAdmission: 7,
      hasRecurrenceEpoch: true,
      examChangedAfterRecurrence: false,
    });
    expect(state).toBe('APROVADO_EXAME');
  });

  it('exame reprovado sem época de recorrência → REPROVADO_EXAME', () => {
    const { state } = computeAcademicState({
      admissionGrade: 10,
      examGrade: 8,
      recurrenceGrade: null,
      recurrenceMinAdmission: 7,
      hasRecurrenceEpoch: false,
      examChangedAfterRecurrence: false,
    });
    expect(state).toBe('REPROVADO_EXAME');
  });

  it('exame reprovado com época aberta e admissão ≥ mínimo → ADMITIDO_RECORRENCIA', () => {
    const { state } = computeAcademicState({
      admissionGrade: 10,
      examGrade: 8,
      recurrenceGrade: null,
      recurrenceMinAdmission: 7,
      hasRecurrenceEpoch: true,
      examChangedAfterRecurrence: false,
    });
    expect(state).toBe('ADMITIDO_RECORRENCIA');
  });

  it('admissão abaixo do mínimo configurado → NAO_ELEGIVEL_RECORRENCIA', () => {
    const { state, reason } = computeAcademicState({
      admissionGrade: 10,
      examGrade: 8,
      recurrenceGrade: null,
      recurrenceMinAdmission: 12,
      hasRecurrenceEpoch: true,
      examChangedAfterRecurrence: false,
    });
    expect(state).toBe('NAO_ELEGIVEL_RECORRENCIA');
    expect(reason).toContain('12');
  });

  it('sem mínimo configurado aplica o default documentado e sinaliza', () => {
    const eligible = computeAcademicState({
      admissionGrade: 10,
      examGrade: 8,
      recurrenceGrade: null,
      recurrenceMinAdmission: null,
      hasRecurrenceEpoch: true,
      examChangedAfterRecurrence: false,
    });
    expect(eligible.state).toBe('ADMITIDO_RECORRENCIA');
    expect(eligible.reason).toContain('não configurados');

    // Frequência < 10 nunca chega à recorrência: é excluída antes (regra de admissão).
    const excluded = computeAcademicState({
      admissionGrade: DEFAULT_RECURRENCE_MIN - 0.1,
      examGrade: 8,
      recurrenceGrade: null,
      recurrenceMinAdmission: null,
      hasRecurrenceEpoch: true,
      examChangedAfterRecurrence: false,
    });
    expect(excluded.state).toBe('EXCLUIDO');
  });

  it('(admissão + recorrência) / 2 decide APROVADO/REPROVADO_RECORRENCIA', () => {
    const approved = computeAcademicState({
      admissionGrade: 10,
      examGrade: 8,
      recurrenceGrade: 16,
      recurrenceMinAdmission: 7,
      hasRecurrenceEpoch: true,
      examChangedAfterRecurrence: false,
    });
    expect(approved.state).toBe('APROVADO_RECORRENCIA');

    const failed = computeAcademicState({
      admissionGrade: 10,
      examGrade: 8,
      recurrenceGrade: 6,
      recurrenceMinAdmission: 7,
      hasRecurrenceEpoch: true,
      examChangedAfterRecurrence: false,
    });
    expect(failed.state).toBe('REPROVADO_RECORRENCIA');
  });

  it('exame alterado depois da recorrência → RECORRENCIA_EM_REVISAO (cenário 5)', () => {
    const { state, reason } = computeAcademicState({
      admissionGrade: 10,
      examGrade: 12,
      recurrenceGrade: 16,
      recurrenceMinAdmission: 7,
      hasRecurrenceEpoch: true,
      examChangedAfterRecurrence: true,
    });
    expect(state).toBe('RECORRENCIA_EM_REVISAO');
    expect(reason).toContain('alterada');
  });
});

describe('assertGradeAllowedForState — guarda de lançamento por estado', () => {
  it('dispensados e excluidos não recebem nota de exame', () => {
    expect(() => assertGradeAllowedForState('EXAM', 'DISPENSADO')).toThrow(/dispensado/i);
    expect(() => assertGradeAllowedForState('EXAM', 'EXCLUIDO')).toThrow(/não admitido/);
  });

  it('estudantes pendentes ou admitidos ao exame não recebem recorrência', () => {
    expect(() => assertGradeAllowedForState('RECURRENCE', 'PENDENTE')).toThrow(/Aguarda exame normal/);
    expect(() => assertGradeAllowedForState('RECURRENCE', 'ADMITIDO_AO_EXAME')).toThrow(/Aguarda exame normal/);
    expect(() => assertGradeAllowedForState('RECURRENCE', 'APROVADO_EXAME')).toThrow(/não necessita/);
  });

  it('quem está no processo de recorrência pode receber nota de recorrência', () => {
    expect(() => assertGradeAllowedForState('RECURRENCE', 'ADMITIDO_RECORRENCIA')).not.toThrow();
    expect(() => assertGradeAllowedForState('RECURRENCE', 'RECORRENCIA_EM_REVISAO')).not.toThrow();
    expect(() => assertGradeAllowedForState('EXAM', 'ADMITIDO_RECORRENCIA')).not.toThrow();
  });

  it('avaliações contínuas nunca são bloqueadas pela máquina de estados', () => {
    expect(() => assertGradeAllowedForState('TEST', 'DISPENSADO')).not.toThrow();
    expect(() => assertGradeAllowedForState('ASSIGNMENT', 'EXCLUIDO')).not.toThrow();
  });
});

describe('computeSubjectFinalResult — estado calculado no motor', () => {
  it('devolve state, stateReason e recurrenceEligible junto do resultado final', () => {
    const recurrenceEpoch: SubjectAssessmentForFinal = {
      id: 'rec-epoch',
      title: 'rec-epoch',
      type: 'RECURRENCE',
      weight: 5,
      grades: [],
    };
    const result = computeSubjectFinalResult(
      [continuous(50, 50), continuous(50, 50, 'c2'), exam(40), recurrenceEpoch],
      S,
      2,
      7,
    );
    expect(result.complete).toBe(true);
    expect(result.admissionPercent).toBe(50);
    expect(result.state).toBe('ADMITIDO_RECORRENCIA');
    expect(result.recurrenceEligible).toBe(true);
    // Aguarda recorrência: a média do exame é provisória, sem nota final.
    expect(result.finalGrade).toBeNull();
    expect(result.finalPercent).toBeNull();
  });

  it('nota de recorrência substitui o exame no resultado final', () => {
    const result = computeSubjectFinalResult(
      [continuous(50, 50), continuous(50, 50, 'c2'), exam(40), recurrence(80)],
      S,
      2,
      7,
    );
    expect(result.state).toBe('APROVADO_RECORRENCIA');
    expect(result.finalGrade).toBe(13);
    expect(result.recurrencePercent).toBe(80);
    expect(result.examPercent).toBe(40);
  });

  it('dispensa calculada pela frequência (≥ 14) sem exame', () => {
    const result = computeSubjectFinalResult([continuous(80, 50), continuous(80, 50, 'c2')], S, 2, 7);
    expect(result.state).toBe('DISPENSADO');
    expect(result.finalGrade).toBe(16);
  });
});
