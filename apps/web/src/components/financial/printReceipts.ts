import type { PaymentReceiptDto, SalaryReceiptDto } from '@smart-campus/shared-types';
import { printDocument } from '../../lib/print';
import { date, money } from './shared';

const methods: Record<string, string> = {
  BANK_TRANSFER: 'Transferência bancária',
  CASH_DEPOSIT: 'Depósito',
  MOBILE_MONEY: 'Carteira móvel',
  POS: 'POS',
};

export function printPaymentReceipt(receipt: PaymentReceiptDto) {
  printDocument({
    title: 'Comprovativo de pagamento',
    summary: [{ label: 'Valor pago', value: money(receipt.payment.amountPaid) }],
    signatures: ['Tesouraria', 'Recebido por'],
    subtitle: receipt.payment.code,
    eyebrow: 'Tesouraria',
    meta: [
      `Estudante: ${receipt.student.fullName}`,
      `Matrícula: ${receipt.student.studentNumber ?? 'Sem matrícula'}`,
    ],
    columns: ['Campo', 'Valor'],
    rows: [
      ['Estudante', receipt.student.fullName],
      ['Matrícula', receipt.student.studentNumber ?? '—'],
      ['Dívida', `${receipt.debt.code} · ${receipt.debt.title}`],
      ['Valor pago', money(receipt.payment.amountPaid)],
      ['Método', methods[receipt.payment.paymentMethod] ?? receipt.payment.paymentMethod],
      ['Referência', receipt.payment.referenceCode],
      ['Confirmado em', date(receipt.payment.paidAt)],
    ],
    footer: 'Confirmação interna de tesouraria. Não constitui transferência bancária.',
  });
}

export function printSalaryReceipt(receipt: SalaryReceiptDto) {
  const salary = receipt.salary;
  printDocument({
    title: 'Comprovativo de pagamento salarial',
    summary: [{ label: 'Valor pago', value: money(salary.amount) }],
    signatures: ['Tesouraria', 'Funcionário'],
    subtitle: salary.employee.fullName,
    eyebrow: 'Tesouraria',
    meta: [`Código: ${salary.employee.employeeCode}`, `Período: ${salary.month}`],
    columns: ['Campo', 'Valor'],
    rows: [
      ['Funcionário', salary.employee.fullName],
      ['Código', salary.employee.employeeCode],
      ['Período', salary.month],
      ['Valor', money(salary.amount)],
      ['Método', salary.paymentMethod ? methods[salary.paymentMethod] ?? salary.paymentMethod : '—'],
      ['Referência', salary.referenceCode ?? '—'],
      ['Pago em', salary.paidAt ? date(salary.paidAt) : '—'],
    ],
    footer: 'Confirmação interna de tesouraria. Não constitui transferência bancária.',
  });
}
