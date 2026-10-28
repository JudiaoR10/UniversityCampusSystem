import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import { bearer, tokenFor, uniqueSuffix } from '../../../test/auth.js';

const app = createApp();
const suffix = uniqueSuffix();
const tag = suffix.toLowerCase();
const api = '/api/v1';
const PASSWORD = 'Password123!';
const teacherEmail = `docente.${tag}@test.local`;

describe('API Docentes', () => {
  let adminToken = '';
  let coordinatorToken = '';
  let studentToken = '';
  let departmentId = '';
  let createdTeacherId = '';
  let createdTeacherUserId = '';

  function payload(overrides: Record<string, unknown> = {}) {
    return {
      email: `novo.docente.${tag}@test.local`,
      password: PASSWORD,
      fullName: 'Docente Novo',
      employeeCode: `TD${suffix}`,
      departmentId,
      ...overrides,
    };
  }

  beforeAll(async () => {
    const seeded = await prisma.user.findUnique({ where: { email: 'docente@smartcampus.demo' } });
    if (!seeded) throw new Error('Seed necessário antes dos testes (npm run db:seed)');

    adminToken = await tokenFor('admin@smartcampus.demo');
    coordinatorToken = await tokenFor('coordenador@smartcampus.demo');
    studentToken = await tokenFor('estudante@smartcampus.demo');

    const department = await prisma.department.findUniqueOrThrow({ where: { code: 'DEI' } });
    departmentId = department.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: tag } } });
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
    const res = await request(app).post(`${api}/teachers`).set(bearer(coordinatorToken)).send(payload());
    expect(res.status).toBe(403);
  });

  it('rejeita payload inválido (400)', async () => {
    const res = await request(app)
      .post(`${api}/teachers`)
      .set(bearer(adminToken))
      .send({ studentNumber: 'sem-conta' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('admin cria conta e perfil de docente na mesma operação (201)', async () => {
    const res = await request(app)
      .post(`${api}/teachers`)
      .set(bearer(adminToken))
      .send(
        payload({
          email: teacherEmail,
          fullName: 'Docente Teste',
          title: 'Assistente',
          phone: '+258 84 000 0010',
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      employeeCode: `TD${suffix}`,
      title: 'Assistente',
      status: 'ACTIVE',
    });
    expect(res.body.data.userId).toEqual(expect.any(String));
    expect(res.body.data.department).toEqual({ id: departmentId, code: 'DEI', name: expect.any(String) });
    expect(res.body.data.user.fullName).toBe('Docente Teste');
    createdTeacherId = res.body.data.id;
    createdTeacherUserId = res.body.data.userId;

    const user = await prisma.user.findUnique({
      where: { id: createdTeacherUserId },
      include: { role: true },
    });
    expect(user?.email).toBe(teacherEmail);
    expect(user?.role.code).toBe('TEACHER');
    expect(user?.isActive).toBe(true);

    const login = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: teacherEmail, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('TEACHER');

    const [userAudit, profileAudit] = await Promise.all([
      prisma.auditEvent.findFirst({
        where: { action: 'USER_CREATE', resourceId: createdTeacherUserId },
      }),
      prisma.auditEvent.findFirst({
        where: { action: 'TEACHER_PROFILE_CREATED', resourceId: createdTeacherId },
      }),
    ]);
    expect(userAudit).not.toBeNull();
    expect(profileAudit).not.toBeNull();
    expect(userAudit?.correlationId).toBe(res.body.meta.correlationId);
    expect(profileAudit?.correlationId).toBe(userAudit?.correlationId);
    expect(userAudit?.actorId).toBeTruthy();
  });

  it('rejeita email já registado (409 USER_EXISTS) sem criar perfil', async () => {
    const employeeCode = `TD2${suffix}`;
    const res = await request(app)
      .post(`${api}/teachers`)
      .set(bearer(adminToken))
      .send(payload({ email: teacherEmail, employeeCode }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USER_EXISTS');
    expect(await prisma.teacherProfile.count({ where: { employeeCode } })).toBe(0);
  });

  it('rejeita código de docente duplicado (409) sem criar conta', async () => {
    const email = `dupcode.${tag}@test.local`;
    const res = await request(app)
      .post(`${api}/teachers`)
      .set(bearer(adminToken))
      .send(payload({ email, employeeCode: `TD${suffix}` }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TEACHER_EMPLOYEE_CODE_EXISTS');
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('rejeita departamento inexistente (404) sem criar conta', async () => {
    const email = `semdpto.${tag}@test.local`;
    const res = await request(app)
      .post(`${api}/teachers`)
      .set(bearer(adminToken))
      .send(payload({ email, departmentId: 'nao-existe' }));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DEPARTMENT_NOT_FOUND');
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('docente criado consulta o próprio perfil em /teachers/me', async () => {
    const ownToken = await tokenFor(teacherEmail);
    const res = await request(app).get(`${api}/teachers/me`).set(bearer(ownToken));
    expect(res.status).toBe(200);
    expect(res.body.data.employeeCode).toBe(`TD${suffix}`);
  });

  it('estudante não consulta by-user (403)', async () => {
    const res = await request(app)
      .get(`${api}/teachers/by-user/${createdTeacherUserId}`)
      .set(bearer(studentToken));
    expect(res.status).toBe(403);
  });

  it('docente não altera o perfil por id (403)', async () => {
    const ownToken = await tokenFor(teacherEmail);
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
    const ownToken = await tokenFor(teacherEmail);
    const res = await request(app)
      .patch(`${api}/teachers/me`)
      .set(bearer(ownToken))
      .send({ phone: '+258 84 222 2222' });
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+258 84 222 2222');
  });

  it('docente não altera outros campos pelo /me (400)', async () => {
    const ownToken = await tokenFor(teacherEmail);
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

  it('admin remove docente e conta de acesso (200)', async () => {
    const res = await request(app)
      .delete(`${api}/teachers/${createdTeacherId}`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: createdTeacherId, deleted: true });

    expect(await prisma.teacherProfile.findUnique({ where: { id: createdTeacherId } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: createdTeacherUserId } })).toBeNull();

    const login = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: teacherEmail, password: PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.code).toBe('INVALID_CREDENTIALS');

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'USER_DELETE', resourceId: createdTeacherUserId },
    });
    expect(audit).not.toBeNull();
  });

  it('permite recriar o docente com o mesmo email e código após a remoção', async () => {
    const res = await request(app)
      .post(`${api}/teachers`)
      .set(bearer(adminToken))
      .send(payload({ email: teacherEmail, fullName: 'Docente Teste' }));

    expect(res.status).toBe(201);
    expect(res.body.data.employeeCode).toBe(`TD${suffix}`);
    expect(res.body.data.user.fullName).toBe('Docente Teste');
  });
});
