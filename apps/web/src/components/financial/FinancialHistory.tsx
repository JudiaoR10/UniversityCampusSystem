import { useCallback, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { date, money, LoadState, Pagination, useFinancialLoad } from './shared';

const methods: Record<string, string> = { BANK_TRANSFER: 'Transferência bancária', CASH_DEPOSIT: 'Depósito', MOBILE_MONEY: 'Carteira móvel', POS: 'POS' };

export function FinancialHistory({ studentId, revision }: { studentId: string; revision: number }) {
  const { api } = useAuth();
  const [offset, setOffset] = useState(0);
  const load = useCallback(() => api.financialHistory(studentId, { offset, limit: 20 }), [api, studentId, offset, revision]);
  const result = useFinancialLoad(load);
  const history = result.data?.data;
  return <section className="space-y-4" aria-label="Histórico de pagamentos">
    <h2 className="font-display text-xl font-semibold">Histórico de pagamentos</h2>
    <LoadState {...result} />
    {history && <>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="surface p-4"><dt>Situação financeira</dt><dd className="text-xl font-semibold">{history.status.status === 'ACTIVE' ? 'Regular' : 'Bloqueada'}</dd>{history.status.reason && <dd className="mt-2 text-sm">{history.status.reason}</dd>}</div>
        <div className="surface p-4"><dt>Total pago</dt><dd className="text-xl font-semibold">{money(history.totalPaid)}</dd></div>
        <div className="surface p-4"><dt>Valor em aberto</dt><dd className="text-xl font-semibold">{money(history.totalOutstanding)}</dd></div>
      </dl>
      <div className="surface table-scroll"><table className="w-full min-w-[640px] text-left text-sm">
        <caption className="p-4 text-left">Pagamentos confirmados: {history.pagination.totalPayments}</caption>
        <thead><tr>{['Data', 'Pagamento', 'Valor', 'Método', 'Referência'].map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}</tr></thead>
        <tbody>{history.payments.map(payment => <tr key={payment.id} className="border-t border-campus-line"><td className="px-4 py-3">{date(payment.paidAt)}</td><td className="max-w-60 break-words px-4 py-3">{payment.code}</td><td className="whitespace-nowrap px-4 py-3">{money(payment.amountPaid)}</td><td className="px-4 py-3">{methods[payment.paymentMethod] ?? payment.paymentMethod}</td><td className="break-all px-4 py-3">{payment.referenceCode}</td></tr>)}</tbody>
      </table></div>
      {!history.payments.length && <p>Não existem pagamentos nesta página.</p>}
      <p className="text-sm text-campus-deep/75">Os totais abrangem todo o histórico. Uma dívida regularizada por contestação não conta como pagamento.</p>
      <Pagination offset={offset} hasMore={history.pagination.hasMorePayments} loading={result.loading} onChange={setOffset} />
    </>}
  </section>;
}
