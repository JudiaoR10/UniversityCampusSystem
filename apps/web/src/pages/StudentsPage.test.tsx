// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser, CourseDto } from '@smart-campus/shared-types';
import type { ApiClient } from '@smart-campus/api-client';
import { StudentsPage } from './StudentsPage';

const auth = vi.hoisted(() => ({ user: null as AuthUser | null, api: null as unknown }));

vi.mock('../lib/auth', () => ({ useAuth: () => auth }));

const course: CourseDto = {
  id: 'course-1',
  code: 'LEI',
  name: 'Licenciatura em Informática',
  description: null,
  departmentId: 'department-1',
  department: { id: 'department-1', code: 'DEI', name: 'Departamento de Informática' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setupApi() {
  const create = vi.fn().mockResolvedValue({ data: {} });

  auth.api = {
    students: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      create,
      remove: vi.fn(),
      getMe: vi.fn(),
      updateOwn: vi.fn(),
    },
    courses: vi.fn().mockResolvedValue({ data: [course] }),
  } as unknown as ApiClient;

  return { create };
}

function renderAsAdmin() {
  auth.user = {
    id: 'actor-1',
    email: 'admin@ujac.ac.mz',
    fullName: 'Admin',
    role: 'ADMIN',
    isActive: true,
  };
  render(<StudentsPage />);
}

async function fillForm() {
  fireEvent.change(await screen.findByPlaceholderText('Email da conta'), {
    target: { value: 'ana@ujac.ac.mz' },
  });
  fireEvent.change(screen.getByPlaceholderText('Password (mín. 8)'), {
    target: { value: 'segredo123' },
  });
  fireEvent.change(screen.getByPlaceholderText('Nome completo'), {
    target: { value: 'Ana Silva' },
  });
  fireEvent.change(screen.getByPlaceholderText('Nº de estudante'), {
    target: { value: '20261001' },
  });

  const submit = screen.getByRole('button', { name: 'Criar perfil' });
  await waitFor(() => expect(submit).toBeEnabled());
  return submit;
}

describe('StudentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('só cria o estudante depois de confirmar no diálogo do sistema', async () => {
    const { create } = setupApi();
    renderAsAdmin();

    const submit = await fillForm();
    fireEvent.click(submit);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Criar estudante');
    expect(dialog).toHaveTextContent('ana@ujac.ac.mz');
    expect(create).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar estudante' }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        email: 'ana@ujac.ac.mz',
        password: 'segredo123',
        fullName: 'Ana Silva',
        studentNumber: '20261001',
        courseId: 'course-1',
        yearOfStudy: 1,
        phone: undefined,
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Estudante criado com sucesso.');
  });

  it('cancelar a confirmação não submete o formulário', async () => {
    const { create } = setupApi();
    renderAsAdmin();

    const submit = await fillForm();
    fireEvent.click(submit);

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
