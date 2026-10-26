import type { AcademicState, SituacaoAcademica } from '@smart-campus/shared-types';
import type { CreateAssessmentInput, UpdateAssessmentInput, UpsertGradesInput } from '@smart-campus/validation';
import { AppError, conflict, forbidden, notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';

export type Actor = { id: string; role: string };

/** Tipos de avaliação que só fazem sentido fora do ciclo contínuo (exame/recorrência). */
export const EXAM_ASSESSMENT_TYPES = ['EXAM', 'RECURRENCE'];

type AssessmentRecord = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  gradingMode: string;
  maxScore: number;
  weight: number;
  date: Date | null;
  subjectId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

const STAFF_ROLES = ['TEACHER', 'COORDINATOR', 'ADMIN'];

export function normalizeGradeValue(value: number, gradingMode: string, maxScore: number): number {
  let percent: number;
  if (gradingMode === 'POINTS') {
    percent = (value / maxScore) * 100;
  } else {
    percent = (value / 20) * 100;
  }
  return Math.round(percent * 100) / 100;
}

export function assertGradeValueInRange(value: number, gradingMode: string, maxScore: number) {
  const invalid =
    (gradingMode === 'PERCENTAGE' && (value < 0 || value > 20)) ||
    (gradingMode === 'POINTS' && (value < 0 || value > maxScore)) ||
    (gradingMode === 'SCALE' && (value < 0 || value > 20));  if (invalid) {
    const range =
      gradingMode === 'PERCENTAGE' ? '0 a 20' : gradingMode === 'POINTS' ? `0 a ${maxScore} (pontos)` : '0 a 20';
    throw new AppError('INVALID_GRADE_VALUE', `Nota fora do intervalo permitido para o modo ${gradingMode}: ${range}`, 400);
  }
}

/**
 * Regra de posse (anti-BOLA): ADMIN e COORDINATOR actuam sobre qualquer
 * avaliação; o docente (TEACHER) apenas sobre as avaliações que criou.
 * Violações devolvem sempre 403 FORBIDDEN (escolha documentada em
 * docs/avaliacoes-rbac-e-testes.md e usada de forma consistente no módulo).
 */
export function assertCanManageAssessment(assessment: AssessmentRecord, actor: Actor) {
  if (actor.role === 'ADMIN' || actor.role === 'COORDINATOR') return;
  if (actor.role === 'TEACHER' && assessment.createdById === actor.id) return;
  throw forbidden('Avaliação pertence a outro utilizador', 'FORBIDDEN');
}

/**
 * Regra de lançamento (decisão do módulo): criar avaliação e lançar notas é
 * exclusivo do docente (TEACHER) da respectiva disciplina. A ligação
 * docente↔disciplina é feita por ClassSchedule.teacherId + subjectId.
 * COORDINATOR/ADMIN mantêm leitura e edição de metadados, mas não lançam notas.
 */
export async function assertTeacherTeachesSubject(subjectId: string, actor: Actor) {
  if (actor.role !== 'TEACHER') {
    throw forbidden('Criação de avaliações e lançamento de notas é exclusivo do docente da disciplina', 'FORBIDDEN');
  }
  const schedule = await prisma.classSchedule.findFirst({
    where: { subjectId, teacherId: actor.id },
    select: { id: true },
  });
  if (!schedule) {
    throw forbidden('Docente não está atribuído a esta disciplina', 'FORBIDDEN');
  }
}

/** Classificação a partir da nota inteira final (escala 0–20). */
export function classifySituacao(finalGrade: number, hasExam?: boolean, examComplete?: boolean): SituacaoAcademica {
  if (finalGrade <= 9) return 'EXCLUIDO';
  if (finalGrade <= 13) return 'APROVADO';
  if (!hasExam && finalGrade >= 14) return 'DISPENSADO';
  if (hasExam && examComplete) return 'DISPENSADO';
  if (hasExam && !examComplete) return 'ADMITIDO_AO_EXAME';
  return 'DISPENSADO';
}

/**
 * Nota mínima de admissão (0–20) para recorrência quando a disciplina ainda
 * não tem regra configurada. É um default documentado, sinalizado na API
 * (`rulesConfigured: false`) e bloqueia a publicação de resultados.
 */
export const DEFAULT_RECURRENCE_MIN = 7;

export type AcademicStateInput = {
  /** Nota de admissão/frequência (0–20), null quando a média não está completa. */
  admissionGrade: number | null;
  /** Nota do exame normal (0–20), null quando não lançada. */
  examGrade: number | null;
  /** Nota de recorrência (0–20), null quando não lançada. */
  recurrenceGrade: number | null;
  /** Mínimo de admissão para recorrer (0–20); null = regra não configurada. */
  recurrenceMinAdmission: number | null;
  /** Existe época de recorrência (avaliação RECURRENCE criada)? */
  hasRecurrenceEpoch: boolean;
  /** A nota de exame foi alterada depois de lançada a recorrência (cenário 5). */
  examChangedAfterRecurrence: boolean;
};

/**
 * Máquina de estados académicos — função pura, única fonte de verdade do
 * módulo (o frontend nunca decide aprovações).
 */
export function computeAcademicState(input: AcademicStateInput): { state: AcademicState; reason: string | null } {
  const { admissionGrade, examGrade, recurrenceGrade, hasRecurrenceEpoch } = input;

  // 1. Sem frequência completa não há situação a determinar.
  if (admissionGrade === null) {
    return { state: 'PENDENTE', reason: 'Frequência incompleta — faltam notas das avaliações contínuas' };
  }

  const admissionRounded = Math.round(admissionGrade);

  // 2. Dispensa: frequência na banda >= 14 não faz exame nem recorrência.
  if (admissionRounded >= 14) {
    return { state: 'DISPENSADO', reason: null };
  }

  // 3. Frequência insuficiente: não é admitido ao exame normal.
  if (admissionRounded < 10) {
    return { state: 'EXCLUIDO', reason: 'Frequência abaixo de 10 — não admitido ao exame normal' };
  }

  // 4. Ainda não realizou (ou não foi lançado) o exame normal.
  if (examGrade === null) {
    return { state: 'ADMITIDO_AO_EXAME', reason: null };
  }

  // 5. Recorrência lançada — substitui o exame normal no resultado.
  if (recurrenceGrade !== null) {
    if (input.examChangedAfterRecurrence) {
      return {
        state: 'RECORRENCIA_EM_REVISAO',
        reason: 'A nota do exame normal foi alterada depois da recorrência — resultado em revisão',
      };
    }
    const final = Math.round((admissionGrade + recurrenceGrade) / 2);
    return { state: final >= 10 ? 'APROVADO_RECORRENCIA' : 'REPROVADO_RECORRENCIA', reason: null };
  }

  // 6. Resultado do exame normal.
  const finalWithExam = Math.round((admissionGrade + examGrade) / 2);
  if (finalWithExam >= 10) {
    return { state: 'APROVADO_EXAME', reason: null };
  }

  // Reprovou no exame: avalia elegibilidade para a recorrência.
  if (!hasRecurrenceEpoch) {
    return { state: 'REPROVADO_EXAME', reason: 'Sem época de recorrência aberta nesta disciplina' };
  }

  const min = input.recurrenceMinAdmission ?? DEFAULT_RECURRENCE_MIN;
  if (admissionGrade < min) {
    return {
      state: 'NAO_ELEGIVEL_RECORRENCIA',
      reason:
        input.recurrenceMinAdmission === null
          ? `Critérios de recorrência não configurados (mínimo padrão ${min}) e frequência abaixo desse mínimo`
          : `Frequência ${admissionGrade.toFixed(2)} abaixo do mínimo ${min} para recorrência`,
    };
  }

  return {
    state: 'ADMITIDO_RECORRENCIA',
    reason:
      input.recurrenceMinAdmission === null
        ? `Critérios de recorrência não configurados — aplicado o mínimo padrão ${min}`
        : null,
  };
}

/**
 * Guardas de lançamento de notas por estado (backend é a única autoridade):
 * - EXAM:  dispensados e excluidos (frequência < 10) não realizam exame;
 * - RECURRENCE: só quem está no processo de recorrência (reprovou no exame e é
 *   elegível, ou já tem nota de recorrência a corrigir).
 */
export function assertGradeAllowedForState(assessmentType: string, state: AcademicState | null) {
  if (!EXAM_ASSESSMENT_TYPES.includes(assessmentType) || state === null) return;

  if (assessmentType === 'EXAM') {
    if (state === 'DISPENSADO') {
      throw conflict('STUDENT_DISPENSADO', 'Estudante dispensado: não é permitido lançar nota de exame ou recorrência');
    }
    if (state === 'EXCLUIDO') {
      throw conflict('STUDENT_NAO_ADMITIDO_EXAME', 'Estudante não admitido ao exame normal (frequência insuficiente)');
    }
    return;
  }

  // RECURRENCE
  switch (state) {
    case 'DISPENSADO':
      throw conflict('STUDENT_DISPENSADO', 'Estudante dispensado: não é permitido lançar nota de exame ou recorrência');
    case 'EXCLUIDO':
      throw conflict('STUDENT_NAO_ADMITIDO_EXAME', 'Estudante não admitido ao exame normal (frequência insuficiente)');
    case 'PENDENTE':
    case 'ADMITIDO_AO_EXAME':
      throw conflict('EXAM_PENDING', 'Aguarda exame normal — a recorrência só fica disponível após o exame');
    case 'APROVADO_EXAME':
      throw conflict('STUDENT_APROVADO_EXAME', 'Aprovado no exame normal — não necessita de recorrência');
    case 'NAO_ELEGIVEL_RECORRENCIA':
      throw conflict('NOT_ELIGIBLE_FOR_RECURRENCE', 'Estudante não elegível para recorrência');
    case 'REPROVADO_EXAME':
      throw conflict('RECURRENCE_EPOCH_CLOSED', 'Sem época de recorrência aberta nesta disciplina');
    case 'ADMITIDO_RECORRENCIA':
    case 'APROVADO_RECORRENCIA':
    case 'REPROVADO_RECORRENCIA':
    case 'RECORRENCIA_EM_REVISAO':
      return;
    default:
      throw conflict('RECURRENCE_NOT_ALLOWED', 'Situação actual não permite nota de recorrência');
  }
}

type SubjectAssessmentInput = {
  id: string;
  type: string;
  weight: number;
  grades: Array<{ studentId: string; valuePercent: number }>;
};

/**
 * Calcula a situação de cada estudante numa disciplina a partir das
 * avaliações contínuas (EXAM/RECURRENCE ficam de fora).
 *
 * Regra de "completo":
 * - Se o docente definiu `requiredTestCount` para a disciplina: basta que o
 *   estudante tenha nota nesse número de avaliações contínuas.
 * - Se não definiu: exigem-se todas as avaliações contínuas com nota E pesos
 *   a somar 100% (ou mais).
 */
export function computeSituationsByStudent(
  assessments: SubjectAssessmentInput[],
  studentIds: string[],
  requiredTestCount?: number | null,
): Map<string, SituacaoAcademica | null> {
  let base = assessments.filter((a) => !EXAM_ASSESSMENT_TYPES.includes(a.type));
  if (base.length === 0) base = assessments;
  const baseWeight = round2(base.reduce((acc, a) => acc + a.weight, 0));

  const situacoes = new Map<string, SituacaoAcademica | null>();
  for (const studentId of studentIds) {
    const graded = base.filter((a) => a.grades.some((g) => g.studentId === studentId));
    const complete =
      base.length > 0 &&
      (requiredTestCount != null
        ? graded.length >= requiredTestCount
        : graded.length === base.length && baseWeight >= 100);
    if (!complete) {
      situacoes.set(studentId, null);
      continue;
    }
    const totalWeight = graded.reduce((acc, a) => acc + a.weight, 0);
    const weightedSum = graded.reduce((acc, a) => {
      const grade = a.grades.find((g) => g.studentId === studentId)!;
      return acc + grade.valuePercent * a.weight;
    }, 0);
    const grade20 = round2((weightedSum / totalWeight) * 0.2);
    situacoes.set(studentId, classifySituacao(Math.round(grade20)));
  }
  return situacoes;
}

/** Estudante dispensado não pode receber nota de exame nem de recorrência. */
export function assertAssessmentTypeAllowedForStudent(assessmentType: string, situacao: SituacaoAcademica | null) {
  if (!EXAM_ASSESSMENT_TYPES.includes(assessmentType)) return;
  if (situacao === 'DISPENSADO') {
    throw conflict(
      'STUDENT_DISPENSADO',
      'Estudante dispensado: não é permitido lançar nota de exame ou recorrência',
    );
  }
}

export async function loadSituations(subjectId: string, studentIds: string[]): Promise<Map<string, SituacaoAcademica | null>> {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { requiredTestCount: true },
  });
  const subjectAssessments = await prisma.assessment.findMany({
    where: { subjectId },
    include: { grades: { select: { studentId: true, valuePercent: true } } },
  });
  return computeSituationsByStudent(subjectAssessments, studentIds, subject?.requiredTestCount ?? null);
}

