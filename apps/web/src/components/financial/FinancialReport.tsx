import { useCallback, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { LoadState, Pagination, money, useFinancialLoad } from './shared';

export function FinancialReport({ revision }: { revision: number }) {
  const { api } = useAuth();
  const load = useCallback(() => api.financialReport(), [api, revision]);
  const result = useFinancialLoad(load);
  const report = result.data?.data;
  return <section className="space-y-4" aria-label="Resumo financeiro">
    <h2 className="font-display text-xl font-semibold">Resumo do campus</h2>
    <LoadState {...result} />
    {report && <>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries({
        'Total de dívidas': report.totalDebts, 'Dívidas pendentes': report.byStatus.pendentes,
        'Dívidas vencidas': report.byStatus.vencidas, 'Dívidas regularizadas': report.byStatus.regularizadas,
        'Dívidas canceladas': report.byStatus.canceladas, 'Pagamentos confirmados': report.totalPayments,
        'Estudantes bloqueados': report.studentsBlocked,
      }).map(([label, count]) => <div className="surface p-4" key={label}><dt>{label}</dt><dd className="text-2xl font-semibold">{count}</dd></div>)}</dl>
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="surface p-4"><dt>Em aberto</dt><dd className="text-2xl font-semibold">{money(report.totals.outstanding)}</dd></div>
        <div className="surface p-4"><dt>Vencido</dt><dd className="text-2xl font-semibold">{money(report.totals.overdue)}</dd></div>
        <div className="surface p-4"><dt>Recebido este mês</dt><dd className="text-2xl font-semibold">{money(report.totals.collectedMonth)}</dd></div>
      </dl>
      <p className="text-sm text-campus-deep/75">Contagens e totais de todo o campus · Actualizado em {new Date(report.generatedAt).toLocaleString('pt-MZ')}</p>
      <BlockedStudents revision={revision} />
    </>}
  </section>;
}

function BlockedStudents({ revision }: { revision: number }) {
  const { api } = useAuth();
  const [offset, setOffset] = useState(0);
  const load = useCallback(() => api.financialBlockedStudents({ offset, limit: 20 }), [api, offset, revision]);
  const result = useFinancialLoad(load);
  const rows = result.data?.data ?? [];
  return <section className="space-y-3" aria-label="Estudantes bloqueados">
    <h3 className="font-semibold">Estudantes bloqueados</h3>
    <LoadState {...result} />
    {result.data && <>
      {!rows.length && <p className="text-sm text-campus-deep/75">Não existem estudantes bloqueados pela política actual.</p>}
      {rows.length > 0 && <div className="surface table-scroll"><table className="w-full min-w-[640px] text-left text-sm">
        <thead><tr>{['Estudante', 'Matrícula', 'Dívidas vencidas', 'Valor em atraso', 'Desde'].map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}</tr></thead>
        <tbody>{rows.map(row => <tr key={row.student.userId} className="border-t border-campus-line">
          <td className="px-4 py-3">{row.student.fullName}</td>
          <td className="px-4 py-3">{row.student.studentNumber ?? '—'}</td>
          <td className="px-4 py-3">{row.overdueDebtsCount}</td>
          <td className="px-4 py-3">{money(row.totalOverdueAmount)}</td>
          <td className="px-4 py-3">{row.blockedAt ? new Date(row.blockedAt).toLocaleDateString('pt-MZ') : '—'}</td>
        </tr>)}</tbody>
      </table></div>}
      <Pagination offset={offset} hasMore={!!result.data.meta.hasMore} loading={result.loading} onChange={setOffset} />
    </>}
  </section>;
}
