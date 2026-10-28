import { AppError } from '../../../lib/errors.js';
import { Prisma } from '@prisma/client';
import {
  createDebtSchema,
  createPaymentSchema,
  CreateDebtInput,
  CreatePaymentInput,
  CreateAnalysisRequestInput,
  ResolveAnalysisRequestInput,
  UpdateFinancialPolicyInput,
  FinancialAnalysisQuery,
} from '@smart-campus/validation';
import type { FinancialAnalysisRequestViewDto } from '@smart-campus/shared-types';
import { studentIdentitySelect, toStudentIdentity } from '../../users/application/studentDirectoryService.js';
import {
  generateCode,
  calculateSlaDueDate,
  toDebtDto,
  toPaymentDto,
  toAnalysisRequestDto,
  toNotificationDto,
  toPolicyDto,
} from '../domain/financial.domain.js';
import { prisma } from '../infrastructure/financialRepository.js';
import { dispatchNotificationSafely } from './notificationDeliveryService.js';

type Transaction = Prisma.TransactionClient;
type Page = { offset: number; limit: number };
const defaultPage: Page = { offset: 0, limit: 50 };
const fail = (statusCode: number, code: string, message: string): never => {
  throw new AppError(code, message, statusCode);
};

async function auditFinancial(
  tx: Transaction,
  action: string,
  resourceId: string,
  actorId: string,
  correlationId: string,
  payload: Prisma.InputJsonValue = {},
) {
  // A auditoria confirma ou reverte juntamente com a operacao que descreve.
  await tx.auditEvent.create({
    data: { action, resource: 'financial', resourceId, actorId, correlationId, metadata: payload },
  });
}

async function requireStudent(tx: Transaction, studentId: string) {
  const user = await tx.user.findUnique({ where: { id: studentId }, include: { role: true } });
  if (!user || user.role.code !== 'STUDENT') fail(404, 'STUDENT_NOT_FOUND', 'Estudante nao encontrado.');
}

