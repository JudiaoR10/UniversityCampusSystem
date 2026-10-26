import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import { bearer, tokenFor, uniqueSuffix } from '../../../test/auth.js';

const app = createApp();
const suffix = uniqueSuffix();
const api = '/api/v1';

describe('API Docentes', () => {
  let adminToken = '';
  let coordinatorToken = '';
  let studentToken = '';
  let departmentId = '';
  let tempTeacherUserId = '';
  let tempTeacher2UserId = '';
  let createdTeacherId = '';

  beforeAll(async () => {
    const seeded = await prisma.user.findUnique({ where: { email: 'docente@smartcampus.demo' } });
    if (!seeded) throw new Error('Seed necessário antes dos testes (npm run db:seed)');

    adminToken = await tokenFor('admin@smartcampus.demo');
    coordinatorToken = await tokenFor('coordenador@smartcampus.demo');
    studentToken = await tokenFor('estudante@smartcampus.demo');

    const department = await prisma.department.findUniqueOrThrow({ where: { code: 'DEI' } });
    departmentId = department.id;

    const teacherRole = await prisma.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });
    const temp1 = await prisma.user.create({
      data: {
        email: `docente.${suffix}@test.local`,
        fullName: 'Docente Teste',
        passwordHash: 'test',
        roleId: teacherRole.id,
      },
    });
    tempTeacherUserId = temp1.id;

    const temp2 = await prisma.user.create({
      data: {
        email: `docente2.${suffix}@test.local`,
        fullName: 'Docente Teste 2',
        passwordHash: 'test',
        roleId: teacherRole.id,
      },
    });
    tempTeacher2UserId = temp2.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
  });

  it('rejeita listagem sem token (401)', async () => {
    const res = await request(app).get(`${api}/teachers`);
    expect(res.status).toBe(401);
  });

  it('estudante consulta o diretório (200)', async () => {
    const res = await request(app).get(`${api}/teachers`).set(bearer(studentToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('rejeita filtro de estado inválido (400)', async () => {
    const res = await request(app).get(`${api}/teachers?status=INVALID`).set(bearer(adminToken));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejeita criação por coordenador (403)', async () => {
    const res = await request(app)
      .post(`${api}/teachers`)
      .set(bearer(coordinatorToken))
      .send({ userId: tempTeacherUserId, employeeCode: `X${suffix}`, departmentId });
    expect(res.status).toBe(403);
  });

  it('rejeita payload inválido (400)', async () => {
    const res = await request(app)
      .post(`${api}/teachers`)
      .set(bearer(adminToken))
      .send({ userId: tempTeacherUserId });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('admin cria docente (201) com DTO do Core', async () => {
    const res = await request(app)
      .post(`${api}/teachers`)
      .set(bearer(adminToken))
      .send({
        userId: tempTeacherUserId,
        employeeCode: `TD${suffix}`,
        departmentId,
        title: 'Assistente',
        phone: '+258 84 000 0010',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      userId: tempTeacherUserId,
      employeeCode: `TD${suffix}`,
      title: 'Assistente',
      status: 'ACTIVE',
    });
    expect(res.body.data.department).toEqual({ id: departmentId, code: 'DEI', name: expect.any(String) });
    expect(res.body.data.user.fullName).toBe('Docente Teste');
    createdTeacherId = res.body.data.id;

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'TEACHER_PROFILE_CREATED', resourceId: createdTeacherId },
    });
    expect(audit).not.toBeNull();
  });

  it('rejeita código de docente duplicado (409)', async () => {
    const res = await request(app)
      .post(`${api}/teachers`)
      .set(bearer(adminToken))
      .send({ userId: tempTeacher2UserId, employeeCode: `TD${suffix}`, departmentId });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TEACHER_EMPLOYEE_CODE_EXISTS');
  });

  it('rejeita utilizador que já tem perfil (409)', async () => {
    const res = await request(app)
      .post(`${api}/teachers`)
      .set(bearer(adminToken))
      .send({ userId: tempTeacherUserId, employeeCode: `TD2${suffix}`, departmentId });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TEACHER_PROFILE_EXISTS');
  });

  it('rejeita departamento inexistente (404)', async () => {
    const res = await request(app)
      .post(`${api}/teachers`)
      .set(bearer(adminToken))
      .send({ userId: tempTeacher2UserId, employeeCode: `TD3${suffix}`, departmentId: 'nao-existe' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DEPARTMENT_NOT_FOUND');
  });

  it('docente consulta o próprio perfil em /teachers/me', async () => {
    const ownToken = await tokenFor(`docente.${suffix}@test.local`);
    const res = await request(app).get(`${api}/teachers/me`).set(bearer(ownToken));
    expect(res.status).toBe(200);
    expect(res.body.data.employeeCode).toBe(`TD${suffix}`);
  });

  it('estudante não consulta by-user (403)', async () => {
    const res = await request(app)
      .get(`${api}/teachers/by-user/${tempTeacherUserId}`)
      .set(bearer(studentToken));
    expect(res.status).toBe(403);
  });

  it('outro docente não altera o perfil (403)', async () => {
    const ownToken = await tokenFor(`docente.${suffix}@test.local`);
    const res = await request(app)
      .patch(`${api}/teachers/${createdTeacherId}`)
      .set(bearer(ownToken))
      .send({ title: 'Professor' });
    expect(res.status).toBe(403);
  });

  it('coordenador altera o perfil (200)', async () => {
    const res = await request(app)
      .patch(`${api}/teachers/${createdTeacherId}`)
      .set(bearer(coordinatorToken))
      .send({ title: 'Professor Auxiliar', status: 'ON_LEAVE' });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Professor Auxiliar');
    expect(res.body.data.status).toBe('ON_LEAVE');
  });

  it('docente atualiza apenas o próprio contacto (200)', async () => {
    const ownToken = await tokenFor(`docente.${suffix}@test.local`);
    const res = await request(app)
      .patch(`${api}/teachers/me`)
      .set(bearer(ownToken))
      .send({ phone: '+258 84 222 2222' });
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+258 84 222 2222');
  });

  it('docente não altera outros campos pelo /me (400)', async () => {
    const ownToken = await tokenFor(`docente.${suffix}@test.local`);
    const res = await request(app)
      .patch(`${api}/teachers/me`)
      .set(bearer(ownToken))
      .send({ title: 'Professor Catedrático' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('coordenador não remove docente (403)', async () => {
    const res = await request(app)
      .delete(`${api}/teachers/${createdTeacherId}`)
      .set(bearer(coordinatorToken));
    expect(res.status).toBe(403);
  });

  it('admin remove docente (200)', async () => {
    const res = await request(app)
      .delete(`${api}/teachers/${createdTeacherId}`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: createdTeacherId, deleted: true });
  });
});
