import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ScheduleDto } from '@smart-campus/shared-types';

const useAuthMock = vi.fn();
const { printDocumentMock } = vi.hoisted(() => ({ printDocumentMock: vi.fn() }));

vi.mock('../lib/auth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../lib/print', () => ({
  printDocument: printDocumentMock,
}));

import { SchedulesPage } from './SchedulesPage';

const sampleSchedule: ScheduleDto = {
  id: 'schedule-1',
  title: 'Aula PTP3 — Projeto',
  subjectId: 'subject-1',
  subject: { id: 'subject-1', code: 'PTP3', name: 'Projeto' },
  courseId: 'course-1',
  course: { id: 'course-1', code: 'LEI', name: 'Engenharia Informática' },
  teacherId: 'teacher-1',
  teacher: { id: 'teacher-1', fullName: 'Docente Demo' },
  roomId: 'room-1',
  room: { id: 'room-1', code: 'A-101', name: 'Sala A-101' },
  startsAt: '2026-11-02T09:00:00.000Z',
  endsAt: '2026-11-02T10:30:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const optionsPayload = {
  courses: [{ id: 'course-1', code: 'LEI', name: 'Engenharia Informática' }],
  subjects: [{ id: 'subject-1', code: 'PTP3', name: 'Projeto', courseId: 'course-1' }],
  teachers: [{ id: 'teacher-1', fullName: 'Docente Demo' }],
  rooms: [{ id: 'room-1', code: 'A-101', name: 'Sala A-101' }],
};

function buildApi(overrides: Record<string, unknown> = {}) {
  return {
    schedules: vi.fn().mockResolvedValue({ data: [sampleSchedule], meta: {} }),
    scheduleOptions: vi.fn().mockResolvedValue({ data: optionsPayload, meta: {} }),
    createSchedule: vi.fn().mockResolvedValue({ data: sampleSchedule, meta: {} }),
    updateSchedule: vi.fn().mockResolvedValue({ data: sampleSchedule, meta: {} }),
    deleteSchedule: vi.fn().mockResolvedValue({ data: { id: 'schedule-1' }, meta: {} }),
    ...overrides,
  };
}

function setAuth(role: string, api = buildApi()) {
  useAuthMock.mockReturnValue({ user: { id: 'user-1', role }, api });
  return api;
}

describe('SchedulesPage', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    printDocumentMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('mostra os horários agrupados por dia para um estudante (sem formulário)', async () => {
    setAuth('STUDENT');
    render(<SchedulesPage />);

    expect(await screen.findByText('Aula PTP3 — Projeto')).toBeInTheDocument();
    expect(screen.getByText('A-101 — Sala A-101')).toBeInTheDocument();
    expect(screen.getByText('Docente Demo')).toBeInTheDocument();
    expect(screen.queryByText('Nova sessão de horário')).not.toBeInTheDocument();
  });

  it('mostra estado vazio quando não há horários', async () => {
    setAuth('STUDENT', buildApi({ schedules: vi.fn().mockResolvedValue({ data: [], meta: {} }) }));
    render(<SchedulesPage />);

    expect(await screen.findByText('Não há horários para mostrar.')).toBeInTheDocument();
  });

  it('mostra mensagem de erro amigável quando a API falha', async () => {
    setAuth('STUDENT', buildApi({ schedules: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) }));
    render(<SchedulesPage />);

    expect(
      await screen.findByText('Não foi possível carregar os horários. Verifica a ligação e tenta novamente.'),
    ).toBeInTheDocument();
  });

  it('coordenador vê o formulário de gestão e as ações', async () => {
    const api = setAuth('COORDINATOR');
    render(<SchedulesPage />);

    expect(await screen.findByText('Nova sessão de horário')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar horário' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument();
    await waitFor(() => expect(api.scheduleOptions).toHaveBeenCalled());
  });

  it('imprime o horário com as colunas e linhas corretas', async () => {
    setAuth('STUDENT');
    render(<SchedulesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Imprimir horário' }));

    expect(printDocumentMock).toHaveBeenCalledTimes(1);
    const doc = printDocumentMock.mock.calls[0][0];
    expect(doc.columns).toContain('Sala');
    expect(doc.rows[0]).toEqual([
      expect.any(String),
      expect.stringContaining('–'),
      'Aula PTP3 — Projeto',
      'Projeto',
      'Docente Demo',
      'A-101 — Sala A-101',
    ]);
  });

  it('desativa o botão de imprimir quando não há horários', async () => {
    setAuth('STUDENT', buildApi({ schedules: vi.fn().mockResolvedValue({ data: [], meta: {} }) }));
    render(<SchedulesPage />);

    await screen.findByText('Não há horários para mostrar.');
    expect(screen.getByRole('button', { name: 'Imprimir horário' })).toBeDisabled();
  });
});
