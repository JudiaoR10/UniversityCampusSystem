import { describe, expect, it } from 'vitest';
import {
  classifySituacao,
  computeSituationsByStudent,
  computeSubjectFinalResult,
  type SubjectAssessmentForFinal,
} from './assessmentService.js';

const S = 'student-1';

function continuous(
  valuePercent: number,
  weight: number,
  id = `c-${valuePercent}-${weight}`,
): SubjectAssessmentForFinal {
  return { id, title: id, type: 'TEST', weight, grades: [{ studentId: S, value: valuePercent, valuePercent }] };
}

function exam(valuePercent: number, weight = 50, id = 'exam'): SubjectAssessmentForFinal {
  return { id, title: id, type: 'EXAM', weight, grades: [{ studentId: S, value: valuePercent, valuePercent }] };
}

describe('classifySituacao — limiares institucionais (nota inteira 0–20)', () => {
  it('nota <= 9 → EXCLUIDO', () => {
    expect(classifySituacao(0)).toBe('EXCLUIDO');
    expect(classifySituacao(9)).toBe('EXCLUIDO');
  });

  it('9.5 arredonda para 10 → APROVADO; 13 → APROVADO', () => {
    expect(classifySituacao(10)).toBe('APROVADO');
    expect(classifySituacao(13)).toBe('APROVADO');
  });

  it('13.5 arredonda para 14 → DISPENSADO; 20 → DISPENSADO', () => {
    expect(classifySituacao(14)).toBe('DISPENSADO');
    expect(classifySituacao(20)).toBe('DISPENSADO');
  });
});

describe('computeSubjectFinalResult — admissão sem exame', () => {
  it('incompleto quando falta nota de uma avaliação contínua', () => {
    const complete = computeSubjectFinalResult([continuous(80, 50), continuous(70, 50, 'c2')], S);
    const partial = computeSubjectFinalResult(
      [{ ...continuous(80, 50), grades: [] }, continuous(70, 50, 'c2')],
      S,
    );
    expect(complete.complete).toBe(true);
    expect(partial.complete).toBe(false);
    expect(partial.finalGrade).toBeNull();
  });

  it('soma ponderada e divisão: 60% (peso 25) + 100% (peso 75) → 90% → nota 18 → DISPENSADO', () => {
    const r = computeSubjectFinalResult([continuous(60, 25), continuous(100, 75, 'c2')], S);
    expect(r.admissionPercent).toBe(90);
    expect(r.finalPercent).toBe(90);
    expect(r.finalGrade).toBe(18);
    expect(r.status).toBe('DISPENSADO');
    expect(r.examPercent).toBeNull();
  });

  it('pesos contínuos abaixo de 100%: nota lançada mas resultado/em aberto (sem situação)', () => {
    const r = computeSubjectFinalResult([continuous(80, 40)], S);
    expect(r.complete).toBe(false);
    expect(r.finalGrade).toBeNull();
    expect(r.status).toBeNull();
    expect(computeSituationsByStudent([{ id: 'a1', type: 'TEST', weight: 40, grades: [{ studentId: S, valuePercent: 80 }] }], [S]).get(S)).toBeNull();
  });

  it('casos-limite de classificação: 18.75% → nota 4 EXCLUIDO; 47.5% → nota 10 APROVADO; 65% → 13 APROVADO; 67.5% → 14 DISPENSADO', () => {
    expect(computeSubjectFinalResult([continuous(18.75, 100)], S).status).toBe('EXCLUIDO');
    expect(computeSubjectFinalResult([continuous(47.5, 100)], S).finalGrade).toBeNull();
    expect(computeSubjectFinalResult([continuous(47.5, 100)], S).status).toBe('APROVADO');
    expect(computeSubjectFinalResult([continuous(65, 100)], S).finalGrade).toBeNull();
    expect(computeSubjectFinalResult([continuous(65, 100)], S).status).toBe('APROVADO');
    expect(computeSubjectFinalResult([continuous(67.5, 100)], S).finalGrade).toBe(14);
    expect(computeSubjectFinalResult([continuous(67.5, 100)], S).status).toBe('DISPENSADO');
  });
});

describe('computeSubjectFinalResult — com exame: (admissão + exame) / 2', () => {
  it('admissão 10 (50%) + exame 16 (80%) → (50+80)/2 = 65% → nota 13 → APROVADO', () => {
    const r = computeSubjectFinalResult([continuous(50, 100), exam(80)], S);
    expect(r.admissionPercent).toBe(50);
    expect(r.examPercent).toBe(80);
    expect(r.finalPercent).toBe(65);
    expect(r.finalGrade).toBe(13);
    expect(r.status).toBe('APROVADO');
  });

  it('admissão 8 (40%) + exame 10 (50%) → 45% → nota 9 → EXCLUIDO', () => {
    const r = computeSubjectFinalResult([continuous(40, 100), exam(50)], S);
    expect(r.finalPercent).toBe(45);
    expect(r.finalGrade).toBe(9);
    expect(r.status).toBe('EXCLUIDO');
  });

  it('sem nota de exame lançada, o resultado é só a admissão', () => {
    const r = computeSubjectFinalResult([continuous(80, 100), { ...exam(0), grades: [] }], S);
    expect(r.examPercent).toBeNull();
    expect(r.finalGrade).toBe(16);
    expect(r.status).toBe('DISPENSADO');
  });

  it('recorrência substitui o exame quando ambas têm nota', () => {
    const recurrence: SubjectAssessmentForFinal = {
      id: 'rec',
      title: 'rec',
      type: 'RECURRENCE',
      weight: 50,
      grades: [{ studentId: S, value: 100, valuePercent: 100 }],
    };
    const r = computeSubjectFinalResult([continuous(40, 100), exam(20), recurrence], S);
    expect(r.examPercent).toBe(20);
    expect(r.recurrencePercent).toBe(100);
    expect(r.finalPercent).toBe(70);
    expect(r.finalGrade).toBe(14);
    expect(r.status).toBe('DISPENSADO');
  });
});

