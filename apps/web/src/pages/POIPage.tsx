import { FormEvent, useEffect, useState } from 'react';
import type { BuildingDto, POIDto, RoomDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { SelectField } from '../components/SelectField';
import { DeleteAction, EditAction, TableActions } from '../components/ActionButtons';

type POIForm = {
  nome: string;
  descricao: string;
  tipo: string;
  edificioId: string;
  sala_codigo: string;
  piso: string;
  ativo: boolean;
};

const POI_TIPOS = [
  'ENTRADA',
  'SAIDA',
  'WC',
  'REFEITORIO',
  'BIBLIOTECA',
  'SECRETARIA',
  'AUDITORIO',
  'LABORATORIO',
  'SALA_AULA',
  'ESCADA',
  'ELEVADOR',
  'OUTRO',
];

export function POIPage() {
  const { api, user } = useAuth();
  const [pois, setPois] = useState<POIDto[]>([]);
  const [buildings, setBuildings] = useState<BuildingDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<POIForm>({
    nome: '',
    descricao: '',
    tipo: 'OUTRO',
    edificioId: '',
    sala_codigo: '',
    piso: '',
    ativo: true,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const canManage = user && ['ADMIN', 'COORDINATOR', 'TECHNICIAN'].includes(user.role);

  async function load() {
    const [poisRes, buildingsRes, roomsRes] = await Promise.all([
      api.pois(),
      api.buildings(),
      api.rooms(),
    ]);
    setPois(poisRes.data);
    setBuildings(buildingsRes.data);
    setRooms(roomsRes.data);
    if (!editingId && !form.edificioId && buildingsRes.data[0]) {
      setForm((f) => ({ ...f, edificioId: buildingsRes.data[0].id }));
    }
  }

  useEffect(() => {
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setForm({
      nome: '',
      descricao: '',
      tipo: 'OUTRO',
      edificioId: buildings[0]?.id ?? '',
      sala_codigo: '',
      piso: '',
      ativo: true,
    });
    setEditingId(null);
    setError(null);
  }

  function startEdit(p: POIDto) {
    setEditingId(p.id);
    setForm({
      nome: p.nome,
      descricao: p.descricao ?? '',
      tipo: p.tipo,
      edificioId: p.edificioId ?? '',
      sala_codigo: p.sala?.code ?? '',
      piso: p.piso != null ? String(p.piso) : '',
      ativo: p.ativo,
    });
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const selectedBuilding = buildings.find((b) => b.id === form.edificioId);
    const autoMapX = selectedBuilding?.mapX != null ? Math.round(selectedBuilding.mapX * 10) : 0;
    const autoMapY = selectedBuilding?.mapY != null ? Math.round(selectedBuilding.mapY * 10) : 0;
    const selectedRoom = rooms.find((r) => r.code === form.sala_codigo);
    const autoPiso = selectedRoom ? selectedRoom.floor : (form.piso === '' ? null : Number(form.piso));
    try {
      if (editingId) {
        await api.updatePoi(editingId, {
          nome: form.nome,
          descricao: form.descricao || null,
          tipo: form.tipo,
          edificioId: form.edificioId || null,
          sala_codigo: form.sala_codigo || null,
          piso: autoPiso,
          mapX: autoMapX,
          mapY: autoMapY,
          ativo: form.ativo,
        });
      } else {
        await api.createPoi({
          nome: form.nome,
          descricao: form.descricao || null,
          tipo: form.tipo,
          edificioId: form.edificioId || null,
          sala_codigo: form.sala_codigo || null,
          piso: autoPiso,
          mapX: autoMapX,
          mapY: autoMapY,
          ativo: form.ativo,
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? 'Erro ao atualizar POI' : 'Erro ao criar POI');
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Tem a certeza que pretende eliminar este POI?')) return;
    setError(null);
    try {
      await api.deletePoi(id);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao eliminar POI');
    }
  }

  const roomsForBuilding = rooms.filter((r) => r.building.id === form.edificioId);
  const selectedRoom = rooms.find((r) => r.code === form.sala_codigo);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Infraestrutura"
        title="Pontos de Interesse (POI)"
        description="Cadastro de pontos de interesse do campus (entradas, WC, refeitório, biblioteca, etc.)."
      />

      {error ? <p className="alert-error">{error}</p> : null}
      {loading ? <p className="text-sm text-campus-deep/70">A carregar pontos de interesse…</p> : null}

      {canManage ? (
        <form onSubmit={onSubmit} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-5">
          <h2 className="section-title md:col-span-2 xl:col-span-5">
            {editingId ? 'Editar POI' : 'Novo POI'}
          </h2>
          <input
            className="field-input !mt-0"
            placeholder="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
          <input
            className="field-input !mt-0"
            placeholder="Descrição"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
          <select
            className="field-input !mt-0"
            value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value })}
          >
            {POI_TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <SelectField
            value={form.edificioId}
            onChange={(edificioId) => setForm({ ...form, edificioId, sala_codigo: '' })}
            required
            placeholder="Seleccionar edifício"
            options={buildings.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))}
          />
          <SelectField
            value={form.sala_codigo}
            onChange={(sala_codigo) => setForm({ ...form, sala_codigo })}
            placeholder="Seleccionar sala (opcional)"
            options={roomsForBuilding.map((r) => ({ value: r.code, label: `${r.code} — ${r.name}` }))}
          />
          <input
            className="field-input !mt-0"
            type="number"
            placeholder="Piso"
            value={selectedRoom ? String(selectedRoom.floor) : form.piso}
            onChange={(e) => setForm({ ...form, piso: e.target.value })}
            disabled={!!selectedRoom}
            title={selectedRoom ? 'Piso determinado automaticamente pela sala selecionada' : ''}
          />
          <div className="flex items-center gap-2 xl:col-span-1">
            <input
              className="form-checkbox"
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            <label className="text-sm text-campus-deep">Ativo</label>
          </div>
          <div className="flex flex-col gap-2 xl:col-span-1">
            <button type="submit" className="btn-primary w-full">
              {editingId ? 'Guardar alterações' : 'Criar POI'}
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
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Tipo</th>
              <th className="px-4 py-3 font-semibold">Edifício</th>
              <th className="px-4 py-3 font-semibold">Sala</th>
              <th className="px-4 py-3 font-semibold">Piso</th>
              <th className="px-4 py-3 font-semibold">Ativo</th>
              {canManage ? <th className="px-4 py-3 text-right font-semibold">Ações</th> : null}
            </tr>
          </thead>
          <tbody>
            {pois.map((p) => (
              <tr key={p.id} className="border-t border-campus-line/70">
                <td className="px-4 py-3 font-medium">{p.nome}</td>
                <td className="px-4 py-3">{p.tipo}</td>
                <td className="px-4 py-3">{p.edificio?.code ?? '—'}</td>
                <td className="px-4 py-3">{p.sala?.code ?? '—'}</td>
                <td className="px-4 py-3">{p.piso != null ? String(p.piso) : '—'}</td>
                <td className="px-4 py-3">
                  {p.ativo ? (
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
                {canManage ? (
                  <td className="px-4 py-3">
                    <TableActions>
                      <EditAction onClick={() => startEdit(p)} />
                      <DeleteAction onClick={() => onDelete(p.id)} />
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
