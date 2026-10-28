// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, SubjectEnrolmentDto } from '@smart-campus/shared-types';
import type { ApiClient } from '@smart-campus/api-client';
import { EnrolmentsPage } from './EnrolmentsPage';

const auth = vi.hoisted(() => ({ user: null as AuthUser | null, api: null as unknown }));

vi.mock('../lib/auth', () => ({ useAuth: () => auth }));

const enrolment: SubjectEnrolmentDto = {
  id: 'enr-1',
  studentId: 'student-1',
  student: { id: 'student-1', studentNumber: '20240123', fullName: 'Ana Silva' },
  subjectId: 'subject-1',
  subject: { id: 'subject-1', code: 'PTP3', name: 'Projecto' },
  academicYear: 2026,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setupApi() {
  const updateStatus = vi.fn().mockResolvedValue({ data: { ...enrolment, status: 'COMPLETED' } });

  auth.api = {
    enrolments: {
      list: vi.fn().mockResolvedValue({ data: [enrolment] }),
      updateStatus,
      remove: vi.fn(),
      create: vi.fn(),
    },
    students: { list: vi.fn().mockResolvedValue({ data: [] }), getMe: vi.fn() },
    subjects: vi.fn().mockResolvedValue({ data: [] }),
  } as unknown as ApiClient;

  return { updateStatus };
}

function signIn(role: AuthUser['role']) {
  auth.user = {
    id: 'actor-1',
    email: 'actor@ujac.ac.mz',
    fullName: 'Actor',
    role,
    isActive: true,
  };
}

describe('EnrolmentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('coordenação conclui a inscrição e recebe mensagem de sucesso', async () => {
    signIn('COORDINATOR');
    const { updateStatus } = setupApi();

    render(<EnrolmentsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Concluir inscrição');
    expect(updateStatus).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Concluir inscrição' }));

    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith('enr-1', 'COMPLETED'));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Inscrição actualizada para "Concluída".',
    );
  });

  it('cancelar a confirmação não altera a inscrição', async () => {
    signIn('COORDINATOR');
    const { updateStatus } = setupApi();

    render(<EnrolmentsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it('admin não vê a acção de concluir inscrição', async () => {
    signIn('ADMIN');
    setupApi();

    render(<EnrolmentsPage />);

    expect(await screen.findByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Concluir' })).toBeNull();
  });
});
