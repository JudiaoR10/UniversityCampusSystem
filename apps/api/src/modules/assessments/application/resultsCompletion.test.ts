import { describe, expect, it } from 'vitest';
import { computeSubjectFinalResult, computeSituationsByStudent, type SubjectAssessmentForFinal } from './assessmentService.js';

const student = 'student';
const test = (id: string, value: number | null): SubjectAssessmentForFinal => ({
  id, title: id, type: 'TEST', weight: 50,
  grades: value === null ? [] : [{ studentId: student, value, valuePercent: value * 5 }],
});

describe('Resultados só depois de todas as notas', () => {
  it('não apresenta situação nem nota final enquanto falta uma avaliação, mesmo atingindo o número mínimo', () => {
    const assessments = [test('a', 18), test('b', null)];
    const result = computeSubjectFinalResult(assessments, student, 1);
    expect(result).toMatchObject({ complete: false, status: null, finalGrade: null, state: 'PENDENTE' });
    expect(computeSituationsByStudent(assessments, [student], 1).get(student)).toBeNull();
  });

  it('não antecipa uma dispensa manual antiga se ainda faltam notas', () => {
    const result = computeSubjectFinalResult([test('a', 18), test('b', null)], student, 1, 7, true, 19);
    expect(result).toMatchObject({ complete: false, status: null, finalGrade: null, state: 'PENDENTE' });
  });

  it('considera zero uma nota lançada', () => {
    expect(computeSubjectFinalResult([test('a', 0), test('b', 0)], student, 2)).toMatchObject({ complete: true, state: 'EXCLUIDO' });
  });

  it('um exame isolado não substitui a frequência', () => {
    const result = computeSubjectFinalResult([{ ...test('exame', 18), type: 'EXAM' }], student, 1);
    expect(result).toMatchObject({ complete: false, status: null, state: 'PENDENTE' });
  });

  it('usa o mínimo de dispensa escolhido pelo docente nos resultados e na pauta', () => {
    const assessments = [test('a', 15), test('b', 15)];
    expect(computeSubjectFinalResult(assessments, student, 2, 7, false, null, 16)).toMatchObject({
      complete: true, state: 'ADMITIDO_AO_EXAME', status: 'ADMITIDO_AO_EXAME', finalGrade: null,
    });
    expect(computeSituationsByStudent(assessments, [student], 2, 16).get(student)).toBe('ADMITIDO_AO_EXAME');
    expect(computeSubjectFinalResult(assessments, student, 2, 7, false, null, 15)).toMatchObject({ state: 'DISPENSADO', finalGrade: 15 });
  });

  it('respeita um mínimo escolhido inferior ao padrão e mantém a negativa como impedimento', () => {
    const assessments = [test('a', 12), test('b', 12)];
    expect(computeSubjectFinalResult(assessments, student, 2, 7, false, null, 12).state).toBe('DISPENSADO');
    assessments[0].grades[0].everNegative = true;
    expect(computeSubjectFinalResult(assessments, student, 2, 7, false, null, 12).state).toBe('ADMITIDO_AO_EXAME');
  });
});
