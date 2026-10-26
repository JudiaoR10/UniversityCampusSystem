import { Prisma } from '@prisma/client';
import type { TeacherProfileStatus } from '@prisma/client';
import type {
  CreateTeacherProfileInput,
  UpdateTeacherProfileInput,
} from '@smart-campus/validation';
import type { TeacherProfileDto } from '@smart-campus/shared-types';
import { AppError, conflict, notFound } from '../../../lib/errors.js';
import { audit } from '../../audit/application/auditService.js';
import * as teacherRepository from '../infrastructure/teacherRepository.js';

type AuditContext = {
  actorId: string;
  correlationId: string;
  ip?: string;
  userAgent?: string;
};

type TeacherRow = {
  id: string;
  userId: string;
  employeeCode: string;
  departmentId: string | null;
  title: string | null;
  phone: string | null;
  status: TeacherProfileStatus;
  createdAt: Date;
  updatedAt: Date;
  department: { id: string; code: string; name: string } | null;
  user: { id: string; fullName: string };
};

function toDto(row: TeacherRow): TeacherProfileDto {
  return {
    id: row.id,
    userId: row.userId,
    employeeCode: row.employeeCode,
    departmentId: row.departmentId,
    department: row.department,
    title: row.title,
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

export async function list(filters: { departmentId?: string; status?: TeacherProfileStatus }) {
  const rows = await teacherRepository.listTeachers(filters);
  return rows.map(toDto);
}

export async function getById(id: string) {
  const row = await teacherRepository.findTeacherById(id);
  if (!row) throw notFound('TEACHER_NOT_FOUND', 'Perfil de docente não encontrado');
  return toDto(row);
}

export async function getByUserId(userId: string) {
  const row = await teacherRepository.findTeacherByUserId(userId);
  if (!row) throw notFound('TEACHER_NOT_FOUND', 'Perfil de docente não encontrado');
  return toDto(row);
}

export async function create(input: CreateTeacherProfileInput, ctx: AuditContext) {
  const user = await teacherRepository.findUserById(input.userId);
  if (!user) throw notFound('USER_NOT_FOUND', 'Utilizador não encontrado');
  if (!user.isActive) throw conflict('USER_INACTIVE', 'O utilizador indicado está inactivo');
  if (user.role.code !== 'TEACHER') {
    throw new AppError('USER_ROLE_INVALID', 'O utilizador indicado não tem a role TEACHER', 400);
  }

  const department = await teacherRepository.findDepartmentById(input.departmentId);
  if (!department) throw notFound('DEPARTMENT_NOT_FOUND', 'Departamento não encontrado');

  if (await teacherRepository.findTeacherByUserId(input.userId)) {
    throw conflict('TEACHER_PROFILE_EXISTS', 'Este utilizador já tem um perfil de docente');
  }
  if (await teacherRepository.findTeacherByEmployeeCode(input.employeeCode)) {
    throw conflict(
      'TEACHER_EMPLOYEE_CODE_EXISTS',
      `Já existe um docente com o código '${input.employeeCode}'`,
    );
  }

  try {
    const row = await teacherRepository.createTeacher({
      userId: input.userId,
      employeeCode: input.employeeCode,
      departmentId: input.departmentId,
      title: input.title ?? null,
      phone: input.phone ?? null,
    });

    await audit({
      action: 'TEACHER_PROFILE_CREATED',
      resource: 'TeacherProfile',
      resourceId: row.id,
      ...auditContext(ctx),
    });

    return toDto(row);
  } catch (error) {
    if (isDuplicate(error)) {
      throw conflict('TEACHER_DUPLICATE', 'Código de docente ou utilizador já registado');
    }
    throw error;
  }
}

export async function update(id: string, input: UpdateTeacherProfileInput, ctx: AuditContext) {
  const existing = await teacherRepository.findTeacherById(id);
  if (!existing) throw notFound('TEACHER_NOT_FOUND', 'Perfil de docente não encontrado');

  if (input.departmentId) {
    const department = await teacherRepository.findDepartmentById(input.departmentId);
    if (!department) throw notFound('DEPARTMENT_NOT_FOUND', 'Departamento não encontrado');
  }

  const row = await teacherRepository.updateTeacher(id, input);

  await audit({
    action: 'TEACHER_PROFILE_UPDATED',
    resource: 'TeacherProfile',
    resourceId: row.id,
    ...auditContext(ctx),
    metadata: { fields: Object.keys(input) },
  });

  return toDto(row);
}

export async function updateOwn(userId: string, phone: string, ctx: AuditContext) {
  const existing = await teacherRepository.findTeacherByUserId(userId);
  if (!existing) throw notFound('TEACHER_NOT_FOUND', 'Perfil de docente não encontrado');

  const row = await teacherRepository.updateTeacher(existing.id, { phone });

  await audit({
    action: 'TEACHER_PROFILE_UPDATED',
    resource: 'TeacherProfile',
    resourceId: row.id,
    ...auditContext(ctx),
    metadata: { fields: ['phone'], self: true },
  });

  return toDto(row);
}

export async function remove(id: string, ctx: AuditContext) {
  const existing = await teacherRepository.findTeacherById(id);
  if (!existing) throw notFound('TEACHER_NOT_FOUND', 'Perfil de docente não encontrado');

  await teacherRepository.deleteTeacher(id);

  await audit({
    action: 'TEACHER_PROFILE_DELETED',
    resource: 'TeacherProfile',
    resourceId: existing.id,
    ...auditContext(ctx),
  });

  return { id: existing.id, deleted: true as const };
}
