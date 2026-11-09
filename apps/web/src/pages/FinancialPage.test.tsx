import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AuthUser, RoleCode } from '@smart-campus/shared-types';
import { ApiClientError } from '@smart-campus/api-client';
import { FinancialPage } from './FinancialPage';
import { changeSelect } from '../test/selectField';

const mocks = vi.hoisted(() => ({ user: null as AuthUser | null, api: {
  financialDebts: vi.fn(), financialHistory: vi.fn(), financialStudents: vi.fn(),
  financialAnalysisRequests: vi.fn(), resolveAnalysisRequest: vi.fn(), createAnalysisRequest: vi.fn(),
  createDebt: vi.fn(), createPayment: vi.fn(), financialPolicy: vi.fn(), updateFinancialPolicy: vi.fn(),
  financialNotifications: vi.fn(), financialDelivery: vi.fn(), retryFinancialDelivery: vi.fn(), financialReport: vi.fn(),
  financialTeachers: vi.fn(), financialEmployees: vi.fn(), createExternalEmployee: vi.fn(),
  salaryChangeRequests: vi.fn(), createSalaryChange: vi.fn(), reviewSalaryChange: vi.fn(),
  financialSalaries: vi.fn(), createSalary: vi.fn(), paySalary: vi.fn(),
  courseTuitions: vi.fn(), updateCourseTuition: vi.fn(), monthlyPaymentReport: vi.fn(),
  cancelDebt: vi.fn(), createDebtsFromEnrolments: vi.fn(), financialNotificationQueue: vi.fn(),
  retryFailedNotifications: vi.fn(), financialStatus: vi.fn(), financialBlockedStudents: vi.fn(),
  paymentReceipt: vi.fn(), salaryReceipt: vi.fn(), courses: vi.fn(),
  auditEvents: vi.fn(),
} }));
vi.mock('../lib/auth', () => ({ useAuth: () => mocks }));
const response = (data: unknown, meta = {}) => ({ data, meta: { correlationId: 'test', ...meta } });
const student = { userId: 'student-1', fullName: 'Ana Estudante', studentNumber: '20260001', isActive: true };
const debt = { id: 'debt-1', studentId: 'student-1', title: 'Propina Outubro', amount: 100, status: 'PENDENTE', dueDate: '2099-01-01' };
const history = { payments: [{ id: 'payment-1', code: 'PAY-1', paidAt: '2026-10-01', amountPaid: 100, paymentMethod: 'BANK_TRANSFER', referenceCode: 'BANK-001' }], status: { status: 'ACTIVE' }, totalPaid: 100, totalOutstanding: 200, pagination: { totalPayments: 21, hasMorePayments: true } };
const analysis = { id: 'analysis-1', studentId: 'student-1', student, debt, reason: 'Solicito revisão desta cobrança.', status: 'PENDENTE_ANALISE', createdAt: '2026-10-01', slaDueDate: '2026-10-08' };
const teacher = { teacherId: 'teacher-profile-1', userId: 'teacher-user-1', fullName: 'Maria Docente', employeeCode: 'DOC-1', isActive: true };
const employee = { employeeKey: 'CORE:teacher-user-1', userId: 'teacher-user-1', externalEmployeeId: null, fullName: 'Maria Docente', employeeCode: 'DOC-1', category: 'TEACHER', jobTitle: 'Docente', isActive: true, source: 'CORE', currentSalary: 15000, salaryApprovedAt: '2026-10-20T10:00:00.000Z' };
const salary = { id: 'salary-1', employee, month: '2026-10', amount: 15000, notes: '', status: 'PENDING', paidAt: null, paymentMethod: null, referenceCode: null, createdAt: '2026-10-24T10:00:00.000Z', updatedAt: '2026-10-24T10:00:00.000Z' };
const proposal = { id: 'proposal-1', employee, currentAmount: 15000, proposedAmount: 16500, reason: 'Progressão salarial.', status: 'PENDING', requestedBy: { id: 'finance-1', fullName: 'Finance' }, reviewedBy: null, reviewNotes: null, reviewedAt: null, createdAt: '2026-10-24T10:00:00.000Z', updatedAt: '2026-10-24T10:00:00.000Z' };
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
  mocks.api.financialEmployees.mockResolvedValue(response([employee], { total: 1, hasMore: false }));
  mocks.api.salaryChangeRequests.mockResolvedValue(response([proposal], { total: 1, hasMore: false }));
  mocks.api.financialSalaries.mockResolvedValue(response([salary], { total: 1, hasMore: false }));
  mocks.api.courseTuitions.mockResolvedValue(response([{ courseId: 'course-1', courseCode: 'LEI', courseName: 'Engenharia Informática', departmentName: 'Engenharia', amount: 5000, notes: '', updatedAt: '2026-10-24T10:00:00.000Z' }]));
  mocks.api.monthlyPaymentReport.mockResolvedValue(response({ kind: 'payments', month: '2026-10', timezone: 'Africa/Maputo', totalPayments: 1, totalAmount: 100, generatedAt: '2026-10-24T10:00:00.000Z', rows: [{ id: 'p-1', fullName: 'Ana Estudante', identityCode: '20260001', description: 'Propina Outubro', amount: 100, paymentMethod: 'BANK_TRANSFER', referenceCode: 'REPORT-001', paidAt: '2026-10-23T10:00:00Z' }] }));
  mocks.api.financialReport.mockResolvedValue(response({ totalDebts: 1, byStatus: { pendentes: 1, vencidas: 0, regularizadas: 0, canceladas: 0 }, totalPayments: 0, studentsBlocked: 0, generatedAt: '2026-10-23' }));
  mocks.api.financialStatus.mockResolvedValue(response({ studentId: 'student-1', status: 'ACTIVE', reason: null, blockedAt: null, overdueDebtsCount: 0, totalOverdueAmount: 0, updatedAt: '2026-10-23' }));
  mocks.api.financialBlockedStudents.mockResolvedValue(response([], { total: 0, hasMore: false }));
  mocks.api.financialNotificationQueue.mockResolvedValue(response([], { total: 0, hasMore: false }));
  mocks.api.courses.mockResolvedValue(response([{ id: 'course-1', code: 'LEI', name: 'Engenharia Informática' }]));
  mocks.api.auditEvents.mockResolvedValue(response([{ id: 'audit-1', action: 'DEBT_CREATED', resource: 'financial', correlationId: 'corr-1', createdAt: '2026-10-23T10:00:00Z', actor: { fullName: 'Tesouraria Demo' } }]));
});
afterEach(cleanup);

