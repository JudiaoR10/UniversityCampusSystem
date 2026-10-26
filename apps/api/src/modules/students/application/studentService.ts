import { Prisma } from '@prisma/client';
import type { StudentProfileStatus } from '@prisma/client';
import type {
  CreateStudentProfileInput,
  UpdateStudentProfileInput,
} from '@smart-campus/validation';
import type { StudentProfileDto } from '@smart-campus/shared-types';
import { AppError, conflict, notFound } from '../../../lib/errors.js';
import { audit } from '../../audit/application/auditService.js';
import * as studentRepository from '../infrastructure/studentRepository.js';

type AuditContext = {
  actorId: string;
  correlationId: string;
  ip?: string;
  userAgent?: string;
};

type StudentRow = {
  id: string;
  userId: string;
  studentNumber: string;
  courseId: string | null;
  yearOfStudy: number | null;
  phone: string | null;
  status: StudentProfileStatus;
  createdAt: Date;
  updatedAt: Date;
  course: { id: string; code: string; name: string } | null;
  user: { id: string; fullName: string };
};

function toDto(row: StudentRow): StudentProfileDto {
  return {
    id: row.id,
    userId: row.userId,
    studentNumber: row.studentNumber,
    courseId: row.courseId,
    course: row.course,
    yearOfStudy: row.yearOfStudy,
    phone: row.phone,
    status: row.status,
    user: row.user,
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

export async function list(filters: { courseId?: string; status?: StudentProfileStatus }) {
  const rows = await studentRepository.listStudents(filters);
  return rows.map(toDto);
}

export async function getById(id: string) {
  const row = await studentRepository.findStudentById(id);
  if (!row) throw notFound('STUDENT_NOT_FOUND', 'Perfil de estudante não encontrado');
  return toDto(row);
}

export async function getByUserId(userId: string) {
  const row = await studentRepository.findStudentByUserId(userId);
  if (!row) throw notFound('STUDENT_NOT_FOUND', 'Perfil de estudante não encontrado');
  return toDto(row);
}

export async function create(input: CreateStudentProfileInput, ctx: AuditContext) {
  const user = await studentRepository.findUserById(input.userId);
  if (!user) throw notFound('USER_NOT_FOUND', 'Utilizador não encontrado');
  if (!user.isActive) throw conflict('USER_INACTIVE', 'O utilizador indicado está inactivo');
  if (user.role.code !== 'STUDENT') {
    throw new AppError('USER_ROLE_INVALID', 'O utilizador indicado não tem a role STUDENT', 400);
  }

  const course = await studentRepository.findCourseById(input.courseId);
  if (!course) throw notFound('COURSE_NOT_FOUND', 'Curso não encontrado');

  if (await studentRepository.findStudentByUserId(input.userId)) {
    throw conflict('STUDENT_PROFILE_EXISTS', 'Este utilizador já tem um perfil de estudante');
  }
  if (await studentRepository.findStudentByStudentNumber(input.studentNumber)) {
    throw conflict('STUDENT_NUMBER_EXISTS', `Já existe um estudante com o número '${input.studentNumber}'`);
  }

  try {
    const row = await studentRepository.createStudent({
      userId: input.userId,
      studentNumber: input.studentNumber,
      courseId: input.courseId,
      yearOfStudy: input.yearOfStudy ?? null,
      phone: input.phone ?? null,
    });

    await audit({
      action: 'STUDENT_PROFILE_CREATED',
      resource: 'StudentProfile',
      resourceId: row.id,
      ...auditContext(ctx),
    });

    return toDto(row);
  } catch (error) {
    if (isDuplicate(error)) {
      throw conflict('STUDENT_DUPLICATE', 'Número de estudante ou utilizador já registado');
    }
    throw error;
  }
}

export async function update(id: string, input: UpdateStudentProfileInput, ctx: AuditContext) {
  const existing = await studentRepository.findStudentById(id);
  if (!existing) throw notFound('STUDENT_NOT_FOUND', 'Perfil de estudante não encontrado');

  if (input.courseId) {
    const course = await studentRepository.findCourseById(input.courseId);
    if (!course) throw notFound('COURSE_NOT_FOUND', 'Curso não encontrado');
  }

  const row = await studentRepository.updateStudent(id, input);

  await audit({
    action: 'STUDENT_PROFILE_UPDATED',
    resource: 'StudentProfile',
    resourceId: row.id,
    ...auditContext(ctx),
    metadata: { fields: Object.keys(input) },
  });

  return toDto(row);
}

export async function updateOwn(userId: string, phone: string, ctx: AuditContext) {
  const existing = await studentRepository.findStudentByUserId(userId);
  if (!existing) throw notFound('STUDENT_NOT_FOUND', 'Perfil de estudante não encontrado');

  const row = await studentRepository.updateStudent(existing.id, { phone });

  await audit({
    action: 'STUDENT_PROFILE_UPDATED',
    resource: 'StudentProfile',
    resourceId: row.id,
    ...auditContext(ctx),
    metadata: { fields: ['phone'], self: true },
  });

  return toDto(row);
}

export async function remove(id: string, ctx: AuditContext) {
  const existing = await studentRepository.findStudentById(id);
  if (!existing) throw notFound('STUDENT_NOT_FOUND', 'Perfil de estudante não encontrado');

  const deleted = await studentRepository.deleteStudentWithoutEnrolments(id);
  if (deleted === 0) {
    throw conflict(
      'STUDENT_HAS_ENROLMENTS',
      'Não é possível remover um estudante com inscrições associadas',
    );
  }

  await audit({
    action: 'STUDENT_PROFILE_DELETED',
    resource: 'StudentProfile',
    resourceId: existing.id,
    ...auditContext(ctx),
  });

  return { id: existing.id, deleted: true as const };
}