/** Carrega disciplina + todas as avaliações (com notas) para calcular estados. */
async function loadSubjectContext(subjectId: string) {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw notFound('SUBJECT_NOT_FOUND', 'Disciplina não encontrada');
  const assessments = await prisma.assessment.findMany({
    where: { subjectId },
    include: { grades: true },
    orderBy: { createdAt: 'asc' },
  });
  return { subject, assessments };
}

/**
 * Dispensas manuais da disciplina (docente/coordenação)— que sobrepõem a regra
 * automática (admissão >= 14) e obrigam ao estado DISPENSADO. O mapa devolve a
 * nota de dispensa (null = usar a admissão).
 */
export async function loadSubjectExemptions(subjectId: string): Promise<Map<string, number | null>> {
  const exemptions = await prisma.subjectExemption.findMany({
    where: { subjectId },
    select: { studentId: true, grade: true },
  });
  return new Map(exemptions.map((e) => [e.studentId, e.grade]));
}

export type SetExemptionInput = {
  studentId: string;
  /** true = dispensar; false = anular a dispensa. */
  exempted: boolean;
  reason?: string | null;
  /** Nota de dispensa (0–20) escolhida pelo docente (obrigatória na prática). */
  grade?: number | null;
};

/**
 * POST /assessments/subject/:subjectId/exemptions — o docente decide livremente
 * quem dispensa, com que nota, e pode anular. Auditar sempre a decisão.
 */
