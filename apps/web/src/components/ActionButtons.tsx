import type { ReactNode } from 'react';

export function TableActions({ children }: { children: ReactNode }) {
  return <div className="row-actions">{children}</div>;
}

export function IconActionButton({
  label,
  icon,
  danger = false,
  tone,
  disabled = false,
  busy = false,
  title,
  onClick,
}: {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  tone?: 'neutral' | 'danger' | 'success';
  disabled?: boolean;
  busy?: boolean;
  title?: string;
  onClick: () => void;
}) {
  const resolved = tone ?? (danger ? 'danger' : 'neutral');
  return (
    <button
      type="button"
      className={`row-action row-action-${resolved}`}
      disabled={disabled || busy}
      title={title ?? label}
      onClick={onClick}
    >
      {icon || busy ? (
        <span className="row-action-icon" aria-hidden>
          {busy ? '…' : icon}
        </span>
      ) : null}
      {label}
    </button>
  );
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M13.586 3.586a2 2 0 0 1 2.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.828-2.828z" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482l-.025-.004c-.919-.145-1.85-.264-2.786-.334v-.443A2.75 2.75 0 0 0 10.8 1H8.75zM7 4.297c1.321-.169 2.655-.246 4-.247 1.345 0 2.679.078 4 .248M7.5 6.75a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75zm5 0a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4.5 10.5 8 14l7.5-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BanIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 14.5 14.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function EditAction({
  onClick,
  disabled,
  title = 'Editar',
  label = 'Editar',
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  label?: string;
}) {
  return <IconActionButton label={label} icon={<PencilIcon />} title={title} disabled={disabled} onClick={onClick} />;
}

export function DeleteAction({
  onClick,
  disabled,
  busy,
  title,
  label = 'Eliminar',
}: {
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
  label?: string;
}) {
  return (
    <IconActionButton
      label={label}
      icon={<TrashIcon />}
      danger
      title={title ?? label}
      disabled={disabled}
      busy={busy}
      onClick={onClick}
    />
  );
}
