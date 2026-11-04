import { FormEvent, useEffect, useState } from 'react';
import type { EquipmentDto, LaboratoryDto, RoomDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';

type EquipmentForm = { code: string; name: string; description: string; roomId: string; laboratoryId: string };

export function EquipmentPage() {
  const { api, user } = useAuth();
  const [items, setItems] = useState<EquipmentDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [labs, setLabs] = useState<LaboratoryDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<EquipmentForm>({ code: '', name: '', description: '', roomId: '', laboratoryId: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const canManage = user && ['ADMIN', 'COORDINATOR', 'TECHNICIAN'].includes(user.role);

  async function load() {
    const [itemsRes, roomsRes, labsRes] = await Promise.all([api.equipment(), api.rooms(), api.laboratories()]);
    setItems(itemsRes.data);
    setRooms(roomsRes.data);
    setLabs(labsRes.data);
  }

  useEffect(() => {
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setForm({ code: '', name: '', description: '', roomId: '', laboratoryId: '' });
    setEditingId(null);
  }

  function startEdit(item: EquipmentDto) {
    setEditingId(item.id);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description ?? '',
      roomId: item.roomId ?? '',
      laboratoryId: item.laboratoryId ?? '',
    });
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await api.updateEquipment(editingId, {
          code: form.code,
          name: form.name,
          description: form.description || null,
          roomId: form.roomId || null,
          laboratoryId: form.laboratoryId || null,
        });
      } else {
        await api.createEquipment({
          code: form.code,
          name: form.name,
          description: form.description || null,
          roomId: form.roomId || null,
          laboratoryId: form.laboratoryId || null,
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? 'Erro ao atualizar equipamento' : 'Erro ao criar equipamento');
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Tem a certeza que pretende eliminar este equipamento?')) return;
    setError(null);
    try {
      await api.deleteEquipment(id);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao eliminar equipamento');
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Infraestrutura"
        title="Equipamentos"
        description="Inventário de equipamentos por sala ou laboratório."
      />

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-campus-deep/70">A carregar equipamentos…</p> : null}

      {canManage ? (
        <form onSubmit={onSubmit} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-6">
          <input className="field-input !mt-0" placeholder="Código" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="field-input !mt-0" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="field-input !mt-0" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="field-input !mt-0" value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
            <option value="">Sem sala</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </select>
          <select className="field-input !mt-0" value={form.laboratoryId} onChange={(e) => setForm({ ...form, laboratoryId: e.target.value })}>
            <option value="">Sem laboratório</option>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.name}
              </option>
            ))}
          </select>
          <div className="flex flex-col gap-2">
            <button type="submit" className="btn-primary w-full">
              {editingId ? 'Guardar alterações' : 'Criar equipamento'}
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
              <th className="px-4 py-3 font-semibold">Sala</th>
              <th className="px-4 py-3 font-semibold">Laboratório</th>
              <th className="px-4 py-3 font-semibold">Descrição</th>
              {canManage ? <th className="px-4 py-3 font-semibold text-right">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-campus-line/70">
                <td className="px-4 py-3 font-medium">{item.code}</td>
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3">{item.room?.code ?? '—'}</td>
                <td className="px-4 py-3">{item.laboratory?.code ?? '—'}</td>
                <td className="px-4 py-3">{item.description ?? '—'}</td>
                {canManage ? (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn-ghost" onClick={() => startEdit(item)}>
                        Editar
                      </button>
                      <button type="button" className="btn-ghost text-red-600 hover:text-red-700" onClick={() => onDelete(item.id)}>
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
