import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { canViewAlerts } from '../lib/roles';
import type { AlertDto } from '@smart-campus/shared-types';

export function AlertsPage() {
  const { api, user } = useAuth();
  const [searchParams] = useSearchParams();
  const deviceId = searchParams.get('deviceId');

  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);

  const canSee = canViewAlerts(user?.role);
  const canManage = canSee;

  async function load() {
    const res = await api.alerts(deviceId ?? undefined);
    setAlerts(res.data);
  }

  // Carrega os alertas (todos, ou só os do dispositivo indicado em ?deviceId=)
  useEffect(() => {
    if (!canSee) return;
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
  }, [api, deviceId, canSee]);

  // Nome do dispositivo para o aviso de filtro
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
        const d = res.data.find((x) => x.id === deviceId);
        setDeviceLabel(d ? `${d.code} — ${d.name}` : deviceId);
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

  if (!canSee) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-campus-line bg-white/85 p-5 shadow-panel">
        <h2 className="font-display text-2xl">Alertas</h2>
        <p className="mt-1 text-sm text-campus-deep/75">Alertas fictícios estão claramente marcados como demonstração.</p>
        {deviceId ? (
          <p className="mt-3 text-sm text-campus-ink">
            A mostrar só os alertas de <span className="font-semibold">{deviceLabel ?? '…'}</span>.{' '}
            <Link to="/alerts" className="underline">
              Ver todos os alertas
            </Link>
          </p>
        ) : null}
      </section>

      {error ? <p className="text-red-700">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-campus-deep/70">A carregar alertas…</p>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-campus-deep/70">
          {deviceId ? 'Nenhum alerta associado a este dispositivo.' : 'Nenhum alerta para mostrar.'}
        </p>
      ) : (
        <div className="space-y-3">
          {alerts.map((a) => (
            <article key={a.id} className="rounded-2xl border border-campus-line bg-white p-4 shadow-panel">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium">{a.title}</h3>
                <span className="text-xs">{a.severity}</span>
              </div>
              <p className="mt-1 text-sm text-campus-deep/75">{a.message}</p>
              {a.isDemo ? <p className="mt-2 text-xs text-campus-accent">Dados de demonstração</p> : null}
              <div className="mt-3 flex items-center gap-3 text-xs">
                {a.acknowledged ? (
                  <span className="font-semibold text-emerald-700">Confirmado</span>
                ) : canManage ? (
                  <button
                    type="button"
                    disabled={busyId === a.id}
                    onClick={() => onAck(a.id)}
                    className="btn-primary"
                  >
                    {busyId === a.id ? 'A confirmar…' : 'Confirmar alerta'}
                  </button>
                ) : (
                  <span className="text-campus-deep/60">Por confirmar</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}