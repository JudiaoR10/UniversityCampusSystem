import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AttendanceDto, AttendanceRoster, AttendanceSummaryDto, ScheduleDto } from '@smart-campus/shared-types';

const useAuthMock = vi.fn();

vi.mock('../lib/auth', () => ({
  useAuth: () => useAuthMock(),
}));

import { AttendancePage } from './AttendancePage';

const sampleSession: ScheduleDto = {
  id: 'schedule-1',
  title: 'Aula PTP3',
  subjectId: 'subject-1',
  subject: { id: 'subject-1', code: 'PTP3', name: 'Projeto' },
  courseId: 'course-1',
  course: { id: 'course-1', code: 'LEI', name: 'Engenharia Informática' },
  teacherId: 'teacher-1',
  teacher: { id: 'teacher-1', fullName: 'Docente Demo' },
  roomId: null,
  room: null,
  startsAt: '2026-11-02T09:00:00.000Z',
  endsAt: '2026-11-02T10:30:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const sampleRecord: AttendanceDto = {
  id: 'attendance-1',
  classScheduleId: 'schedule-1',
  classSchedule: { id: 'schedule-1', title: 'Aula PTP3', startsAt: '2026-11-02T09:00:00.000Z', endsAt: '2026-11-02T10:30:00.000Z' },
  studentProfileId: 'student-1',
  student: { id: 'student-1', studentNumber: 'EST-2026-001', fullName: 'Estudante Demo' },
  status: 'PRESENT',
  note: null,
  recordedById: 'teacher-1',
  recordedAt: '2026-11-02T09:05:00.000Z',
  createdAt: '2026-11-02T09:05:00.000Z',
  updatedAt: '2026-11-02T09:05:00.000Z',
};

const sampleSummary: AttendanceSummaryDto = {
  studentProfileId: 'student-1',
  studentNumber: 'EST-2026-001',
  fullName: 'Estudante Demo',
  present: 3,
  absent: 1,
  late: 0,
  justified: 0,
  total: 4,
  attendanceRate: 75,
};

const sampleRoster: AttendanceRoster = {
  schedule: {
    id: 'schedule-1',
    title: 'Aula PTP3',
    startsAt: '2026-11-02T09:00:00.000Z',
    endsAt: '2026-11-02T10:30:00.000Z',
    subject: { id: 'subject-1', code: 'PTP3', name: 'Projeto' },
    course: { id: 'course-1', code: 'LEI', name: 'Engenharia Informática' },
  },
  entries: [{ id: 'student-1', studentNumber: 'EST-2026-001', fullName: 'Estudante Demo', attendanceId: null, status: null, note: null }],
};

function buildApi(overrides: Record<string, unknown> = {}) {
  return {
    attendance: vi.fn().mockResolvedValue({ data: [sampleRecord], meta: {} }),
    attendanceSummary: vi.fn().mockResolvedValue({ data: [sampleSummary], meta: {} }),
    attendanceSessions: vi.fn().mockResolvedValue({ data: [sampleSession], meta: {} }),
    attendanceRoster: vi.fn().mockResolvedValue({ data: sampleRoster, meta: {} }),
    markAttendance: vi.fn().mockResolvedValue({ data: sampleRoster, meta: {} }),
    ...overrides,
  };
}

function setAuth(role: string, api = buildApi()) {
  useAuthMock.mockReturnValue({ user: { id: 'user-1', role }, api });
  return api;
}

describe('AttendancePage', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('estudante vê o resumo e os registos', async () => {
    setAuth('STUDENT');
    render(<AttendancePage />);

    expect(await screen.findByText('Registos')).toBeInTheDocument();
    expect(screen.getByText('Aula PTP3')).toBeInTheDocument();
    expect(screen.getByText('Presente')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Presenças')).toBeInTheDocument();
  });

  it('docente abre uma sessão, ajusta o estado e guarda', async () => {
    const api = setAuth('TEACHER');
    render(<AttendancePage />);

    const sessionSelect = await screen.findByRole('combobox');
    fireEvent.change(sessionSelect, { target: { value: 'schedule-1' } });

    const statusSelect = await screen.findByLabelText('Estado de EST-2026-001');
    fireEvent.change(statusSelect, { target: { value: 'ABSENT' } });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar assiduidade' }));

    await waitFor(() =>
      expect(api.markAttendance).toHaveBeenCalledWith(
        'schedule-1',
        expect.objectContaining({ records: [{ studentId: 'student-1', status: 'ABSENT', note: null }] }),
      ),
    );
  });

  it('docente vê o resumo da turma', async () => {
    const api = setAuth('TEACHER');
    render(<AttendancePage />);

    expect(await screen.findByText('Resumo de assiduidade')).toBeInTheDocument();
    expect(screen.getByText('EST-2026-001')).toBeInTheDocument();
    await waitFor(() => expect(api.attendanceSummary).toHaveBeenCalled());
  });

  it('mostra erro amigável quando a API de assiduidade falha', async () => {
    setAuth('STUDENT', buildApi({ attendance: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) }));
    render(<AttendancePage />);

    expect(await screen.findByText('Não foi possível carregar a tua assiduidade.')).toBeInTheDocument();
  });
});
