export type AlertTone = 'success' | 'error';

export type AlertState = { tone: AlertTone; message: string };

export function AlertMessage({ tone, message }: AlertState) {
  const palette =
    tone === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700';

  return (
    <p
      role={tone === 'success' ? 'status' : 'alert'}
      className={`rounded-xl px-3 py-2 text-sm ${palette}`}
    >
      {message}
    </p>
  );
}