describe('Acções financeiras por perfil', () => {
  it('ADMIN entra no painel administrativo e não recebe acções operacionais', async () => {
    asRole('ADMIN');
    render(<FinancialPage />);
    expect(screen.getByRole('button', { name: 'Visão geral' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('Dívidas pendentes')).toBeInTheDocument();
    expect(screen.getByText('Contestações pendentes')).toBeInTheDocument();
    expect(screen.getByText('Actividade financeira recente')).toBeInTheDocument();
    expect(screen.queryByText('Seleccionar estudante')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Registar dívida|Registar pagamento|Analisar/ })).not.toBeInTheDocument();
  });

  it('ADMIN consulta estudante sem registar dívida ou pagamento', async () => {
    asRole('ADMIN');
    render(<FinancialPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Consultar estudante' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Seleccionar Ana Estudante' }));
    await screen.findByText('Propina Outubro');
    expect(screen.queryByRole('heading', { name: 'Nova dívida' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registar pagamento' })).not.toBeInTheDocument();
  });

  it('ADMIN consulta funcionários e aprova salários sem criar ou pagar; pode imprimir o relatório mensal', async () => {
    asRole('ADMIN');
    mocks.api.reviewSalaryChange.mockResolvedValue(response({ ...proposal, status: 'APPROVED' }));
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<FinancialPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Funcionários' }));
    await screen.findAllByText('Maria Docente');
    expect(screen.queryByRole('button', { name: /Propor salário|Gerar salário|Registar pagamento salarial/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nota da decisão'), { target: { value: 'Valor conferido.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar salário' }));
    await waitFor(() => expect(mocks.api.reviewSalaryChange).toHaveBeenCalledWith('proposal-1', { decision: 'APPROVED', reviewNotes: 'Valor conferido.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Relatórios mensais' }));
    const section = screen.getByRole('region', { name: 'Relatórios mensais' });
    await within(section).findByText('REPORT-001');
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir relatório mensal' }));
    expect(print).toHaveBeenCalledOnce();
    expect(document.querySelector('.financial-print-view')).toHaveTextContent('REPORT-001');
    changeSelect('Relatório', 'salaries');
    await waitFor(() => expect(mocks.api.monthlyPaymentReport).toHaveBeenLastCalledWith('salaries', expect.any(String)));
    expect(mocks.api.createSalary).not.toHaveBeenCalled();
    expect(mocks.api.paySalary).not.toHaveBeenCalled();
    print.mockRestore();
  });

  it('FINANCE propõe o salário aprovado, gera a folha mensal e regista o pagamento', async () => {
    asRole('FINANCE');
    mocks.api.salaryChangeRequests.mockResolvedValue(response([], { total: 0, hasMore: false }));
    mocks.api.createSalaryChange.mockResolvedValue(response(proposal));
    mocks.api.createSalary.mockResolvedValue(response(salary));
    mocks.api.paySalary.mockResolvedValue(response({ ...salary, status: 'PAID' }));
    render(<FinancialPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Funcionários' }));
    await screen.findAllByText('Maria Docente');
    fireEvent.click(screen.getByRole('button', { name: 'Propor salário' }));
    fireEvent.change(screen.getByLabelText('Novo salário proposto (MZN)'), { target: { value: '16500' } });
    fireEvent.change(screen.getByLabelText('Justificação da proposta'), { target: { value: 'Progressão salarial.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para aprovação' }));
    await screen.findByText('Proposta enviada ao administrador.');
    expect(mocks.api.createSalaryChange).toHaveBeenCalledWith({ employeeKey: employee.employeeKey, proposedAmount: 16500, reason: 'Progressão salarial.' });
    await waitFor(() => expect(mocks.api.financialEmployees).toHaveBeenCalledTimes(2));
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar salário mensal' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gerar salário' }));
    await screen.findByText('Salário mensal gerado com o valor aprovado.');
    expect(mocks.api.createSalary).toHaveBeenCalledWith(expect.objectContaining({ employeeKey: employee.employeeKey }));
    fireEvent.click(screen.getByRole('button', { name: 'Registar pagamento salarial' }));
    fireEvent.change(screen.getByLabelText('Referência do pagamento salarial'), { target: { value: 'SAL-001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento salarial' }));
    await waitFor(() => expect(mocks.api.paySalary).toHaveBeenCalled());
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
    changeSelect('Decisão', 'IMPROCEDENTE');
    fireEvent.change(screen.getByLabelText('Justificação da decisão'), { target: { value: 'Cobrança confirmada.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registar decisão' }));
    await screen.findByText('Decisão registada.');
    expect(mocks.api.resolveAnalysisRequest).toHaveBeenCalledWith('analysis-1', { decision: 'IMPROCEDENTE', resolutionNotes: 'Cobrança confirmada.' });
    expect(mocks.api.financialAnalysisRequests).toHaveBeenCalledTimes(2);
  });

  it('ADMIN abre a engrenagem e guarda apenas as três políticas existentes', async () => {
    asRole('ADMIN'); mocks.api.updateFinancialPolicy.mockResolvedValue(response({}));
    render(<FinancialPage />);
    await waitFor(() => expect(mocks.api.financialPolicy).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'Políticas financeiras' }));
    fireEvent.change(await screen.findByLabelText('Dias de tolerância'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Limite de dívida vencida (MZN)'), { target: { value: '500' } });
    fireEvent.click(screen.getByLabelText('Activar bloqueio automático'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar políticas' }));
    await screen.findByText('Políticas guardadas.');
    expect(mocks.api.updateFinancialPolicy).toHaveBeenCalledWith({ gracePeriodDays: 10, maxDebtAmount: 500, autoBlockEnabled: false });
    await waitFor(() => expect(mocks.api.financialPolicy).toHaveBeenCalledTimes(3));
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

  it('identifica o relatório salarial como abrangendo funcionários de várias categorias', async () => {
    asRole('ADMIN');
    mocks.api.monthlyPaymentReport.mockImplementation(async (kind: 'payments' | 'salaries') => response({
      kind, month: '2026-10', timezone: 'Africa/Maputo', totalPayments: 1, totalAmount: 100,
      generatedAt: '2026-10-24T10:00:00Z',
      rows: [{ id: 'salary-test', fullName: 'Funcionário Externo', identityCode: 'EXT-1', description: 'Salário', amount: 100, paymentMethod: 'BANK_TRANSFER', referenceCode: 'SAL-001', paidAt: '2026-10-23T10:00:00Z' }],
    }));
    render(<FinancialPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Relatórios mensais' }));
    changeSelect('Relatório', 'salaries');
    expect(await screen.findByRole('columnheader', { name: 'Funcionário / código' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Smart Campus — Salários pagos aos funcionários' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Relatórios mensais' })).getByRole('cell', { name: /Funcionário Externo/ })).toBeInTheDocument();
  });

  it.each(['TEACHER', 'TECHNICIAN', 'COORDINATOR'] as RoleCode[])('%s não acede nem carrega dados financeiros', role => {
    asRole(role); render(<FinancialPage />);
    expect(screen.getByText('O seu perfil não tem acesso à gestão financeira.')).toBeInTheDocument();
    for (const method of Object.values(mocks.api)) expect(method).not.toHaveBeenCalled();
  });
});

describe('Guia financeiro por perfil', () => {
  it('mostra apenas percursos do estudante e fecha com Escape devolvendo o foco', async () => {
    asRole('STUDENT');
    render(<FinancialPage />);
    const trigger = screen.getByRole('button', { name: 'Guia' });
    fireEvent.click(trigger);
    const guide = screen.getByRole('region', { name: 'Guia financeiro' });
    expect(within(guide).getByRole('button', { name: 'Contestar uma cobrança' })).toBeInTheDocument();
    expect(within(guide).queryByRole('button', { name: 'Gerir salários' })).not.toBeInTheDocument();
    expect(within(guide).queryByRole('button', { name: 'Configurar políticas' })).not.toBeInTheDocument();
    fireEvent.click(within(guide).getByRole('button', { name: 'Contestar uma cobrança' }));
    expect(await within(guide).findByText(/Contestar uma cobrança · 1 \/ 3/)).toBeInTheDocument();
    expect(guide).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Guia financeiro' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(mocks.api.createDebt).not.toHaveBeenCalled();
    expect(mocks.api.createAnalysisRequest).not.toHaveBeenCalled();
  });

  it('orienta FINANCE quando o estudante ainda não foi seleccionado e permite continuar após a selecção', async () => {
    asRole('FINANCE');
    render(<FinancialPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Guia' }));
    const guide = screen.getByRole('region', { name: 'Guia financeiro' });
    expect(within(guide).queryByRole('button', { name: 'Configurar políticas' })).not.toBeInTheDocument();
    fireEvent.click(within(guide).getByRole('button', { name: 'Registar dívida e pagamento' }));
    expect(await within(guide).findByText(/Registar dívida e pagamento · 1 \/ 3/)).toBeInTheDocument();
    fireEvent.click(within(guide).getByRole('button', { name: 'Próximo' }));
    expect(await within(guide).findByText(/Esta área ainda não está disponível/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Seleccionar Ana Estudante' }));
    await waitFor(() => expect(within(guide).getByText(/A área indicada está contornada/)).toBeInTheDocument());
    expect(mocks.api.createDebt).not.toHaveBeenCalled();
    expect(mocks.api.createPayment).not.toHaveBeenCalled();
  });

  it('abre a política para ADMIN sem guardar alterações e permite sair com Escape', async () => {
    asRole('ADMIN');
    render(<FinancialPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Guia' }));
    const guide = screen.getByRole('region', { name: 'Guia financeiro' });
    expect(within(guide).queryByRole('button', { name: 'Registar dívida e pagamento' })).not.toBeInTheDocument();
    fireEvent.click(within(guide).getByRole('button', { name: 'Configurar políticas' }));
    expect(await screen.findByLabelText('Dias de tolerância')).toBeInTheDocument();
    expect(mocks.api.updateFinancialPolicy).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Guia financeiro' })).not.toBeInTheDocument();
  });
});
