import { Prisma } from '@prisma/client';
import type { MonthlyPaymentReportDto, MonthlyPaymentRowDto } from '@smart-campus/shared-types';
import { financialMonthSchema } from '@smart-campus/validation';
import { prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../lib/errors.js';
import { studentIdentitySelect } from '../../users/application/studentDirectoryService.js';
import { authorizeFinancialRead, type FinancialActor } from './payrollService.js';

// Maputo usa UTC+02:00; limites do mês são locais, nunca os do browser.
export function monthlyBounds(month: string) {
  financialMonthSchema.parse(month);
  const [year, number] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(year, number - 1, 1) - 2 * 3600000), lt: new Date(Date.UTC(year, number, 1) - 2 * 3600000) };
}

export function currentMaputoMonth() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Maputo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}`;
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
      const salaries = await tx.employeeSalary.findMany({
        where: { status: 'PAID', paidAt },
        include: { compensation: { include: {
          user: { select: { fullName: true, role: { select: { code: true } }, teacherProfile: { select: { employeeCode: true } } } },
          externalEmployee: { select: { fullName: true, employeeCode: true } },
        } } },
        orderBy: [{ paidAt: 'asc' }, { id: 'asc' }], take: MAX_REPORT_ROWS + 1,
      });
      rows = salaries.map(salary => {
        total = total.plus(salary.amount);
        const user = salary.compensation.user;
        const external = salary.compensation.externalEmployee;
        return {
          id: salary.id,
          fullName: user?.fullName ?? external?.fullName ?? 'Funcionário',
          identityCode: user?.teacherProfile?.employeeCode ?? external?.employeeCode ?? (user ? `${user.role.code}-${salary.compensation.userId?.slice(-8).toUpperCase()}` : null),
          description: `Salário de ${salary.month}`, amount: salary.amount.toNumber(),
          paidAt: salary.paidAt!.toISOString(), paymentMethod: salary.paymentMethod!,
          referenceCode: salary.referenceCode!,
        };
      });
    }
    if (rows.length > MAX_REPORT_ROWS) throw new AppError('REPORT_TOO_LARGE', 'Este mês excede 10 000 pagamentos. Contacte a equipa técnica para obter o relatório completo.', 422);
    return { kind, month, timezone: 'Africa/Maputo', rows, totalPayments: rows.length, totalAmount: total.toNumber(), generatedAt: new Date().toISOString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 });
}
