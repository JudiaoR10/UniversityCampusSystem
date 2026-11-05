import { FormEvent, useEffect, useState } from 'react';
import type { IncidentDto, RoomDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { EmptyState, StatusPill } from '../components/ui';
import { SelectField } from '../components/SelectField';
import { IconActionButton, TableActions } from '../components/ActionButtons';

export function IncidentsPage() {
  const { api, user } = useAuth();
  const [incidents, setIncidents] = useState<IncidentDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', roomId: '' });
  const canTreat = user && ['TECHNICIAN', 'COORDINATOR', 'ADMIN'].includes(user.role);

  async function load() {
    const [incRes, roomsRes] = await Promise.all([api.incidents(), api.rooms()]);
    setIncidents(incRes.data);
    setRooms(roomsRes.data);
    if (!form.roomId && roomsRes.data[0]) setForm((f) => ({ ...f, roomId: roomsRes.data[0].id }));
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createIncident({
        title: form.title,
        description: form.description,
        priority: form.priority,
        roomId: form.roomId || null,
      });
      setForm((f) => ({ ...f, title: '', description: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar ocorrência');
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api.updateIncidentStatus(id, { status, notes: `Actualizado para ${status}` });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao actualizar estado');
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Manutenção"
        title="Ocorrências"
        description="Fluxo transversal: login → sala → criar ocorrência → alterar estado → auditoria."
      />

      {error ? <p className="alert-error">{error}</p> : null}

      <form onSubmit={onCreate} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2">
        <h2 className="section-title md:col-span-2">Registar ocorrência</h2>
        <input className="field-input !mt-0" placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <SelectField
          value={form.priority}
          onChange={(priority) => setForm({ ...form, priority })}
          options={[
            { value: 'LOW', label: 'Baixa' },
            { value: 'MEDIUM', label: 'Média' },
            { value: 'HIGH', label: 'Alta' },
            { value: 'CRITICAL', label: 'Crítica' },
          ]}
        />
        <SelectField
          value={form.roomId}
          onChange={(roomId) => setForm({ ...form, roomId })}
          placeholder="Seleccionar sala"
          options={rooms.map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }))}
        />
        <textarea className="field-input !mt-0 md:col-span-2" rows={3} placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <button type="submit" className="btn-primary w-full md:col-span-2 md:w-fit">
          Registar ocorrência
        </button>
      </form>

      {incidents.length === 0 ? (
        <EmptyState title="Sem ocorrências" description="Ainda não há pedidos de manutenção registados." />
      ) : (
        <div className="space-y-3">
          {incidents.map((incident) => (
            <article key={incident.id} className="surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-campus-ink">{incident.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-campus-deep/75">{incident.description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusPill tone={incident.priority === 'CRITICAL' || incident.priority === 'HIGH' ? 'danger' : incident.priority === 'MEDIUM' ? 'warning' : 'muted'}>
                      {incident.priority}
                    </StatusPill>
                    <StatusPill tone={incident.status === 'RESOLVED' || incident.status === 'CLOSED' ? 'success' : 'info'}>
                      {incident.status}
                    </StatusPill>
                    <span className="text-xs text-campus-deep/55">{new Date(incident.createdAt).toLocaleString('pt-PT')}</span>
                  </div>
                </div>
                {canTreat ? (
                  <TableActions>
                    {['IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((status) => (
                      <IconActionButton
                        key={status}
                        label={status === 'IN_PROGRESS' ? 'Em curso' : status === 'RESOLVED' ? 'Resolvida' : 'Fechada'}
                        tone={status === 'CLOSED' || status === 'RESOLVED' ? 'success' : 'neutral'}
                        onClick={() => void updateStatus(incident.id, status)}
                      />
                    ))}
                  </TableActions>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
