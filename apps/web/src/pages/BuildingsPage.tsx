import { FormEvent, useEffect, useState } from 'react';
import type { BuildingDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';

type BuildingForm = { code: string; name: string; description: string; floors: number };

export function BuildingsPage() {
  const { api, user } = useAuth();
  const [buildings, setBuildings] = useState<BuildingDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<BuildingForm>({ code: '', name: '', description: '', floors: 1 });
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
    setForm({ code: '', name: '', description: '', floors: 1 });
    setEditingId(null);
  }

  function startEdit(b: BuildingDto) {
    setEditingId(b.id);
    setForm({
      code: b.code,
      name: b.name,
      description: b.description ?? '',
      floors: b.floors ?? 1,
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
        });
      } else {
        await api.createBuilding({
          code: form.code,
          name: form.name,
          description: form.description || null,
          floors: Number(form.floors),
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

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-campus-deep/70">A carregar edifícios…</p> : null}

      {canManage ? (
        <form onSubmit={onSubmit} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-5">
          <input className="field-input !mt-0" placeholder="Código" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="field-input !mt-0" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="field-input !mt-0" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="field-input !mt-0" type="number" placeholder="Pisos" value={form.floors} onChange={(e) => setForm({ ...form, floors: Number(e.target.value) })} required />
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
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn-ghost" onClick={() => startEdit(b)}>
                        Editar
                      </button>
                      <button type="button" className="btn-ghost text-red-600 hover:text-red-700" onClick={() => onDelete(b.id)}>
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
