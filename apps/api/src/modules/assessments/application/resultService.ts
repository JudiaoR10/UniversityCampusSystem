import type { CreateResultInput } from '@smart-campus/validation';
import { conflict, forbidden, notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';
import {
  assertGradeAllowedForState,
  assertGradeValueInRange,
  assertStaff,
  assertSubjectNotPublished,
  assertTeacherTeachesSubject,
  loadAcademicStates,
  normalizeGradeValue,
  type Actor,
} from './assessmentService.js';

type ResultRecord = {
  id: string;
  assessmentId: string;
  studentId: string;
  value: number;
  valuePercent: number;
  comment: string | null;
  gradedById: string;
  createdAt: Date;
  updatedAt: Date;
  assessment?: {
    id: string;
    title: string;
    type: string;
    gradingMode: string;
    maxScore: number;
    weight: number;
    subjectId: string;
    subject?: { id: string; code: string; name: string } | null;
  };
  student?: { id: string; studentNumber: string; userId: string };
};

/**
 * DTO de resultado do contrato G3 (03-financeiro-avaliacoes-horarios.md):
 * identidades distintas — studentProfileId (StudentProfile.id) e
 * studentUserId (User.id) são devolvidas resolvidas pelo backend;
 * o browser não envia nem prova a titularidade com um User.id.
 */
function mapResult(r: ResultRecord) {
  return {
    id: r.id,
    assessmentId: r.assessmentId,
    assessment: r.assessment
      ? {
          id: r.assessment.id,
          title: r.assessment.title,
          type: r.assessment.type,
          gradingMode: r.assessment.gradingMode,
          maxScore: r.assessment.maxScore,
          weight: r.assessment.weight,
          subjectId: r.assessment.subjectId,
          subject: r.assessment.subject ?? undefined,
        }
      : undefined,
    studentProfileId: r.student?.id ?? r.studentId,
    studentUserId: r.student?.userId,
    studentNumber: r.student?.studentNumber,
    value: r.value,
    valuePercent: r.valuePercent,
    comment: r.comment,
    gradedById: r.gradedById,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const resultInclude = {
  assessment: { include: { subject: { select: { id: true, code: true, name: true } } } },
  student: { select: { id: true, studentNumber: true, userId: true } },
} as const;

/**
 * GET /results — contrato G3.
 * STUDENT: apenas os próprios resultados; um ?studentId de outro estudante → 403 (anti-BOLA).
 * TEACHER: apenas resultados das avaliações que criou (as suas disciplinas).
 * COORDINATOR/ADMIN: todos, com filtro opcional por studentId (StudentProfile.id).
 */
export async function listResults(actor: Actor, studentId?: string) {
  let where: Record<string, unknown> = {};

  if (actor.role === 'STUDENT') {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: actor.id } });
    if (!profile) throw notFound('STUDENT_PROFILE_NOT_FOUND', 'Perfil de estudante não encontrado');
    if (studentId && studentId !== profile.id) {
      throw forbidden('Um estudante só pode consultar os seus próprios resultados', 'FORBIDDEN');
    }
    where = { studentId: profile.id };
  } else if (actor.role === 'TEACHER') {
    where = { assessment: { createdById: actor.id }, ...(studentId ? { studentId } : {}) };
  } else if (studentId) {
    const profile = await prisma.studentProfile.findUnique({ where: { id: studentId } });
    if (!profile) throw notFound('STUDENT_NOT_FOUND', 'Estudante não encontrado');
    where = { studentId };
  }

  const results = await prisma.grade.findMany({
    where,
    include: resultInclude,
    orderBy: { createdAt: 'desc' },
  });
  return results.map(mapResult);
}

/**
 * POST /results — contrato G3 (TEACHER gere resultados das suas disciplinas).
 * studentId no pedido = StudentProfile.id; a resposta devolve também
 * studentUserId (User.id) resolvido — critério de aceitação n.º 1 do contrato.
 */
export async function createResult(input: CreateResultInput, actor: Actor, correlationId: string) {
  assertStaff(actor);

  const assessment = await prisma.assessment.findUnique({
    where: { id: input.assessmentId },
    include: { subject: { select: { id: true, courseId: true, resultsPublishedAt: true } } },
  });
  if (!assessment) throw notFound('ASSESSMENT_NOT_FOUND', 'Avaliação não encontrada');
  await assertTeacherTeachesSubject(assessment.subjectId, actor);
  assertSubjectNotPublished(assessment.subject.resultsPublishedAt);

  const profile = await prisma.studentProfile.findUnique({ where: { id: input.studentId } });
  if (!profile) throw notFound('STUDENT_NOT_FOUND', 'Estudante não encontrado');

  if (profile.courseId && profile.courseId !== assessment.subject.courseId) {
    throw conflict('STUDENT_COURSE_MISMATCH', 'Estudante não pertence ao curso da disciplina da avaliação');
  }

  const states = await loadAcademicStates(assessment.subjectId, [profile.id]);
  assertGradeAllowedForState(assessment.type, states.get(profile.id)?.state ?? null);

  assertGradeValueInRange(input.value, assessment.gradingMode, assessment.maxScore);
  const valuePercent = normalizeGradeValue(input.value, assessment.gradingMode, assessment.maxScore);

  const grade = await prisma.grade.upsert({
    where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: profile.id } },
    create: {
      assessmentId: assessment.id,
      studentId: profile.id,
      value: input.value,
      valuePercent,
      comment: input.comment ?? null,
      gradedById: actor.id,
    },
    update: {
      value: input.value,
      valuePercent,
      comment: input.comment ?? null,
      gradedById: actor.id,
    },
    include: resultInclude,
  });

  await audit({
    action: 'RESULT_CREATE',
    resource: 'Grade',
    resourceId: grade.id,
    actorId: actor.id,
    correlationId,
    metadata: {
      assessmentId: assessment.id,
      studentProfileId: profile.id,
      studentUserId: profile.userId,
      valuePercent,
    },
  });

  return mapResult(grade);
}
