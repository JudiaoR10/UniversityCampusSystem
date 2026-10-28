import { useCallback, useEffect, useRef, useState } from 'react';

export type ConfirmOptions = {
  title: string;
  message?: string;
  details?: Array<{ label: string; value: string }>;
  confirmLabel?: string;
};

export function ConfirmDialog({
  title,
  message,
  details,
  confirmLabel = 'Confirmar',
  onCancel,
  onConfirm,
}: ConfirmOptions & { onCancel: () => void; onConfirm: () => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-campus-ink/40 p-4 backdrop-blur-sm"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
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
        {message ? <p className="mt-2 text-sm text-campus-deep/75">{message}</p> : null}
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
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button ref={confirmRef} type="button" className="btn-primary" onClick={onConfirm}>
            {confirmLabel}
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
      {...options}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  ) : null;

  return { confirm, dialog };
}
