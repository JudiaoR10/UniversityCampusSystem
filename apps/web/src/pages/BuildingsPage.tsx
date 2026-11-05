import { FormEvent, useEffect, useState } from 'react';
import type { BuildingDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { DeleteAction, EditAction, TableActions } from '../components/ActionButtons';

type BuildingForm = { code: string; name: string; description: string; floors: number; mapX: string; mapY: string };

export function BuildingsPage() {
  const { api, user } = useAuth();
  const [buildings, setBuildings] = useState<BuildingDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<BuildingForm>({ code: '', name: '', description: '', floors: 1, mapX: '', mapY: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const canManage = user && ['ADMIN', 'COORDINATOR', 'TECHNICIAN'].includes(user.role);

  async function load() {
    const res = await api.buildings();
    setBuildings(res.data);
  }

  useEffect(() => {
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setForm({ code: '', name: '', description: '', floors: 1, mapX: '', mapY: '' });
    setEditingId(null);
  }

  function startEdit(b: BuildingDto) {
    setEditingId(b.id);
    setForm({
      code: b.code,
      name: b.name,
      description: b.description ?? '',
      floors: b.floors ?? 1,
      mapX: b.mapX != null ? String(b.mapX) : '',
      mapY: b.mapY != null ? String(b.mapY) : '',
    });
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await api.updateBuilding(editingId, {
          code: form.code,
          name: form.name,
          description: form.description || null,
          floors: Number(form.floors),
          mapX: form.mapX === '' ? null : Number(form.mapX),
          mapY: form.mapY === '' ? null : Number(form.mapY),
        });
      } else {
        await api.createBuilding({
          code: form.code,
          name: form.name,
          description: form.description || null,
          floors: Number(form.floors),
          mapX: form.mapX === '' ? null : Number(form.mapX),
          mapY: form.mapY === '' ? null : Number(form.mapY),
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? 'Erro ao atualizar edifício' : 'Erro ao criar edifício');
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Tem a certeza que pretende eliminar este edifício?')) return;
    setError(null);
    try {
      await api.deleteBuilding(id);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao eliminar edifício');
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Infraestrutura"
        title="Edifícios"
        description="Cadastro de edifícios do campus."
      />

      {error ? <p className="alert-error">{error}</p> : null}
      {loading ? <p className="text-sm text-campus-deep/70">A carregar edifícios…</p> : null}

      {canManage ? (
        <form onSubmit={onSubmit} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-5">
          <h2 className="section-title md:col-span-2 xl:col-span-5">{editingId ? 'Editar edifício' : 'Novo edifício'}</h2>
          <input className="field-input !mt-0" placeholder="Código" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="field-input !mt-0" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="field-input !mt-0" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="field-input !mt-0" type="number" placeholder="Pisos" value={form.floors} onChange={(e) => setForm({ ...form, floors: Number(e.target.value) })} required />
          <input className="field-input !mt-0" type="number" min={0} max={100} step={0.1} placeholder="Mapa X (0-100)" value={form.mapX} onChange={(e) => setForm({ ...form, mapX: e.target.value })} />
          <input className="field-input !mt-0" type="number" min={0} max={100} step={0.1} placeholder="Mapa Y (0-100)" value={form.mapY} onChange={(e) => setForm({ ...form, mapY: e.target.value })} />
          <div className="flex flex-col gap-2 xl:col-span-1">
            <button type="submit" className="btn-primary w-full">
              {editingId ? 'Guardar alterações' : 'Criar edifício'}
            </button>
            {editingId ? (
              <button type="button" className="btn-ghost w-full" onClick={resetForm}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="surface table-scroll">
        <table className="min-w-[720px] text-left text-sm">
          <thead className="bg-campus-mist/80 text-campus-deep">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Pisos</th>
              <th className="px-4 py-3 font-semibold">Salas</th>
              <th className="px-4 py-3 font-semibold">Descrição</th>
              {canManage ? <th className="px-4 py-3 text-right font-semibold">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {buildings.map((b) => (
              <tr key={b.id} className="border-t border-campus-line/70">
                <td className="px-4 py-3 font-medium">{b.code}</td>
                <td className="px-4 py-3">{b.name}</td>
                <td className="px-4 py-3">{b.floors}</td>
                <td className="px-4 py-3">{b.roomsCount}</td>
                <td className="px-4 py-3">{b.description ?? '—'}</td>
                {canManage ? (
                  <td className="px-4 py-3">
                    <TableActions>
                      <EditAction onClick={() => startEdit(b)} />
                      <DeleteAction onClick={() => onDelete(b.id)} />
                    </TableActions>
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
