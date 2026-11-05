import { FormEvent, useEffect, useState } from 'react';
import type { DeviceDto, SensorDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { EmptyState, FormField, LoadingState } from '../components/ui';
import { SelectField } from '../components/SelectField';
import { DeleteAction, EditAction, TableActions } from '../components/ActionButtons';

const emptyForm = {
  code: '',
  name: '',
  metric: 'temperature',
  unit: '°C',
  deviceId: '',
  warningMin: '',
  warningMax: '',
  criticalMin: '',
  criticalMax: '',
};

export function SensorsPage() {
  const { api, user } = useAuth();
  const [sensors, setSensors] = useState<SensorDto[]>([]);
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const canManage = !!user && ['ADMIN', 'COORDINATOR', 'TECHNICIAN'].includes(user.role);
  const canDelete = !!user && ['ADMIN', 'COORDINATOR'].includes(user.role);

  async function load() {
    const [sensorRes, deviceRes] = await Promise.all([api.sensors(), api.devices()]);
    setSensors(sensorRes.data);
    setDevices(deviceRes.data);
    if (!form.deviceId && deviceRes.data[0]) {
      setForm((f) => ({ ...f, deviceId: deviceRes.data[0].id }));
    }
  }

  useEffect(() => {
    load()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api]);

  function resetForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      deviceId: devices[0]?.id ?? '',
    });
  }

  function startEdit(sensor: SensorDto) {
    setEditingId(sensor.id);
    setForm({
      code: sensor.code,
      name: sensor.name,
      metric: sensor.metric,
      unit: sensor.unit ?? '',
      deviceId: sensor.deviceId,
      warningMin: sensor.warningMin != null ? String(sensor.warningMin) : '',
      warningMax: sensor.warningMax != null ? String(sensor.warningMax) : '',
      criticalMin: sensor.criticalMin != null ? String(sensor.criticalMin) : '',
      criticalMax: sensor.criticalMax != null ? String(sensor.criticalMax) : '',
    });
  }

  function num(value: string) {
    if (value.trim() === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      metric: form.metric.trim(),
      unit: form.unit.trim() || null,
      deviceId: form.deviceId,
      warningMin: num(form.warningMin),
      warningMax: num(form.warningMax),
      criticalMin: num(form.criticalMin),
      criticalMax: num(form.criticalMax),
    };
    try {
      if (editingId) await api.updateSensor(editingId, payload);
      else await api.createSensor(payload);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar sensor');
    }
  }

  async function onDelete(sensor: SensorDto) {
    if (!window.confirm(`Eliminar o sensor ${sensor.code}?`)) return;
    setError(null);
    try {
      await api.deleteSensor(sensor.id);
      if (editingId === sensor.id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao eliminar sensor');
    }
  }

  if (loading) return <LoadingState label="A carregar sensores…" />;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Inventário IoT"
        title="Sensores"
        description="Sensores associados a dispositivos, com limiares para alertas ambientais."
      />

      {error ? <p className="alert-error">{error}</p> : null}

      {canManage ? (
        <form onSubmit={onSubmit} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-4">
          <h2 className="section-title md:col-span-2 xl:col-span-4">{editingId ? 'Editar sensor' : 'Novo sensor'}</h2>
          <FormField label="Código">
            <input className="field-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </FormField>
          <FormField label="Nome">
            <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </FormField>
          <FormField label="Métrica">
            <input className="field-input" value={form.metric} onChange={(e) => setForm({ ...form, metric: e.target.value })} required />
          </FormField>
          <FormField label="Unidade">
            <input className="field-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </FormField>
          <FormField label="Dispositivo" className="md:col-span-2">
            <SelectField
              value={form.deviceId}
              onChange={(deviceId) => setForm({ ...form, deviceId })}
              required
              placeholder="Seleccionar dispositivo"
              options={devices.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))}
            />
          </FormField>
          <FormField label="Aviso mín.">
            <input className="field-input" value={form.warningMin} onChange={(e) => setForm({ ...form, warningMin: e.target.value })} />
          </FormField>
          <FormField label="Aviso máx.">
            <input className="field-input" value={form.warningMax} onChange={(e) => setForm({ ...form, warningMax: e.target.value })} />
          </FormField>
          <FormField label="Crítico mín.">
            <input className="field-input" value={form.criticalMin} onChange={(e) => setForm({ ...form, criticalMin: e.target.value })} />
          </FormField>
          <FormField label="Crítico máx.">
            <input className="field-input" value={form.criticalMax} onChange={(e) => setForm({ ...form, criticalMax: e.target.value })} />
          </FormField>
          <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
            <button type="submit" className="btn-primary">
              {editingId ? 'Guardar alterações' : 'Criar sensor'}
            </button>
            {editingId ? (
              <button type="button" className="btn-ghost" onClick={resetForm}>
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {sensors.length === 0 ? (
        <EmptyState title="Sem sensores" description="Crie um sensor ou execute o seed para o dispositivo ambiental." />
      ) : (
        <div className="surface table-scroll">
          <table className="min-w-[860px] text-left text-sm">
            <thead className="bg-campus-mist/80 text-campus-deep">
              <tr>
                <th className="px-4 py-3 font-semibold">Código</th>
                <th className="px-4 py-3 font-semibold">Métrica</th>
                <th className="px-4 py-3 font-semibold">Dispositivo</th>
                <th className="px-4 py-3 font-semibold">Limiares</th>
                {canManage ? <th className="px-4 py-3 text-right font-semibold">Acções</th> : null}
              </tr>
            </thead>
            <tbody>
              {sensors.map((s) => (
                <tr key={s.id} className="border-t border-campus-line/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-campus-ink">{s.code}</p>
                    <p className="text-xs text-campus-deep/60">{s.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    {s.metric} {s.unit ? <span className="text-campus-deep/55">({s.unit})</span> : null}
                  </td>
                  <td className="px-4 py-3">{s.device ? `${s.device.code}` : s.deviceId}</td>
                  <td className="px-4 py-3 text-xs text-campus-deep/70">
                    {s.warningMin != null || s.warningMax != null || s.criticalMin != null || s.criticalMax != null ? (
                      <>
                        aviso {s.warningMin ?? '—'}–{s.warningMax ?? '—'} · crítico {s.criticalMin ?? '—'}–{s.criticalMax ?? '—'}
                      </>
                    ) : (
                      'Padrão do sistema'
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <TableActions>
                        <EditAction onClick={() => startEdit(s)} />
                        {canDelete ? <DeleteAction onClick={() => onDelete(s)} /> : null}
                      </TableActions>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
