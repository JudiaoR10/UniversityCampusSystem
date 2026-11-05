import { useCallback, useEffect, useRef, useState } from 'react';

export type ConfirmOptions = {
  title: string;
  message?: string;
  details?: Array<{ label: string; value: string }>;
  confirmLabel?: string;
  confirmTone?: 'danger' | 'primary';
};

export function ConfirmDialog({
  open = true,
  title,
  description,
  message,
  details,
  confirmLabel = 'Confirmar',
  confirmTone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open?: boolean;
  title: string;
  description?: string;
  message?: string;
  details?: Array<{ label: string; value: string }>;
  confirmLabel?: string;
  confirmTone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
  }, [open]);

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

  const desc = description ?? message;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-campus-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
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
        {desc ? <p className="mt-2 text-sm text-campus-deep/75">{desc}</p> : null}
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
                ? 'rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 active:scale-[0.97] disabled:opacity-60'
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
    <ConfirmDialog
      open
      title={options.title}
      message={options.message}
      details={options.details}
      confirmLabel={options.confirmLabel ?? 'Confirmar'}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  ) : null;

  return { confirm, dialog };
}