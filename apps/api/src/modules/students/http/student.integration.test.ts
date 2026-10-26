import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import { bearer, tokenFor, uniqueSuffix } from '../../../test/auth.js';

const app = createApp();
const suffix = uniqueSuffix();
const api = '/api/v1';

describe('API Estudantes', () => {
  let adminToken = '';
  let coordinatorToken = '';
  let teacherToken = '';
  let studentToken = '';
  let technicianToken = '';
  let courseId = '';
  let subjectId = '';
  let tempStudentUserId = '';
  let tempStudent2UserId = '';
  let createdStudentId = '';

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

    const studentRole = await prisma.role.findUniqueOrThrow({ where: { code: 'STUDENT' } });
    const temp1 = await prisma.user.create({
      data: {
        email: `aluno.${suffix}@test.local`,
        fullName: 'Aluno Teste',
        passwordHash: 'test',
        roleId: studentRole.id,
      },
    });
    tempStudentUserId = temp1.id;

    const temp2 = await prisma.user.create({
      data: {
        email: `aluno2.${suffix}@test.local`,
        fullName: 'Aluno Teste 2',
        passwordHash: 'test',
        roleId: studentRole.id,
      },
    });
    tempStudent2UserId = temp2.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
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

  it('estudante não consulta by-user de outro (403)', async () => {
    const res = await request(app)
      .get(`${api}/students/by-user/${tempStudentUserId}`)
      .set(bearer(studentToken));
    expect(res.status).toBe(403);
  });

  it('rejeita criação por docente (403)', async () => {
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(teacherToken))
      .send({ userId: tempStudentUserId, studentNumber: `X${suffix}`, courseId });
    expect(res.status).toBe(403);
  });

  it('rejeita payload inválido (400)', async () => {
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(coordinatorToken))
      .send({ userId: tempStudentUserId });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it('coordenador cria perfil de estudante (201) com DTO do Core', async () => {
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(coordinatorToken))
      .send({
        userId: tempStudentUserId,
        studentNumber: `TS${suffix}`,
        courseId,
        yearOfStudy: 2,
        phone: '+258 84 000 0009',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      userId: tempStudentUserId,
      studentNumber: `TS${suffix}`,
      yearOfStudy: 2,
      status: 'ACTIVE',
    });
    expect(res.body.data.course).toEqual({ id: courseId, code: 'LEI', name: expect.any(String) });
    expect(res.body.data.user.fullName).toBe('Aluno Teste');
    expect(res.body.meta.correlationId).toBeTruthy();
    createdStudentId = res.body.data.id;

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'STUDENT_PROFILE_CREATED', resourceId: createdStudentId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.correlationId).toBeTruthy();
  });

  it('rejeita número de estudante duplicado (409)', async () => {
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(coordinatorToken))
      .send({
        userId: tempStudent2UserId,
        studentNumber: `TS${suffix}`,
        courseId,
      });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STUDENT_NUMBER_EXISTS');
  });

  it('rejeita utilizador que já tem perfil (409)', async () => {
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(coordinatorToken))
      .send({
        userId: tempStudentUserId,
        studentNumber: `TS2${suffix}`,
        courseId,
      });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STUDENT_PROFILE_EXISTS');
  });

  it('rejeita curso inexistente (404)', async () => {
    const res = await request(app)
      .post(`${api}/students`)
      .set(bearer(coordinatorToken))
      .send({ userId: tempStudent2UserId, studentNumber: `TS3${suffix}`, courseId: 'nao-existe' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('COURSE_NOT_FOUND');
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
    const ownToken = await tokenFor(`aluno.${suffix}@test.local`);
    const res = await request(app)
      .patch(`${api}/students/me`)
      .set(bearer(ownToken))
      .send({ phone: '+258 84 111 1111' });
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+258 84 111 1111');
  });

  it('estudante não altera o estado pelo /me (400)', async () => {
    const ownToken = await tokenFor(`aluno.${suffix}@test.local`);
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

  it('coordenador remove estudante sem inscrições (200)', async () => {
    const res = await request(app)
      .delete(`${api}/students/${createdStudentId}`)
      .set(bearer(coordinatorToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: createdStudentId, deleted: true });
  });

  it('admin consulta by-user sem perfil (404)', async () => {
    const res = await request(app)
      .get(`${api}/students/by-user/${tempStudent2UserId}`)
      .set(bearer(adminToken));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('STUDENT_NOT_FOUND');
  });
});