export async function setSubjectExemption(
  subjectId: string,
  input: SetExemptionInput,
  actor: Actor,
  correlationId: string,
) {
  await assertCanManageSubject(subjectId, actor);
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw notFound('SUBJECT_NOT_FOUND', 'Disciplina não encontrada');

  const student = await prisma.studentProfile.findUnique({ where: { id: input.studentId } });
  if (!student) throw notFound('STUDENT_NOT_FOUND', 'Estudante não encontrado');
  if (student.courseId && student.courseId !== subject.courseId) {
    throw conflict('STUDENT_COURSE_MISMATCH', 'Estudante fora do curso da disciplina');
  }

  if (input.grade != null && (input.grade < 0 || input.grade > 20)) {
    throw conflict('INVALID_GRADE_VALUE', 'A nota de dispensa deve estar entre 0 e 20');
  }

  if (input.exempted) {
    await prisma.subjectExemption.upsert({
      where: { subjectId_studentId: { subjectId, studentId: student.id } },
      create: {
        subjectId,
        studentId: student.id,
        exemptedById: actor.id,
        reason: input.reason ?? null,
        grade: input.grade ?? null,
      },
      update: {
        exemptedById: actor.id,
        reason: input.reason ?? null,
        grade: input.grade ?? null,
      },
    });
  } else {
    const deleted = await prisma.subjectExemption.deleteMany({
      where: { subjectId, studentId: student.id },
    });
    if (deleted.count === 0) {
      throw conflict('EXEMPTION_NOT_FOUND', 'Este estudante não tem dispensa nesta disciplina');
    }
  }

  await audit({
    action: input.exempted ? 'SUBJECT_EXEMPTION_SET' : 'SUBJECT_EXEMPTION_REMOVED',
    resource: 'SubjectExemption',
    resourceId: subjectId,
    actorId: actor.id,
    correlationId,
    metadata: {
      subjectId,
      studentId: student.id,
      studentNumber: student.studentNumber,
      reason: input.reason ?? null,
      grade: input.grade ?? null,
    },
  });

  return { subjectId, studentId: student.id, exempted: input.exempted, grade: input.grade ?? null };
}

/**
 * Estado académico detalhado (dispensa/exame normal/recorrência) de cada
 * estudante numa disciplina. Fonte de verdade para a pauta, o roster e o board.
 */
export async function loadAcademicStates(
  subjectId: string,
  studentIds: string[],
): Promise<Map<string, { state: AcademicState | null; reason: string | null }>> {
  const { subject, assessments } = await loadSubjectContext(subjectId);
  const exempted = await loadSubjectExemptions(subjectId);
  const map = new Map<string, { state: AcademicState | null; reason: string | null }>();
  for (const studentId of studentIds) {
    const result = computeSubjectFinalResult(
      assessments,
      studentId,
      subject.requiredTestCount,
      subject.recurrenceMinAdmission,
      exempted.has(studentId),
      exempted.get(studentId) ?? null,
    );
    map.set(studentId, { state: result.state, reason: result.stateReason });
  }
  return map;
}

/**
 * Regra de posse para dados de um estudante (anti-BOLA):
 * - STUDENT: apenas o próprio (id do perfil coincide com o utilizador autenticado);
 * - TEACHER: apenas estudantes cujas notas já lançou;
 * - COORDINATOR/ADMIN: qualquer estudante.
 */
export async function assertStudentDataAccess(studentId: string, actor: Actor) {
  const profile = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!profile) throw notFound('STUDENT_NOT_FOUND', 'Estudante não encontrado');

  if (actor.role === 'ADMIN' || actor.role === 'COORDINATOR') return;

  if (actor.role === 'STUDENT') {
    if (profile.userId !== actor.id) {
      throw forbidden('Um estudante só pode aceder aos seus próprios dados', 'FORBIDDEN');
    }
    return;
  }

  if (actor.role === 'TEACHER') {
    const graded = await prisma.grade.findFirst({ where: { studentId, gradedById: actor.id } });
    if (!graded) {
      throw forbidden('Docente sem relação académica com este estudante', 'FORBIDDEN');
    }
    return;
  }

  throw forbidden('Sem permissão para esta acção', 'FORBIDDEN');
}

function mapAssessment(
  a: AssessmentRecord & {
    subject?: { id: string; code: string; name: string };
    _count?: { grades?: number };
    gradesCount?: number;
  },
) {
  const gradesCount = a.gradesCount ?? a._count?.grades ?? undefined;
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    type: a.type,
    gradingMode: a.gradingMode,
    maxScore: a.maxScore,
    weight: a.weight,
    date: a.date ? a.date.toISOString() : null,
    subjectId: a.subjectId,
    subject: a.subject ? { id: a.subject.id, code: a.subject.code, name: a.subject.name } : undefined,
    createdById: a.createdById,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    hasGrades: gradesCount !== undefined ? gradesCount > 0 : undefined,
    gradesCount,
  };
}

type GradeRecord = {
  id: string;
  assessmentId: string;
  studentId: string;
  value: number;
  valuePercent: number;
  comment: string | null;
  gradedById: string;
  createdAt: Date;
  updatedAt: Date;
  assessment?: { id: string; title: string; type: string; gradingMode: string; maxScore: number; weight: number; subjectId: string };
  student?: { id: string; studentNumber: string; user?: { fullName: string } };
};

