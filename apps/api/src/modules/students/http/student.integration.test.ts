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
const studentEmail = `aluno.${tag}@test.local`;

describe('API Estudantes', () => {
  let adminToken = '';
  let coordinatorToken = '';
  let teacherToken = '';
  let studentToken = '';
  let technicianToken = '';
  let courseId = '';
  let subjectId = '';
  let createdStudentId = '';
  let createdStudentUserId = '';

  function payload(overrides: Record<string, unknown> = {}) {
    return {
      email: `novo.${tag}@test.local`,
      password: PASSWORD,
      fullName: 'Aluno Novo',
      studentNumber: `TS${suffix}`,
      courseId,
      ...overrides,
    };
  }

  beforeAll(async () => {
    const seeded = await prisma.user.findUnique({ where: { email: 'estudante@smartcampus.demo' } });
    if (!seeded) throw new Error('Seed necessário antes dos testes (npm run db:seed)');

    adminToken = await tokenFor('admin@smartcampus.demo');
    coordinatorToken = await tokenFor('coordenador@smartcampus.demo');
    teacherToken = await tokenFor('docente@smartcampus.demo');
    studentToken = await tokenFor('estudante@smartcampus.demo');
    technicianToken = await tokenFor('tecnico@smartcampus.demo');

    const course = await prisma.course.findUniqueOrThrow({ where: { code: 'LEI' } });
    courseId = course.id;
    const subject = await prisma.subject.findUniqueOrThrow({ where: { code: 'PTP3' } });
    subjectId = subject.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: tag } } });
  });

  it('rejeita listagem sem token (401 UNAUTHORIZED)', async () => {
    const res = await request(app).get(`${api}/students`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(res.body.correlationId).toBeTruthy();
  });

  it('estudante não lista o diretório (403)', async () => {
    const res = await request(app).get(`${api}/students`).set(bearer(studentToken));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('docente lista estudantes (200)', async () => {
    const res = await request(app).get(`${api}/students`).set(bearer(teacherToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('rejeita filtro de estado inválido (400 VALIDATION_ERROR)', async () => {
    const res = await request(app).get(`${api}/students?status=INVALID`).set(bearer(teacherToken));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('devolve o próprio perfil em /students/me', async () => {
    const res = await request(app).get(`${api}/students/me`).set(bearer(studentToken));
    expect(res.status).toBe(200);
    expect(res.body.data.studentNumber).toBeDefined();
    expect(res.body.data.course.code).toBe('LEI');
    expect(res.body.data.user.fullName).toBeDefined();
  });

  it('utilizador sem perfil recebe 404 em /students/me', async () => {
    const res = await request(app).get(`${api}/students/me`).set(bearer(technicianToken));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STUDENT_NOT_FOUND');
  });

  it('estudante não consulta o perfil de outro por id (403)', async () => {
    const me = await request(app).get(`${api}/students/me`).set(bearer(studentToken));
    const res = await request(app).get(`${api}/students/${me.body.data.id}`).set(bearer(studentToken));
    expect(res.status).toBe(403);
  });

  it('rejeita criação por docente (403)', async () => {
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(teacherToken))
      .send(payload());
    expect(res.status).toBe(403);
  });

  it('rejeita payload inválido (400)', async () => {
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(coordinatorToken))
      .send({ email: `sem-dados.${tag}@test.local` });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('coordenador cria conta e perfil na mesma operação (201)', async () => {
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(coordinatorToken))
      .send(
        payload({
          email: studentEmail,
          fullName: 'Aluno Teste',
          yearOfStudy: 2,
          phone: '+258 84 000 0009',
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      studentNumber: `TS${suffix}`,
      yearOfStudy: 2,
      status: 'ACTIVE',
    });
    expect(res.body.data.userId).toEqual(expect.any(String));
    expect(res.body.data.course).toEqual({ id: courseId, code: 'LEI', name: expect.any(String) });
    expect(res.body.data.user.fullName).toBe('Aluno Teste');
    expect(res.body.meta.correlationId).toBeTruthy();
    createdStudentId = res.body.data.id;
    createdStudentUserId = res.body.data.userId;

    const user = await prisma.user.findUnique({
      where: { id: createdStudentUserId },
      include: { role: true },
    });
    expect(user?.email).toBe(studentEmail);
    expect(user?.role.code).toBe('STUDENT');
    expect(user?.isActive).toBe(true);

    const login = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: studentEmail, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.user.role).toBe('STUDENT');

    const [userAudit, profileAudit] = await Promise.all([
      prisma.auditEvent.findFirst({
        where: { action: 'USER_CREATE', resourceId: createdStudentUserId },
      }),
      prisma.auditEvent.findFirst({
        where: { action: 'STUDENT_PROFILE_CREATED', resourceId: createdStudentId },
      }),
    ]);
    expect(userAudit).not.toBeNull();
    expect(profileAudit).not.toBeNull();
    expect(userAudit?.correlationId).toBe(res.body.meta.correlationId);
    expect(profileAudit?.correlationId).toBe(userAudit?.correlationId);
    expect(userAudit?.actorId).toBeTruthy();
  });

  it('rejeita email já registado (409 USER_EXISTS) sem criar perfil', async () => {
    const number = `TS2${suffix}`;
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(coordinatorToken))
      .send(payload({ email: studentEmail, studentNumber: number }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USER_EXISTS');
    expect(await prisma.studentProfile.count({ where: { studentNumber: number } })).toBe(0);
  });

  it('rejeita número de estudante duplicado (409) sem criar conta', async () => {
    const email = `dupnum.${tag}@test.local`;
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(coordinatorToken))
      .send(payload({ email, studentNumber: `TS${suffix}` }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STUDENT_NUMBER_EXISTS');
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('não deixa conta órfã quando a criação concorrente colide no número (rollback)', async () => {
    const studentNumber = `RACE${suffix}`;
    const emails = [`race1.${tag}@test.local`, `race2.${tag}@test.local`];

    const results = await Promise.all(
      emails.map((email) =>
        request(app)
          .post(`${api}/students`)
          .set(bearer(coordinatorToken))
          .send(payload({ email, studentNumber })),
      ),
    );

    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([201, 409]);
    const loser = results.find((res) => res.status === 409);
    expect(loser?.body.code).toBe('STUDENT_NUMBER_EXISTS');

    expect(await prisma.studentProfile.count({ where: { studentNumber } })).toBe(1);
    expect(await prisma.user.count({ where: { email: { in: emails } } })).toBe(1);
  });

  it('rejeita curso inexistente (404) sem criar conta', async () => {
    const email = `semcurso.${tag}@test.local`;
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(coordinatorToken))
      .send(payload({ email, courseId: 'nao-existe' }));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('COURSE_NOT_FOUND');
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });

  it('cria inscrição e bloqueia remoção do estudante (409)', async () => {
    const enrolment = await request(app)
      .post(`${api}/enrolments`)
      .set(bearer(coordinatorToken))
      .send({ studentId: createdStudentId, subjectId, academicYear: 2097 });
    expect(enrolment.status).toBe(201);

    const remove = await request(app)
      .delete(`${api}/students/${createdStudentId}`)
      .set(bearer(coordinatorToken));
    expect(remove.status).toBe(409);
    expect(remove.body.code).toBe('STUDENT_HAS_ENROLMENTS');

    const deleteEnrolment = await request(app)
      .delete(`${api}/enrolments/${enrolment.body.data.id}`)
      .set(bearer(coordinatorToken));
    expect(deleteEnrolment.status).toBe(200);
  });

  it('docente não altera o perfil (403)', async () => {
    const res = await request(app)
      .patch(`${api}/students/${createdStudentId}`)
      .set(bearer(teacherToken))
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(403);
  });

  it('coordenador altera o estado (200)', async () => {
    const res = await request(app)
      .patch(`${api}/students/${createdStudentId}`)
      .set(bearer(coordinatorToken))
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUSPENDED');
  });

  it('estudante atualiza apenas o próprio contacto (200)', async () => {
    const ownToken = await tokenFor(studentEmail);
    const res = await request(app)
      .patch(`${api}/students/me`)
      .set(bearer(ownToken))
      .send({ phone: '+258 84 111 1111' });
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+258 84 111 1111');
  });

  it('estudante não altera o estado pelo /me (400)', async () => {
    const ownToken = await tokenFor(studentEmail);
    const res = await request(app)
      .patch(`${api}/students/me`)
      .set(bearer(ownToken))
      .send({ status: 'ACTIVE' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('bloqueia remoção quando existe Enrolment do Core (409)', async () => {
    const coreEnrolment = await prisma.enrolment.create({
      data: { studentId: createdStudentId, courseId, academicYear: '2098' },
    });

    const res = await request(app)
      .delete(`${api}/students/${createdStudentId}`)
      .set(bearer(coordinatorToken));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STUDENT_HAS_ENROLMENTS');

    await prisma.enrolment.delete({ where: { id: coreEnrolment.id } });
  });

  it('coordenador remove estudante e conta de acesso (200)', async () => {
    const res = await request(app)
      .delete(`${api}/students/${createdStudentId}`)
      .set(bearer(coordinatorToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: createdStudentId, deleted: true });

    expect(await prisma.studentProfile.findUnique({ where: { id: createdStudentId } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: createdStudentUserId } })).toBeNull();

    const login = await request(app)
      .post(`${api}/auth/login`)
      .send({ email: studentEmail, password: PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.code).toBe('INVALID_CREDENTIALS');

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'USER_DELETE', resourceId: createdStudentUserId },
    });
    expect(audit).not.toBeNull();
  });

  it('permite recriar o estudante com o mesmo email e número após a remoção', async () => {
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(coordinatorToken))
      .send(payload({ email: studentEmail, fullName: 'Aluno Teste' }));

    expect(res.status).toBe(201);
    expect(res.body.data.studentNumber).toBe(`TS${suffix}`);
    expect(res.body.data.user.fullName).toBe('Aluno Teste');
  });

  it('admin consulta by-user de conta sem perfil (404)', async () => {
    const res = await request(app)
      .get(`${api}/students/by-user/${createdStudentUserId}`)
      .set(bearer(adminToken));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STUDENT_NOT_FOUND');
  });
});