async function lockStudent(tx: Transaction, studentId: string) {
  // Duas dividas do mesmo estudante tambem afectam o mesmo saldo. Reservar apenas
  // a divida deixaria duas transaccoes calcular estados financeiros incompatíveis.
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${studentId} FOR UPDATE`;
  await requireStudent(tx, studentId);
}

async function activePolicy(tx: Transaction) {
  return (
    (await tx.financialPolicy.findUnique({ where: { code: 'DEFAULT_POLICY' } })) ?? {
      gracePeriodDays: 5,
      autoBlockEnabled: true,
      maxDebtAmount: new Prisma.Decimal(0),
    }
  );
}

// As leituras apresentam o mesmo vencimento mesmo antes de actualizar o cache.
function withCurrentDebtStatus<T extends { status: string; dueDate: Date }>(
  debt: T,
  graceDays: number,
): T {
  if (debt.status !== 'PENDENTE' && debt.status !== 'VENCIDA') return debt;
  const overdue = debt.dueDate.getTime() + graceDays * 86400000 < Date.now();
  return { ...debt, status: overdue ? 'VENCIDA' : 'PENDENTE' };
}

async function refreshStanding(tx: Transaction, studentId: string) {
  const policy = await activePolicy(tx);
  const now = new Date();
  const cutoff = new Date(now.getTime() - policy.gracePeriodDays * 86400000);
  // Estado derivado da data e tolerancia; regularizadas e canceladas sao preservadas.
  await tx.debt.updateMany({
    where: { studentId, status: 'PENDENTE', dueDate: { lt: cutoff } },
    data: { status: 'VENCIDA' },
  });
  await tx.debt.updateMany({
    where: { studentId, status: 'VENCIDA', dueDate: { gte: cutoff } },
    data: { status: 'PENDENTE' },
  });
  const overdue = await tx.debt.aggregate({
    where: { studentId, status: 'VENCIDA' },
    _count: true,
    _sum: { amount: true },
  });
  const total = overdue._sum.amount ?? new Prisma.Decimal(0);
  const blocked =
    policy.autoBlockEnabled && overdue._count > 0 && total.greaterThan(policy.maxDebtAmount);
  const previous = await tx.financialStatus.findUnique({ where: { studentId } });
  const status = blocked ? ('BLOCKED' as const) : ('ACTIVE' as const);
  const reason = blocked
    ? `Estudante possui ${overdue._count} divida(s) vencida(s) acima do limite da politica.`
    : null;
  const blockedAt = blocked ? (previous?.blockedAt ?? now) : null;
  const standing = await tx.financialStatus.upsert({
    where: { studentId },
    create: { studentId, status, reason, blockedAt },
    update: { status, reason, blockedAt },
  });
  return {
    studentId,
    status,
    reason,
    blockedAt: blockedAt?.toISOString() ?? null,
    overdueDebtsCount: overdue._count,
    totalOverdueAmount: total.toNumber(),
    updatedAt: standing.updatedAt.toISOString(),
  };
}

export async function listDebts(studentId?: string, page: Page = defaultPage) {
  const policy = await activePolicy(prisma);
  return (
    await prisma.debt.findMany({
      where: studentId ? { studentId } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: page.offset,
      take: page.limit,
    })
  ).map((debt) => toDebtDto(withCurrentDebtStatus(debt, policy.gracePeriodDays)));
}

export async function createDebt(input: CreateDebtInput, actorId: string, correlationId: string) {
  input = createDebtSchema.parse(input);
  const result = await prisma.$transaction(async (tx) => {
    await lockStudent(tx, input.studentId);
    const debt = await tx.debt.create({
      data: {
        ...input,
        code: generateCode('DB'),
        dueDate: new Date(input.dueDate),
        description: input.description ?? null,
      },
    });
    await refreshStanding(tx, input.studentId);
    const notification = await tx.financialNotification.create({
      data: {
        studentId: input.studentId,
        title: 'Nova Divida Registada',
        message: `Foi emitida a divida "${input.title}" no valor de ${input.amount.toFixed(2)} MZN.`,
        eventType: 'DEBT_CREATED',
        resourceId: debt.id,
        correlationId,
      },
    });
    await auditFinancial(tx, 'DEBT_CREATED', debt.id, actorId, correlationId, {
      studentId: input.studentId,
      amount: input.amount,
    });
    return {
      debt: await tx.debt.findUniqueOrThrow({ where: { id: debt.id } }),
      notificationId: notification.id,
    };
  });
  await dispatchNotificationSafely(result.notificationId);
  return toDebtDto(result.debt);
}

export async function getDebtById(id: string) {
  const debt = await prisma.debt.findUnique({ where: { id } });
  if (!debt) return fail(404, 'DEBT_NOT_FOUND', 'Divida nao encontrada.');
  const policy = await activePolicy(prisma);
  return toDebtDto(withCurrentDebtStatus(debt, policy.gracePeriodDays));
}

export async function createPayment(
  input: CreatePaymentInput,
  actorId: string,
  correlationId: string,
) {
  input = createPaymentSchema.parse(input);
  const result = await prisma.$transaction(async (tx) => {
    const candidate = await tx.debt.findUnique({ where: { id: input.debtId } });
    if (!candidate) return fail(404, 'DEBT_NOT_FOUND', 'Divida nao encontrada.');
    await lockStudent(tx, candidate.studentId);
    // Releitura depois da reserva: outro pagamento pode ter terminado entretanto.
    const debt = await tx.debt.findUniqueOrThrow({ where: { id: input.debtId } });
    if (debt.status === 'REGULARIZADA')
      fail(409, 'DEBT_ALREADY_REGULARIZED', 'Divida ja regularizada.');
    if (debt.status === 'CANCELADA') fail(400, 'DEBT_CANCELLED', 'Divida cancelada.');
    if (!debt.amount.equals(new Prisma.Decimal(input.amountPaid)))
      fail(400, 'PAYMENT_AMOUNT_MISMATCH', 'O pagamento deve liquidar o valor total da divida.');
    const payment = await tx.payment.create({
      data: {
        ...input,
        code: generateCode('PAY'),
        studentId: debt.studentId,
        confirmedById: actorId,
      },
    });
    await tx.debt.update({ where: { id: debt.id }, data: { status: 'REGULARIZADA' } });
    const standing = await refreshStanding(tx, debt.studentId);
    const notification = await tx.financialNotification.create({
      data: {
        studentId: debt.studentId,
        title: 'Pagamento Confirmado',
        message: `Pagamento de ${input.amountPaid.toFixed(2)} MZN confirmado. Estado financeiro: ${standing.status}.`,
        eventType: 'PAYMENT_CONFIRMED',
        resourceId: payment.id,
        correlationId,
      },
    });
    await auditFinancial(tx, 'PAYMENT_CREATED', payment.id, actorId, correlationId, {
      debtId: debt.id,
      amountPaid: input.amountPaid,
    });
    return { payment, standing, notificationId: notification.id };
  });
  await dispatchNotificationSafely(result.notificationId);
  return {
    payment: toPaymentDto(result.payment),
    debtStatus: 'REGULARIZADA',
    studentFinancialStatus: result.standing.status,
  };
}

export async function getStudentStatus(studentId: string) {
  return prisma.$transaction(async (tx) => {
    await lockStudent(tx, studentId);
    return refreshStanding(tx, studentId);
  });
}

export async function getStudentHistory(studentId: string, page: Page = defaultPage) {
  return prisma.$transaction(async (tx) => {
    await lockStudent(tx, studentId);
    const status = await refreshStanding(tx, studentId);
    const debts = await tx.debt.findMany({
      where: { studentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: page.offset,
      take: page.limit,
    });
    const payments = await tx.payment.findMany({
      where: { studentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: page.offset,
      take: page.limit,
    });
    // Os totais abrangem todo o historico, mesmo quando as listas sao paginadas.
    const paid = await tx.payment.aggregate({
      where: { studentId },
      _sum: { amountPaid: true },
      _count: true,
    });
    const outstanding = await tx.debt.aggregate({
      where: { studentId, status: { in: ['PENDENTE', 'VENCIDA'] } },
      _sum: { amount: true },
    });
    const totalDebts = await tx.debt.count({ where: { studentId } });
    return {
      studentId,
      debts: debts.map(toDebtDto),
      payments: payments.map(toPaymentDto),
      status,
      totalDebts,
      totalPaid: paid._sum.amountPaid?.toNumber() ?? 0,
      totalOutstanding: outstanding._sum.amount?.toNumber() ?? 0,
      pagination: {
        ...page,
        totalPayments: paid._count,
        hasMoreDebts: page.offset + debts.length < totalDebts,
        hasMorePayments: page.offset + payments.length < paid._count,
      },
    };
  });
}

const analysisViewInclude = {
  student: { select: studentIdentitySelect },
  debt: { select: { id: true, code: true, title: true, amount: true } },
} satisfies Prisma.AnalysisRequestInclude;

function toAnalysisView(row: Prisma.AnalysisRequestGetPayload<{ include: typeof analysisViewInclude }>): FinancialAnalysisRequestViewDto {
  return { ...toAnalysisRequestDto(row), student: toStudentIdentity(row.student), debt: { ...row.debt, amount: row.debt.amount.toNumber() } };
}

function authorizeAnalysisRead(actor: { id: string; role: string }, studentId?: string) {
  if (!['STUDENT', 'FINANCE', 'ADMIN'].includes(actor.role) ||
      (actor.role === 'STUDENT' && studentId && studentId !== actor.id)) {
    fail(403, 'FORBIDDEN', 'Sem permissão para consultar estas contestações.');
  }
}

export async function listAnalysisRequests(actor: { id: string; role: string }, query: FinancialAnalysisQuery) {
  authorizeAnalysisRead(actor, query.studentId);
  const { offset, limit, status, debtId } = query;
  const where: Prisma.AnalysisRequestWhereInput = {
    status, debtId, studentId: actor.role === 'STUDENT' ? actor.id : query.studentId,
  };
  const [rows, total] = await prisma.$transaction([
    prisma.analysisRequest.findMany({ where, include: analysisViewInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: offset, take: limit }),
    prisma.analysisRequest.count({ where }),
  ], { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  return { data: rows.map(toAnalysisView), meta: { total, offset, limit, hasMore: offset + rows.length < total } };
}

export async function getAnalysisRequest(actor: { id: string; role: string }, id: string) {
  authorizeAnalysisRead(actor);
  const row = await prisma.analysisRequest.findUnique({ where: { id }, include: analysisViewInclude });
  if (!row) return fail(404, 'ANALYSIS_REQUEST_NOT_FOUND', 'Pedido de análise não encontrado.');
  authorizeAnalysisRead(actor, row.studentId);
  return toAnalysisView(row);
}

export async function createAnalysisRequest(
  input: CreateAnalysisRequestInput,
  studentId: string,
  correlationId: string,
) {
  return prisma.$transaction(async (tx) => {
    await lockStudent(tx, studentId);
    const debt = await tx.debt.findUnique({ where: { id: input.debtId } });
    if (!debt) return fail(404, 'DEBT_NOT_FOUND', 'Divida nao encontrada.');
    if (debt.studentId !== studentId)
      fail(403, 'FORBIDDEN', 'Nao pode contestar divida de outro estudante.');
    if (debt.status === 'REGULARIZADA')
      fail(409, 'DEBT_ALREADY_REGULARIZED', 'Divida ja regularizada.');
    if (debt.status === 'CANCELADA') fail(400, 'DEBT_CANCELLED', 'Divida cancelada.');
    const pending = await tx.analysisRequest.findFirst({
      where: { debtId: debt.id, status: 'PENDENTE_ANALISE' },
    });
    if (pending)
      fail(409, 'ANALYSIS_REQUEST_ALREADY_OPEN', 'Ja existe pedido de analise pendente.');
    const request = await tx.analysisRequest.create({
      data: { ...input, studentId, code: generateCode('AR'), slaDueDate: calculateSlaDueDate(5) },
    });
    await auditFinancial(tx, 'ANALYSIS_REQUEST_CREATED', request.id, studentId, correlationId, {
      debtId: debt.id,
    });
    return toAnalysisRequestDto(request);
  });
}

export async function resolveAnalysisRequest(
  id: string,
  input: ResolveAnalysisRequestInput,
  actorId: string,
  correlationId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const candidate = await tx.analysisRequest.findUnique({ where: { id } });
    if (!candidate)
      return fail(404, 'ANALYSIS_REQUEST_NOT_FOUND', 'Pedido de analise nao encontrado.');
    await lockStudent(tx, candidate.studentId);
    const changed = await tx.analysisRequest.updateMany({
      where: { id, status: 'PENDENTE_ANALISE' },
      data: {
        status: input.decision,
        resolutionNotes: input.resolutionNotes,
        resolvedById: actorId,
        resolvedAt: new Date(),
      },
    });
    if (changed.count !== 1)
      fail(409, 'ANALYSIS_REQUEST_ALREADY_RESOLVED', 'Pedido de analise ja resolvido.');
    if (input.decision === 'PROCEDENTE') {
      await tx.debt.update({ where: { id: candidate.debtId }, data: { status: 'REGULARIZADA' } });
      await refreshStanding(tx, candidate.studentId);
    }
    const notification = await tx.financialNotification.create({
      data: {
        studentId: candidate.studentId,
        title: 'Decisao da sua Contestacao',
        message: `Pedido ${candidate.code}: ${input.decision}. ${input.resolutionNotes}`,
        eventType: 'ANALYSIS_REQUEST_RESOLVED',
        resourceId: id,
        correlationId,
      },
    });
    await auditFinancial(tx, 'ANALYSIS_REQUEST_RESOLVED', id, actorId, correlationId, {
      decision: input.decision,
    });
    return {
      request: await tx.analysisRequest.findUniqueOrThrow({ where: { id } }),
      notificationId: notification.id,
    };
  });
  await dispatchNotificationSafely(result.notificationId);
  return toAnalysisRequestDto(result.request);
}

export async function getStudentNotifications(
  studentId: string,
  page: Page = { offset: 0, limit: 30 },
) {
  await requireStudent(prisma, studentId);
  return (
    await prisma.financialNotification.findMany({
      where: { studentId },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: page.offset,
      take: page.limit,
    })
  ).map(toNotificationDto);
}

export async function getPolicy(policyId: string) {
  const policy = await prisma.financialPolicy.findUnique({ where: { code: policyId } });
  if (!policy) return fail(404, 'POLICY_NOT_FOUND', 'Politica nao encontrada.');
  return toPolicyDto(policy);
}

export async function updatePolicy(
  policyId: string,
  input: UpdateFinancialPolicyInput,
  actorId: string,
  correlationId: string,
) {
  if (policyId !== 'DEFAULT_POLICY')
    fail(404, 'POLICY_NOT_FOUND', 'A politica activa e DEFAULT_POLICY.');
  return prisma.$transaction(async (tx) => {
    const policy = await tx.financialPolicy.upsert({
      where: { code: policyId },
      create: { code: policyId, ...input },
      update: input,
    });
    await auditFinancial(tx, 'POLICY_UPDATED', policy.id, actorId, correlationId, { ...input });
    return toPolicyDto(policy);
  });
}

export async function getReport() {
  const policy = await activePolicy(prisma);
  const cutoff = new Date(Date.now() - policy.gracePeriodDays * 86400000);
  const open = { status: { in: ['PENDENTE', 'VENCIDA'] as Array<'PENDENTE' | 'VENCIDA'> } };
  const [totalDebts, pendentes, vencidas, regularizadas, canceladas, totalPayments, blocked] =
    await Promise.all([
      prisma.debt.count(),
      prisma.debt.count({ where: { ...open, dueDate: { gte: cutoff } } }),
      prisma.debt.count({ where: { ...open, dueDate: { lt: cutoff } } }),
      prisma.debt.count({ where: { status: 'REGULARIZADA' } }),
      prisma.debt.count({ where: { status: 'CANCELADA' } }),
      prisma.payment.count(),
      // Agregar no servidor da BD evita carregar o historico de todo o campus na API.
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM
      (SELECT "studentId" FROM debts WHERE status IN ('PENDENTE', 'VENCIDA') AND "dueDate" < ${cutoff}
       GROUP BY "studentId" HAVING SUM(amount) > ${policy.maxDebtAmount.toNumber()}) AS blocked`,
    ]);
  return {
    totalDebts,
    byStatus: { pendentes, vencidas, regularizadas, canceladas },
    totalPayments,
    studentsBlocked: policy.autoBlockEnabled ? Number(blocked[0].count) : 0,
    generatedAt: new Date().toISOString(),
  };
}
