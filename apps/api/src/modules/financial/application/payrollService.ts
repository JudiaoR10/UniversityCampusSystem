import { Prisma, type EmployeeCategory, type RoleCode } from '@prisma/client';
import type { CourseTuitionDto, EmployeeDto, EmployeeSalaryDto, SalaryChangeRequestDto } from '@smart-campus/shared-types';
import {
  createExternalEmployeeSchema, createSalaryChangeSchema, createSalarySchema, reviewSalaryChangeSchema,
  salaryPaymentSchema, updateCourseTuitionSchema, type CreateExternalEmployeeInput,
  type CreateSalaryChangeInput, type CreateSalaryInput, type EmployeeQuery, type ReviewSalaryChangeInput,
  type SalaryChangeQuery, type SalaryPaymentInput, type SalaryQuery, type UpdateCourseTuitionInput,
} from '@smart-campus/validation';
import { prisma } from '../../../lib/prisma.js';
import { conflict, forbidden, notFound } from '../../../lib/errors.js';

export type FinancialActor = { id: string; role: string };
export function authorizeFinancialRead(actor: FinancialActor) {
  if (!['FINANCE', 'ADMIN'].includes(actor.role)) throw forbidden();
}
function authorizeFinance(actor: FinancialActor) {
  if (actor.role !== 'FINANCE') throw forbidden('Só a área Financeira pode executar esta operação.');
}
function authorizeAdmin(actor: FinancialActor) {
  if (actor.role !== 'ADMIN') throw forbidden('Só o administrador pode aprovar ou rejeitar alterações salariais.');
}

