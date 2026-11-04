import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import * as payroll from '../application/payrollService.js';
import { monthlyBounds, monthlyPaymentReport } from '../application/monthlyReportService.js';

const app = createApp();
const base = '/api/v1/financial';
const prefix = randomUUID();
const tokens: Record<string, string> = {};
const actors: Record<string, { id: string; role: string }> = {};
let teacherId: string;
let studentId: string;
let sequence = 0;
const auth = (role: string) => `Bearer ${tokens[role]}`;
async function login(role: string, email: string, password: string) {
  const result = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(result.status).toBe(200);
  tokens[role] = result.body.data.tokens.accessToken;
  actors[role] = { id: result.body.data.user.id, role };
}
async function createSalary(month?: string, amount = 10000) {
  const result = await request(app).post(`${base}/salaries`).set('Authorization', auth('FINANCE')).send({ teacherId, month: month ?? `2040-${String(++sequence).padStart(2, '0')}`, amount, notes: 'Salário de teste' });
  expect(result.status).toBe(201);
  return result.body.data;
}
function paymentInput(row: { amount: number; updatedAt: string }, referenceCode = randomUUID()) {
  return { amountPaid: row.amount, expectedUpdatedAt: row.updatedAt, paymentMethod: 'BANK_TRANSFER', referenceCode };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw Error('Exige base descartável _test');
  await login('ADMIN', 'admin@smartcampus.demo', 'Admin123!');
  await login('FINANCE', 'financas@smartcampus.demo', 'Finance123!');
  await login('STUDENT', 'estudante@smartcampus.demo', 'Estudante123!');
  await login('TEACHER', 'docente@smartcampus.demo', 'Docente123!');
  await login('TECHNICIAN', 'tecnico@smartcampus.demo', 'Tecnico123!');
  await login('COORDINATOR', 'coordenador@smartcampus.demo', 'Coord123!');
  studentId = actors.STUDENT.id;
  const user = await request(app).post('/api/v1/users').set('Authorization', auth('ADMIN')).send({ email: `${prefix}@example.test`, password: 'Teacher123!', fullName: `Docente ${prefix}`, role: 'TEACHER' });
  expect(user.status).toBe(201);
  teacherId = (await prisma.teacherProfile.create({ data: { userId: user.body.data.id, employeeCode: `DOC-${prefix}` } })).id;
}, 60000);
afterAll(async () => { await prisma.$disconnect(); });

