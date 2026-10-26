import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AuthUser, RoleCode } from '@smart-campus/shared-types';
import { ApiClientError } from '@smart-campus/api-client';
import { FinancialPage } from './FinancialPage';

const mocks = vi.hoisted(() => ({ user: null as AuthUser | null, api: {
  financialDebts: vi.fn(), financialHistory: vi.fn(), financialStudents: vi.fn(),
  financialAnalysisRequests: vi.fn(), resolveAnalysisRequest: vi.fn(), createAnalysisRequest: vi.fn(),
  createDebt: vi.fn(), createPayment: vi.fn(), financialPolicy: vi.fn(), updateFinancialPolicy: vi.fn(),
  financialNotifications: vi.fn(), financialDelivery: vi.fn(), retryFinancialDelivery: vi.fn(), financialReport: vi.fn(),
  financialTeachers: vi.fn(), financialSalaries: vi.fn(), createSalary: vi.fn(), updateSalary: vi.fn(), paySalary: vi.fn(), monthlyPaymentReport: vi.fn(),
} }));
vi.mock('../lib/auth', () => ({ useAuth: () => mocks }));
const response = (data: unknown, meta = {}) => ({ data, meta: { correlationId: 'test', ...meta } });
const student = { userId: 'student-1', fullName: 'Ana Estudante', studentNumber: '20260001', isActive: true };
const debt = { id: 'debt-1', studentId: 'student-1', title: 'Propina Outubro', amount: 100, status: 'PENDENTE', dueDate: '2099-01-01' };
const history = { payments: [{ id: 'payment-1', code: 'PAY-1', paidAt: '2026-10-01', amountPaid: 100, paymentMethod: 'BANK_TRANSFER', referenceCode: 'BANK-001' }], status: { status: 'ACTIVE' }, totalPaid: 100, totalOutstanding: 200, pagination: { totalPayments: 21, hasMorePayments: true } };
const analysis = { id: 'analysis-1', studentId: 'student-1', student, debt, reason: 'Solicito revisão desta cobrança.', status: 'PENDENTE_ANALISE', createdAt: '2026-10-01', slaDueDate: '2026-10-08' };
const teacher = { teacherId: 'teacher-profile-1', userId: 'teacher-user-1', fullName: 'Maria Docente', employeeCode: 'DOC-1', isActive: true };
const salary = { id: 'salary-1', teacher, month: '2026-10', amount: 15000, notes: '', status: 'PENDING', paidAt: null, updatedAt: '2026-10-24T10:00:00.000Z' };
function asRole(role: RoleCode) { mocks.user = { id: 'student-1', role, fullName: 'Ana', email: 'ana@example.test', isActive: true }; }

beforeEach(() => {
  vi.resetAllMocks(); asRole('STUDENT');
  mocks.api.financialDebts.mockResolvedValue(response([debt]));
  mocks.api.financialHistory.mockResolvedValue(response(history));
  mocks.api.financialStudents.mockResolvedValue(response([student], { total: 1, hasMore: false }));
  mocks.api.financialAnalysisRequests.mockResolvedValue(response([analysis]));
  mocks.api.financialPolicy.mockResolvedValue(response({ code: 'DEFAULT_POLICY', gracePeriodDays: 5, maxDebtAmount: 0, autoBlockEnabled: true }));
  mocks.api.financialNotifications.mockResolvedValue(response([]));
  mocks.api.financialTeachers.mockResolvedValue(response([teacher], { total: 1, hasMore: false }));
  mocks.api.financialSalaries.mockResolvedValue(response([salary], { total: 1, hasMore: false }));
  mocks.api.monthlyPaymentReport.mockResolvedValue(response({ kind: 'payments', month: '2026-10', timezone: 'Africa/Maputo', totalPayments: 1, totalAmount: 100, generatedAt: '2026-10-24T10:00:00.000Z', rows: [{ id: 'p-1', fullName: 'Ana Estudante', identityCode: '20260001', description: 'Propina Outubro', amount: 100, paymentMethod: 'BANK_TRANSFER', referenceCode: 'REPORT-001', paidAt: '2026-10-23T10:00:00Z' }] }));
  mocks.api.financialReport.mockResolvedValue(response({ totalDebts: 1, byStatus: { pendentes: 1, vencidas: 0, regularizadas: 0, canceladas: 0 }, totalPayments: 0, studentsBlocked: 0, generatedAt: '2026-10-23' }));
});
afterEach(cleanup);

