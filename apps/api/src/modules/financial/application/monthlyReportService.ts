import { Prisma } from '@prisma/client';
import type { MonthlyPaymentReportDto, MonthlyPaymentRowDto } from '@smart-campus/shared-types';
import { financialMonthSchema } from '@smart-campus/validation';
import { prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { studentIdentitySelect } from '../../users/application/studentDirectoryService.js';
import { authorizeFinancialRead, salaryInclude, type FinancialActor } from './payrollService.js';

// Maputo usa UTC+02:00; limites do mês são locais, nunca os do browser.
export function monthlyBounds(month: string) {
  financialMonthSchema.parse(month);
  const [year, number] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(year, number - 1, 1) - 2 * 3600000), lt: new Date(Date.UTC(year, number, 1) - 2 * 3600000) };
}
const MAX_REPORT_ROWS = 10000;

export async function monthlyPaymentReport(actor: FinancialActor, kind: 'payments' | 'salaries', month: string): Promise<MonthlyPaymentReportDto> {
  authorizeFinancialRead(actor);
  const paidAt = monthlyBounds(month);
  return prisma.$transaction(async tx => {
    let rows: MonthlyPaymentRowDto[];
    let total = new Prisma.Decimal(0);
    if (kind === 'payments') {
      const payments = await tx.payment.findMany({
        where: { paidAt }, include: { student: { select: studentIdentitySelect }, debt: { select: { title: true } } },
        orderBy: [{ paidAt: 'asc' }, { id: 'asc' }], take: MAX_REPORT_ROWS + 1,
      });
      rows = payments.map(payment => {
        total = total.plus(payment.amountPaid);
        return { id: payment.id, fullName: payment.student.fullName, identityCode: payment.student.studentProfile?.studentNumber ?? null, description: payment.debt.title, amount: payment.amountPaid.toNumber(), paidAt: payment.paidAt.toISOString(), paymentMethod: payment.paymentMethod, referenceCode: payment.referenceCode };
      });
    } else {
      const salaries = await tx.teacherSalary.findMany({
        where: { status: 'PAID', paidAt }, include: salaryInclude,
        orderBy: [{ paidAt: 'asc' }, { id: 'asc' }], take: MAX_REPORT_ROWS + 1,
      });
      rows = salaries.map(salary => {
        total = total.plus(salary.amount);
        return { id: salary.id, fullName: salary.teacher.user.fullName, identityCode: salary.teacher.employeeCode, description: `Salário de ${salary.month}`, amount: salary.amount.toNumber(), paidAt: salary.paidAt!.toISOString(), paymentMethod: salary.paymentMethod!, referenceCode: salary.referenceCode! };
      });
    }
    if (rows.length > MAX_REPORT_ROWS) throw new AppError('REPORT_TOO_LARGE', 'Este mês excede 10 000 pagamentos. Contacte a equipa técnica para obter o relatório completo.', 422);
    return { kind, month, timezone: 'Africa/Maputo', rows, totalPayments: rows.length, totalAmount: total.toNumber(), generatedAt: new Date().toISOString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });
}
