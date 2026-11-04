import { FormEvent, useEffect, useState } from 'react';
import type { BuildingDto, RoomDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';

type RoomForm = {
  code: string;
  name: string;
  capacity: number;
  floor: number;
  buildingId: string;
  status: RoomDto['status'];
};

const estados: RoomDto['status'][] = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'];

export function RoomsPage() {
  const { api, user } = useAuth();
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [buildings, setBuildings] = useState<BuildingDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<RoomForm>({
    code: '',
    name: '',
    capacity: 30,
    floor: 1,
    buildingId: '',
    status: 'AVAILABLE',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const canManage = user && ['ADMIN', 'COORDINATOR', 'TECHNICIAN'].includes(user.role);

  async function load() {
    const [roomsRes, buildingsRes] = await Promise.all([api.rooms(), api.buildings()]);
    setRooms(roomsRes.data);
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
    setForm({
      code: '',
      name: '',
      capacity: 30,
      floor: 1,
      buildingId: buildings[0]?.id ?? '',
      status: 'AVAILABLE',
    });
    setEditingId(null);
  }

  function startEdit(room: RoomDto) {
    setEditingId(room.id);
    setForm({
      code: room.code,
      name: room.name,
      capacity: room.capacity,
      floor: room.floor,
      buildingId: room.building.id,
      status: room.status,
    });
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      code: form.code,
      name: form.name,
      capacity: Number(form.capacity),
      floor: Number(form.floor),
      buildingId: form.buildingId,
      status: form.status,
    };
    try {
      if (editingId) {
        await api.updateRoom(editingId, payload);
      } else {
        await api.createRoom(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? 'Erro ao atualizar sala' : 'Erro ao criar sala');
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Tem a certeza que pretende eliminar esta sala?')) return;
    setError(null);
    try {
      await api.deleteRoom(id);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao eliminar sala');
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Infraestrutura"
        title="Salas"
        description="Módulo funcional do Core — gestão de salas e disponibilidade."
      />

      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-campus-deep/70">A carregar salas…</p> : null}

      {canManage ? (
        <form onSubmit={onSubmit} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-7">
          <input className="field-input !mt-0" placeholder="Código" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="field-input !mt-0" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="field-input !mt-0" type="number" placeholder="Capacidade" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} required />
          <input className="field-input !mt-0" type="number" placeholder="Piso" value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })} required />
          <select className="field-input !mt-0" value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value })} required>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
          <select className="field-input !mt-0" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RoomDto['status'] })}>
            {estados.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary w-full">
            {editingId ? 'Guardar alterações' : 'Criar sala'}
          </button>
          {editingId ? (
            <button type="button" className="btn-ghost w-full" onClick={resetForm}>
              Cancelar
            </button>
          ) : null}
        </form>
      ) : null}

      <div className="surface table-scroll">
        <table className="min-w-[760px] text-left text-sm">
          <thead className="bg-campus-mist/80 text-campus-deep">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Edifício</th>
              <th className="px-4 py-3 font-semibold">Piso</th>
              <th className="px-4 py-3 font-semibold">Capacidade</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              {canManage ? <th className="px-4 py-3 text-right font-semibold">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-t border-campus-line/70">
                <td className="px-4 py-3 font-medium">{room.code}</td>
                <td className="px-4 py-3">{room.name}</td>
                <td className="px-4 py-3">{room.building?.code ?? '—'}</td>
                <td className="px-4 py-3">{room.floor}</td>
                <td className="px-4 py-3">{room.capacity}</td>
                <td className="px-4 py-3">{room.status}</td>
                {canManage ? (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn-ghost" onClick={() => startEdit(room)}>
                        Editar
                      </button>
                      <button type="button" className="btn-ghost text-red-600 hover:text-red-700" onClick={() => onDelete(room.id)}>
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
