import { describe, expect, it } from 'vitest';
import { campusModules } from '@smart-campus/shared-types';

describe('rotas principais', () => {
  it('inclui ops como principal e módulos obrigatórios', () => {
    const paths = campusModules.map((m) => m.path);
    expect(paths).toContain('/ops');
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/rooms');
    expect(paths).toContain('/incidents');
    expect(paths).toContain('/iot');
    expect(campusModules[0]?.key).toBe('ops');
    expect(campusModules.every((m) => ['available', 'partial', 'development'].includes(m.status))).toBe(true);
  });

  it('disponibiliza o módulo de horários no Grupo Académico', () => {
    const schedules = campusModules.find((m) => m.key === 'schedules');
    expect(schedules?.path).toBe('/schedules');
    expect(schedules?.status).toBe('available');
    expect(schedules?.groupHint).toBe('Grupo Académico');
  });

  it('disponibiliza os módulos de assiduidade e avaliações no Grupo Académico', () => {
    const attendance = campusModules.find((m) => m.key === 'attendance');
    expect(attendance?.path).toBe('/attendance');
    expect(attendance?.status).toBe('available');
    expect(attendance?.groupHint).toBe('Grupo Académico');

    const assessments = campusModules.find((m) => m.key === 'assessments');
    expect(assessments?.path).toBe('/assessments');
    expect(assessments?.status).toBe('available');
  });
});
