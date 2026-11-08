import { useCallback, useEffect, useRef, useState } from 'react';

export type ConfirmOptions = {
  title: string;
  message?: string;
  description?: string;
  details?: Array<{ label: string; value: string }>;
  confirmLabel?: string;
  confirmTone?: 'danger' | 'primary';
};

type ConfirmDialogProps = ConfirmOptions & {
  open?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Diálogo partilhado pelos fluxos directos e pelo hook useConfirm.
 * Aceita description ou message, fecha com Escape ou clique fora.
 */
export function ConfirmDialog({
  open = true,
  title,
  description,
  message,
  details,
  confirmLabel = 'Confirmar',
  confirmTone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const supportingText = description ?? message;

  useEffect(() => {
    if (open && !busy) confirmRef.current?.focus();
  }, [open, busy]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-campus-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-busy={busy}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="surface w-full max-w-md p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Confirmação</p>
        <h2
          id="confirm-dialog-title"
          className="mt-1 font-display text-lg font-semibold text-campus-ink"
        >
          {title}
        </h2>
        {supportingText ? <p className="mt-2 text-sm text-campus-deep/75">{supportingText}</p> : null}
        {details && details.length > 0 ? (
          <dl className="mt-3 space-y-1.5 rounded-xl bg-campus-mist/70 p-3 text-sm">
            {details.map((item) => (
              <div key={item.label} className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-xs uppercase tracking-wide text-campus-deep/55">{item.label}</dt>
                <dd className="font-medium text-campus-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={
              confirmTone === 'danger'
                ? 'rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.97] disabled:opacity-60'
                : 'btn-primary'
            }
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'A processar...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useConfirm() {
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const settle = useCallback((confirmed: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOptions(null);
    resolve?.(confirmed);
  }, []);

  const dialog = options ? (
    <ConfirmDialog {...options} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
  ) : null;

  return { confirm, dialog };
}
