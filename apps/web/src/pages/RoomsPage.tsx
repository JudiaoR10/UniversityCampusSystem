import { FormEvent, useEffect, useState } from 'react';
import type { BuildingDto, RoomDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { SelectField } from '../components/SelectField';
import { DeleteAction, EditAction, TableActions } from '../components/ActionButtons';

type RoomForm = {
  code: string;
  name: string;
  capacity: number;
  floor: number;
  buildingId: string;
  status: RoomDto['status'];
  temPlaca: boolean;
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
    temPlaca: false,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const canManage = user && ['ADMIN', 'COORDINATOR', 'TECHNICIAN'].includes(user.role);
  const isAdmin = user?.role === 'ADMIN';

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
      temPlaca: false,
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
      temPlaca: room.temPlaca ?? false,
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
      temPlaca: form.temPlaca,
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

      {error ? <p className="alert-error">{error}</p> : null}
      {loading ? <p className="text-sm text-campus-deep/70">A carregar salas…</p> : null}

      {canManage ? (
        <form onSubmit={onSubmit} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-7">
          <h2 className="section-title md:col-span-2 xl:col-span-7">{editingId ? 'Editar sala' : 'Nova sala'}</h2>
          <input className="field-input !mt-0" placeholder="Código" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="field-input !mt-0" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="field-input !mt-0" type="number" placeholder="Capacidade" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} required />
          <input className="field-input !mt-0" type="number" placeholder="Piso" value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })} required />
          <SelectField
            value={form.buildingId}
            onChange={(buildingId) => setForm({ ...form, buildingId })}
            required
            placeholder="Seleccionar edifício"
            options={buildings.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))}
          />
          <SelectField
            value={form.status}
            onChange={(status) => setForm({ ...form, status: status as RoomDto['status'] })}
            options={estados.map((estado) => ({ value: estado, label: estado }))}
          />
          {isAdmin ? (
            <label className="flex items-center gap-2 field-input !mt-0">
              <input
                type="checkbox"
                checked={form.temPlaca}
                onChange={(e) => setForm({ ...form, temPlaca: e.target.checked })}
              />
              <span className="text-sm">Tem placa</span>
            </label>
          ) : null}
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
              {isAdmin ? <th className="px-4 py-3 font-semibold">Tem Placa</th> : null}
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
                {isAdmin ? (
                  <td className="px-4 py-3">
                    {room.temPlaca ? (
                      <span className="inline-flex items-center gap-1.5 text-campus-emerald">
                        <span className="w-2 h-2 rounded-full bg-campus-emerald"></span>
                        Sim
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-campus-rose">
                        <span className="w-2 h-2 rounded-full bg-campus-rose"></span>
                        Não
                      </span>
                    )}
                  </td>
                ) : null}
                {canManage ? (
                  <td className="px-4 py-3">
                    <TableActions>
                      <EditAction onClick={() => startEdit(room)} />
                      <DeleteAction onClick={() => onDelete(room.id)} />
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
