import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentReceiptDto, SalaryReceiptDto } from '@smart-campus/shared-types';
import { buildPrintHtml, printDocument } from '../../lib/print';
import { printPaymentReceipt, printSalaryReceipt } from './printReceipts';

vi.mock('../../lib/print', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/print')>(),
  printDocument: vi.fn(),
}));

describe('comprovativos financeiros', () => {
  beforeEach(() => vi.mocked(printDocument).mockClear());

  it('gera comprovativo de pagamento com os dados e assinaturas corretos', () => {
    printPaymentReceipt({
      kind: 'payment',
      payment: { code: 'PAG-001', amountPaid: 1500, paymentMethod: 'POS', referenceCode: 'REF-001', paidAt: '2026-11-06T10:00:00Z' },
      student: { fullName: 'Estudante Teste', studentNumber: 'EST-001' },
      debt: { id: 'd1', code: 'DIV-001', title: 'Propina', amount: 1500 },
    } as PaymentReceiptDto);
    expect(printDocument).toHaveBeenCalledOnce();
    const html = buildPrintHtml(vi.mocked(printDocument).mock.calls[0][0]);
    for (const value of ['Comprovativo de pagamento', 'PAG-001', 'Estudante Teste', 'EST-001', 'DIV-001', 'REF-001', 'Tesouraria', 'Recebido por']) expect(html).toContain(value);
    expect(html).toContain('size: A4 portrait');
  });

  it('gera comprovativo salarial com referência, período e assinaturas corretos', () => {
    printSalaryReceipt({
      kind: 'salary',
      salary: { employee: { fullName: 'Funcionário Teste', employeeCode: 'FUN-001' }, month: '2026-11', amount: 20000, paymentMethod: 'POS', referenceCode: 'SAL-REF', paidAt: '2026-11-06T10:00:00Z' },
    } as SalaryReceiptDto);
    expect(printDocument).toHaveBeenCalledOnce();
    const html = buildPrintHtml(vi.mocked(printDocument).mock.calls[0][0]);
    for (const value of ['Comprovativo de pagamento salarial', 'Funcionário Teste', 'FUN-001', '2026-11', 'SAL-REF', 'Tesouraria', 'Funcionário']) expect(html).toContain(value);
    expect(html).toContain('size: A4 portrait');
  });
});
