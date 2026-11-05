import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { AdminSettingsDto, AdminStatusDto } from '@smart-campus/shared-types';
import { useAuth } from '../lib/auth';
import { PageIntro } from '../components/PageIntro';
import { FormField, LoadingState, StatusPill } from '../components/ui';

const links = [
  { to: '/users', label: 'Utilizadores', hint: 'Contas, papéis e estado de acesso.' },
  { to: '/audit', label: 'Auditoria', hint: 'Eventos com correlationId do Core.' },
  { to: '/sensors', label: 'Sensores', hint: 'Limiares ambientais e inventário IoT.' },
  { to: '/reports', label: 'Relatórios', hint: 'Indicadores agregados do campus.' },
];

export function AdminPage() {
  const { api, user } = useAuth();
  const [settings, setSettings] = useState<AdminSettingsDto | null>(null);
  const [status, setStatus] = useState<AdminStatusDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') return;
    Promise.all([api.adminSettings(), api.adminStatus()])
      .then(([settingsRes, statusRes]) => {
        setSettings(settingsRes.data);
        setStatus(statusRes.data);
      })
      .catch((err: Error) => setError(err.message));
  }, [api, user]);

  if (user && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.updateAdminSettings({
        parkingLabMode: settings.parkingLabMode,
        tempWarningMax: settings.tempWarningMax,
        co2WarningMax: settings.co2WarningMax,
        co2CriticalMax: settings.co2CriticalMax,
        readingRetentionDays: settings.readingRetentionDays,
      });
      setSettings(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar configuração');
    } finally {
      setSaving(false);
    }
  }

  if (!settings || !status) {
    return error ? <p className="alert-error">{error}</p> : <LoadingState label="A carregar administração…" />;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Sistema"
        title="Administração"
        description="Estado do Core, MQTT e limiares operacionais."
        actions={
          <StatusPill tone={status.coreStatus === 'healthy' ? 'success' : 'warning'}>
            {status.coreStatus === 'healthy' ? 'Tudo a funcionar' : 'Atenção necessária'}
          </StatusPill>
        }
      />

      {error ? <p className="alert-error">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'MQTT', value: status.mqttConnected ? 'Ligado' : 'Desligado', hint: status.mqttUrl },
          { label: 'Dispositivos online', value: status.devicesOnline, hint: `${status.devicesOffline} offline` },
          { label: 'Ocorrências abertas', value: status.openIncidents, hint: 'Fila de manutenção' },
          { label: 'Alertas vivos', value: status.unreadAlerts, hint: 'Não confirmados e não DEMO' },
        ].map((card) => (
          <div key={card.label} className="surface p-5">
            <p className="text-sm text-campus-deep/65">{card.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold text-campus-ink">{card.value}</p>
            <p className="mt-1 truncate text-xs text-campus-deep/55">{card.hint}</p>
          </div>
        ))}
      </section>

      <form onSubmit={onSave} className="surface grid gap-3 p-4 sm:p-5 md:grid-cols-2">
        <h2 className="section-title md:col-span-2">Configuração</h2>
        <label className="flex items-center gap-3 rounded-xl border border-campus-line/80 bg-campus-mist/50 px-4 py-3 md:col-span-2">
          <input
            type="checkbox"
            checked={settings.parkingLabMode}
            onChange={(e) => setSettings({ ...settings, parkingLabMode: e.target.checked })}
          />
          <span className="text-sm text-campus-ink">Modo laboratório LPR (formulário DEMO no parque)</span>
        </label>
        <FormField label="Temperatura aviso (°C)">
          <input
            className="field-input"
            type="number"
            value={settings.tempWarningMax}
            onChange={(e) => setSettings({ ...settings, tempWarningMax: Number(e.target.value) })}
          />
        </FormField>
        <FormField label="CO₂ aviso (ppm)">
          <input
            className="field-input"
            type="number"
            value={settings.co2WarningMax}
            onChange={(e) => setSettings({ ...settings, co2WarningMax: Number(e.target.value) })}
          />
        </FormField>
        <FormField label="CO₂ crítico (ppm)">
          <input
            className="field-input"
            type="number"
            value={settings.co2CriticalMax}
            onChange={(e) => setSettings({ ...settings, co2CriticalMax: Number(e.target.value) })}
          />
        </FormField>
        <FormField label="Retenção de leituras (dias)">
          <input
            className="field-input"
            type="number"
            min={1}
            max={3650}
            value={settings.readingRetentionDays}
            onChange={(e) => setSettings({ ...settings, readingRetentionDays: Number(e.target.value) })}
          />
        </FormField>
        <div className="md:col-span-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'A guardar…' : 'Guardar configuração'}
          </button>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((item) => (
          <Link key={item.to} to={item.to} className="surface-interactive block p-5">
            <p className="font-medium text-campus-ink">{item.label}</p>
            <p className="mt-1 text-sm text-campus-deep/70">{item.hint}</p>
          </Link>
        ))}
        <a href="/api/docs" target="_blank" rel="noreferrer" className="surface-interactive block p-5">
          <p className="font-medium text-campus-ink">Documentação API</p>
          <p className="mt-1 text-sm text-campus-deep/70">Contrato OpenAPI em /api/docs.</p>
        </a>
      </div>
    </div>
  );
}