describe('Acções financeiras por perfil', () => {
  it('ADMIN consulta salários sem criar, editar ou pagar; pode imprimir o relatório mensal completo', async () => {
    asRole('ADMIN');
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<FinancialPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Salários dos docentes' }));
    await screen.findByText('Maria Docente · DOC-1');
    expect(screen.queryByRole('button', { name: /Novo salário|Editar salário|Registar pagamento salarial/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Relatórios mensais' }));
    const section = screen.getByRole('region', { name: 'Relatórios mensais' });
    await within(section).findByText('REPORT-001');
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir relatório mensal' }));
    expect(print).toHaveBeenCalledOnce();
    expect(document.querySelector('.financial-print-view')).toHaveTextContent('REPORT-001');
    fireEvent.change(screen.getByLabelText('Relatório'), { target: { value: 'salaries' } });
    await waitFor(() => expect(mocks.api.monthlyPaymentReport).toHaveBeenLastCalledWith('salaries', expect.any(String)));
    expect(mocks.api.createSalary).not.toHaveBeenCalled();
    expect(mocks.api.paySalary).not.toHaveBeenCalled();
    print.mockRestore();
  });

  it('FINANCE cria o salário usando o perfil docente e regista o pagamento com a versão apresentada', async () => {
    asRole('FINANCE'); mocks.api.createSalary.mockResolvedValue(response(salary)); mocks.api.paySalary.mockResolvedValue(response({ ...salary, status: 'PAID' }));
    render(<FinancialPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Salários dos docentes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Novo salário mensal' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Seleccionar docente Maria Docente' }));
    fireEvent.change(screen.getByLabelText('Valor do salário (MZN)'), { target: { value: '15000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registar salário' }));
    await screen.findByText('Salário mensal registado.');
    expect(mocks.api.createSalary).toHaveBeenCalledWith(expect.objectContaining({ teacherId: teacher.teacherId, amount: 15000 }));
    fireEvent.click(screen.getByRole('button', { name: 'Registar pagamento salarial' }));
    fireEvent.change(screen.getByLabelText('Referência do pagamento salarial'), { target: { value: 'SAL-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento salarial' }));
    await screen.findByText('Operação salarial registada.');
    expect(mocks.api.paySalary).toHaveBeenCalledWith(salary.id, { amountPaid: 15000, expectedUpdatedAt: salary.updatedAt, paymentMethod: 'BANK_TRANSFER', referenceCode: 'SAL-001' });
  });

  it('não oferece impressão de um relatório em erro nem oculta a falha', async () => {
    asRole('ADMIN'); mocks.api.monthlyPaymentReport.mockRejectedValue(new Error('Relatório indisponível'));
    render(<FinancialPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Relatórios mensais' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Relatório indisponível');
    expect(screen.queryByRole('button', { name: 'Imprimir relatório mensal' })).not.toBeInTheDocument();
  });

  it('STUDENT vê o histórico próprio paginado sem acções de gestão', async () => {
    render(<FinancialPage />);
    await screen.findByRole('button', { name: 'Contestar' });
    expect(screen.queryByRole('button', { name: /Registar dívida|Políticas financeiras|Resumo do campus/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Histórico de pagamentos' }));
    await screen.findByText('BANK-001');
    expect(mocks.api.financialHistory).toHaveBeenCalledWith('student-1', { offset: 0, limit: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }));
    await waitFor(() => expect(mocks.api.financialHistory).toHaveBeenLastCalledWith('student-1', { offset: 20, limit: 20 }));
    expect(mocks.api.financialStudents).not.toHaveBeenCalled();
  });

  it('STUDENT submete uma contestação e consulta a decisão sem botão Analisar', async () => {
    mocks.api.createAnalysisRequest.mockResolvedValue(response(analysis));
    render(<FinancialPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Contestar' }));
    fireEvent.change(screen.getByLabelText('Justificação'), { target: { value: analysis.reason } });
    fireEvent.click(screen.getByRole('button', { name: 'Submeter contestação' }));
    await screen.findByText('Operação concluída.');
    expect(mocks.api.createAnalysisRequest).toHaveBeenCalledWith({ debtId: debt.id, reason: analysis.reason });
    mocks.api.financialAnalysisRequests.mockResolvedValue(response([{ ...analysis, status: 'PROCEDENTE', resolutionNotes: 'Pagamento verificado.' }]));
    fireEvent.click(screen.getByRole('button', { name: 'Contestações' }));
    await screen.findByText('Pagamento verificado.');
    expect(mocks.api.financialAnalysisRequests).toHaveBeenCalledWith(expect.objectContaining({ studentId: 'student-1' }));
    expect(screen.queryByRole('button', { name: /Analisar/ })).not.toBeInTheDocument();
  });

  it('FINANCE selecciona um estudante do Core e cria dívida para esse User.id', async () => {
    asRole('FINANCE'); mocks.api.createDebt.mockResolvedValue(response(debt));
    render(<FinancialPage />);
    expect(screen.queryByRole('button', { name: /Políticas financeiras/ })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Seleccionar Ana Estudante' }));
    await screen.findByRole('button', { name: 'Registar pagamento' });
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Propina Outubro' } });
    fireEvent.change(screen.getByLabelText('Valor (MZN)'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Vencimento'), { target: { value: '2099-01-01T12:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registar dívida' }));
    await screen.findByText('Operação concluída.');
    expect(mocks.api.createDebt).toHaveBeenCalledWith(expect.objectContaining({ studentId: 'student-1', amount: 100 }));
    expect(screen.queryByText(/Criar utilizador/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registar pagamento' }));
    fireEvent.change(screen.getByLabelText('Referência'), { target: { value: 'BANK-002' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento integral' }));
    await waitFor(() => expect(mocks.api.createPayment).toHaveBeenCalledWith(expect.objectContaining({ debtId: debt.id, amountPaid: 100, referenceCode: 'BANK-002' })));
  });

  it('FINANCE decide uma contestação com justificação e actualiza a fila', async () => {
    asRole('FINANCE'); mocks.api.resolveAnalysisRequest.mockResolvedValue(response({ ...analysis, status: 'IMPROCEDENTE' }));
    render(<FinancialPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Contestações' }));
    fireEvent.click(await screen.findByRole('button', { name: /Analisar/ }));
    fireEvent.change(screen.getByLabelText('Decisão'), { target: { value: 'IMPROCEDENTE' } });
    fireEvent.change(screen.getByLabelText('Justificação da decisão'), { target: { value: 'Cobrança confirmada.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registar decisão' }));
    await screen.findByText('Decisão registada.');
    expect(mocks.api.resolveAnalysisRequest).toHaveBeenCalledWith('analysis-1', { decision: 'IMPROCEDENTE', resolutionNotes: 'Cobrança confirmada.' });
    expect(mocks.api.financialAnalysisRequests).toHaveBeenCalledTimes(2);
  });

  it('ADMIN abre a engrenagem e guarda apenas as três políticas existentes', async () => {
    asRole('ADMIN'); mocks.api.updateFinancialPolicy.mockResolvedValue(response({}));
    render(<FinancialPage />);
    expect(mocks.api.financialPolicy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Políticas financeiras' }));
    fireEvent.change(await screen.findByLabelText('Dias de tolerância'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Limite de dívida vencida (MZN)'), { target: { value: '500' } });
    fireEvent.click(screen.getByLabelText('Activar bloqueio automático'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar políticas' }));
    await screen.findByText('Políticas guardadas.');
    expect(mocks.api.updateFinancialPolicy).toHaveBeenCalledWith({ gracePeriodDays: 10, maxDebtAmount: 500, autoBlockEnabled: false });
  });

  it('mostra erro de histórico e permite repetir a consulta', async () => {
    mocks.api.financialHistory.mockRejectedValueOnce(new Error('Serviço indisponível'));
    render(<FinancialPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Histórico de pagamentos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Serviço indisponível');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('BANK-001');
  });

  it('ADMIN configura a política pela primeira vez quando ainda não está persistida', async () => {
    asRole('ADMIN');
    mocks.api.financialPolicy.mockRejectedValueOnce(new ApiClientError('POLICY_NOT_FOUND', 'Política não encontrada.', 'test', [], 404));
    mocks.api.updateFinancialPolicy.mockResolvedValue(response({}));
    render(<FinancialPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Políticas financeiras' }));
    expect(await screen.findByLabelText('Dias de tolerância')).toHaveValue(5);
    expect(screen.getByLabelText('Limite de dívida vencida (MZN)')).toHaveValue(0);
    expect(screen.getByLabelText('Activar bloqueio automático')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar políticas' }));
    await screen.findByText('Políticas guardadas.');
    expect(mocks.api.updateFinancialPolicy).toHaveBeenCalledWith({ gracePeriodDays: 5, maxDebtAmount: 0, autoBlockEnabled: true });
    expect(screen.queryByText(/A política ainda não foi guardada/)).not.toBeInTheDocument();
  });

  it('não aplica uma resposta antiga ao trocar o estudante seleccionado', async () => {
    asRole('FINANCE');
    let resolveHistory!: (data: unknown) => void;
    mocks.api.financialHistory.mockImplementationOnce(() => new Promise(resolve => { resolveHistory = resolve; }));
    mocks.api.financialStudents.mockResolvedValue(response([student, { ...student, userId: 'student-2', fullName: 'Bia Estudante' }]));
    render(<FinancialPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Seleccionar Ana Estudante' }));
    fireEvent.click(screen.getByRole('button', { name: 'Histórico de pagamentos' }));
    await waitFor(() => expect(mocks.api.financialHistory).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Trocar estudante' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Bia Estudante' }));
    await screen.findByText('BANK-001');
    resolveHistory(response({ ...history, payments: [{ ...history.payments[0], referenceCode: 'SEGREDO-ANA' }] }));
    await waitFor(() => expect(mocks.api.financialHistory).toHaveBeenLastCalledWith('student-2', { offset: 0, limit: 20 }));
    expect(within(screen.getByRole('region', { name: 'Histórico de pagamentos' })).queryByText('SEGREDO-ANA')).not.toBeInTheDocument();
  });

  it.each(['TEACHER', 'TECHNICIAN', 'COORDINATOR'] as RoleCode[])('%s não acede nem carrega dados financeiros', role => {
    asRole(role); render(<FinancialPage />);
    expect(screen.getByText('O seu perfil não tem acesso à gestão financeira.')).toBeInTheDocument();
    for (const method of Object.values(mocks.api)) expect(method).not.toHaveBeenCalled();
  });
});
