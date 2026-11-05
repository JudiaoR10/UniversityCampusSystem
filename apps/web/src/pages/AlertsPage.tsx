import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import type { AlertDto } from '@smart-campus/shared-types';
import { PageIntro } from '../components/PageIntro';
import { AlertMessage } from '../components/AlertMessage';
import { EmptyState, LoadingState, PageBanner, StatusPill } from '../components/ui';
import { CheckIcon, IconActionButton } from '../components/ActionButtons';

function severityTone(severity: string) {
  const value = severity.toUpperCase();
  if (value === 'CRITICAL' || value === 'HIGH') return 'danger' as const;
  if (value === 'MEDIUM' || value === 'WARNING') return 'warning' as const;
  return 'muted' as const;
}

export function AlertsPage() {
  const { api, user } = useAuth();
  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get('deviceId');

  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);

  const canManage = !!user && ['ADMIN', 'COORDINATOR', 'TECHNICIAN'].includes(user.role);

  async function load() {
    const res = await api.alerts(deviceId ?? undefined);
    setAlerts(res.data);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .alerts(deviceId ?? undefined)
      .then((res) => {
        if (!cancelled) setAlerts(res.data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, deviceId]);

  useEffect(() => {
    if (!deviceId) {
      setDeviceLabel(null);
      return;
    }
    let cancelled = false;
    api
      .devices()
      .then((res) => {
        if (cancelled) return;
        const match = res.data.find((item) => item.id === deviceId);
        setDeviceLabel(match ? `${match.code} — ${match.name}` : deviceId);
      })
      .catch(() => {
        if (!cancelled) setDeviceLabel(deviceId);
      });
    return () => {
      cancelled = true;
    };
  }, [api, deviceId]);

  async function onAck(id: string) {
    setError(null);
    setBusyId(id);
    try {
      await api.ackAlert(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao confirmar alerta');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Operações"
        title="Alertas"
        description="Eventos operacionais do campus. Os dados fictícios estão identificados como demonstração."
      />

      {deviceId ? (
        <PageBanner>
          A mostrar só os alertas de <strong>{deviceLabel ?? '…'}</strong>.{' '}
          <Link to="/alerts" className="font-semibold text-campus-teal underline decoration-campus-teal/30 underline-offset-2">
            Ver todos os alertas
          </Link>
        </PageBanner>
      ) : null}

      {error ? <AlertMessage tone="error" message={error} /> : null}

      {loading ? (
        <LoadingState label="A carregar alertas…" />
      ) : alerts.length === 0 ? (
        <EmptyState
          title="Sem alertas"
          description={deviceId ? 'Nenhum alerta associado a este dispositivo.' : 'Nenhum alerta para mostrar.'}
        />
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <article key={alert.id} className="surface p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-semibold text-campus-ink">{alert.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-campus-deep/75">{alert.message}</p>
                </div>
                <StatusPill tone={severityTone(alert.severity)}>{alert.severity}</StatusPill>
              </div>
              {alert.isDemo ? <p className="mt-2 text-xs font-medium text-campus-accent">Dados de demonstração</p> : null}
              <div className="mt-4 flex items-center gap-3 text-xs">
                {alert.acknowledged ? (
                  <StatusPill tone="success">Confirmado</StatusPill>
                ) : canManage ? (
                  <IconActionButton
                    label="Confirmar alerta"
                    icon={<CheckIcon />}
                    tone="success"
                    busy={busyId === alert.id}
                    onClick={() => onAck(alert.id)}
                  />
                ) : (
                  <StatusPill>Por confirmar</StatusPill>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
