import { AppError } from '../../../lib/errors.js';
import { Prisma } from '@prisma/client';
import {
  createDebtSchema,
  createPaymentSchema,
  createDebtsFromEnrolmentsSchema,
  CreateDebtInput,
  CreatePaymentInput,
  CreateDebtsFromEnrolmentsInput,
  CreateAnalysisRequestInput,
  ResolveAnalysisRequestInput,
  UpdateFinancialPolicyInput,
  FinancialAnalysisQuery,
  FinancialDebtQuery,
  FinancialNotificationQueueQuery,
} from '@smart-campus/validation';
import type { FinancialAnalysisRequestViewDto } from '@smart-campus/shared-types';
import { studentIdentitySelect, toStudentIdentity } from '../../users/application/studentDirectoryService.js';
import { currentMaputoMonth, monthlyBounds } from './monthlyReportService.js';
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
import { dispatchNotificationSafely, retryNotification } from './notificationDeliveryService.js';

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

function derivedDebtWhere(query: Partial<FinancialDebtQuery>, cutoff: Date): Prisma.DebtWhereInput {
  const dueDate: Prisma.DateTimeFilter = {};
  if (query.status === 'VENCIDA') dueDate.lt = cutoff;
  if (query.status === 'PENDENTE') dueDate.gte = cutoff;
  if (query.dueBefore) dueDate.lte = new Date(query.dueBefore);
  return {
    ...(query.studentId ? { studentId: query.studentId } : {}),
    ...(query.origin ? { origin: query.origin } : {}),
    ...(query.status === 'VENCIDA' || query.status === 'PENDENTE'
      ? { status: { in: ['PENDENTE', 'VENCIDA'] } }
      : query.status
        ? { status: query.status }
        : {}),
    ...(Object.keys(dueDate).length ? { dueDate } : {}),
  };
}

export async function listDebts(query: Partial<FinancialDebtQuery> = {}) {
  const policy = await activePolicy(prisma);
  const cutoff = new Date(Date.now() - policy.gracePeriodDays * 86400000);
  const offset = query.offset ?? defaultPage.offset;
  const limit = query.limit ?? defaultPage.limit;
  const where = derivedDebtWhere(query, cutoff);
  const rows = await prisma.debt.findMany({
    where,
    include: { student: { select: studentIdentitySelect } },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
    skip: offset,
    take: limit,
  });
  return rows.map((debt) =>
    toDebtDto({
      ...withCurrentDebtStatus(debt, policy.gracePeriodDays),
      student: toStudentIdentity(debt.student),
    }),
  );
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
  const debt = await prisma.debt.findUnique({
    where: { id },
    include: { student: { select: studentIdentitySelect } },
  });
  if (!debt) return fail(404, 'DEBT_NOT_FOUND', 'Divida nao encontrada.');
  const policy = await activePolicy(prisma);
  return toDebtDto({
    ...withCurrentDebtStatus(debt, policy.gracePeriodDays),
    student: toStudentIdentity(debt.student),
  });
}

export async function cancelDebt(id: string, actorId: string, correlationId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const candidate = await tx.debt.findUnique({ where: { id } });
    if (!candidate) return fail(404, 'DEBT_NOT_FOUND', 'Divida nao encontrada.');
    await lockStudent(tx, candidate.studentId);
    const debt = await tx.debt.findUniqueOrThrow({ where: { id } });
    if (debt.status === 'REGULARIZADA') fail(409, 'DEBT_ALREADY_REGULARIZED', 'Divida ja regularizada.');
    if (debt.status === 'CANCELADA') fail(409, 'DEBT_ALREADY_CANCELLED', 'Divida ja cancelada.');
    const pending = await tx.analysisRequest.findFirst({
      where: { debtId: debt.id, status: 'PENDENTE_ANALISE' },
    });
    if (pending) fail(409, 'ANALYSIS_REQUEST_ALREADY_OPEN', 'Existe um pedido de analise pendente nesta divida.');
    await tx.debt.update({ where: { id: debt.id }, data: { status: 'CANCELADA' } });
    await refreshStanding(tx, debt.studentId);
    const notification = await tx.financialNotification.create({
      data: {
        studentId: debt.studentId,
        title: 'Divida cancelada',
        message: `A divida "${debt.title}" foi cancelada pela tesouraria.`,
        eventType: 'DEBT_CANCELLED',
        resourceId: debt.id,
        correlationId,
      },
    });
    await auditFinancial(tx, 'DEBT_CANCELLED', debt.id, actorId, correlationId, { studentId: debt.studentId });
    return {
      debt: await tx.debt.findUniqueOrThrow({
        where: { id: debt.id },
        include: { student: { select: studentIdentitySelect } },
      }),
      notificationId: notification.id,
    };
  });
  await dispatchNotificationSafely(result.notificationId);
  const policy = await activePolicy(prisma);
  return toDebtDto({
    ...withCurrentDebtStatus(result.debt, policy.gracePeriodDays),
    student: toStudentIdentity(result.debt.student),
  });
}

