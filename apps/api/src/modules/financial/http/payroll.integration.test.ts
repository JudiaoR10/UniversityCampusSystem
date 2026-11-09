import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import { monthlyBounds, monthlyPaymentReport } from '../application/monthlyReportService.js';

const app = createApp();
const base = '/api/v1/financial';
const tokens: Record<string, string> = {};
const actors: Record<string, { id: string; role: string }> = {};
const auth = (role: string) => `Bearer ${tokens[role]}`;
async function login(role: string, email: string, password: string) {
  const result = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(result.status).toBe(200);
  tokens[role] = result.body.data.tokens.accessToken;
  actors[role] = { id: result.body.data.user.id, role };
}
async function externalEmployee() {
  const code = `EXT-${randomUUID().slice(0, 8)}`;
  const result = await request(app).post(`${base}/employees/external`)
    .set('Authorization', auth('FINANCE'))
    .send({ employeeCode: code, fullName: `Funcionário ${code}`, category: 'GUARD', jobTitle: 'Guarda' });
  expect(result.status).toBe(201);
  return result.body.data;
}
async function approveSalary(employeeKey: string, amount = 12500) {
  const proposal = await request(app).post(`${base}/salary-change-requests`)
    .set('Authorization', auth('FINANCE'))
    .send({ employeeKey, proposedAmount: amount, reason: 'Actualização salarial aprovada para teste.' });
  expect(proposal.status).toBe(201);
  const approval = await request(app).patch(`${base}/salary-change-requests/${proposal.body.data.id}/review`)
    .set('Authorization', auth('ADMIN'))
    .send({ decision: 'APPROVED', reviewNotes: 'Proposta verificada e aprovada.' });
  expect(approval.status).toBe(200);
  return approval.body.data;
}
function paymentInput(row: { amount: number; updatedAt: string }, referenceCode = randomUUID()) {
  return { amountPaid: row.amount, expectedUpdatedAt: row.updatedAt, paymentMethod: 'BANK_TRANSFER', referenceCode };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) {
    throw Error('Exige base descartável _test');
  }
  await login('ADMIN', 'admin@smartcampus.demo', 'Admin123!');
  await login('FINANCE', 'financas@smartcampus.demo', 'Finance123!');
  await login('STUDENT', 'estudante@smartcampus.demo', 'Estudante123!');
  await login('TEACHER', 'docente@smartcampus.demo', 'Docente123!');
  await login('TECHNICIAN', 'tecnico@smartcampus.demo', 'Tecnico123!');
  await login('COORDINATOR', 'coordenador@smartcampus.demo', 'Coord123!');
}, 60000);
afterAll(async () => { await prisma.$disconnect(); });

