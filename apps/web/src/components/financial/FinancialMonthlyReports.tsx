import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MonthlyPaymentReportDto } from '@smart-campus/shared-types';
import { useAuth } from '../../lib/auth';
import { LoadState, money, useFinancialLoad } from './shared';

export const currentFinancialMonth = () => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Africa/Maputo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find(part => part.type === 'year')!.value}-${parts.find(part => part.type === 'month')!.value}`;
};
const paymentMethods: Record<string, string> = { BANK_TRANSFER: 'Transferência bancária', CASH_DEPOSIT: 'Depósito', MOBILE_MONEY: 'Carteira móvel', POS: 'POS' };
const reportDate = (value: string) => new Date(value).toLocaleString('pt-MZ', { timeZone: 'Africa/Maputo' });

export function FinancialMonthlyReports() {
  const [month, setMonth] = useState(currentFinancialMonth);
  const [kind, setKind] = useState<'payments' | 'salaries'>('payments');
  return <section className="space-y-4" aria-label="Relatórios mensais">
    <h2 className="font-display text-xl font-semibold">Relatórios mensais</h2>
    <p className="text-sm text-campus-deep/75">Pagamentos efectivamente registados no mês, pela hora de Moçambique. Finance e Admin podem consultar e imprimir.</p>
    <div className="flex flex-wrap gap-4">
      <div><label htmlFor="monthly-report-kind" className="text-sm font-medium">Relatório</label><select id="monthly-report-kind" className="field-input" value={kind} onChange={event => setKind(event.target.value as 'payments' | 'salaries')}><option value="payments">Pagamentos dos estudantes</option><option value="salaries">Salários pagos aos docentes</option></select></div>
      <label className="text-sm font-medium">Mês do pagamento<input className="field-input" type="month" min="2000-01" max="2100-12" required value={month} onChange={event => setMonth(event.target.value)} /></label>
    </div>
    {/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month) ? <MonthlyReport key={`${kind}:${month}`} kind={kind} month={month} /> : <p>Seleccione um mês válido.</p>}
  </section>;
}

function MonthlyReport({ kind, month }: { kind: 'payments' | 'salaries'; month: string }) {
  const { api } = useAuth();
  const load = useCallback(() => api.monthlyPaymentReport(kind, month), [api, kind, month]);
  const result = useFinancialLoad(load);
  const report = result.data?.data;
  const printRef = useRef<HTMLDivElement>(null);
  // O relatório completo fica fora do layout da aplicação para imprimir todas as linhas.
  useEffect(() => {
    const enable = () => { if (printRef.current) document.body.classList.add('financial-print-mode'); };
    const disable = () => document.body.classList.remove('financial-print-mode');
    window.addEventListener('beforeprint', enable);
    window.addEventListener('afterprint', disable);
    return () => { disable(); window.removeEventListener('beforeprint', enable); window.removeEventListener('afterprint', disable); };
  }, []);
  function print() {
    document.body.classList.add('financial-print-mode');
    try { window.print(); } finally { document.body.classList.remove('financial-print-mode'); }
  }
  return <>
    <LoadState {...result} />
    {report && <>
      <div className="flex flex-wrap gap-3"><button className="btn-primary" onClick={print}>Imprimir relatório mensal</button><button className="btn-secondary" onClick={result.reload}>Actualizar relatório</button></div>
      <div className="surface space-y-4 p-4 sm:p-5"><ReportContent report={report} /></div>
      {createPortal(<div className="financial-print-view" ref={printRef} aria-hidden="true"><ReportContent report={report} /></div>, document.body)}
    </>}
  </>;
}

function ReportContent({ report }: { report: MonthlyPaymentReportDto }) {
  return <>
    <h3 className="font-display text-xl font-semibold">Smart Campus — {report.kind === 'payments' ? 'Pagamentos dos estudantes' : 'Salários pagos aos docentes'}</h3>
    <p>Mês do pagamento: <strong>{report.month}</strong> · Moçambique (UTC+02:00)</p>
    <p>{report.totalPayments} pagamento(s) · Total: <strong>{money(report.totalAmount)}</strong></p>
    <p className="text-sm">Emitido em {reportDate(report.generatedAt)}</p>
    {!report.rows.length ? <p>Não existem pagamentos registados neste mês.</p> : <div className="table-scroll"><table className="w-full min-w-[900px] text-left text-sm">
      <caption className="sr-only">Movimentos do mês {report.month}</caption>
      <thead><tr>{['Data', report.kind === 'payments' ? 'Estudante / matrícula' : 'Docente / código', 'Descrição', 'Método', 'Referência', 'Valor (MZN)'].map(label => <th className="px-3 py-3" key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{report.rows.map(row => <tr className="border-t border-campus-line" key={row.id}>
        <td className="px-3 py-3">{reportDate(row.paidAt)}</td><td className="px-3 py-3">{row.fullName}<br />{row.identityCode ?? 'Sem matrícula'}</td>
        <td className="px-3 py-3">{row.description}</td><td className="px-3 py-3">{paymentMethods[row.paymentMethod]}</td><td className="break-all px-3 py-3">{row.referenceCode}</td><td className="whitespace-nowrap px-3 py-3 text-right">{row.amount.toFixed(2)}</td>
      </tr>)}</tbody>
    </table></div>}
    <p className="text-sm text-campus-deep/75">{report.kind === 'payments' ? 'Inclui pagamentos confirmados; regularizações por contestação não representam entrada de dinheiro.' : 'Inclui apenas salários com pagamento registado neste mês; a descrição identifica o período salarial.'}</p>
  </>;
}
