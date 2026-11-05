import { useCallback } from 'react';
import { useAuth } from '../../lib/auth';
import { money, LoadState, useFinancialLoad } from './shared';

export function FinancialStandingBanner({ studentId }: { studentId: string }) {
  const { api } = useAuth();
  const load = useCallback(() => api.financialStatus(studentId), [api, studentId]);
  const result = useFinancialLoad(load);
  const standing = result.data?.data;
  return (
    <section aria-label="Situação financeira">
      <LoadState {...result} />
      {standing && (
        standing.status === 'BLOCKED' ? (
          <p role="status" className="alert-error">
            Situação financeira bloqueada
            {standing.reason ? ` — ${standing.reason}` : ''}.
            {standing.overdueDebtsCount > 0
              ? ` ${standing.overdueDebtsCount} dívida(s) vencida(s), ${money(standing.totalOverdueAmount)} em atraso.`
              : ''}
          </p>
        ) : (
          <p role="status" className="rounded-xl bg-campus-teal/10 px-3 py-2 text-sm text-campus-teal">
            Situação financeira regular.
          </p>
        )
      )}
    </section>
  );
}
