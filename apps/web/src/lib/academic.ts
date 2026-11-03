import type { AcademicState } from '@smart-campus/shared-types';

export const STATE_LABELS: Record<AcademicState, string> = {
  PENDENTE: 'Frequência incompleta',
  DISPENSADO: 'Dispensado',
  EXCLUIDO: 'Excluído',
  ADMITIDO_AO_EXAME: 'Admitido ao exame',
  APROVADO_EXAME: 'Aprovado no exame normal',
  REPROVADO_EXAME: 'Reprovado no exame normal',
  ADMITIDO_RECORRENCIA: 'Admitido à recorrência',
  APROVADO_RECORRENCIA: 'Aprovado na recorrência',
  REPROVADO_RECORRENCIA: 'Reprovado na recorrência',
  NAO_ELEGIVEL_RECORRENCIA: 'Não elegível à recorrência',
  RECORRENCIA_EM_REVISAO: 'Recorrência em revisão',
};

export const STATE_STYLES: Record<AcademicState, string> = {
  PENDENTE: 'bg-slate-100 text-slate-700',
  DISPENSADO: 'bg-sky-50 text-sky-700',
  EXCLUIDO: 'bg-red-50 text-red-700',
  ADMITIDO_AO_EXAME: 'bg-amber-50 text-amber-800',
  APROVADO_EXAME: 'bg-emerald-50 text-emerald-700',
  REPROVADO_EXAME: 'bg-red-50 text-red-700',
  ADMITIDO_RECORRENCIA: 'bg-amber-50 text-amber-800',
  APROVADO_RECORRENCIA: 'bg-emerald-50 text-emerald-700',
  REPROVADO_RECORRENCIA: 'bg-red-50 text-red-700',
  NAO_ELEGIVEL_RECORRENCIA: 'bg-slate-100 text-slate-600',
  RECORRENCIA_EM_REVISAO: 'bg-violet-50 text-violet-700',
};

export const ACADEMIC_STATES: AcademicState[] = [
  'PENDENTE',
  'DISPENSADO',
  'EXCLUIDO',
  'ADMITIDO_AO_EXAME',
  'APROVADO_EXAME',
  'REPROVADO_EXAME',
  'ADMITIDO_RECORRENCIA',
  'APROVADO_RECORRENCIA',
  'REPROVADO_RECORRENCIA',
  'NAO_ELEGIVEL_RECORRENCIA',
  'RECORRENCIA_EM_REVISAO',
];

export const RECURRENCE_LEGEND = '* Aprovado no exame normal — não necessita de recorrência';

export function stateBadgeClass(state: AcademicState | null): string {
  if (!state) return 'bg-slate-100 text-slate-600';
  return STATE_STYLES[state];
}