describe('computeSituationsByStudent — bloqueio de exame a dispensados', () => {
  it('estudante com média contínua completa é classificado; incompleto fica null', () => {
    const assessments = [
      { id: 'a1', type: 'TEST', weight: 50, grades: [{ studentId: S, valuePercent: 80 }] },
      { id: 'a2', type: 'TEST', weight: 50, grades: [{ studentId: S, valuePercent: 80 }] },
      { id: 'a3', type: 'TEST', weight: 30, grades: [] },
    ];
    const partial = computeSituationsByStudent(assessments.slice(0, 2), [S]);
    expect(partial.get(S)).toBe('DISPENSADO');
    const incomplete = computeSituationsByStudent(assessments, [S]);
    expect(incomplete.get(S)).toBeNull();
  });

  it('EXAM/RECURRENCE não contam para a definição de completo', () => {
    const assessments = [
      { id: 'a1', type: 'TEST', weight: 100, grades: [{ studentId: S, valuePercent: 20 }] },
      { id: 'e1', type: 'EXAM', weight: 10, grades: [{ studentId: S, valuePercent: 100 }] },
    ];
    const situacoes = computeSituationsByStudent(assessments, [S]);
    // 20% → nota 4 → EXCLUIDO (o exame de 100% não mistura aqui)
    expect(situacoes.get(S)).toBe('EXCLUIDO');
  });

  it('pesos contínuos abaixo de 100%: primeira nota lançada não classifica (fica em aberto)', () => {
    const situacoes = computeSituationsByStudent(
      [{ id: 'a1', type: 'TEST', weight: 40, grades: [{ studentId: S, valuePercent: 90 }] }],
      [S],
    );
    expect(situacoes.get(S)).toBeNull();
  });
});

describe('regra do número de testes definida pelo docente', () => {
  it('com requiredTestCount=2: 1 teste lançado → em aberto; 2 lançados → classificado', () => {
    const one = computeSituationsByStudent(
      [
        { id: 'a1', type: 'TEST', weight: 50, grades: [{ studentId: S, valuePercent: 80 }] },
        { id: 'a2', type: 'TEST', weight: 50, grades: [] },
      ],
      [S],
      2,
    );
    expect(one.get(S)).toBeNull();

    const two = computeSituationsByStudent(
      [
        { id: 'a1', type: 'TEST', weight: 50, grades: [{ studentId: S, valuePercent: 80 }] },
        { id: 'a2', type: 'TEST', weight: 50, grades: [{ studentId: S, valuePercent: 80 }] },
      ],
      [S],
      2,
    );
    expect(two.get(S)).toBe('DISPENSADO');
  });

  it('requiredTestCount substitui a regra dos 100% dos pesos quando definido', () => {
    // Pesos só somam 40% mas o docente definiu 1 teste → basta 1 nota.
    const situacoes = computeSituationsByStudent(
      [{ id: 'a1', type: 'TEST', weight: 40, grades: [{ studentId: S, valuePercent: 90 }] }],
      [S],
      1,
    );
    expect(situacoes.get(S)).toBe('DISPENSADO');
  });

  it('requiredTestCount=null volta à regra dos 100% dos pesos', () => {
    const situacoes = computeSituationsByStudent(
      [{ id: 'a1', type: 'TEST', weight: 40, grades: [{ studentId: S, valuePercent: 90 }] }],
      [S],
      null,
    );
    expect(situacoes.get(S)).toBeNull();
  });

  it('computeSubjectFinalResult respeita requiredTestCount', () => {
    const open = computeSubjectFinalResult(
      [
        { id: 'a1', title: 'a1', type: 'TEST', weight: 50, grades: [{ studentId: S, value: 16, valuePercent: 80 }] },
        { id: 'a2', title: 'a2', type: 'TEST', weight: 50, grades: [] },
      ],
      S,
      2,
    );
    expect(open.complete).toBe(false);
    expect(open.status).toBeNull();

    const done = computeSubjectFinalResult(
      [
        { id: 'a1', title: 'a1', type: 'TEST', weight: 50, grades: [{ studentId: S, value: 16, valuePercent: 80 }] },
        { id: 'a2', title: 'a2', type: 'TEST', weight: 50, grades: [{ studentId: S, value: 16, valuePercent: 80 }] },
      ],
      S,
      2,
    );
    expect(done.complete).toBe(true);
    expect(done.status).toBe('DISPENSADO');
  });
});
