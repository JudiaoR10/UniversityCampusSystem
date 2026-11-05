export type AlertTone = 'success' | 'error' | 'info';

export type AlertState = { tone: AlertTone; message: string };

const roleByTone = {
  success: 'status',
  error: 'alert',
  info: 'status',
} as const;

const classByTone = {
  success: 'alert-success',
  error: 'alert-error',
  info: 'alert-info',
} as const;

export function AlertMessage({ tone, message }: AlertState) {
  return (
    <p role={roleByTone[tone]} className={classByTone[tone]}>
      {message}
    </p>
  );
}
