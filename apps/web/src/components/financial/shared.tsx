import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export const money = (value: number) => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN' }).format(value);
export const date = (value: string) => new Date(value).toLocaleDateString('pt-MZ');
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível concluir a operação.';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

export function BusyLabel({ busy, busyText, children }: { busy: boolean; busyText: string; children: ReactNode }) {
  return busy ? <span className="inline-flex items-center gap-2"><Spinner className="h-4 w-4" />{busyText}</span> : <>{children}</>;
}

export function SuccessFeedback({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  return <div className="fixed inset-x-4 top-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:justify-end" role="status" aria-live="polite">
    <div className="surface flex max-w-sm items-center gap-3 border-campus-teal/30 bg-white px-4 py-3 shadow-xl">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-campus-teal text-sm font-bold text-white" aria-hidden="true">✓</span>
      <span className="text-sm font-semibold text-campus-deep">{message}</span>
      <button type="button" className="ml-1 text-lg leading-none text-campus-deep/55 hover:text-campus-deep" aria-label="Fechar confirmação" onClick={onClose}>×</button>
    </div>
  </div>;
}

export function ConfirmDialog({ open, title = 'Confirmar', message, busy = false, confirmLabel = 'Confirmar', onConfirm, onCancel }: {
  open: boolean; title?: string; message: string; busy?: boolean; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-campus-deep/35 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="surface w-full max-w-sm space-y-4 bg-white p-5 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
      <div><h2 id="confirm-title" className="font-display text-xl font-semibold">{title}</h2><p id="confirm-message" className="mt-1 text-sm text-campus-deep/75">{message}</p></div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" type="button" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button className="btn-primary !bg-red-700 hover:!bg-red-800" type="button" disabled={busy} onClick={onConfirm}><BusyLabel busy={busy} busyText="A eliminar…">{confirmLabel}</BusyLabel></button>
      </div>
    </section>
  </div>;
}

// Ignora respostas de consultas que já deixaram de ser a selecção actual.
export function useFinancialLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(undefined);
    setError('');
    load().then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(errorMessage(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, attempt]);
  return { data, loading, error, reload: () => setAttempt(n => n + 1) };
}

export function LoadState({ loading, error, reload, label = 'A carregar…' }: { loading: boolean; error: string; reload: () => void; label?: string }) {
  return <>
    {loading && <div role="status" aria-live="polite" className="surface flex items-center gap-3 p-4">
      <Spinner className="h-6 w-6 text-campus-teal" />
      <p className="text-sm font-medium text-campus-deep/75">{label}</p>
      <span className="sr-only">Aguarde</span>
    </div>}
    {error && <div role="alert" className="space-y-2 text-red-700"><p>{error}</p><button className="btn-secondary" onClick={reload}>Tentar novamente</button></div>}
  </>;
}

export function Pagination({ offset, hasMore, loading, onChange }: { offset: number; hasMore: boolean; loading: boolean; onChange: (offset: number) => void }) {
  return <div className="flex flex-wrap items-center gap-3">
    <button className="btn-secondary" disabled={loading || offset === 0} onClick={() => onChange(Math.max(0, offset - 20))}>Anterior</button>
    <span className="text-sm">Página {offset / 20 + 1}</span>
    <button className="btn-secondary" disabled={loading || !hasMore} onClick={() => onChange(offset + 20)}>Seguinte</button>
  </div>;
}