function mapGrade(g: GradeRecord) {
  return {
    id: g.id,
    assessmentId: g.assessmentId,
    studentId: g.studentId,
    value: g.value,
    valuePercent: g.valuePercent,
    comment: g.comment,
    gradedById: g.gradedById,
    assessment: g.assessment,
    student: g.student
      ? { id: g.student.id, studentNumber: g.student.studentNumber, fullName: g.student.user?.fullName }
      : undefined,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

export function assertStaff(actor: Actor) {
  if (!STAFF_ROLES.includes(actor.role)) {
    throw forbidden('Apenas docentes, coordenadores ou administradores', 'FORBIDDEN');
  }
}

export async function listAssessments(actor: Actor) {
  if (actor.role === 'STUDENT') {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: actor.id } });
    if (!profile) throw notFound('STUDENT_PROFILE_NOT_FOUND', 'Perfil de estudante não encontrado');
    if (!profile.courseId) return [];
    const assessments = await prisma.assessment.findMany({
      where: { subject: { courseId: profile.courseId } },
      include: { subject: { select: { id: true, code: true, name: true } }, _count: { select: { grades: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return assessments.map(mapAssessment);
  }

  assertStaff(actor);
  const where = actor.role === 'TEACHER' ? { createdById: actor.id } : {};
  const assessments = await prisma.assessment.findMany({
    where,
    include: { subject: { select: { id: true, code: true, name: true } }, _count: { select: { grades: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return assessments.map(mapAssessment);
}

/**
 * GET /assessments/options — disciplinas disponíveis para criar avaliações.
 * TEACHER: apenas as disciplinas que tem atribuídas (ClassSchedule).
 * COORDINATOR/ADMIN: todas (visão de gestão).
 */
export async function listAssessmentOptions(actor: Actor) {
  assertStaff(actor);
  if (actor.role === 'TEACHER') {
    const schedules = await prisma.classSchedule.findMany({
      where: { teacherId: actor.id },
      select: { subjectId: true },
      distinct: ['subjectId'],
    });
    const subjects = await prisma.subject.findMany({
      where: { id: { in: schedules.map((s) => s.subjectId) } },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        courseId: true,
        requiredTestCount: true,
        recurrenceMinAdmission: true,
        resultsPublishedAt: true,
      },
    });
    return { subjects };
  }
  const subjects = await prisma.subject.findMany({
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      courseId: true,
      requiredTestCount: true,
      recurrenceMinAdmission: true,
      resultsPublishedAt: true,
    },
  });
  return { subjects };
}

/**
 * PATCH /assessments/subject/:subjectId/required-test-count — o docente da
 * disciplina define quantos testes o estudante precisa de ter com nota para
 * a situação final aparecer. null volta à regra dos 100% dos pesos.
 */
export async function setSubjectRequiredTestCount(
  subjectId: string,
  requiredTestCount: number | null,
  actor: Actor,
) {
  await assertTeacherTeachesSubject(subjectId, actor);
  const subject = await prisma.subject.update({
    where: { id: subjectId },
    data: { requiredTestCount },
    select: { id: true, code: true, name: true, requiredTestCount: true },
  });
  return subject;
}

/** Quem gere regras/publicação de uma disciplina: docente titular, coordenador ou admin. */
async function assertCanManageSubject(subjectId: string, actor: Actor) {
  if (actor.role === 'COORDINATOR' || actor.role === 'ADMIN') return;
  await assertTeacherTeachesSubject(subjectId, actor);
}

export type SubjectRulesInput = {
  requiredTestCount?: number | null;
  recurrenceMinAdmission?: number | null;
};

/**
 * PATCH /assessments/subject/:subjectId/rules — regras configuráveis da
 * disciplina: nº de testes exigidos e nota mínima de admissão para recorrência.
 */
export async function setSubjectRules(subjectId: string, input: SubjectRulesInput, actor: Actor, correlationId: string) {
  await assertCanManageSubject(subjectId, actor);
  const existing = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!existing) throw notFound('SUBJECT_NOT_FOUND', 'Disciplina não encontrada');
  assertSubjectNotPublished(existing.resultsPublishedAt);

  const data: Record<string, unknown> = {};
  if (input.requiredTestCount !== undefined) data.requiredTestCount = input.requiredTestCount;
  if (input.recurrenceMinAdmission !== undefined) {
    const min = input.recurrenceMinAdmission;
    if (min !== null && (min < 0 || min > 20)) {
      throw new AppError('INVALID_RECURRENCE_MIN', 'O mínimo de admissão para recorrência deve estar entre 0 e 20', 400);
    }
    data.recurrenceMinAdmission = min;
  }
  if (Object.keys(data).length === 0) {
    throw new AppError('NO_CHANGES', 'Nenhum valor para actualizar', 400);
  }

  const subject = await prisma.subject.update({
    where: { id: subjectId },
    data,
    select: {
      id: true,
      code: true,
      name: true,
      requiredTestCount: true,
      recurrenceMinAdmission: true,
      resultsPublishedAt: true,
    },
  });

  await audit({
    action: 'SUBJECT_RULES_UPDATE',
    resource: 'Subject',
    resourceId: subjectId,
    actorId: actor.id,
    correlationId,
    metadata: {
      before: {
        requiredTestCount: existing.requiredTestCount,
        recurrenceMinAdmission: existing.recurrenceMinAdmission,
      },
      after: { requiredTestCount: subject.requiredTestCount, recurrenceMinAdmission: subject.recurrenceMinAdmission },
    },
  });

  return subject;
}

/**
 * POST /assessments/subject/:subjectId/publish — publica ou reabre a pauta.
 * Enquanto publicada, nenhuma nota pode ser alterada (correcções exigem
 * reabertura explícita, registada na auditoria).
 */
export async function setSubjectPublication(subjectId: string, published: boolean, actor: Actor, correlationId: string) {
  await assertCanManageSubject(subjectId, actor);
  const existing = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!existing) throw notFound('SUBJECT_NOT_FOUND', 'Disciplina não encontrada');

  if (published && existing.recurrenceMinAdmission === null) {
    throw conflict(
      'RULES_NOT_CONFIGURED',
      'Configure os critérios de recorrência da disciplina antes de publicar resultados definitivos',
    );
  }

  const subject = await prisma.subject.update({
    where: { id: subjectId },
    data: published
      ? { resultsPublishedAt: new Date(), resultsPublishedById: actor.id }
      : { resultsPublishedAt: null, resultsPublishedById: null },
    select: { id: true, code: true, name: true, resultsPublishedAt: true },
  });

  await audit({
    action: published ? 'RESULTS_PUBLISH' : 'RESULTS_UNPUBLISH',
    resource: 'Subject',
    resourceId: subjectId,
    actorId: actor.id,
    correlationId,
    metadata: { code: subject.code, name: subject.name, published },
  });

  return {
    subjectId: subject.id,
    subjectCode: subject.code,
    subjectName: subject.name,
    published: subject.resultsPublishedAt !== null,
    publishedAt: subject.resultsPublishedAt ? subject.resultsPublishedAt.toISOString() : null,
  };
}

/** Texto de bloqueio do campo de recorrência por estado (alimenta a legenda da UI). */
function recurrenceBlockedReason(state: AcademicState, stateReason: string | null): string | null {
  switch (state) {
    case 'APROVADO_EXAME':
      return '* Aprovado no exame normal — não necessita de recorrência';
    case 'DISPENSADO':
      return 'Dispensado — sem exame/recorrência';
    case 'EXCLUIDO':
      return 'Frequência insuficiente — não admitido ao exame';
    case 'PENDENTE':
      return 'Aguarda frequência';
    case 'ADMITIDO_AO_EXAME':
      return 'Aguarda exame normal';
    case 'REPROVADO_EXAME':
      return 'Sem época de recorrência aberta nesta disciplina';
    case 'NAO_ELEGIVEL_RECORRENCIA':
      return stateReason ?? 'Não elegível para recorrência';
    default:
      return null;
  }
}

/**
 * GET /assessments/subject/:subjectId/board — quadro completo da disciplina
 * para os 4 separadores (Frequência e Dispensa, Exame Normal, Recorrência,
 * Resultados Finais). Estado calculado no backend para todos os estudantes.
 */
export async function getSubjectBoard(subjectId: string, actor: Actor) {
  assertStaff(actor);
  await assertCanManageSubject(subjectId, actor);

  const { subject, assessments } = await loadSubjectContext(subjectId);
  const exemptedStudents = await loadSubjectExemptions(subjectId);

  const students = await prisma.studentProfile.findMany({
    where: { courseId: subject.courseId },
    include: { user: { select: { fullName: true } } },
    orderBy: { studentNumber: 'asc' },
  });

  const examAssessment = assessments.find((a) => a.type === 'EXAM') ?? null;
  const recurrenceAssessment = assessments.find((a) => a.type === 'RECURRENCE') ?? null;
  const continuousAssessments = assessments.filter((a) => !EXAM_ASSESSMENT_TYPES.includes(a.type));
  const base = continuousAssessments.length > 0 ? continuousAssessments : assessments;

  const counters = {
    total: students.length,
    pendentes: 0,
    dispensados: 0,
    excluidos: 0,
    admitidosExame: 0,
    aprovadosExame: 0,
    reprovadosExame: 0,
    admitidosRecorrencia: 0,
    elegiveisRecorrencia: 0,
    aprovadosRecorrencia: 0,
    reprovadosRecorrencia: 0,
    naoElegiveis: 0,
    emRevisao: 0,
  };

  const entries = students.map((student) => {
    const result = computeSubjectFinalResult(
      assessments,
      student.id,
      subject.requiredTestCount,
      subject.recurrenceMinAdmission,
      exemptedStudents.has(student.id),
      exemptedStudents.get(student.id) ?? null,
    );
    const state = result.state;

    const examGrade = examAssessment?.grades.find((g) => g.studentId === student.id) ?? null;
    const recurrenceGrade = recurrenceAssessment?.grades.find((g) => g.studentId === student.id) ?? null;

    const examEditable = state !== 'DISPENSADO' && state !== 'EXCLUIDO';
    const examBlockedReason = state === 'DISPENSADO'
      ? 'Dispensado — sem exame/recorrência'
      : state === 'EXCLUIDO'
        ? 'Frequência insuficiente — não admitido ao exame'
        : null;

    const asterisk = state === 'APROVADO_EXAME';
    const recurrenceEditable = result.recurrenceEligible;
    const blockedReason = recurrenceEditable ? null : recurrenceBlockedReason(state, result.stateReason);

    switch (state) {
      case 'PENDENTE': counters.pendentes++; break;
      case 'DISPENSADO': counters.dispensados++; break;
      case 'ADMITIDO_AO_EXAME': counters.admitidosExame++; break;
      case 'APROVADO_EXAME': counters.aprovadosExame++; break;
      case 'REPROVADO_EXAME': counters.reprovadosExame++; break;
      case 'ADMITIDO_RECORRENCIA': counters.admitidosRecorrencia++; break;
      case 'APROVADO_RECORRENCIA': counters.aprovadosRecorrencia++; break;
      case 'REPROVADO_RECORRENCIA': counters.reprovadosRecorrencia++; break;
      case 'NAO_ELEGIVEL_RECORRENCIA': counters.naoElegiveis++; break;
      case 'RECORRENCIA_EM_REVISAO': counters.emRevisao++; break;
      case 'EXCLUIDO': counters.excluidos++; break;
    }
    if (result.recurrenceEligible) counters.elegiveisRecorrencia++;

    return {
      studentProfileId: student.id,
      studentNumber: student.studentNumber,
      fullName: student.user?.fullName ?? null,
      /** true quando o docente dispensou este estudante na disciplina. */
      exempted: exemptedStudents.has(student.id),
      /** Nota de dispensa escolhida pelo docente (null = usa a admissão). */
      exemptionGrade: exemptedStudents.get(student.id) ?? null,
      continuous: base.map((a) => ({
        assessmentId: a.id,
        title: a.title,
        weight: a.weight,
        value: a.grades.find((g) => g.studentId === student.id)?.value ?? null,
      })),
      admissionGrade: result.admissionPercent !== null ? Math.round(result.admissionPercent * 0.2) : null,
      admissionPercent: result.admissionPercent,
      complete: result.complete,
      state,
      stateReason: result.stateReason,
      status: result.status,
      exam: {
        assessmentId: examAssessment?.id ?? null,
        grade: examGrade?.value ?? null,
        valuePercent: examGrade?.valuePercent ?? null,
        comment: examGrade?.comment ?? null,
        editable: examEditable,
        blockedReason: examBlockedReason,
      },
      recurrence: {
        assessmentId: recurrenceAssessment?.id ?? null,
        grade: recurrenceGrade?.value ?? null,
        valuePercent: recurrenceGrade?.valuePercent ?? null,
        comment: recurrenceGrade?.comment ?? null,
        asterisk,
        editable: recurrenceEditable,
        blockedReason: blockedReason,
      },
      finalGrade: result.finalGrade,
      finalPercent: result.finalPercent,
    };
  });

  const mapEpoch = (a: { id: string; title: string; gradingMode: string; maxScore: number } | null) =>
    a ? { id: a.id, title: a.title, gradingMode: a.gradingMode as any, maxScore: a.maxScore } : null;

  return {
    rules: {
      subjectId: subject.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      requiredTestCount: subject.requiredTestCount,
      recurrenceMinAdmission: subject.recurrenceMinAdmission,
      rulesConfigured: subject.recurrenceMinAdmission !== null,
      published: subject.resultsPublishedAt !== null,
      publishedAt: subject.resultsPublishedAt ? subject.resultsPublishedAt.toISOString() : null,
      hasExamEpoch: examAssessment !== null,
      hasRecurrenceEpoch: recurrenceAssessment !== null,
    },
    examAssessment: mapEpoch(examAssessment),
    recurrenceAssessment: mapEpoch(recurrenceAssessment),
    counters,
    entries,
  };
}

/**
 * GET /assessments/:id/roster — estudantes do curso da disciplina com a nota atual
 * (para lançamento de notas em bloco). Só a quem pode gerir a avaliação.
 */
export async function getAssessmentRoster(id: string, actor: Actor) {
  assertStaff(actor);
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { subject: { select: { id: true, code: true, name: true, courseId: true } } },
  });
  if (!assessment) throw notFound('ASSESSMENT_NOT_FOUND', 'Avaliação não encontrada');
  assertCanManageAssessment(assessment, actor);

  const students = await prisma.studentProfile.findMany({
    where: { courseId: assessment.subject.courseId },
    include: { user: { select: { fullName: true } } },
    orderBy: { studentNumber: 'asc' },
  });

  const grades = await prisma.grade.findMany({ where: { assessmentId: id } });
  const byStudent = new Map(grades.map((g) => [g.studentId, g]));

  const situacoes = await loadSituations(
    assessment.subjectId,
    students.map((s) => s.id),
  );
  const states = await loadAcademicStates(
    assessment.subjectId,
    students.map((s) => s.id),
  );

  return {
    assessment: mapAssessment(assessment),
    entries: students.map((student) => {
      const grade = byStudent.get(student.id);
      return {
        studentProfileId: student.id,
        studentNumber: student.studentNumber,
        fullName: student.user?.fullName,
        value: grade?.value ?? null,
        valuePercent: grade?.valuePercent ?? null,
        comment: grade?.comment ?? null,
        situacao: situacoes.get(student.id) ?? null,
        state: states.get(student.id)?.state ?? null,
      };
    }),
  };
}

export async function getAssessment(id: string, actor: Actor) {
  assertStaff(actor);
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { subject: { select: { id: true, code: true, name: true } } },
  });
  if (!assessment) throw notFound('ASSESSMENT_NOT_FOUND', 'Avaliação não encontrada');
  assertCanManageAssessment(assessment, actor);
  return mapAssessment(assessment);
}

export async function createAssessment(input: CreateAssessmentInput, actor: Actor, correlationId: string) {
  const subjectId = input.subjectId as string;
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw notFound('SUBJECT_NOT_FOUND', 'Disciplina não encontrada');
  await assertTeacherTeachesSubject(subjectId, actor);
  assertSubjectNotPublished(subject.resultsPublishedAt);

  const type = (input.type ?? 'TEST') as any;
  const isExam = type === 'EXAM' || type === 'RECURRENCE';
  const weight = (input.weight ?? 1) as number;
  if (!isExam && weight > 100) {
    throw conflict('WEIGHT_EXCEEDED', 'O peso das avaliações contínuas não pode exceder 100%');
  }
  const assessment = await prisma.assessment.create({
    data: {
      title: (input.title ?? '') as any,
      description: (input.description ?? null) as any,
      type: type,
      gradingMode: (input.gradingMode ?? 'PERCENTAGE') as any,
      maxScore: (input.maxScore ?? 20) as any,
      weight: weight as any,
      date: (input.date === undefined ? null : input.date) as any,
      subjectId: subjectId as any,
      createdById: actor.id as any,
    },
    include: { subject: { select: { id: true, code: true, name: true } } },
  });

  await audit({
    action: 'ASSESSMENT_CREATE',
    resource: 'Assessment',
    resourceId: assessment.id,
    actorId: actor.id,
    correlationId,
    metadata: { title: assessment.title, type: assessment.type, weight: assessment.weight },
  });

  return mapAssessment(assessment);
}

export async function listAssessmentGrades(assessmentId: string, actor: Actor) {
  assertStaff(actor);
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) throw notFound('ASSESSMENT_NOT_FOUND', 'Avaliação não encontrada');
  assertCanManageAssessment(assessment, actor);

  const grades = await prisma.grade.findMany({
    where: { assessmentId },
    include: { student: { select: { id: true, studentNumber: true, user: { select: { fullName: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  return grades.map(mapGrade);
}

/** Pauta publicada bloqueia qualquer alteração de notas (correcção exige reabertura). */
export function assertSubjectNotPublished(publishedAt: Date | null) {
  if (publishedAt) {
    throw conflict(
      'RESULTS_PUBLISHED',
      'A pauta está publicada — reabra a disciplina antes de alterar notas',
    );
  }
}

/**
 * Cenário 5: uma nota de exame normal alterada depois de recorrência lançada
 * coloca o estado em RECORRENCIA_EM_REVISAO e é auditada explicitamente.
 */
async function auditExamChangeAfterRecurrence(
  assessment: { id: string; subjectId: string; type: string; title: string },
  changes: { studentId: string; from: number | null; to: number }[],
  states: Map<string, { state: AcademicState | null; reason: string | null }>,
  actor: Actor,
  correlationId: string,
) {
  if (assessment.type !== 'EXAM' || changes.length === 0) return;
  const changedIds = changes.map((c) => c.studentId);
  const recurrenceGrades = await prisma.grade.findMany({
    where: {
      studentId: { in: changedIds },
      assessment: { subjectId: assessment.subjectId, type: 'RECURRENCE' },
    },
    select: { studentId: true, value: true },
  });
  if (recurrenceGrades.length === 0) return;

  // A alteração passa a valer a partir daqui; o estado destes estudantes
  // fica RECORRENCIA_EM_REVISAO até a coordenação resolver o conflito.
  const affected = recurrenceGrades.map((g) => ({
    studentId: g.studentId,
    recurrenceGrade: g.value,
    previousState: states.get(g.studentId)?.state ?? null,
  }));

  await audit({
    action: 'EXAM_CHANGED_AFTER_RECURRENCE',
    resource: 'Grade',
    resourceId: assessment.id,
    actorId: actor.id,
    correlationId,
    metadata: { assessmentId: assessment.id, title: assessment.title, students: affected },
  });
}

export async function upsertGrades(assessmentId: string, input: UpsertGradesInput, actor: Actor, correlationId: string) {
  assertStaff(actor);
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { subject: { select: { id: true, courseId: true, resultsPublishedAt: true } } },
  });
  if (!assessment) throw notFound('ASSESSMENT_NOT_FOUND', 'Avaliação não encontrada');
  await assertTeacherTeachesSubject(assessment.subjectId, actor);
  assertSubjectNotPublished(assessment.subject.resultsPublishedAt);

  const studentIds = [...new Set(input.grades.map((g) => g.studentId))];
  const students = await prisma.studentProfile.findMany({ where: { id: { in: studentIds } } });
  const foundIds = new Set(students.map((s) => s.id));
  const missing = studentIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw notFound('STUDENT_NOT_FOUND', `Estudantes não encontrados: ${missing.join(', ')}`);
  }

  const courseMismatch = students.filter((s) => s.courseId && s.courseId !== assessment.subject.courseId);
  if (courseMismatch.length > 0) {
    throw conflict(
      'STUDENT_COURSE_MISMATCH',
      `Estudantes fora do curso da disciplina: ${courseMismatch.map((s) => s.studentNumber).join(', ')}`,
    );
  }

  const states = await loadAcademicStates(assessment.subjectId, studentIds);
  for (const g of input.grades) {
    assertGradeAllowedForState(assessment.type, states.get(g.studentId)?.state ?? null);
  }

  const prepared = input.grades.map((g) => {
    assertGradeValueInRange(g.value, assessment.gradingMode, assessment.maxScore);
    return {
      assessmentId,
      studentId: g.studentId,
      value: g.value,
      valuePercent: normalizeGradeValue(g.value, assessment.gradingMode, assessment.maxScore),
      comment: g.comment ?? null,
      gradedById: actor.id,
    };
  });

  const before = await prisma.grade.findMany({
    where: { assessmentId, studentId: { in: studentIds } },
    select: { studentId: true, value: true, comment: true },
  });
  const beforeByStudent = new Map(before.map((g) => [g.studentId, g]));

  const changes = prepared
    .map((g) => {
      const previous = beforeByStudent.get(g.studentId);
      return {
        studentId: g.studentId,
        from: previous ? previous.value : null,
        to: g.value,
        commentFrom: previous ? previous.comment : null,
        commentTo: g.comment,
      };
    })
    .filter((c) => c.from !== c.to || c.commentFrom !== c.commentTo);

  await prisma.$transaction(
    prepared.map((g) =>
      prisma.grade.upsert({
        where: { assessmentId_studentId: { assessmentId: g.assessmentId, studentId: g.studentId } },
        create: g,
        update: {
          value: g.value,
          valuePercent: g.valuePercent,
          comment: g.comment,
          gradedById: g.gradedById,
        },
      }),
    ),
  );

  await audit({
    action: 'GRADE_UPSERT',
    resource: 'Grade',
    resourceId: assessmentId,
    actorId: actor.id,
    correlationId,
    metadata: {
      assessmentId,
      assessmentTitle: assessment.title,
      type: assessment.type,
      students: studentIds.length,
      changed: changes.length,
      changes,
      gradingMode: assessment.gradingMode,
    },
  });

  await auditExamChangeAfterRecurrence(assessment, changes, states, actor, correlationId);

  const grades = await prisma.grade.findMany({
    where: { assessmentId },
    include: { student: { select: { id: true, studentNumber: true, user: { select: { fullName: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  return grades.map(mapGrade);
}

export async function listStudentGrades(studentId: string, actor: Actor) {
  await assertStudentDataAccess(studentId, actor);
  const grades = await prisma.grade.findMany({
    where: { studentId },
    include: {
      assessment: {
        select: { id: true, title: true, type: true, gradingMode: true, maxScore: true, weight: true, subjectId: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return grades.map(mapGrade);
}

export async function listMyGrades(userId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) throw notFound('STUDENT_PROFILE_NOT_FOUND', 'Perfil de estudante não encontrado');
  return listStudentGrades(profile.id, { id: userId, role: 'STUDENT' });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function toTime(value?: Date | string | null): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export type SubjectAssessmentForFinal = {
  id: string;
  title: string;
  type: string;
  weight: number;
  grades: Array<{
    studentId: string;
    value: number;
    valuePercent: number;
    /** Opcional — usado para detectar alteração de exame após recorrência. */
    createdAt?: Date | string;
    updatedAt?: Date | string;
  }>;
};

export type SubjectFinalResult = {
  /** true quando todas as avaliações contínuas têm nota lançada. */
  complete: boolean;
  /** Média ponderada das avaliações contínuas (%), null se incompleta. */
  admissionPercent: number | null;
  /** Nota do exame normal (%), null se não lançada. */
  examPercent: number | null;
  /** Nota do exame de recorrência (%), null se não lançada. */
  recurrencePercent: number | null;
  /** Percentagem final: recorrência → (admissão + recorrência) / 2; exame → (admissão + exame) / 2; sem exame → admissão. */
  finalPercent: number | null;
  /** Nota inteira final (0–20). */
  finalGrade: number | null;
  status: SituacaoAcademica | null;
  /** Estado académico detalhado (dispensa → exame normal → recorrência). Fonte de verdade do backend. */
  state: AcademicState;
  /** Aviso legível associado ao estado (ex.: regras não configuradas, revisão pendente). */
  stateReason: string | null;
  /** O estudante pode receber nota de recorrência. */
  recurrenceEligible: boolean;
  totalWeight: number;
  gradedAssessments: number;
  assessments: number;
  breakdown: Array<{
    assessmentId: string;
    title: string;
    weight: number;
    value: number;
    valuePercent: number;
  }>;
};

/**
 * Motor de resultado final (regra da instituição para este módulo):
 * 1. Nota de admissão = soma ponderada das avaliações contínuas ÷ soma dos pesos.
 * 2. Se o estudante tem nota de exame (ou recorrência, que substitui o exame):
 *    resultado final % = (admissão + exame) / 2.
 * 3. Nota inteira final = arredondamento para inteiro da percentagem final × 0.2.
 * 4. Classificação a partir da nota inteira: <=9 EXCLUIDO, 10–13 APROVADO,
 *    >=14 DISPENSADO (bandas 9.5–13 e 13.5–20 da regra institucional).
 * 5. O resultado só é calculado quando:
 *    - o docente definiu `requiredTestCount`: o estudante tem nota nesse número
 *      de avaliações contínuas; ou
 *    - não definiu: os pesos contínuos somam 100% (ou mais) e todos têm nota.
 * Função pura — sem acesso à base de dados — para ser testável de forma isolada.
 */
export function computeSubjectFinalResult(
  assessments: SubjectAssessmentForFinal[],
  studentId: string,
  requiredTestCount?: number | null,
  recurrenceMinAdmission?: number | null,
  manuallyExempted = false,
  /** Nota de dispensa (0–20) imposta pelo docente; null/undefined = nota de admissão. */
  exemptionGrade?: number | null,
): Omit<SubjectFinalResult, 'status'> & { status: SituacaoAcademica | null } {
  const hasGrade = (a: SubjectAssessmentForFinal) => a.grades.some((g) => g.studentId === studentId);
  const findGrade = (a: SubjectAssessmentForFinal) => a.grades.find((g) => g.studentId === studentId)!;

  // Ciclo contínuo: EXAM/RECURRENCE ficam de fora. Sem contínuos definidos, tudo conta.
  const nonExam = assessments.filter((a) => !EXAM_ASSESSMENT_TYPES.includes(a.type));
  const base = nonExam.length > 0 ? nonExam : assessments;
  const baseIds = new Set(base.map((a) => a.id));
  const gradedBase = base.filter(hasGrade);
  // Situação/resultados: regra do número de testes definida pelo docente,
  // ou (fallback) pesos contínuos a cobrir 100% com todos lançados.
  const baseWeight = round2(base.reduce((acc, a) => acc + a.weight, 0));
  const complete =
    base.length > 0 &&
    (requiredTestCount != null
      ? gradedBase.length >= requiredTestCount
      : gradedBase.length === base.length && baseWeight >= 100);

  const admissionPercent =
    complete && gradedBase.length > 0
      ? round2(
          gradedBase.reduce((acc, a) => acc + findGrade(a).valuePercent * a.weight, 0) /
            gradedBase.reduce((acc, a) => acc + a.weight, 0),
        )
      : null;

  // Exame e recorrência lançados.
  const extras = assessments.filter((a) => !baseIds.has(a.id) && hasGrade(a));
  const normalExam = extras.find((a) => a.type === 'EXAM');
  const recurrenceExam = extras.find((a) => a.type === 'RECURRENCE');

  const normalExamPercent = normalExam ? findGrade(normalExam).valuePercent : null;
  const recurrenceExamPercent = recurrenceExam ? findGrade(recurrenceExam).valuePercent : null;

  // O exame de recorrência substitui o exame normal se existir.
  const effectiveExamPercent = recurrenceExamPercent ?? normalExamPercent ?? null;

  // Regra institucional: com exame → (admissão + exame) / 2; sem exame → admissão.
  const finalPercent =
    admissionPercent !== null ? (effectiveExamPercent !== null ? round2((admissionPercent + effectiveExamPercent) / 2) : admissionPercent) : null;

  // A nota final só é exibida se houver exame lançado OU se o aluno for DISPENSADO.
  const statusTemp = finalPercent !== null
    ? classifySituacao(Math.round(finalPercent * 0.2), effectiveExamPercent !== null, true)
    : (complete && admissionPercent !== null && effectiveExamPercent === null
        ? classifySituacao(Math.round(admissionPercent * 0.2), false, false)
        : null);

  // Estado académico detalhado (dispensa → exame normal → recorrência).
  const examGradeRecord = normalExam ? findGrade(normalExam) : null;
  const recurrenceGradeRecord = recurrenceExam ? findGrade(recurrenceExam) : null;
  const examChangedAfterRecurrence = Boolean(
    examGradeRecord &&
      recurrenceGradeRecord &&
      toTime(examGradeRecord.updatedAt) > toTime(recurrenceGradeRecord.createdAt),
  );
  const { state, reason } = computeAcademicState({
    admissionGrade: admissionPercent !== null ? round2(admissionPercent * 0.2) : null,
    examGrade: normalExamPercent !== null ? round2(normalExamPercent * 0.2) : null,
    recurrenceGrade: recurrenceExamPercent !== null ? round2(recurrenceExamPercent * 0.2) : null,
    recurrenceMinAdmission: recurrenceMinAdmission ?? null,
    hasRecurrenceEpoch: assessments.some((a) => a.type === 'RECURRENCE'),
    examChangedAfterRecurrence,
  });

  // Enquanto o estudante aguarda a recorrência não existe nota final: a média
  // do exame normal é provisória e só se torna final com a nota de recorrência.
  const finalGrade = state === 'ADMITIDO_RECORRENCIA'
    ? null
    : (effectiveExamPercent !== null || statusTemp === 'DISPENSADO')
      ? (finalPercent !== null ? Math.round(finalPercent * 0.2) : null)
      : null;

  // Dispensa imposta pelo docente/coordenação: sobrepõe-se a qualquer cálculo.
  // O estudante fica DISPENSADO sem nada relacionado a exame/recorrência — a
  // nota final é a que o docente escolheu na dispensa (ou a admissão por omissão).
  if (manuallyExempted) {
    const exemptedGrade =
      exemptionGrade != null
        ? Math.round(exemptionGrade)
        : complete && admissionPercent !== null
          ? Math.round(admissionPercent * 0.2)
          : null;
    const consideredExempt = complete ? gradedBase : [...gradedBase, ...extras];
    return {
      complete,
      admissionPercent,
      examPercent: null,
      recurrencePercent: null,
      finalPercent: exemptedGrade !== null ? round2(exemptedGrade * 5) : null,
      finalGrade: exemptedGrade,
      status: 'DISPENSADO',
      state: 'DISPENSADO',
      stateReason: 'Dispensado pelo docente',
      recurrenceEligible: false,
      totalWeight: round2(consideredExempt.reduce((acc, a) => acc + a.weight, 0)),
      gradedAssessments: consideredExempt.length,
      assessments: assessments.length,
      breakdown: consideredExempt.map((a) => ({
        assessmentId: a.id,
        title: a.title,
        weight: a.weight,
        value: findGrade(a).value,
        valuePercent: findGrade(a).valuePercent,
      })),
    };
  }

  const considered = complete ? [...gradedBase, ...(recurrenceExam ? [recurrenceExam] : normalExam ? [normalExam] : [])] : [...gradedBase, ...extras];

  return {
    complete,
    admissionPercent,
    examPercent: normalExamPercent,
    recurrencePercent: recurrenceExamPercent,
    finalPercent: finalGrade !== null ? finalPercent : null,
    finalGrade,
    status: statusTemp,
    state,
    stateReason: reason,
    recurrenceEligible:
      state === 'ADMITIDO_RECORRENCIA' ||
      state === 'APROVADO_RECORRENCIA' ||
      state === 'REPROVADO_RECORRENCIA' ||
      state === 'RECORRENCIA_EM_REVISAO',
    totalWeight: round2(considered.reduce((acc, a) => acc + a.weight, 0)),
    gradedAssessments: considered.length,
    assessments: assessments.length,
    breakdown: considered.map((a) => ({
      assessmentId: a.id,
      title: a.title,
      weight: a.weight,
      value: findGrade(a).value,
      valuePercent: findGrade(a).valuePercent,
    })),
  };
}

export async function listMyFinalGrades(userId: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) throw notFound('STUDENT_PROFILE_NOT_FOUND', 'Perfil de estudante não encontrado');
  return getFinalGrades(profile.id, { id: userId, role: 'STUDENT' });
}

export async function getFinalGrades(studentId: string, actor: Actor) {
  await assertStudentDataAccess(studentId, actor);
  const profile = await prisma.studentProfile.findUnique({ where: { id: studentId } });
  if (!profile || !profile.courseId) throw notFound('STUDENT_PROFILE_NOT_FOUND', 'Estudante sem curso atribuído');

  const subjects = await prisma.subject.findMany({
    where: { courseId: profile.courseId },
    include: {
      assessments: { include: { grades: { where: { studentId } } } },
    },
    orderBy: { code: 'asc' },
  });

  const exemptionRows = await prisma.subjectExemption.findMany({
    where: { studentId, subjectId: { in: subjects.map((s) => s.id) } },
    select: { subjectId: true, grade: true },
  });
  const exemptedSubjects = new Map(exemptionRows.map((row) => [row.subjectId, row.grade]));

  return subjects.map((subject) => {
    const result = computeSubjectFinalResult(
      subject.assessments,
      studentId,
      subject.requiredTestCount,
      subject.recurrenceMinAdmission,
      exemptedSubjects.has(subject.id),
      exemptedSubjects.get(subject.id) ?? null,
    );
    return {
      subjectId: subject.id,
      subjectCode: subject.code,
      subjectName: subject.name,
      requiredTestCount: subject.requiredTestCount,
      recurrenceMinAdmission: subject.recurrenceMinAdmission,
      exempted: exemptedSubjects.has(subject.id),
      exemptionGrade: exemptedSubjects.get(subject.id) ?? null,
      finalGrade: result.finalGrade,
      admissionGrade: result.admissionPercent !== null ? Math.round(result.admissionPercent * 0.2) : null,
      examGrade: result.examPercent !== null ? Math.round(result.examPercent * 0.2) : null,
      recurrenceGrade: result.recurrencePercent !== null ? Math.round(result.recurrencePercent * 0.2) : null,
      usedExam: result.examPercent !== null || result.recurrencePercent !== null,
      status: result.status,
      state: result.state,
      stateReason: result.stateReason,
      recurrenceEligible: result.recurrenceEligible,
      complete: result.complete,
      totalWeight: result.totalWeight,
      gradedAssessments: result.gradedAssessments,
      assessments: result.assessments,
      breakdown: result.breakdown,
    };
  });
}

export async function updateAssessment(id: string, input: UpdateAssessmentInput, actor: Actor, correlationId: string) {
  assertStaff(actor);
  const existing = await prisma.assessment.findUnique({
    where: { id },
    include: { subject: { select: { resultsPublishedAt: true } } },
  });
  if (!existing) throw notFound('ASSESSMENT_NOT_FOUND', 'Avaliação não encontrada');
  assertCanManageAssessment(existing, actor);
  assertSubjectNotPublished(existing.subject.resultsPublishedAt);

  const gradesCount = await prisma.grade.count({ where: { assessmentId: id } });
  const changesGradingRules =
    (input.gradingMode !== undefined && input.gradingMode !== existing.gradingMode) ||
    (input.maxScore !== undefined && input.maxScore !== existing.maxScore);
  if (changesGradingRules && gradesCount > 0) {
    throw conflict(
      'GRADING_RULES_LOCKED',
      'Não é possível alterar o modo de nota ou a escala depois de notas lançadas',
    );
  }

  const updateType = (input.type ?? existing.type) as any;
  const updateWeight = (input.weight ?? existing.weight) as any;
  const isExamU = updateType === 'EXAM' || updateType === 'RECURRENCE';
  if (!isExamU && updateWeight > 100) {
    throw conflict('WEIGHT_EXCEEDED', 'O peso das avaliações contínuas não pode exceder 100%');
  }

  const data: any = { subject: { connect: { id: existing.subjectId } }, createdBy: { connect: { id: existing.createdById } } };
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.type !== undefined) data.type = input.type;
  if (input.gradingMode !== undefined) data.gradingMode = input.gradingMode;
  if (input.maxScore !== undefined) data.maxScore = input.maxScore;
  if (input.weight !== undefined) data.weight = input.weight;
  if (input.date !== undefined) data.date = input.date;

  const assessment = await prisma.assessment.update({
    where: { id },
    data,
    include: { subject: { select: { id: true, code: true, name: true } } },
  });

  await audit({
    action: 'ASSESSMENT_UPDATE',
    resource: 'Assessment',
    resourceId: assessment.id,
    actorId: actor.id,
    correlationId,
    metadata: { weight: assessment.weight, title: assessment.title },
  });

  return mapAssessment(assessment);
}
