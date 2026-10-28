import { Prisma } from '@prisma/client';
import type { TeacherIdentitySummaryDto } from '@smart-campus/shared-types';
import type { FinancialStudentQuery } from '@smart-campus/validation';
import { prisma } from '../../../lib/prisma.js';
import { forbidden } from '../../../lib/errors.js';

// Leitura do cadastro académico existente. O Financeiro não edita perfis docentes.
export const teacherIdentitySelect = {
  id: true, employeeCode: true,
  user: { select: { id: true, fullName: true, isActive: true } },
} satisfies Prisma.TeacherProfileSelect;

export function toTeacherIdentity(row: Prisma.TeacherProfileGetPayload<{ select: typeof teacherIdentitySelect }>): TeacherIdentitySummaryDto {
  return { teacherId: row.id, employeeCode: row.employeeCode, userId: row.user.id, fullName: row.user.fullName, isActive: row.user.isActive };
}

export async function searchTeachers(actor: { id: string; role: string }, query: FinancialStudentQuery) {
  if (!['FINANCE', 'ADMIN'].includes(actor.role)) throw forbidden();
  const { q, offset, limit } = query;
  const where: Prisma.TeacherProfileWhereInput = {
    user: { role: { code: 'TEACHER' } },
    ...(q ? { OR: [{ employeeCode: { contains: q, mode: 'insensitive' } }, { user: { fullName: { contains: q, mode: 'insensitive' } } }] } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.teacherProfile.findMany({ where, select: teacherIdentitySelect, orderBy: [{ user: { fullName: 'asc' } }, { id: 'asc' }], skip: offset, take: limit }),
    prisma.teacherProfile.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { data: rows.map(toTeacherIdentity), meta: { total, offset, limit, hasMore: offset + rows.length < total } };
}