const compensationInclude = {
  user: { select: {
    id: true, fullName: true, isActive: true,
    role: { select: { code: true } },
    teacherProfile: { select: { employeeCode: true } },
  } },
  externalEmployee: true,
} satisfies Prisma.EmployeeCompensationInclude;
type CompensationRow = Prisma.EmployeeCompensationGetPayload<{ include: typeof compensationInclude }>;
const salaryInclude = { compensation: { include: compensationInclude } } satisfies Prisma.EmployeeSalaryInclude;
type SalaryRow = Prisma.EmployeeSalaryGetPayload<{ include: typeof salaryInclude }>;
const requestInclude = {
  compensation: { include: compensationInclude },
  requestedBy: { select: { id: true, fullName: true } },
  reviewedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.SalaryChangeRequestInclude;
type RequestRow = Prisma.SalaryChangeRequestGetPayload<{ include: typeof requestInclude }>;

const coreRoleCodes: RoleCode[] = ['TEACHER', 'TECHNICIAN', 'COORDINATOR', 'FINANCE', 'ADMIN'];
const categoryByRole: Partial<Record<RoleCode, EmployeeCategory>> = {
  TEACHER: 'TEACHER', TECHNICIAN: 'TECHNICIAN', COORDINATOR: 'COORDINATOR',
  FINANCE: 'FINANCE', ADMIN: 'ADMINISTRATIVE',
};
const titleByCategory: Record<EmployeeCategory, string> = {
  TEACHER: 'Docente', TECHNICIAN: 'Técnico', COORDINATOR: 'Coordenador',
  ADMINISTRATIVE: 'Administrativo', FINANCE: 'Financeiro', CLEANER: 'Agente de limpeza',
  GUARD: 'Guarda', OTHER: 'Outro',
};
function coreCode(role: string, id: string, teacherCode?: string | null) {
  return teacherCode ?? `${role}-${id.slice(-8).toUpperCase()}`;
}
function employeeFromCompensation(row: CompensationRow): EmployeeDto {
  if (row.user) {
    const category = categoryByRole[row.user.role.code] ?? 'OTHER';
    return {
      employeeKey: `CORE:${row.user.id}`, userId: row.user.id, externalEmployeeId: null,
      employeeCode: coreCode(row.user.role.code, row.user.id, row.user.teacherProfile?.employeeCode),
      fullName: row.user.fullName, category, jobTitle: titleByCategory[category],
      isActive: row.user.isActive, source: 'CORE',
      currentSalary: row.approvedAt ? row.currentAmount.toNumber() : null,
      salaryApprovedAt: row.approvedAt?.toISOString() ?? null,
    };
  }
  if (row.externalEmployee) return {
    employeeKey: `EXTERNAL:${row.externalEmployee.id}`, userId: null,
    externalEmployeeId: row.externalEmployee.id, employeeCode: row.externalEmployee.employeeCode,
    fullName: row.externalEmployee.fullName, category: row.externalEmployee.category,
    jobTitle: row.externalEmployee.jobTitle, isActive: row.externalEmployee.isActive, source: 'EXTERNAL',
    currentSalary: row.approvedAt ? row.currentAmount.toNumber() : null,
    salaryApprovedAt: row.approvedAt?.toISOString() ?? null,
  };
  throw new Error('Compensação sem funcionário associado.');
}
export function toSalaryDto(row: SalaryRow): EmployeeSalaryDto {
  return {
    id: row.id, employee: employeeFromCompensation(row.compensation), month: row.month,
    amount: row.amount.toNumber(), notes: row.notes, status: row.status,
    paymentMethod: row.paymentMethod, referenceCode: row.referenceCode,
    paidAt: row.paidAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
function toRequestDto(row: RequestRow): SalaryChangeRequestDto {
  return {
    id: row.id, employee: employeeFromCompensation(row.compensation),
    currentAmount: row.compensation.approvedAt ? row.compensation.currentAmount.toNumber() : null,
    proposedAmount: row.proposedAmount.toNumber(), reason: row.reason, status: row.status,
    requestedBy: row.requestedBy, reviewedBy: row.reviewedBy, reviewNotes: row.reviewNotes,
    reviewedAt: row.reviewedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
async function audit(
  tx: Prisma.TransactionClient, actor: FinancialActor, correlationId: string, action: string,
  resource: string, resourceId: string, metadata: Prisma.InputJsonValue,
) {
  await tx.auditEvent.create({ data: { actorId: actor.id, correlationId, action, resource, resourceId, metadata } });
}

export async function listEmployees(actor: FinancialActor, query: EmployeeQuery) {
  authorizeFinancialRead(actor);
  const { q, category, active, offset, limit } = query;
  const coreUsers = await prisma.user.findMany({
    where: {
      role: { code: { in: coreRoleCodes } },
      ...(active === undefined ? {} : { isActive: active }),
      ...(q ? { OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { teacherProfile: { employeeCode: { contains: q, mode: 'insensitive' } } },
      ] } : {}),
    },
    select: {
      id: true, fullName: true, isActive: true, role: { select: { code: true } },
      teacherProfile: { select: { employeeCode: true } },
      employeeCompensation: { select: { currentAmount: true, approvedAt: true } },
    },
  });
  const external = await prisma.externalEmployee.findMany({
    where: {
      ...(active === undefined ? {} : { isActive: active }), ...(category ? { category } : {}),
      ...(q ? { OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { employeeCode: { contains: q, mode: 'insensitive' } },
        { jobTitle: { contains: q, mode: 'insensitive' } },
      ] } : {}),
    },
    include: { compensation: { select: { currentAmount: true, approvedAt: true } } },
  });
  const core: EmployeeDto[] = coreUsers
    .filter(user => !category || categoryByRole[user.role.code] === category)
    .map(user => {
      const employeeCategory = categoryByRole[user.role.code] ?? 'OTHER';
      return {
        employeeKey: `CORE:${user.id}`, userId: user.id, externalEmployeeId: null,
        employeeCode: coreCode(user.role.code, user.id, user.teacherProfile?.employeeCode),
        fullName: user.fullName, category: employeeCategory, jobTitle: titleByCategory[employeeCategory],
        isActive: user.isActive, source: 'CORE' as const,
        currentSalary: user.employeeCompensation?.approvedAt ? user.employeeCompensation.currentAmount.toNumber() : null,
        salaryApprovedAt: user.employeeCompensation?.approvedAt?.toISOString() ?? null,
      };
    });
  const all: EmployeeDto[] = [...core, ...external.map(item => ({
    employeeKey: `EXTERNAL:${item.id}`, userId: null, externalEmployeeId: item.id,
    employeeCode: item.employeeCode, fullName: item.fullName, category: item.category,
    jobTitle: item.jobTitle, isActive: item.isActive, source: 'EXTERNAL' as const,
    currentSalary: item.compensation?.approvedAt ? item.compensation.currentAmount.toNumber() : null,
    salaryApprovedAt: item.compensation?.approvedAt?.toISOString() ?? null,
  }))].sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt'));
  return {
    data: all.slice(offset, offset + limit),
    meta: { total: all.length, offset, limit, hasMore: offset + limit < all.length },
  };
}

export async function createExternalEmployee(
  actor: FinancialActor, input: CreateExternalEmployeeInput, correlationId: string,
) {
  authorizeFinance(actor);
  const data = createExternalEmployeeSchema.parse(input);
  try {
    const external = await prisma.$transaction(async tx => {
      const created = await tx.externalEmployee.create({ data });
      await audit(tx, actor, correlationId, 'EXTERNAL_EMPLOYEE_CREATED', 'financial_employee', created.id, {
        employeeCode: created.employeeCode, category: created.category,
      });
      return created;
    });
    return {
      employeeKey: `EXTERNAL:${external.id}`, userId: null, externalEmployeeId: external.id,
      employeeCode: external.employeeCode, fullName: external.fullName, category: external.category,
      jobTitle: external.jobTitle, isActive: external.isActive, source: 'EXTERNAL' as const,
      currentSalary: null, salaryApprovedAt: null,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('EMPLOYEE_CODE_EXISTS', 'Já existe um funcionário com este código.');
    }
    throw error;
  }
}

async function ensureCompensation(tx: Prisma.TransactionClient, employeeKey: string) {
  const [source, id] = employeeKey.split(':', 2);
  if (!id || !['CORE', 'EXTERNAL'].includes(source)) {
    throw notFound('EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado.');
  }
  if (source === 'CORE') {
    const user = await tx.user.findFirst({ where: { id, role: { code: { in: coreRoleCodes } } } });
    if (!user) throw notFound('EMPLOYEE_NOT_FOUND', 'Funcionário não encontrado no Core.');
    return tx.employeeCompensation.upsert({ where: { userId: id }, create: { userId: id }, update: {} });
  }
  const external = await tx.externalEmployee.findUnique({ where: { id } });
  if (!external) throw notFound('EMPLOYEE_NOT_FOUND', 'Funcionário externo não encontrado.');
  return tx.employeeCompensation.upsert({
    where: { externalEmployeeId: id }, create: { externalEmployeeId: id }, update: {},
  });
}

export async function listSalaryChangeRequests(actor: FinancialActor, query: SalaryChangeQuery) {
  authorizeFinancialRead(actor);
  const { status, offset, limit } = query;
  const where: Prisma.SalaryChangeRequestWhereInput = status ? { status } : {};
  const [rows, total] = await prisma.$transaction([
    prisma.salaryChangeRequest.findMany({
      where, include: requestInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: offset, take: limit,
    }),
    prisma.salaryChangeRequest.count({ where }),
  ]);
  return { data: rows.map(toRequestDto), meta: { total, offset, limit, hasMore: offset + rows.length < total } };
}
export async function createSalaryChangeRequest(
  actor: FinancialActor, input: CreateSalaryChangeInput, correlationId: string,
) {
  authorizeFinance(actor);
  const data = createSalaryChangeSchema.parse(input);
  return prisma.$transaction(async tx => {
    const compensation = await ensureCompensation(tx, data.employeeKey);
    const pending = await tx.salaryChangeRequest.findFirst({
      where: { compensationId: compensation.id, status: 'PENDING' },
    });
    if (pending) throw conflict('SALARY_CHANGE_PENDING', 'Este funcionário já possui uma proposta salarial pendente.');
    const row = await tx.salaryChangeRequest.create({
      data: {
        compensationId: compensation.id, proposedAmount: data.proposedAmount,
        reason: data.reason, requestedById: actor.id,
      },
      include: requestInclude,
    });
    await audit(tx, actor, correlationId, 'SALARY_CHANGE_REQUESTED', 'salary_change_request', row.id, {
      employeeKey: data.employeeKey, proposedAmount: row.proposedAmount.toString(),
    });
    return toRequestDto(row);
  });
}
export async function reviewSalaryChangeRequest(
  actor: FinancialActor, id: string, input: ReviewSalaryChangeInput, correlationId: string,
) {
  authorizeAdmin(actor);
  const data = reviewSalaryChangeSchema.parse(input);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM salary_change_requests WHERE id = ${id} FOR UPDATE`;
    const current = await tx.salaryChangeRequest.findUnique({ where: { id } });
    if (!current) throw notFound('SALARY_CHANGE_NOT_FOUND', 'Proposta salarial não encontrada.');
    if (current.status !== 'PENDING') throw conflict('SALARY_CHANGE_REVIEWED', 'Esta proposta já foi analisada.');
    const reviewedAt = new Date();
    if (data.decision === 'APPROVED') {
      await tx.employeeCompensation.update({
        where: { id: current.compensationId },
        data: { currentAmount: current.proposedAmount, approvedAt: reviewedAt },
      });
    }
    const row = await tx.salaryChangeRequest.update({
      where: { id },
      data: {
        status: data.decision, reviewNotes: data.reviewNotes,
        reviewedById: actor.id, reviewedAt,
      },
      include: requestInclude,
    });
    await audit(
      tx, actor, correlationId,
      data.decision === 'APPROVED' ? 'SALARY_CHANGE_APPROVED' : 'SALARY_CHANGE_REJECTED',
      'salary_change_request', id,
      { proposedAmount: row.proposedAmount.toString(), reviewNotes: data.reviewNotes },
    );
    return toRequestDto(row);
  });
}

export async function listSalaries(actor: FinancialActor, query: SalaryQuery) {
  authorizeFinancialRead(actor);
  const { month, offset, limit } = query;
  const [rows, total] = await prisma.$transaction([
    prisma.employeeSalary.findMany({
      where: { month }, include: salaryInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: offset, take: limit,
    }),
    prisma.employeeSalary.count({ where: { month } }),
  ]);
  return { data: rows.map(toSalaryDto), meta: { total, offset, limit, hasMore: offset + rows.length < total } };
}
export async function createSalary(actor: FinancialActor, input: CreateSalaryInput, correlationId: string) {
  authorizeFinance(actor);
  const data = createSalarySchema.parse(input);
  return prisma.$transaction(async tx => {
    const compensation = await ensureCompensation(tx, data.employeeKey);
    if (!compensation.approvedAt || compensation.currentAmount.lte(0)) {
      throw conflict('SALARY_NOT_APPROVED', 'O salário precisa de aprovação do administrador antes de gerar o pagamento mensal.');
    }
    try {
      const row = await tx.employeeSalary.create({
        data: {
          compensationId: compensation.id, month: data.month,
          amount: compensation.currentAmount, notes: data.notes,
        },
        include: salaryInclude,
      });
      await audit(tx, actor, correlationId, 'EMPLOYEE_SALARY_CREATED', 'financial_salary', row.id, {
        employeeKey: data.employeeKey, month: data.month, amount: row.amount.toString(),
      });
      return toSalaryDto(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw conflict('SALARY_ALREADY_EXISTS', 'Já existe um salário para este funcionário e período.');
      }
      throw error;
    }
  });
}
export async function paySalary(
  actor: FinancialActor, id: string, input: SalaryPaymentInput, correlationId: string,
) {
  authorizeFinance(actor);
  const data = salaryPaymentSchema.parse(input);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM employee_salaries WHERE id = ${id} FOR UPDATE`;
    const current = await tx.employeeSalary.findUnique({ where: { id } });
    if (!current) throw notFound('SALARY_NOT_FOUND', 'Salário não encontrado.');
    if (current.status !== 'PENDING') throw conflict('SALARY_ALREADY_PAID', 'Este salário já foi pago.');
    if (current.updatedAt.toISOString() !== data.expectedUpdatedAt) {
      throw conflict('SALARY_CHANGED', 'O salário foi alterado. Actualize a lista antes de continuar.');
    }
    if (!current.amount.equals(data.amountPaid)) {
      throw conflict('SALARY_AMOUNT_CHANGED', 'O montante deve corresponder ao salário integral.');
    }
    const row = await tx.employeeSalary.update({
      where: { id },
      data: {
        status: 'PAID', paidAt: new Date(), paymentMethod: data.paymentMethod,
        referenceCode: data.referenceCode,
      },
      include: salaryInclude,
    });
    await audit(tx, actor, correlationId, 'SALARY_PAYMENT_RECORDED', 'financial_salary', id, {
      amount: row.amount.toString(), paymentMethod: row.paymentMethod, referenceCode: row.referenceCode,
    });
    return toSalaryDto(row);
  });
}

export async function listCourseTuitions(actor: FinancialActor) {
  authorizeFinancialRead(actor);
  const courses = await prisma.course.findMany({
    include: { department: { select: { name: true } }, tuition: true },
    orderBy: [{ department: { name: 'asc' } }, { name: 'asc' }],
  });
  return courses.map<CourseTuitionDto>(course => ({
    courseId: course.id, courseCode: course.code, courseName: course.name,
    departmentName: course.department.name, amount: course.tuition?.amount.toNumber() ?? null,
    notes: course.tuition?.notes ?? '', updatedAt: course.tuition?.updatedAt.toISOString() ?? null,
  }));
}
export async function updateCourseTuition(
  actor: FinancialActor, courseId: string, input: UpdateCourseTuitionInput, correlationId: string,
) {
  authorizeFinance(actor);
  const data = updateCourseTuitionSchema.parse(input);
  return prisma.$transaction(async tx => {
    const course = await tx.course.findUnique({
      where: { id: courseId }, include: { department: { select: { name: true } } },
    });
    if (!course) throw notFound('COURSE_NOT_FOUND', 'Curso não encontrado no módulo académico.');
    const tuition = await tx.courseTuition.upsert({
      where: { courseId },
      create: { courseId, amount: data.amount, notes: data.notes, updatedById: actor.id },
      update: { amount: data.amount, notes: data.notes, updatedById: actor.id },
    });
    await audit(tx, actor, correlationId, 'COURSE_TUITION_UPDATED', 'course_tuition', tuition.id, {
      courseId, amount: tuition.amount.toString(),
    });
    return {
      courseId: course.id, courseCode: course.code, courseName: course.name,
      departmentName: course.department.name, amount: tuition.amount.toNumber(),
      notes: tuition.notes, updatedAt: tuition.updatedAt.toISOString(),
    } satisfies CourseTuitionDto;
  });
}

export async function getSalaryReceipt(actor: FinancialActor, id: string) {
  authorizeFinancialRead(actor);
  const row = await prisma.employeeSalary.findUnique({ where: { id }, include: salaryInclude });
  if (!row) throw notFound('SALARY_NOT_FOUND', 'Salário não encontrado.');
  if (row.status !== 'PAID') throw conflict('SALARY_NOT_PAID', 'O comprovativo só está disponível após o pagamento.');
  return { kind: 'salary' as const, salary: toSalaryDto(row) };
}
