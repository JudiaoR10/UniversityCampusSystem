import { randomUUID } from 'crypto';
// domain/financial.domain.ts
// Camada de dominio: tipos puros e funcoes de mapeamento (sem Prisma, sem Express)

import {
  DebtDto,
  PaymentDto,
  FinancialStatusDto,
  AnalysisRequestDto,
  FinancialNotificationDto,
  FinancialPolicyDto,
} from '@smart-campus/shared-types';

// Gera um codigo legivel com identificador aleatorio resistente a colisoes
// Formato: prefixo-ano-UUID; nao representa uma sequencia contabilistica.
export function generateCode(prefix: string): string {
  const year = new Date().getFullYear();
  const random = randomUUID();
  return `${prefix}-${year}-${random}`;
}

// Calcula a data limite de SLA para um Pedido de Analise (5 dias uteis por defeito)
export function calculateSlaDueDate(graceDays: number = 5): Date {
  const date = new Date();
  for (let remaining = graceDays; remaining > 0; ) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) remaining--;
  }
  return date;
}

// Converte um registo Prisma de Debt para DebtDto (formato da API)
export function toDebtDto(debt: {
  id: string;
  code: string;
  studentId: string;
  title: string;
  description: string | null;
  amount: { toNumber(): number };
  origin: string;
  dueDate: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): DebtDto {
  return {
    id: debt.id,
    code: debt.code,
    studentId: debt.studentId,
    title: debt.title,
    description: debt.description ?? undefined,
    amount: debt.amount.toNumber(),
    origin: debt.origin,
    dueDate: debt.dueDate.toISOString(),
    status: debt.status as DebtDto['status'],
    createdAt: debt.createdAt.toISOString(),
    updatedAt: debt.updatedAt.toISOString(),
  };
}

// Converte um registo Prisma de Payment para PaymentDto
export function toPaymentDto(payment: {
  id: string;
  code: string;
  debtId: string;
  studentId: string;
  amountPaid: { toNumber(): number };
  paymentMethod: string;
  referenceCode: string;
  confirmedById: string;
  paidAt: Date;
  createdAt: Date;
}): PaymentDto {
  return {
    id: payment.id,
    code: payment.code,
    debtId: payment.debtId,
    studentId: payment.studentId,
    amountPaid: payment.amountPaid.toNumber(),
    paymentMethod: payment.paymentMethod as PaymentDto['paymentMethod'],
    referenceCode: payment.referenceCode,
    confirmedById: payment.confirmedById,
    paidAt: payment.paidAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
  };
}

// Converte um registo Prisma de FinancialStatus para FinancialStatusDto
export function toFinancialStatusDto(fs: {
  id: string;
  studentId: string;
  status: string;
  blockedAt: Date | null;
  reason: string | null;
  updatedAt: Date;
}): FinancialStatusDto {
  return {
    id: fs.id,
    studentId: fs.studentId,
    status: fs.status as FinancialStatusDto['status'],
    blockedAt: fs.blockedAt?.toISOString() ?? undefined,
    reason: fs.reason ?? undefined,
    updatedAt: fs.updatedAt.toISOString(),
  };
}

// Converte um registo Prisma de AnalysisRequest para AnalysisRequestDto
export function toAnalysisRequestDto(ar: {
  id: string;
  code: string;
  debtId: string;
  studentId: string;
  reason: string;
  status: string;
  slaDueDate: Date;
  resolvedById: string | null;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AnalysisRequestDto {
  return {
    id: ar.id,
    code: ar.code,
    debtId: ar.debtId,
    studentId: ar.studentId,
    reason: ar.reason,
    status: ar.status as AnalysisRequestDto['status'],
    slaDueDate: ar.slaDueDate.toISOString(),
    resolvedById: ar.resolvedById ?? undefined,
    resolvedAt: ar.resolvedAt?.toISOString() ?? undefined,
    resolutionNotes: ar.resolutionNotes ?? undefined,
    createdAt: ar.createdAt.toISOString(),
    updatedAt: ar.updatedAt.toISOString(),
  };
}

// Converte um registo Prisma de FinancialNotification para FinancialNotificationDto
export function toNotificationDto(n: {
  id: string;
  studentId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}): FinancialNotificationDto {
  return {
    id: n.id,
    studentId: n.studentId,
    title: n.title,
    message: n.message,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

// Converte um registo Prisma de FinancialPolicy para FinancialPolicyDto
export function toPolicyDto(p: {
  id: string;
  code: string;
  gracePeriodDays: number;
  autoBlockEnabled: boolean;
  maxDebtAmount: { toNumber(): number };
  updatedAt: Date;
}): FinancialPolicyDto {
  return {
    id: p.id,
    code: p.code,
    gracePeriodDays: p.gracePeriodDays,
    autoBlockEnabled: p.autoBlockEnabled,
    maxDebtAmount: p.maxDebtAmount.toNumber(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
