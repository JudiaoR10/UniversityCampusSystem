import { useCallback, useState } from 'react';
import { ApiClientError } from '@smart-campus/api-client';
import { useAuth } from '../../lib/auth';
import { currentFinancialMonth } from './FinancialMonthlyReports';
import { BusyLabel, LoadState, money, useFinancialLoad } from './shared';

type AuditEvent = {
  id: string;
  action: string;
  resource: string;
  correlationId: string;
  createdAt: string;
  actor?: { fullName?: string } | null;
};

export function AdminFinancialOverview({ revision, onOpenReports, onOpenPolicies }: { revision: number; onOpenReports: () => void; onOpenPolicies: () => void }) {
  const { api } = useAuth();
  const initialMonth = currentFinancialMonth();
  const [month, setMonth] = useState(initialMonth);
  const load = useCallback(async () => {
    const policyRequest = api.financialPolicy().catch(error => {
      if (error instanceof ApiClientError && error.code === 'POLICY_NOT_FOUND') return null;
      throw error;
    });
    const [summary, payments, salaries, pending, policy, audit] = await Promise.all([
      api.financialReport(),
      api.monthlyPaymentReport('payments', month),
      api.monthlyPaymentReport('salaries', month),
      api.financialAnalysisRequests({ status: 'PENDENTE_ANALISE', offset: 0, limit: 1 }),
      policyRequest,
      api.auditEvents(),
    ]);
    return {
      summary: summary.data,
      payments: payments.data,
      salaries: salaries.data,
      pendingAnalyses: pending.meta.total ?? pending.data.length,
      policy: policy?.data ?? null,
      audit: (audit.data as AuditEvent[]).filter(event => event.resource === 'financial' || event.resource === 'financial_salary').slice(0, 5),
    };
  }, [api, month, revision]);
  const result = useFinancialLoad(load);
  const data = result.data;

  return <section className="space-y-5" aria-label="Painel financeiro administrativo">
    <div className="surface flex flex-wrap items-end justify-between gap-4 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-xl font-semibold">Painel financeiro administrativo</h2>
        <p className="text-sm text-campus-deep/75">Acompanhamento institucional em modo de consulta.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3" aria-label="Filtros do painel administrativo">
        <label className="text-sm font-medium">Período
          <input className="field-input" type="month" min="2000-01" max="2100-12" value={month} disabled={result.loading} onChange={event => setMonth(event.target.value)} />
        </label>
        <button className="btn-secondary" disabled={result.loading || month === initialMonth} onClick={() => setMonth(initialMonth)}>Limpar filtros</button>
        <button className="btn-secondary" disabled={result.loading} onClick={result.reload}><BusyLabel busy={result.loading} busyText="A actualizar…">Actualizar</BusyLabel></button>
      </div>
    </div>

    <LoadState {...result} label="A carregar indicadores administrativos…" />
    {data && <>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ['Dívidas pendentes', String(data.summary.byStatus.pendentes)],
          ['Dívidas vencidas', String(data.summary.byStatus.vencidas)],
          [`Recebido em ${month}`, money(data.payments.totalAmount)],
          [`Salários pagos em ${month}`, money(data.salaries.totalAmount)],
          ['Contestações pendentes', String(data.pendingAnalyses)],
          ['Estudantes bloqueados', String(data.summary.studentsBlocked)],
        ].map(([label, value]) => <div className="surface p-4" key={label}><dt className="text-sm text-campus-deep/75">{label}</dt><dd className="mt-1 text-2xl font-semibold text-campus-ink">{value}</dd></div>)}
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="surface space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-display text-lg font-semibold">Política financeira</h3><p className="text-sm text-campus-deep/75">Estado das regras globais do campus.</p></div>
            <button className="btn-secondary" onClick={onOpenPolicies}>Configurar políticas</button>
          </div>
          {data.policy ? <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-campus-deep/70">Tolerância</dt><dd className="font-semibold">{data.policy.gracePeriodDays} dias</dd></div>
            <div><dt className="text-campus-deep/70">Limite vencido</dt><dd className="font-semibold">{money(data.policy.maxDebtAmount)}</dd></div>
            <div><dt className="text-campus-deep/70">Bloqueio automático</dt><dd className="font-semibold">{data.policy.autoBlockEnabled ? 'Activo' : 'Inactivo'}</dd></div>
            <div><dt className="text-campus-deep/70">Última actualização</dt><dd className="font-semibold">{new Date(data.policy.updatedAt).toLocaleString('pt-MZ')}</dd></div>
          </dl> : <p role="status" className="text-sm">A política ainda usa os valores padrão e não foi persistida.</p>}
        </article>

        <article className="surface space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-display text-lg font-semibold">Relatórios mensais</h3><p className="text-sm text-campus-deep/75">Consulte e imprima pagamentos e salários pagos.</p></div>
            <button className="btn-primary" onClick={onOpenReports}>Abrir relatórios</button>
          </div>
          <p className="text-sm">{data.payments.totalPayments} pagamentos de estudantes e {data.salaries.totalPayments} salários pagos em {month}.</p>
        </article>
      </div>

      <article className="surface space-y-3 p-4 sm:p-5">
        <h3 className="font-display text-lg font-semibold">Actividade financeira recente</h3>
        {!data.audit.length ? <p className="text-sm text-campus-deep/75">Não existem eventos financeiros recentes.</p> : <div className="table-scroll"><table className="w-full min-w-[640px] text-left text-sm">
          <thead><tr><th className="py-2 pr-4">Acção</th><th className="py-2 pr-4">Responsável</th><th className="py-2 pr-4">Quando</th><th className="py-2">Correlação</th></tr></thead>
          <tbody>{data.audit.map(event => <tr className="border-t border-campus-line/70" key={event.id}><td className="py-3 pr-4">{event.action}</td><td className="py-3 pr-4">{event.actor?.fullName ?? 'Sistema'}</td><td className="py-3 pr-4">{new Date(event.createdAt).toLocaleString('pt-MZ')}</td><td className="py-3 font-mono text-xs">{event.correlationId}</td></tr>)}</tbody>
        </table></div>}
      </article>
      <p role="status" className="text-sm text-campus-deep/75">Indicadores actualizados em {new Date(data.summary.generatedAt).toLocaleString('pt-MZ')}.</p>
    </>}
  </section>;
}