describe('Salários e relatórios mensais', () => {
  it('pesquisa docente lê identidade académica mínima; outros perfis são proibidos', async () => {
    for (const role of ['FINANCE', 'ADMIN']) {
      const result = await request(app).get(`${base}/teachers`).query({ q: prefix }).set('Authorization', auth(role));
      expect(result.status).toBe(200);
      expect(result.body.meta.total).toBe(1);
      expect(Object.keys(result.body.data[0]).sort()).toEqual(['employeeCode', 'fullName', 'isActive', 'teacherId', 'userId']);
      expect(result.body.data[0].teacherId).toBe(teacherId);
    }
    for (const role of ['STUDENT', 'TEACHER', 'TECHNICIAN', 'COORDINATOR']) {
      for (const path of ['/teachers', '/salaries?month=2040-01', '/reports/payments?month=2040-01', '/reports/salaries?month=2040-01']) {
        expect((await request(app).get(base + path).set('Authorization', auth(role))).status).toBe(403);
      }
    }
    expect((await request(app).get(`${base}/teachers`)).status).toBe(401);
  });

  it('Finance cria e edita salário pendente, com auditoria e sem duplicação mensal', async () => {
    const row = await createSalary();
    expect(row.teacher.teacherId).toBe(teacherId);
    expect(row.status).toBe('PENDING');
    expect((await request(app).post(`${base}/salaries`).set('Authorization', auth('FINANCE')).send({ teacherId, month: row.month, amount: 200 })).status).toBe(409);
    const updated = await request(app).patch(`${base}/salaries/${row.id}`).set('Authorization', auth('FINANCE')).send({ amount: 12000, notes: 'Valor revisto', expectedUpdatedAt: row.updatedAt });
    expect(updated.status).toBe(200);
    expect(updated.body.data.amount).toBe(12000);
    expect((await request(app).patch(`${base}/salaries/${row.id}`).set('Authorization', auth('FINANCE')).send({ amount: 13000, notes: 'Edição antiga', expectedUpdatedAt: row.updatedAt })).status).toBe(409);
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { resourceId: row.id, action: 'SALARY_UPDATED' } });
    expect(audit.actorId).toBe(actors.FINANCE.id);
    expect(audit.metadata).toMatchObject({ previousAmount: '10000', amount: '12000' });
  });

  it('ADMIN só consulta, incluindo quando tenta escrever directamente na aplicação', async () => {
    const row = await createSalary();
    expect((await request(app).get(`${base}/salaries`).query({ month: row.month }).set('Authorization', auth('ADMIN'))).body.data[0].id).toBe(row.id);
    expect((await request(app).post(`${base}/salaries`).set('Authorization', auth('ADMIN')).send({ teacherId, month: '2045-01', amount: 100 })).status).toBe(403);
    expect((await request(app).patch(`${base}/salaries/${row.id}`).set('Authorization', auth('ADMIN')).send({ amount: 1, notes: '', expectedUpdatedAt: row.updatedAt })).status).toBe(403);
    expect((await request(app).post(`${base}/salaries/${row.id}/payment`).set('Authorization', auth('ADMIN')).send(paymentInput(row))).status).toBe(403);
    await expect(payroll.createSalary(actors.ADMIN, { teacherId, month: '2045-01', amount: 100, notes: '' }, prefix)).rejects.toMatchObject({ statusCode: 403 });
    await expect(payroll.updateSalary(actors.ADMIN, row.id, { amount: 1, notes: '', expectedUpdatedAt: row.updatedAt }, prefix)).rejects.toMatchObject({ statusCode: 403 });
    await expect(payroll.paySalary(actors.ADMIN, row.id, { ...paymentInput(row), paymentMethod: 'BANK_TRANSFER' }, prefix)).rejects.toMatchObject({ statusCode: 403 });
    await expect(monthlyPaymentReport(actors.TEACHER, 'salaries', '2045-01')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('pagamento integral é atómico e imutável, inclusive em pedidos concorrentes', async () => {
    const row = await createSalary();
    const input = paymentInput(row);
    expect((await request(app).post(`${base}/salaries/${row.id}/payment`).set('Authorization', auth('FINANCE')).send({ ...input, amountPaid: 1 })).status).toBe(409);
    const results = await Promise.all([1, 2].map(() => request(app).post(`${base}/salaries/${row.id}/payment`).set('Authorization', auth('FINANCE')).send(input)));
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    expect(await prisma.auditEvent.count({ where: { resourceId: row.id, action: 'SALARY_PAYMENT_RECORDED' } })).toBe(1);
    expect((await request(app).patch(`${base}/salaries/${row.id}`).set('Authorization', auth('FINANCE')).send({ amount: 1, notes: '', expectedUpdatedAt: row.updatedAt })).status).toBe(409);
    const another = await createSalary();
    expect((await request(app).post(`${base}/salaries/${another.id}/payment`).set('Authorization', auth('FINANCE')).send(paymentInput(another, input.referenceCode))).status).toBe(409);
    expect((await prisma.teacherSalary.findUniqueOrThrow({ where: { id: another.id } })).status).toBe('PENDING');
  });

  it('rejeita entradas inválidas e reverte a criação se a auditoria falhar', async () => {
    for (const body of [{ teacherId, month: '2040-13', amount: 100 }, { teacherId, month: '2040-11', amount: -1 }, { teacherId, month: '2040-11', amount: 10.001 }, { teacherId, month: '2040-11', amount: 100, status: 'PAID' }]) {
      expect((await request(app).post(`${base}/salaries`).set('Authorization', auth('FINANCE')).send(body)).status).toBe(400);
    }
    expect((await request(app).post(`${base}/salaries`).set('Authorization', auth('FINANCE')).send({ teacherId: studentId, month: '2040-12', amount: 100 })).status).toBe(404);
    await expect(payroll.createSalary({ id: 'missing-actor', role: 'FINANCE' }, { teacherId, month: '2045-12', amount: 100, notes: '' }, prefix)).rejects.toBeDefined();
    expect(await prisma.teacherSalary.count({ where: { teacherId, month: '2045-12' } })).toBe(0);
  });

  it('relatório de salários usa o mês do pagamento, exclui pendentes e admite salários atrasados', async () => {
    const row = await createSalary('2039-12', 101.25);
    expect((await request(app).post(`${base}/salaries/${row.id}/payment`).set('Authorization', auth('FINANCE')).send(paymentInput(row))).status).toBe(200);
    await prisma.teacherSalary.update({ where: { id: row.id }, data: { paidAt: new Date('2041-01-31T21:59:59.999Z') } });
    await createSalary('2041-01', 99999);
    for (const role of ['FINANCE', 'ADMIN']) {
      const report = await request(app).get(`${base}/reports/salaries?month=2041-01`).set('Authorization', auth(role));
      expect(report.status).toBe(200);
      expect(report.body.data).toMatchObject({ kind: 'salaries', month: '2041-01', totalPayments: 1, totalAmount: 101.25, timezone: 'Africa/Maputo' });
      expect(report.body.data.rows[0].description).toBe('Salário de 2039-12');
    }
    expect(monthlyBounds('2041-01')).toEqual({ gte: new Date('2040-12-31T22:00:00Z'), lt: new Date('2041-01-31T22:00:00Z') });
  });

  it('relatório de recebimentos filtra limites locais e soma apenas pagamentos reais', async () => {
    const fixtures = [
      ['2040-12-31T21:59:59.999Z', 999], ['2040-12-31T22:00:00Z', 10.1],
      ['2041-01-31T21:59:59.999Z', 20.2], ['2041-01-31T22:00:00Z', 999],
    ] as const;
    for (const [paidAt, amount] of fixtures) {
      const debt = await request(app).post(`${base}/debts`).set('Authorization', auth('FINANCE')).send({ studentId, title: 'Propina relatório mensal', amount, origin: 'TEST', dueDate: '2099-01-01T00:00:00Z' });
      expect(debt.status).toBe(201);
      const payment = await request(app).post(`${base}/payments`).set('Authorization', auth('FINANCE')).send({ debtId: debt.body.data.id, amountPaid: amount, paymentMethod: 'BANK_TRANSFER', referenceCode: randomUUID() });
      expect(payment.status).toBe(201);
      await prisma.payment.update({ where: { id: payment.body.data.payment.id }, data: { paidAt: new Date(paidAt) } });
    }
    const report = await request(app).get(`${base}/reports/payments?month=2041-01`).set('Authorization', auth('ADMIN'));
    expect(report.status).toBe(200);
    expect(report.body.data).toMatchObject({ totalPayments: 2, totalAmount: 30.3 });
    expect(report.body.data.rows).toHaveLength(2);
    for (const query of ['', '?month=2041-13', '?month=2041-01&month=2041-02']) {
      expect((await request(app).get(`${base}/reports/payments${query}`).set('Authorization', auth('ADMIN'))).status).toBe(400);
    }
    expect((await request(app).get(`${base}/reports/payments?month=2049-01`).set('Authorization', auth('FINANCE'))).body.data).toMatchObject({ totalPayments: 0, totalAmount: 0, rows: [] });
  });
});
