import { Prisma } from '@prisma/client';
import type { StudentProfileStatus } from '@prisma/client';
import type {
  CreateStudentProfileInput,
  UpdateStudentProfileInput,
} from '@smart-campus/validation';
import type { StudentProfileDto } from '@smart-campus/shared-types';
import { conflict, notFound } from '../../../lib/errors.js';
import { audit } from '../../audit/application/auditService.js';
import { hashPassword } from '../../auth/application/authService.js';
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

function isDuplicate(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function duplicateTarget(error: Prisma.PrismaClientKnownRequestError) {
  const target = (error.meta as { target?: unknown } | undefined)?.target;
  return Array.isArray(target) ? target.join(',') : String(target ?? '');
}

function isForeignKeyViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003';
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
  const course = await studentRepository.findCourseById(input.courseId);
  if (!course) throw notFound('COURSE_NOT_FOUND', 'Curso não encontrado');

  if (await studentRepository.findStudentByStudentNumber(input.studentNumber)) {
    throw conflict('STUDENT_NUMBER_EXISTS', `Já existe um estudante com o número '${input.studentNumber}'`);
  }

  const role = await studentRepository.findRoleByCode('STUDENT');
  if (!role) {
    throw conflict('ROLE_NOT_FOUND', 'Role STUDENT não existe na base de dados — corra o seed');
  }

  if (await studentRepository.findUserByEmail(input.email)) {
    throw conflict('USER_EXISTS', 'Email já registado');
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const row = await studentRepository.createStudentAccount({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      roleId: role.id,
      studentNumber: input.studentNumber,
      courseId: input.courseId,
      yearOfStudy: input.yearOfStudy ?? null,
      phone: input.phone ?? null,
    });

    await audit({
      action: 'USER_CREATE',
      resource: 'User',
      resourceId: row.userId,
      ...auditContext(ctx),
      metadata: { email: input.email, role: role.code },
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
      const target = duplicateTarget(error);
      if (target.includes('email')) throw conflict('USER_EXISTS', 'Email já registado');
      if (target.includes('studentNumber')) {
        throw conflict('STUDENT_NUMBER_EXISTS', `Já existe um estudante com o número '${input.studentNumber}'`);
      }
      throw conflict('STUDENT_DUPLICATE', 'Número de estudante ou email já registado');
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

  let removed: { id: string; userId: string } | null;
  try {
    removed = await studentRepository.deleteStudentAccount(id);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw conflict(
        'USER_HAS_DEPENDENCIES',
        'A conta tem ocorrências ou acções de manutenção associadas e não pode ser removida',
      );
    }
    throw error;
  }

  if (!removed) {
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
  await audit({
    action: 'USER_DELETE',
    resource: 'User',
    resourceId: removed.userId,
    ...auditContext(ctx),
    metadata: { fullName: existing.user.fullName, role: 'STUDENT' },
  });

  return { id: existing.id, deleted: true as const };
}