describe('Funcionários, aprovação salarial e mensalidades', () => {
  it('lista numa vista única funcionários do Core e pessoal externo sem duplicar perfis', async () => {
    for (const role of ['FINANCE', 'ADMIN']) {
      const result = await request(app).get(`${base}/employees`).query({ limit: 100 }).set('Authorization', auth(role));
      expect(result.status).toBe(200);
      expect(result.body.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ fullName: 'Docente Demo', category: 'TEACHER', source: 'CORE', employeeCode: 'DOC-100' }),
        expect.objectContaining({ fullName: 'Técnico Demo', category: 'TECHNICIAN', source: 'CORE' }),
        expect.objectContaining({ employeeCode: 'LIM-001', category: 'CLEANER', source: 'EXTERNAL' }),
        expect.objectContaining({ employeeCode: 'GRD-001', category: 'GUARD', source: 'EXTERNAL' }),
      ]));
    }
    for (const role of ['STUDENT', 'TEACHER', 'TECHNICIAN', 'COORDINATOR']) {
      expect((await request(app).get(`${base}/employees`).set('Authorization', auth(role))).status).toBe(403);
    }
  });

  it('Finance cadastra apenas o registo mínimo de pessoal externo; Admin só consulta', async () => {
    const employee = await externalEmployee();
    expect(employee).toMatchObject({ category: 'GUARD', source: 'EXTERNAL', userId: null });
    expect((await request(app).post(`${base}/employees/external`).set('Authorization', auth('ADMIN')).send({
      employeeCode: 'NO-ADMIN', fullName: 'Sem Permissão', category: 'GUARD', jobTitle: 'Guarda',
    })).status).toBe(403);
    expect((await request(app).post(`${base}/employees/external`).set('Authorization', auth('FINANCE')).send({
      employeeCode: 'INVALID', fullName: 'Categoria Inválida', category: 'TEACHER', jobTitle: 'Docente',
    })).status).toBe(400);
  });

  it('Finance propõe e somente Admin aprova; o salário só muda depois da aprovação', async () => {
    const employee = await externalEmployee();
    const proposed = await request(app).post(`${base}/salary-change-requests`)
      .set('Authorization', auth('FINANCE'))
      .send({ employeeKey: employee.employeeKey, proposedAmount: 15000, reason: 'Novo enquadramento profissional.' });
    expect(proposed.status).toBe(201);
    expect(proposed.body.data).toMatchObject({ status: 'PENDING', currentAmount: null, proposedAmount: 15000 });
    expect((await request(app).post(`${base}/salaries`).set('Authorization', auth('FINANCE')).send({
      employeeKey: employee.employeeKey, month: '2042-01', notes: '',
    })).status).toBe(409);
    expect((await request(app).post(`${base}/salary-change-requests`).set('Authorization', auth('ADMIN')).send({
      employeeKey: employee.employeeKey, proposedAmount: 1, reason: 'Admin não propõe.',
    })).status).toBe(403);
    expect((await request(app).patch(`${base}/salary-change-requests/${proposed.body.data.id}/review`)
      .set('Authorization', auth('FINANCE')).send({ decision: 'APPROVED', reviewNotes: 'Sem poder.' })).status).toBe(403);
    const approved = await request(app).patch(`${base}/salary-change-requests/${proposed.body.data.id}/review`)
      .set('Authorization', auth('ADMIN'))
      .send({ decision: 'APPROVED', reviewNotes: 'Valor conferido com a proposta.' });
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ status: 'APPROVED', currentAmount: 15000 });
    expect((await request(app).patch(`${base}/salary-change-requests/${proposed.body.data.id}/review`)
      .set('Authorization', auth('ADMIN')).send({ decision: 'REJECTED', reviewNotes: 'Repetida.' })).status).toBe(409);
  });

  it('gera o salário mensal com o valor aprovado e impede edição directa ou duplicação', async () => {
    const employee = await externalEmployee();
    await approveSalary(employee.employeeKey, 13250);
    const row = await request(app).post(`${base}/salaries`).set('Authorization', auth('FINANCE')).send({
      employeeKey: employee.employeeKey, month: '2042-02', notes: 'Folha mensal',
    });
    expect(row.status).toBe(201);
    expect(row.body.data).toMatchObject({ amount: 13250, status: 'PENDING', employee: { employeeKey: employee.employeeKey } });
    expect((await request(app).post(`${base}/salaries`).set('Authorization', auth('FINANCE')).send({
      employeeKey: employee.employeeKey, month: '2042-02', notes: '',
    })).status).toBe(409);
    expect((await request(app).patch(`${base}/salaries/${row.body.data.id}`).set('Authorization', auth('FINANCE')).send({ amount: 1 })).status).toBe(404);
    expect((await request(app).post(`${base}/salaries`).set('Authorization', auth('ADMIN')).send({
      employeeKey: employee.employeeKey, month: '2042-03', notes: '',
    })).status).toBe(403);
  });

  it('regista pagamento integral uma vez e inclui funcionários externos no relatório mensal', async () => {
    const employee = await externalEmployee();
    await approveSalary(employee.employeeKey, 101.25);
    const salary = await request(app).post(`${base}/salaries`).set('Authorization', auth('FINANCE')).send({
      employeeKey: employee.employeeKey, month: '2039-12', notes: '',
    });
    const row = salary.body.data;
    expect((await request(app).post(`${base}/salaries/${row.id}/payment`).set('Authorization', auth('ADMIN')).send(paymentInput(row))).status).toBe(403);
    const paid = await request(app).post(`${base}/salaries/${row.id}/payment`)
      .set('Authorization', auth('FINANCE')).send(paymentInput(row));
    expect(paid.status).toBe(200);
    expect((await request(app).post(`${base}/salaries/${row.id}/payment`)
      .set('Authorization', auth('FINANCE')).send(paymentInput(row))).status).toBe(409);
    await prisma.employeeSalary.update({ where: { id: row.id }, data: { paidAt: new Date('2041-01-31T21:59:59.999Z') } });
    const report = await request(app).get(`${base}/reports/salaries?month=2041-01`).set('Authorization', auth('ADMIN'));
    expect(report.status).toBe(200);
    expect(report.body.data).toMatchObject({ kind: 'salaries', totalPayments: 1, totalAmount: 101.25 });
    expect(report.body.data.rows[0]).toMatchObject({ fullName: employee.fullName, identityCode: employee.employeeCode, description: 'Salário de 2039-12' });
    expect(monthlyBounds('2041-01')).toEqual({
      gte: new Date('2040-12-31T22:00:00Z'), lt: new Date('2041-01-31T22:00:00Z'),
    });
    await expect(monthlyPaymentReport(actors.TEACHER, 'salaries', '2041-01')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('Finance define mensalidade em cursos partilhados; Admin consulta sem editar', async () => {
    const list = await request(app).get(`${base}/course-tuitions`).set('Authorization', auth('ADMIN'));
    expect(list.status).toBe(200);
    const course = list.body.data.find((item: { courseCode: string }) => item.courseCode === 'LEI');
    expect(course).toMatchObject({ courseName: 'Licenciatura em Engenharia Informática' });
    expect((await request(app).put(`${base}/course-tuitions/${course.courseId}`).set('Authorization', auth('ADMIN')).send({ amount: 5000, notes: '' })).status).toBe(403);
    const updated = await request(app).put(`${base}/course-tuitions/${course.courseId}`)
      .set('Authorization', auth('FINANCE')).send({ amount: 5000, notes: 'Mensalidade regular' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ courseId: course.courseId, amount: 5000, notes: 'Mensalidade regular' });
    const adminView = await request(app).get(`${base}/course-tuitions`).set('Authorization', auth('ADMIN'));
    expect(adminView.body.data.find((item: { courseId: string }) => item.courseId === course.courseId).amount).toBe(5000);
    expect((await request(app).get(`${base}/course-tuitions`).set('Authorization', auth('STUDENT'))).status).toBe(403);
  });
});
