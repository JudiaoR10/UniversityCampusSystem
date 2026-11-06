import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AttendanceDto, AttendanceRoster, AttendanceSummaryDto, ScheduleDto } from '@smart-campus/shared-types';

const useAuthMock = vi.fn();

vi.mock('../lib/auth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../lib/print', () => ({ printDocument: vi.fn() }));

import { printDocument } from '../lib/print';
import { AttendancePage } from './AttendancePage';
import { changeSelect } from '../test/selectField';

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
    vi.mocked(printDocument).mockClear();
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

  it('pagina os registos sem alterar o resumo de assiduidade', async () => {
    const firstPage = Array.from({ length: 51 }, (_, index) => ({ ...sampleRecord, id: `attendance-${index}` }));
    const attendance = vi.fn().mockImplementation(({ offset }) => Promise.resolve({
      data: offset === '0' ? firstPage : [{ ...sampleRecord, classSchedule: { ...sampleRecord.classSchedule!, title: 'Outra sessão' } }],
      meta: {},
    }));
    setAuth('STUDENT', buildApi({ attendance }));
    render(<AttendancePage />);

    expect(await screen.findByText('Página 1')).toBeInTheDocument();
    expect(screen.getAllByText('Aula PTP3')).toHaveLength(50);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }));

    expect(await screen.findByText('Outra sessão')).toBeInTheDocument();
    expect(attendance).toHaveBeenLastCalledWith({ offset: '50', limit: '51' });
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Seguinte' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    await waitFor(() => expect(screen.getAllByText('Aula PTP3')).toHaveLength(50));
  });

  it('docente abre uma sessão, ajusta o estado e guarda', async () => {
    const api = setAuth('TEACHER');
    render(<AttendancePage />);

    await screen.findByLabelText('Sessão');
    changeSelect('Sessão', 'schedule-1');

    const mark = await screen.findByRole('button', { name: /Por registar — EST-2026-001\. Alterar para Presente/ });
    expect(mark).toHaveTextContent('—');
    fireEvent.change(screen.getByLabelText('Observação de EST-2026-001'), { target: { value: 'Nota da aula' } });
    fireEvent.click(mark);
    expect(screen.getByRole('button', { name: /Presente — EST-2026-001\. Alterar para Falta/ })).toBe(mark);
    expect(mark).toHaveTextContent('P');
    fireEvent.click(mark);
    expect(mark).toHaveTextContent('F');
    fireEvent.click(mark);
    expect(screen.getByRole('button', { name: /Justificada — EST-2026-001\. Alterar para Presente/ })).toBe(mark);
    expect(mark).toHaveTextContent('J');
    fireEvent.click(mark);
    fireEvent.click(mark);
    expect(mark).toHaveTextContent('F');
    expect(screen.getByLabelText('Observação de EST-2026-001')).toHaveValue('Nota da aula');

    fireEvent.click(screen.getByRole('button', { name: 'Guardar assiduidade' }));

    await waitFor(() =>
      expect(api.markAttendance).toHaveBeenCalledWith(
        'schedule-1',
        expect.objectContaining({ records: [{ studentId: 'student-1', status: 'ABSENT', note: 'Nota da aula' }] }),
      ),
    );
  });

  it('escolhe o dia, mostra todos os estudantes e guarda a turma em bloco', async () => {
    const roster = { ...sampleRoster, entries: [
      ...sampleRoster.entries,
      { ...sampleRoster.entries[0], id: 'student-2', studentNumber: 'EST-2026-002', fullName: 'Ana' },
    ] };
    const api = setAuth('TEACHER', buildApi({ attendanceRoster: vi.fn().mockResolvedValue({ data: roster }) }));
    render(<AttendancePage />);
    await waitFor(() => expect(screen.getByLabelText('Dia da aula')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Dia da aula'), { target: { value: '2026-11-02' } });
    expect(await screen.findByText('2 estudantes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Marcar todos presentes' }));
    fireEvent.click(screen.getByRole('button', { name: /Presente — EST-2026-002\. Alterar para Falta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar assiduidade' }));
    await waitFor(() => expect(api.markAttendance).toHaveBeenCalledWith('schedule-1', { records: [
      { studentId: 'student-1', status: 'PRESENT', note: null },
      { studentId: 'student-2', status: 'ABSENT', note: null },
    ] }));
  });

  it('edita cada dia sem alterar os outros e mantém as alterações ao trocar de aula', async () => {
    const secondSession = { ...sampleSession, id: 'schedule-2', startsAt: '2026-11-04T09:00:00.000Z' };
    const thirdSession = { ...sampleSession, id: 'schedule-3', startsAt: '2026-11-06T09:00:00.000Z' };
    const roster: AttendanceRoster = { ...sampleRoster,
      entries: [{ ...sampleRoster.entries[0], status: 'PRESENT', marked: true }], semester: {
      year: 2026, number: 2, sessions: [sampleSession, secondSession, thirdSession],
      records: [
        { scheduleId: 'schedule-1', studentId: 'student-1', status: 'PRESENT' },
        { scheduleId: 'schedule-3', studentId: 'student-1', status: 'ABSENT' },
      ],
    } };
    const api = setAuth('TEACHER', buildApi({
      attendanceSessions: vi.fn().mockResolvedValue({ data: [sampleSession, secondSession] }),
      attendanceRoster: vi.fn().mockResolvedValue({ data: roster }),
    }));
    render(<AttendancePage />);
    await waitFor(() => expect(screen.getByLabelText('Dia da aula')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Dia da aula'), { target: { value: '2026-11-02' } });
    expect(await screen.findByText('Presenças do 2º semestre de 2026')).toBeInTheDocument();
    const currentMark = screen.getByRole('button', { name: /Presente — EST-2026-001\. Alterar para Falta/ });
    expect(currentMark).toHaveTextContent('P');
    expect(screen.getByLabelText('Faltas de EST-2026-001: 1')).toBeInTheDocument();
    fireEvent.click(currentMark);
    expect(screen.getByLabelText('Faltas de EST-2026-001: 2')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pauta de presenças do semestre' })).toContainElement(currentMark);
    fireEvent.click(screen.getByRole('button', { name: /Por registar — EST-2026-001.*4 de novembro/ }));
    expect(screen.getByRole('button', { name: /Presente — EST-2026-001.*4 de novembro/ })).toHaveTextContent('P');
    expect(currentMark).toHaveTextContent('F');
    fireEvent.click(screen.getByRole('button', { name: /Seleccionar aula de 04 de novembro/ }));
    await waitFor(() => expect(api.attendanceRoster).toHaveBeenLastCalledWith('schedule-2'));
    expect(screen.getByLabelText('Dia da aula')).toHaveValue('2026-11-04');
    expect(screen.getByRole('button', { name: /Falta — EST-2026-001.*2 de novembro/ })).toHaveTextContent('F');
    expect(screen.getByRole('button', { name: /Presente — EST-2026-001.*4 de novembro/ })).toHaveTextContent('P');
  });

  it('guarda F num dia e P noutro sem alterar os restantes estudantes ou perder observações', async () => {
    const second = { ...sampleSession, id: 'schedule-2', startsAt: '2026-11-04T09:00:00.000Z' };
    const sessions = [sampleSession, second];
    const stored = new Map<string, { scheduleId: string; studentId: string; status: 'PRESENT' | 'ABSENT' | 'JUSTIFIED'; note: string | null }>([
      ['schedule-2', { scheduleId: 'schedule-2', studentId: 'student-1', status: 'JUSTIFIED', note: 'Documento entregue' }],
    ]);
    const attendanceRoster = vi.fn().mockImplementation(async (id: string) => ({ data: {
      ...sampleRoster, schedule: sessions.find((session) => session.id === id)!,
      entries: [
        { ...sampleRoster.entries[0], status: stored.get(id)?.status ?? null, note: stored.get(id)?.note ?? null, marked: stored.has(id) },
        { ...sampleRoster.entries[0], id: 'student-2', studentNumber: 'EST-2026-002', marked: false },
      ],
      semester: { year: 2026, number: 2, sessions, records: [...stored.values()] },
    } }));
    const markAttendance = vi.fn().mockImplementation(async (id, { records }) => {
      stored.set(id, { scheduleId: id, ...records[0] });
      return { data: sampleRoster };
    });
    const api = setAuth('TEACHER', buildApi({ attendanceRoster, markAttendance }));
    render(<AttendancePage />);
    await waitFor(() => expect(screen.getByLabelText('Dia da aula')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Dia da aula'), { target: { value: '2026-11-02' } });
    const first = await screen.findByRole('button', { name: /Por registar — EST-2026-001.*2 de novembro/ });
    fireEvent.click(first);
    fireEvent.click(first);
    fireEvent.click(screen.getByRole('button', { name: /Justificada — EST-2026-001.*4 de novembro/ }));
    expect(first).toHaveTextContent('F');
    expect(screen.getByRole('button', { name: /Presente — EST-2026-001.*4 de novembro/ })).toHaveTextContent('P');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar assiduidade' }));
    await waitFor(() => expect(api.markAttendance).toHaveBeenCalledTimes(2));
    expect(api.markAttendance).toHaveBeenNthCalledWith(1, 'schedule-1', { records: [{ studentId: 'student-1', status: 'ABSENT', note: null }] });
    expect(api.markAttendance).toHaveBeenNthCalledWith(2, 'schedule-2', { records: [{ studentId: 'student-1', status: 'PRESENT', note: 'Documento entregue' }] });
    await waitFor(() => expect(screen.getByRole('button', { name: /Falta — EST-2026-001.*2 de novembro/ })).toHaveTextContent('F'));
    expect(screen.getByRole('button', { name: /Presente — EST-2026-001.*4 de novembro/ })).toHaveTextContent('P');
    expect(screen.getAllByRole('button', { name: /Por registar — EST-2026-002/ })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Guardar assiduidade' })).toBeDisabled();
  });

  it('imprime todas as aulas do semestre em blocos legíveis sem perder estudantes', async () => {
    const sessions = Array.from({ length: 12 }, (_, index) => ({
      ...sampleSession, id: `schedule-${index + 1}`,
      startsAt: new Date(Date.UTC(2026, 10, index + 2, 9)).toISOString(),
    }));
    const roster: AttendanceRoster = { ...sampleRoster, semester: { year: 2026, number: 2, sessions, records: [] } };
    setAuth('TEACHER', buildApi({ attendanceRoster: vi.fn().mockResolvedValue({ data: roster }) }));
    render(<AttendancePage />);
    await waitFor(() => expect(screen.getByLabelText('Dia da aula')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Dia da aula'), { target: { value: '2026-11-02' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Imprimir pauta de assiduidade' }));
    const doc = vi.mocked(printDocument).mock.calls[0][0];
    expect(doc.orientation).toBe('landscape');
    expect(doc.sections).toHaveLength(3);
    expect(doc.sections![0].columns).toHaveLength(11);
    expect(doc.sections![1].columns).toHaveLength(3);
    expect(doc.sections![0].rows[0]).toContain('Estudante Demo\nEST-2026-001');
    expect(doc.sections![2].rows[0][0]).toBe('EST-2026-001');
  });

  it('informa quando o dia escolhido não tem aulas', async () => {
    const api = setAuth('TEACHER');
    render(<AttendancePage />);
    await waitFor(() => expect(screen.getByLabelText('Dia da aula')).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Dia da aula'), { target: { value: '2026-11-03' } });
    expect(screen.getByText('Não há aulas agendadas neste dia.')).toBeInTheDocument();
    expect(api.attendanceRoster).not.toHaveBeenCalled();
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