export async function createDebtsFromEnrolments(
  input: CreateDebtsFromEnrolmentsInput,
  actorId: string,
  correlationId: string,
) {
  const data = createDebtsFromEnrolmentsSchema.parse(input);
  const title = data.title ?? `Propina ${data.academicYear}`;
  const course = await prisma.course.findUnique({ where: { id: data.courseId } });
  if (!course) return fail(404, 'COURSE_NOT_FOUND', 'Curso nao encontrado.');
  const enrolments = await prisma.enrolment.findMany({
    where: { courseId: data.courseId, academicYear: data.academicYear, status: 'ACTIVE' },
    include: { student: { select: { userId: true } } },
  });
  const uniqueUserIds = [...new Set(enrolments.map((row) => row.student.userId))];
  const created: ReturnType<typeof toDebtDto>[] = [];
  let skipped = 0;
  for (const studentId of uniqueUserIds) {
    const existing = await prisma.debt.findFirst({
      where: {
        studentId,
        origin: 'TUITION',
        title,
        status: { in: ['PENDENTE', 'VENCIDA'] },
      },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    created.push(
      await createDebt(
        {
          studentId,
          title,
          amount: data.amount,
          origin: 'TUITION',
          dueDate: data.dueDate,
        },
        actorId,
        correlationId,
      ),
    );
  }
  return { created: created.length, skipped, debts: created };
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
  return {
    ...toAnalysisRequestDto(row),
    student: toStudentIdentity(row.student),
    debt: { ...row.debt, amount: row.debt.amount.toNumber() },
    slaOverdue: row.status === 'PENDENTE_ANALISE' && row.slaDueDate.getTime() < Date.now(),
  };
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
  const orderBy: Prisma.AnalysisRequestOrderByWithRelationInput[] =
    status === 'PENDENTE_ANALISE'
      ? [{ slaDueDate: 'asc' }, { id: 'asc' }]
      : [{ createdAt: 'desc' }, { id: 'asc' }];
  const [rows, total] = await prisma.$transaction([
    prisma.analysisRequest.findMany({ where, include: analysisViewInclude, orderBy, skip: offset, take: limit }),
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
    const policy = await activePolicy(tx);
    const request = await tx.analysisRequest.create({
      data: { ...input, studentId, code: generateCode('AR'), slaDueDate: calculateSlaDueDate(policy.gracePeriodDays) },
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
    const studentIds = [
      ...(await tx.debt.findMany({ select: { studentId: true }, distinct: ['studentId'] })),
      ...(await tx.financialStatus.findMany({ select: { studentId: true } })),
    ].map((row) => row.studentId);
    for (const studentId of new Set(studentIds)) {
      await refreshStanding(tx, studentId);
    }
    return toPolicyDto(policy);
  });
}

export async function getReport() {
  const policy = await activePolicy(prisma);
  const cutoff = new Date(Date.now() - policy.gracePeriodDays * 86400000);
  const open = { status: { in: ['PENDENTE', 'VENCIDA'] as Array<'PENDENTE' | 'VENCIDA'> } };
  const month = monthlyBounds(currentMaputoMonth());
  const [totalDebts, pendentes, vencidas, regularizadas, canceladas, totalPayments, blocked, outstandingSum, overdueSum, collectedMonth] =
    await Promise.all([
      prisma.debt.count(),
      prisma.debt.count({ where: { ...open, dueDate: { gte: cutoff } } }),
      prisma.debt.count({ where: { ...open, dueDate: { lt: cutoff } } }),
      prisma.debt.count({ where: { status: 'REGULARIZADA' } }),
      prisma.debt.count({ where: { status: 'CANCELADA' } }),
      prisma.payment.count(),
      prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM
      (SELECT "studentId" FROM debts WHERE status IN ('PENDENTE', 'VENCIDA') AND "dueDate" < ${cutoff}
       GROUP BY "studentId" HAVING SUM(amount) > ${policy.maxDebtAmount.toNumber()}) AS blocked`,
      prisma.debt.aggregate({ where: { ...open, dueDate: { gte: cutoff } }, _sum: { amount: true } }),
      prisma.debt.aggregate({ where: { ...open, dueDate: { lt: cutoff } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { paidAt: month }, _sum: { amountPaid: true } }),
    ]);
  const outstanding =
    (outstandingSum._sum.amount ?? new Prisma.Decimal(0)).plus(overdueSum._sum.amount ?? 0).toNumber();
  return {
    totalDebts,
    byStatus: { pendentes, vencidas, regularizadas, canceladas },
    totals: {
      outstanding,
      overdue: overdueSum._sum.amount?.toNumber() ?? 0,
      collectedMonth: collectedMonth._sum.amountPaid?.toNumber() ?? 0,
    },
    totalPayments,
    studentsBlocked: policy.autoBlockEnabled ? Number(blocked[0].count) : 0,
    generatedAt: new Date().toISOString(),
  };
}

export async function listBlockedStudents(page: Page = { offset: 0, limit: 20 }) {
  const policy = await activePolicy(prisma);
  if (!policy.autoBlockEnabled) return { data: [], meta: { total: 0, offset: page.offset, limit: page.limit, hasMore: false } };
  const cutoff = new Date(Date.now() - policy.gracePeriodDays * 86400000);
  const grouped = await prisma.$queryRaw<Array<{ studentId: string; overdueCount: bigint; overdueAmount: Prisma.Decimal }>>`
    SELECT "studentId", COUNT(*)::bigint AS "overdueCount", SUM(amount) AS "overdueAmount"
    FROM debts
    WHERE status IN ('PENDENTE', 'VENCIDA') AND "dueDate" < ${cutoff}
    GROUP BY "studentId"
    HAVING SUM(amount) > ${policy.maxDebtAmount.toNumber()}
    ORDER BY "studentId" ASC
  `;
  const total = grouped.length;
  const slice = grouped.slice(page.offset, page.offset + page.limit);
  const users = await prisma.user.findMany({
    where: { id: { in: slice.map((row) => row.studentId) } },
    select: studentIdentitySelect,
  });
  const byId = new Map(users.map((user) => [user.id, toStudentIdentity(user)]));
  const standings = await prisma.financialStatus.findMany({
    where: { studentId: { in: slice.map((row) => row.studentId) } },
  });
  const standingById = new Map(standings.map((row) => [row.studentId, row]));
  return {
    data: slice.map((row) => {
      const standing = standingById.get(row.studentId);
      return {
        student: byId.get(row.studentId) ?? { userId: row.studentId, fullName: 'Estudante', studentNumber: null, isActive: true },
        status: 'BLOCKED' as const,
        reason: standing?.reason ?? null,
        overdueDebtsCount: Number(row.overdueCount),
        totalOverdueAmount: Number(row.overdueAmount),
        blockedAt: standing?.blockedAt?.toISOString() ?? null,
      };
    }),
    meta: { total, offset: page.offset, limit: page.limit, hasMore: page.offset + slice.length < total },
  };
}

export async function getPaymentReceipt(id: string, actor: { id: string; role: string }) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      student: { select: studentIdentitySelect },
      debt: { select: { id: true, code: true, title: true, amount: true } },
    },
  });
  if (!payment) return fail(404, 'PAYMENT_NOT_FOUND', 'Pagamento nao encontrado.');
  if (actor.role === 'STUDENT' && actor.id !== payment.studentId) {
    fail(403, 'FORBIDDEN', 'Nao pode consultar o comprovativo de outro estudante.');
  }
  if (!['STUDENT', 'FINANCE', 'ADMIN'].includes(actor.role)) fail(403, 'FORBIDDEN', 'Sem permissao.');
  return {
    kind: 'payment' as const,
    payment: toPaymentDto(payment),
    student: toStudentIdentity(payment.student),
    debt: { ...payment.debt, amount: payment.debt.amount.toNumber() },
  };
}

export async function listNotificationQueue(query: FinancialNotificationQueueQuery) {
  const { offset, limit, deliveryStatus } = query;
  const where: Prisma.FinancialNotificationWhereInput = deliveryStatus ? { deliveryStatus } : {};
  const [rows, total] = await prisma.$transaction([
    prisma.financialNotification.findMany({
      where,
      include: { student: { select: studentIdentitySelect } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: offset,
      take: limit,
    }),
    prisma.financialNotification.count({ where }),
  ]);
  return {
    data: rows.map((row) => ({
      id: row.id,
      student: toStudentIdentity(row.student),
      title: row.title,
      message: row.message,
      eventType: row.eventType,
      deliveryStatus: row.deliveryStatus,
      attempts: row.attempts,
      lastError: row.lastError,
      nextAttemptAt:
        row.deliveryStatus === 'PENDING' || row.deliveryStatus === 'FAILED' ? row.nextAttemptAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    })),
    meta: { total, offset, limit, hasMore: offset + rows.length < total },
  };
}

export async function retryFailedNotifications(actorId: string, correlationId: string) {
  const failed = await prisma.financialNotification.findMany({
    where: { deliveryStatus: 'FAILED' },
    select: { id: true },
    take: 20,
    orderBy: { nextAttemptAt: 'asc' },
  });
  const results = [];
  for (const item of failed) {
    results.push(await retryNotification(item.id, actorId, correlationId));
  }
  return { retried: results.length, results };
}

export async function assertUserFinanciallyClear(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user || user.role.code !== 'STUDENT') return;
  const standing = await getStudentStatus(userId);
  if (standing.status === 'BLOCKED') {
    fail(403, 'FINANCIAL_BLOCKED', 'Deve regularizar a sua situação financeira para continuar.');
  }
}
