import type { ReactNode } from 'react';

/**
 * Botão de acção em linha (editar/eliminar) com ícone + rótulo.
 * Variante danger: anima para vermelho no hover e desabilita durante a operação.
 */
export function IconActionButton({
  label,
  icon,
  danger = false,
  disabled = false,
  busy = false,
  title,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
  onClick: () => void;
}) {
  const base =
    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1';
  const tone = disabled
    ? 'cursor-not-allowed border-campus-line/60 bg-campus-mist/40 text-campus-deep/40'
    : danger
      ? 'border-red-200/70 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 active:scale-[0.97] focus-visible:ring-red-300'
      : 'border-campus-line bg-white text-campus-deep hover:bg-campus-mist hover:border-campus-line active:scale-[0.97] focus-visible:ring-campus-line';
  return (
    <button
      type="button"
      className={`${base} ${tone}`}
      disabled={disabled || busy}
      title={title}
      onClick={onClick}
    >
      <span aria-hidden="true" className={busy ? 'animate-pulse' : undefined}>
        {busy ? '…' : icon}
      </span>
      {label}
    </button>
  );
}

export function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M13.586 3.586a2 2 0 0 1 2.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.828-2.828z" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482l-.025-.004c-.919-.145-1.85-.264-2.786-.334v-.443A2.75 2.75 0 0 0 10.8 1H8.75zM7 4.297c1.321-.169 2.655-.246 4-.247 1.345 0 2.679.078 4 .248M7.5 6.75a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75zm5 0a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}
