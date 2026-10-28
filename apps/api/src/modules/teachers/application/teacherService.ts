import { Prisma } from '@prisma/client';
import type { TeacherProfileStatus } from '@prisma/client';
import type {
  CreateTeacherProfileInput,
  UpdateTeacherProfileInput,
} from '@smart-campus/validation';
import type { TeacherProfileDto } from '@smart-campus/shared-types';
import { conflict, notFound } from '../../../lib/errors.js';
import { audit } from '../../audit/application/auditService.js';
import { hashPassword } from '../../auth/application/authService.js';
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
  const department = await teacherRepository.findDepartmentById(input.departmentId);
  if (!department) throw notFound('DEPARTMENT_NOT_FOUND', 'Departamento não encontrado');

  if (await teacherRepository.findTeacherByEmployeeCode(input.employeeCode)) {
    throw conflict(
      'TEACHER_EMPLOYEE_CODE_EXISTS',
      `Já existe um docente com o código '${input.employeeCode}'`,
    );
  }

  const role = await teacherRepository.findRoleByCode('TEACHER');
  if (!role) {
    throw conflict('ROLE_NOT_FOUND', 'Role TEACHER não existe na base de dados — corra o seed');
  }

  if (await teacherRepository.findUserByEmail(input.email)) {
    throw conflict('USER_EXISTS', 'Email já registado');
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const row = await teacherRepository.createTeacherAccount({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      roleId: role.id,
      employeeCode: input.employeeCode,
      departmentId: input.departmentId,
      title: input.title ?? null,
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
      action: 'TEACHER_PROFILE_CREATED',
      resource: 'TeacherProfile',
      resourceId: row.id,
      ...auditContext(ctx),
    });

    return toDto(row);
  } catch (error) {
    if (isDuplicate(error)) {
      const target = duplicateTarget(error);
      if (target.includes('email')) throw conflict('USER_EXISTS', 'Email já registado');
      if (target.includes('employeeCode')) {
        throw conflict('TEACHER_EMPLOYEE_CODE_EXISTS', `Já existe um docente com o código '${input.employeeCode}'`);
      }
      throw conflict('TEACHER_DUPLICATE', 'Código de docente ou email já registado');
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

  let removed: { id: string; userId: string } | null;
  try {
    removed = await teacherRepository.deleteTeacherAccount(id);
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw conflict(
        'USER_HAS_DEPENDENCIES',
        'A conta tem ocorrências ou acções de manutenção associadas e não pode ser removida',
      );
    }
    throw error;
  }

  if (!removed) throw notFound('TEACHER_NOT_FOUND', 'Perfil de docente não encontrado');

  await audit({
    action: 'TEACHER_PROFILE_DELETED',
    resource: 'TeacherProfile',
    resourceId: existing.id,
    ...auditContext(ctx),
  });
  await audit({
    action: 'USER_DELETE',
    resource: 'User',
    resourceId: removed.userId,
    ...auditContext(ctx),
    metadata: { fullName: existing.user.fullName, role: 'TEACHER' },
  });

  return { id: existing.id, deleted: true as const };
}
