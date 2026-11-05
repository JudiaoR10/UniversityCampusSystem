import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { DeviceDto, DeviceStatus, RoomDto } from '@smart-campus/shared-types';
import { DeviceCard } from '../components/iot/DeviceCard';
import { PageIntro } from '../components/PageIntro';
import { ChipTabs, EmptyState, LoadingState } from '../components/ui';
import { SelectField } from '../components/SelectField';
import { EditAction, TableActions } from '../components/ActionButtons';

export function DevicesPage() {
  const { api, user } = useAuth();
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | DeviceStatus>('ALL');
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [form, setForm] = useState({ code: '', name: '', type: '', mqttTopic: '', roomId: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canManage = !!user && ['ADMIN', 'COORDINATOR', 'TECHNICIAN'].includes(user.role);
  const canDelete = !!user && ['ADMIN', 'COORDINATOR'].includes(user.role);

  async function load() {
    const [res, roomsRes] = await Promise.all([api.devices(), api.rooms()]);
    setDevices(res.data);
    setRooms(roomsRes.data);
  }

  useEffect(() => {
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        type: form.type.trim(),
        mqttTopic: form.mqttTopic.trim() || null,
        roomId: form.roomId || null,
      };
      if (editingId) {
        await api.updateDevice(editingId, {
          name: payload.name,
          type: payload.type,
          mqttTopic: payload.mqttTopic,
          roomId: payload.roomId,
        });
        setEditingId(null);
      } else {
        await api.createDevice(payload);
      }
      setForm({ code: '', name: '', type: '', mqttTopic: '', roomId: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar dispositivo');
    } finally {
      setSaving(false);
    }
  }

  
  async function onDelete(device: DeviceDto) {
    if (!window.confirm(`Eliminar o dispositivo ${device.code}?`)) return;
    setError(null);
    try {
      await api.deleteDevice(device.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao eliminar dispositivo');
    }
  }

  async function onStatusChange(device: DeviceDto, status: DeviceStatus) {
  if (status === device.status) return;
  setError(null);
  try {
    await api.updateDeviceStatus(device.id, { status });
    await load();
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erro ao actualizar o estado');
  }
}


  const filtered = devices.filter((d) => (filter === 'ALL' ? true : d.status === filter));

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Inventário IoT"
        title="Dispositivos"
        description="Dispositivos registados no Core, com a sala e os sensores associados."
        actions={
          <Link to="/iot" className="btn-primary">
            Ver hub IoT
          </Link>
        }
      />

      {canManage ? (
        <form onSubmit={onCreate} className="surface grid gap-3 p-4 sm:p-5 sm:grid-cols-2 xl:grid-cols-3">
          <h2 className="section-title sm:col-span-2 xl:col-span-3">{editingId ? 'Editar dispositivo' : 'Novo dispositivo'}</h2>
          <input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="Código (ex.: TEMP-A-01)"
            required
            minLength={2}
            disabled={Boolean(editingId)}
            className="field-input !mt-0"
          />
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome"
            required
            minLength={2}
            className="field-input !mt-0"
          />
          <input
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            placeholder="Tipo (ex.: sensor)"
            required
            minLength={2}
            className="field-input !mt-0"
          />
          <input
            value={form.mqttTopic}
            onChange={(e) => setForm({ ...form, mqttTopic: e.target.value })}
            placeholder="Tópico MQTT (ex.: campus/d2/d2-101/env)"
            className="field-input !mt-0"
          />
          <SelectField
            value={form.roomId}
            onChange={(roomId) => setForm({ ...form, roomId })}
            aria-label="Sala"
            options={[{ value: '', label: 'Sem sala' }, ...rooms.map((room) => ({ value: room.id, label: `${room.code} — ${room.name}` }))]}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'A guardar…' : editingId ? 'Guardar' : 'Criar dispositivo'}
            </button>
            {editingId ? (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setEditingId(null);
                  setForm({ code: '', name: '', type: '', mqttTopic: '', roomId: '' });
                }}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <ChipTabs
        items={[
          { id: 'ALL', label: 'Todos' },
          { id: 'ONLINE', label: 'ONLINE' },
          { id: 'MAINTENANCE', label: 'MAINTENANCE' },
          { id: 'OFFLINE', label: 'OFFLINE' },
          { id: 'UNKNOWN', label: 'UNKNOWN' },
        ]}
        value={filter}
        onChange={setFilter}
        ariaLabel="Filtrar dispositivos"
      />

      {error ? <p className="alert-error">{error}</p> : null}

      {loading ? (
        <LoadingState label="A carregar dispositivos…" />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum dispositivo" description="Nenhum dispositivo para mostrar neste filtro." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((device) => (
            <div key={device.id} className="space-y-2">
              <DeviceCard
                device={device}
                onDelete={canDelete ? onDelete : undefined}
                onStatusChange={canManage ? onStatusChange : undefined}
              />
              {canManage ? (
                <TableActions>
                  <EditAction
                    label="Editar tópico e sala"
                    onClick={() => {
                      setEditingId(device.id);
                      setForm({
                        code: device.code,
                        name: device.name,
                        type: device.type,
                        mqttTopic: device.mqttTopic ?? '',
                        roomId: device.roomId ?? '',
                      });
                    }}
                  />
                </TableActions>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}