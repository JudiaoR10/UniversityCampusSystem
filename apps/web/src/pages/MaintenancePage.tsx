import { FormEvent, useEffect, useState } from 'react';
import type { IncidentDto, MaintenanceActionDto, MaintenanceStatus } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { EmptyState, FormField, LoadingState, StatusPill } from '../components/ui';
import { SelectField } from '../components/SelectField';
import { IconActionButton, TableActions } from '../components/ActionButtons';

const statusTone: Record<MaintenanceStatus, 'warning' | 'info' | 'success'> = {
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  DONE: 'success',
};

const statusLabel: Record<MaintenanceStatus, string> = {
  OPEN: 'Aberta',
  IN_PROGRESS: 'Em curso',
  DONE: 'Concluída',
};

export function MaintenancePage() {
  const { api, user } = useAuth();
  const [actions, setActions] = useState<MaintenanceActionDto[]>([]);
  const [incidents, setIncidents] = useState<IncidentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ incidentId: '', notes: '', status: 'OPEN' as MaintenanceStatus });
  const canManage = !!user && ['TECHNICIAN', 'COORDINATOR', 'ADMIN'].includes(user.role);

  async function load() {
    const [maintRes, incRes] = await Promise.all([api.maintenance(), api.incidents()]);
    setActions(maintRes.data);
    setIncidents(incRes.data);
    if (!form.incidentId && incRes.data[0]) {
      setForm((f) => ({ ...f, incidentId: incRes.data[0].id }));
    }
  }

  useEffect(() => {
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createMaintenance({
        incidentId: form.incidentId,
        notes: form.notes,
        status: form.status,
      });
      setForm((f) => ({ ...f, notes: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registar manutenção');
    }
  }

  async function onStatus(action: MaintenanceActionDto, status: MaintenanceStatus) {
    if (action.status === status) return;
    setError(null);
    try {
      await api.updateMaintenance(action.id, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao actualizar manutenção');
    }
  }

  if (loading) return <LoadingState label="A carregar manutenção…" />;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Infraestrutura"
        title="Manutenção"
        description="Acções associadas a ocorrências: abertura, execução e fecho."
      />

      {error ? <p className="alert-error">{error}</p> : null}

      {canManage ? (
        <form onSubmit={onCreate} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2">
          <h2 className="section-title md:col-span-2">Nova acção</h2>
          <FormField label="Ocorrência">
            <SelectField
              value={form.incidentId}
              onChange={(incidentId) => setForm({ ...form, incidentId })}
              required
              placeholder="Seleccionar ocorrência"
              options={incidents.map((i) => ({ value: i.id, label: i.title }))}
            />
          </FormField>
          <FormField label="Estado">
            <SelectField
              value={form.status}
              onChange={(status) => setForm({ ...form, status: status as MaintenanceStatus })}
              options={[
                { value: 'OPEN', label: 'Aberta' },
                { value: 'IN_PROGRESS', label: 'Em curso' },
                { value: 'DONE', label: 'Concluída' },
              ]}
            />
          </FormField>
          <FormField label="Notas" className="md:col-span-2">
            <textarea
              className="field-input min-h-[88px]"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              required
            />
          </FormField>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary" disabled={incidents.length === 0}>
              Registar acção
            </button>
          </div>
        </form>
      ) : null}

      {actions.length === 0 ? (
        <EmptyState title="Sem acções de manutenção" description="Crie uma ocorrência e associe-lhe uma acção." />
      ) : (
        <ul className="space-y-3">
          {actions.map((action) => (
            <li key={action.id} className="surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold text-campus-ink">{action.incident.title}</p>
                  <p className="mt-1 text-sm text-campus-deep/70">{action.notes}</p>
                  <p className="mt-2 text-xs text-campus-deep/55">
                    {action.performer.fullName} · {new Date(action.createdAt).toLocaleString('pt-PT')}
                  </p>
                </div>
                <StatusPill tone={statusTone[action.status]}>{statusLabel[action.status]}</StatusPill>
              </div>
              {canManage ? (
                <div className="mt-3">
                  <TableActions>
                    {(['OPEN', 'IN_PROGRESS', 'DONE'] as const).map((status) => (
                      <IconActionButton
                        key={status}
                        label={statusLabel[status]}
                        tone={status === 'DONE' ? 'success' : 'neutral'}
                        onClick={() => void onStatus(action, status)}
                      />
                    ))}
                  </TableActions>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
