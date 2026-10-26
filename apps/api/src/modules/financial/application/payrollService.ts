import { Prisma } from '@prisma/client';
import type { TeacherSalaryDto } from '@smart-campus/shared-types';
import { createSalarySchema, updateSalarySchema, salaryPaymentSchema, type CreateSalaryInput, type UpdateSalaryInput, type SalaryPaymentInput, type SalaryQuery } from '@smart-campus/validation';
import { prisma } from '../../../lib/prisma.js';
import { conflict, forbidden, notFound } from '../../../lib/errors.js';
import { teacherIdentitySelect, toTeacherIdentity } from '../../users/application/teacherDirectoryService.js';

export type FinancialActor = { id: string; role: string };
export function authorizeFinancialRead(actor: FinancialActor) {
  if (!['FINANCE', 'ADMIN'].includes(actor.role)) throw forbidden();
}
function authorizeSalaryWrite(actor: FinancialActor) {
  // ADMIN é expressamente só de leitura nesta área.
  if (actor.role !== 'FINANCE') throw forbidden('Só a tesouraria pode alterar salários e registar pagamentos salariais.');
}
export const salaryInclude = { teacher: { select: teacherIdentitySelect } } satisfies Prisma.TeacherSalaryInclude;
export function toSalaryDto(row: Prisma.TeacherSalaryGetPayload<{ include: typeof salaryInclude }>): TeacherSalaryDto {
  return {
    id: row.id, teacher: toTeacherIdentity(row.teacher), month: row.month, amount: row.amount.toNumber(),
    notes: row.notes, status: row.status, paymentMethod: row.paymentMethod, referenceCode: row.referenceCode,
    paidAt: row.paidAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}
async function audit(tx: Prisma.TransactionClient, actor: FinancialActor, correlationId: string, action: string, resourceId: string, metadata: Prisma.InputJsonValue) {
  await tx.auditEvent.create({ data: { actorId: actor.id, correlationId, action, resource: 'financial_salary', resourceId, metadata } });
}

export async function listSalaries(actor: FinancialActor, query: SalaryQuery) {
  authorizeFinancialRead(actor);
  const { month, offset, limit } = query;
  const [rows, total] = await prisma.$transaction([
    prisma.teacherSalary.findMany({ where: { month }, include: salaryInclude, orderBy: [{ teacher: { employeeCode: 'asc' } }, { id: 'asc' }], skip: offset, take: limit }),
    prisma.teacherSalary.count({ where: { month } }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { data: rows.map(toSalaryDto), meta: { total, offset, limit, hasMore: offset + rows.length < total } };
}

export async function createSalary(actor: FinancialActor, input: CreateSalaryInput, correlationId: string) {
  authorizeSalaryWrite(actor);
  const data = createSalarySchema.parse(input);
  return prisma.$transaction(async tx => {
    const teacher = await tx.teacherProfile.findFirst({ where: { id: data.teacherId, user: { role: { code: 'TEACHER' } } } });
    if (!teacher) throw notFound('TEACHER_NOT_FOUND', 'Docente não encontrado no cadastro de Estudantes e Docentes.');
    const row = await tx.teacherSalary.create({ data, include: salaryInclude });
    await audit(tx, actor, correlationId, 'SALARY_CREATED', row.id, { teacherId: row.teacherId, month: row.month, amount: row.amount.toString() });
    return toSalaryDto(row);
  });
}

async function pendingSalary(tx: Prisma.TransactionClient, id: string, expectedUpdatedAt: string) {
  // Serializa edição e pagamento para não confirmar um valor entretanto alterado.
  await tx.$queryRaw`SELECT id FROM teacher_salaries WHERE id = ${id} FOR UPDATE`;
  const row = await tx.teacherSalary.findUnique({ where: { id } });
  if (!row) throw notFound('SALARY_NOT_FOUND', 'Salário não encontrado.');
  if (row.status !== 'PENDING') throw conflict('SALARY_ALREADY_PAID', 'O salário já foi pago e não pode ser alterado.');
  if (row.updatedAt.toISOString() !== expectedUpdatedAt) throw conflict('SALARY_CHANGED', 'O salário foi alterado. Actualize a lista antes de continuar.');
  return row;
}

export async function updateSalary(actor: FinancialActor, id: string, input: UpdateSalaryInput, correlationId: string) {
  authorizeSalaryWrite(actor);
  const { expectedUpdatedAt, ...data } = updateSalarySchema.parse(input);
  return prisma.$transaction(async tx => {
    const previous = await pendingSalary(tx, id, expectedUpdatedAt);
    const row = await tx.teacherSalary.update({ where: { id }, data, include: salaryInclude });
    await audit(tx, actor, correlationId, 'SALARY_UPDATED', id, { previousAmount: previous.amount.toString(), amount: row.amount.toString(), previousNotes: previous.notes, notes: row.notes });
    return toSalaryDto(row);
  });
}

export async function paySalary(actor: FinancialActor, id: string, input: SalaryPaymentInput, correlationId: string) {
  authorizeSalaryWrite(actor);
  const { expectedUpdatedAt, amountPaid, paymentMethod, referenceCode } = salaryPaymentSchema.parse(input);
  return prisma.$transaction(async tx => {
    const previous = await pendingSalary(tx, id, expectedUpdatedAt);
    if (!previous.amount.equals(amountPaid)) throw conflict('SALARY_AMOUNT_CHANGED', 'O montante deve corresponder ao salário integral. Actualize a lista.');
    const row = await tx.teacherSalary.update({ where: { id }, data: { status: 'PAID', paidAt: new Date(), paymentMethod, referenceCode }, include: salaryInclude });
    await audit(tx, actor, correlationId, 'SALARY_PAYMENT_RECORDED', id, { amount: row.amount.toString(), paymentMethod, referenceCode });
    return toSalaryDto(row);
  });
}
