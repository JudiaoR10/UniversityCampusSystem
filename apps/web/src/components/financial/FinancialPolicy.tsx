import { useCallback, useState, type FormEvent } from 'react';
import type { FinancialPolicyDto } from '@smart-campus/shared-types';
import { ApiClientError } from '@smart-campus/api-client';
import { useAuth } from '../../lib/auth';
import { errorMessage, LoadState, useFinancialLoad } from './shared';

export function FinancialPolicy({ onChanged }: { onChanged: () => void }) {
  const { api } = useAuth();
  const load = useCallback(async () => {
    try {
      const response = await api.financialPolicy();
      return { policy: response.data, persisted: true };
    } catch (error) {
      if (!(error instanceof ApiClientError) || error.code !== 'POLICY_NOT_FOUND') throw error;
      // Valores iniciais iguais ao fallback aplicado pelo serviço financeiro.
      return { policy: { gracePeriodDays: 5, maxDebtAmount: 0, autoBlockEnabled: true }, persisted: false };
    }
  }, [api]);
  const result = useFinancialLoad(load);
  return <section id="financial-policy" className="surface space-y-4 p-4 sm:p-5" aria-label="Políticas financeiras">
    <h2 className="font-display text-xl font-semibold">Políticas financeiras</h2>
    <p className="text-sm text-campus-deep/75">Configuração global do campus. Apenas o administrador pode alterar estas regras.</p>
    <LoadState {...result} />
    {result.data && <PolicyForm policy={result.data.policy} persisted={result.data.persisted} onChanged={onChanged} />}
  </section>;
}

function PolicyForm({ policy, persisted, onChanged }: { policy: Pick<FinancialPolicyDto, 'gracePeriodDays' | 'maxDebtAmount' | 'autoBlockEnabled'>; persisted: boolean; onChanged: () => void }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [configured, setConfigured] = useState(persisted);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true); setError(''); setSaved(false);
    try {
      await api.updateFinancialPolicy({
        gracePeriodDays: Number(fields.get('gracePeriodDays')),
        maxDebtAmount: Number(fields.get('maxDebtAmount')),
        autoBlockEnabled: fields.get('autoBlockEnabled') === 'on',
      });
      setSaved(true); setConfigured(true); onChanged();
    } catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit} onChange={() => setSaved(false)}>
    {!configured && <p className="sm:col-span-2">A política ainda não foi guardada. Estes são os valores padrão em uso; pode ajustá-los e guardar a primeira configuração.</p>}
    <label className="text-sm font-medium">Dias de tolerância<input className="field-input" name="gracePeriodDays" type="number" min={0} max={60} step={1} required defaultValue={policy.gracePeriodDays} disabled={busy} /></label>
    <label className="text-sm font-medium">Limite de dívida vencida (MZN)<input className="field-input" name="maxDebtAmount" type="number" min={0} max={1000000} step="0.01" required defaultValue={policy.maxDebtAmount} disabled={busy} /></label>
    <label className="flex items-center gap-2 sm:col-span-2"><input name="autoBlockEnabled" type="checkbox" defaultChecked={policy.autoBlockEnabled} disabled={busy} />Activar bloqueio automático</label>
    <p className="text-sm text-campus-deep/75 sm:col-span-2">Com o bloqueio activo, o estudante fica bloqueado quando a soma das dívidas vencidas após a tolerância ultrapassa o limite. As consultas e operações seguintes aplicam a nova regra.</p>
    {error && <p role="alert" className="text-red-700 sm:col-span-2">{error}</p>}
    {saved && <p role="status" className="sm:col-span-2">Políticas guardadas.</p>}
    <button className="btn-primary justify-self-start" disabled={busy}>Guardar políticas</button>
  </form>;
}
