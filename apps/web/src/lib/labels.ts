import type { RoleCode } from '@smart-campus/shared-types';

export const roleLabels: Record<RoleCode, string> = {
  STUDENT: 'Estudante',
  TEACHER: 'Docente',
  TECHNICIAN: 'Técnico',
  COORDINATOR: 'Coordenador',
  ADMIN: 'Administrador',
  FINANCE: 'Financeiro',
};

export function greetingFor(fullName: string, at = new Date()) {
  const hour = at.getHours();
  const hello = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const first = fullName.trim().split(/\s+/)[0] || fullName;
  return `${hello}, ${first}`;
}

export function initialsFor(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function coreStatusLabel(status: string | undefined) {
  if (status === 'healthy') return 'Tudo a funcionar';
  if (status === 'degraded') return 'Atenção necessária';
  return status ?? 'Indisponível';
}

export function relativeTime(iso: string, at = new Date()) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((at.getTime() - then) / 60_000));
  if (minutes < 1) return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });
}
