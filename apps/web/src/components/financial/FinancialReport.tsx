import { useCallback } from 'react';
import { useAuth } from '../../lib/auth';
import { LoadState, useFinancialLoad } from './shared';

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
      <p className="text-sm text-campus-deep/75">Contagens de todo o campus · Actualizado em {new Date(report.generatedAt).toLocaleString('pt-MZ')}</p>
    </>}
  </section>;
}
