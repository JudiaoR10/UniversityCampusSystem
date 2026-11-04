import { FormEvent, useEffect, useState } from 'react';
import type { BuildingDto, LaboratoryDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';

type LabForm = { code: string; name: string; description: string; buildingId: string };

export function LaboratoriesPage() {
  const { api, user } = useAuth();
  const [labs, setLabs] = useState<LaboratoryDto[]>([]);
  const [buildings, setBuildings] = useState<BuildingDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<LabForm>({ code: '', name: '', description: '', buildingId: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const canManage = user && ['ADMIN', 'COORDINATOR', 'TECHNICIAN'].includes(user.role);

  async function load() {
    const [labsRes, buildingsRes] = await Promise.all([api.laboratories(), api.buildings()]);
    setLabs(labsRes.data);
    setBuildings(buildingsRes.data);
    if (!editingId && !form.buildingId && buildingsRes.data[0]) {
      setForm((f) => ({ ...f, buildingId: buildingsRes.data[0].id }));
    }
  }

  useEffect(() => {
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setForm({ code: '', name: '', description: '', buildingId: buildings[0]?.id ?? '' });
    setEditingId(null);
  }

  function startEdit(lab: LaboratoryDto) {
    setEditingId(lab.id);
    setForm({
      code: lab.code,
      name: lab.name,
      description: lab.description ?? '',
      buildingId: lab.buildingId,
    });
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await api.updateLaboratory(editingId, {
          code: form.code,
          name: form.name,
          description: form.description || null,
          buildingId: form.buildingId,
        });
      } else {
        await api.createLaboratory({
          code: form.code,
          name: form.name,
          description: form.description || null,
          buildingId: form.buildingId,
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? 'Erro ao atualizar laboratório' : 'Erro ao criar laboratório');
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Tem a certeza que pretende eliminar este laboratório?')) return;
    setError(null);
    try {
      await api.deleteLaboratory(id);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao eliminar laboratório');
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Infraestrutura"
        title="Laboratórios"
        description="Laboratórios e espaços técnicos associados aos edifícios."
      />

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-campus-deep/70">A carregar laboratórios…</p> : null}

      {canManage ? (
        <form onSubmit={onSubmit} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-6">
          <input className="field-input !mt-0" placeholder="Código" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="field-input !mt-0" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="field-input !mt-0" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="field-input !mt-0" value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value })} required>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary w-full">
            {editingId ? 'Guardar alterações' : 'Criar laboratório'}
          </button>
          {editingId ? (
            <button type="button" className="btn-ghost w-full" onClick={resetForm}>
              Cancelar
            </button>
          ) : null}
        </form>
      ) : null}

      <div className="surface table-scroll">
        <table className="min-w-[640px] text-left text-sm">
          <thead className="bg-campus-mist/80 text-campus-deep">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Edifício</th>
              <th className="px-4 py-3 font-semibold">Descrição</th>
              {canManage ? <th className="px-4 py-3 font-semibold text-right">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {labs.map((lab) => (
              <tr key={lab.id} className="border-t border-campus-line/70">
                <td className="px-4 py-3 font-medium">{lab.code}</td>
                <td className="px-4 py-3">{lab.name}</td>
                <td className="px-4 py-3">{lab.building?.code ?? '—'}</td>
                <td className="px-4 py-3">{lab.description ?? '—'}</td>
                {canManage ? (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn-ghost" onClick={() => startEdit(lab)}>
                        Editar
                      </button>
                      <button type="button" className="btn-ghost text-red-600 hover:text-red-700" onClick={() => onDelete(lab.id)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
