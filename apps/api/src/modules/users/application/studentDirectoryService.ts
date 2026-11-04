import { Prisma } from '@prisma/client';
import type { StudentIdentitySummaryDto } from '@smart-campus/shared-types';
import type { FinancialStudentQuery } from '@smart-campus/validation';
import { prisma } from '../../../lib/prisma.js';
import { forbidden } from '../../../lib/errors.js';

// Projecção de leitura do Core: nunca cria nem altera utilizadores/perfis.
export const studentIdentitySelect = {
  id: true, fullName: true, isActive: true,
  studentProfile: { select: { studentNumber: true } },
} satisfies Prisma.UserSelect;

export function toStudentIdentity(
  user: Prisma.UserGetPayload<{ select: typeof studentIdentitySelect }>,
): StudentIdentitySummaryDto {
  return {
    userId: user.id, fullName: user.fullName, isActive: user.isActive,
    studentNumber: user.studentProfile?.studentNumber ?? null,
  };
}

export async function searchStudents(actor: { id: string; role: string }, query: FinancialStudentQuery) {
  if (!['FINANCE', 'ADMIN'].includes(actor.role)) throw forbidden();
  const { q, offset, limit } = query;
  const where: Prisma.UserWhereInput = {
    role: { code: 'STUDENT' },
    ...(q ? { OR: [
      { fullName: { contains: q, mode: 'insensitive' } },
      { studentProfile: { studentNumber: { contains: q, mode: 'insensitive' } } },
    ] } : {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select: studentIdentitySelect, orderBy: [{ fullName: 'asc' }, { id: 'asc' }], skip: offset, take: limit }),
    prisma.user.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { data: rows.map(toStudentIdentity), meta: { total, offset, limit, hasMore: offset + rows.length < total } };
}
