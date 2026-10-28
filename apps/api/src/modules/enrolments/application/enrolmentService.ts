import { Prisma } from '@prisma/client';
import type { EnrolmentStatus } from '@prisma/client';
import type {
  CreateEnrolmentInput,
  UpdateEnrolmentStatusInput,
} from '@smart-campus/validation';
import type { SubjectEnrolmentDto } from '@smart-campus/shared-types';
import { conflict, forbidden, notFound } from '../../../lib/errors.js';
import { audit } from '../../audit/application/auditService.js';
import { assertActiveForEnrolment } from '../../students/domain/studentProfile.js';
import { assertCanTransition } from '../domain/enrolment.js';
import * as enrolmentRepository from '../infrastructure/enrolmentRepository.js';

type AuditContext = {
  actorId: string;
  correlationId: string;
  ip?: string;
  userAgent?: string;
};

type Requester = { id: string; role: string };

type EnrolmentRow = {
  id: string;
  studentId: string;
  subjectId: string;
  academicYear: number;
  status: EnrolmentStatus;
  createdAt: Date;
  updatedAt: Date;
  student: { id: string; studentNumber: string; user: { fullName: string } };
  subject: { id: string; code: string; name: string };
};

function toDto(row: EnrolmentRow): SubjectEnrolmentDto {
  return {
    id: row.id,
    studentId: row.studentId,
    student: {
      id: row.student.id,
      studentNumber: row.student.studentNumber,
      fullName: row.student.user.fullName,
    },
    subjectId: row.subjectId,
    subject: row.subject,
    academicYear: row.academicYear,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isDuplicate(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function auditContext(ctx: AuditContext) {
  return {
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  };
}

export async function list(
  filters: { studentId?: string; subjectId?: string; academicYear?: number },
  requester: Requester,
) {
  const where: Prisma.SubjectEnrolmentWhereInput = {
    subjectId: filters.subjectId,
    academicYear: filters.academicYear,
  };

  if (requester.role === 'STUDENT') {
    const own = await enrolmentRepository.findStudentByUserId(requester.id);
    if (!own) return [];
    where.studentId = own.id;
  } else if (filters.studentId) {
    where.studentId = filters.studentId;
  }

  const rows = await enrolmentRepository.listEnrolments(where);
  return rows.map(toDto);
}

export async function create(input: CreateEnrolmentInput, requester: Requester, ctx: AuditContext) {
  if (!['ADMIN', 'COORDINATOR', 'STUDENT'].includes(requester.role)) {
    throw forbidden('Apenas administradores, coordenadores ou o próprio estudante podem inscrever');
  }

  const student = await enrolmentRepository.findStudentById(input.studentId);
  if (!student) throw notFound('STUDENT_NOT_FOUND', 'Perfil de estudante não encontrado');

  if (requester.role === 'STUDENT' && requester.id !== student.userId) {
    throw forbidden('Só pode criar inscrições para si próprio');
  }

  const subject = await enrolmentRepository.findSubjectById(input.subjectId);
  if (!subject) throw notFound('SUBJECT_NOT_FOUND', 'Disciplina não encontrada');

  assertActiveForEnrolment(student.status);

  if (!student.courseId) {
    throw conflict(
      'STUDENT_WITHOUT_COURSE',
      'O estudante não tem curso associado e não pode ser inscrito em disciplinas',
    );
  }

  if (subject.courseId !== student.courseId) {
    throw conflict(
      'SUBJECT_NOT_IN_STUDENT_COURSE',
      'A disciplina não pertence ao curso do estudante',
    );
  }

  if (
    await enrolmentRepository.findEnrolmentByUniqueKey(
      input.studentId,
      input.subjectId,
      input.academicYear,
    )
  ) {
    throw conflict(
      'DUPLICATE_ENROLMENT',
      'O estudante já está inscrito nesta disciplina neste ano lectivo',
    );
  }

  try {
    const row = await enrolmentRepository.createEnrolment(input);

    await audit({
      action: 'SUBJECT_ENROLMENT_CREATED',
      resource: 'SubjectEnrolment',
      resourceId: row.id,
      ...auditContext(ctx),
      metadata: {
        studentId: row.studentId,
        subjectId: row.subjectId,
        academicYear: row.academicYear,
      },
    });

    return toDto(row);
  } catch (error) {
    if (isDuplicate(error)) {
      throw conflict(
        'DUPLICATE_ENROLMENT',
        'O estudante já está inscrito nesta disciplina neste ano lectivo',
      );
    }
    throw error;
  }
}

export async function updateStatus(
  id: string,
  input: UpdateEnrolmentStatusInput,
  requester: Requester,
  ctx: AuditContext,
) {
  if (input.status === 'COMPLETED' && requester.role === 'ADMIN') {
    throw forbidden('Apenas a coordenação pode concluir inscrições');
  }

  const existing = await enrolmentRepository.findEnrolmentById(id);
  if (!existing) throw notFound('ENROLMENT_NOT_FOUND', 'Inscrição não encontrada');

  assertCanTransition(existing.status, input.status);

  const row = await enrolmentRepository.updateEnrolmentStatus(id, input.status);

  await audit({
    action: 'SUBJECT_ENROLMENT_STATUS_CHANGED',
    resource: 'SubjectEnrolment',
    resourceId: row.id,
    ...auditContext(ctx),
    metadata: { from: existing.status, to: row.status },
  });

  return toDto(row);
}

export async function remove(id: string, ctx: AuditContext) {
  const existing = await enrolmentRepository.findEnrolmentById(id);
  if (!existing) throw notFound('ENROLMENT_NOT_FOUND', 'Inscrição não encontrada');

  await enrolmentRepository.deleteEnrolment(id);

  await audit({
    action: 'SUBJECT_ENROLMENT_DELETED',
    resource: 'SubjectEnrolment',
    resourceId: existing.id,
    ...auditContext(ctx),
    metadata: {
      studentId: existing.studentId,
      subjectId: existing.subjectId,
      status: existing.status,
    },
  });

  return { id: existing.id, deleted: true as const };
}
