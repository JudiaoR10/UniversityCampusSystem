import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import { bearer, tokenFor, uniqueSuffix } from '../../../test/auth.js';

const app = createApp();
const suffix = uniqueSuffix();
const api = '/api/v1';

describe('API Inscrições em disciplinas', () => {
  let adminToken = '';
  let coordinatorToken = '';
  let teacherToken = '';
  let studentToken = '';
  let studentProfileId = '';
  let subjectId = '';
  let tempStudentProfileId = '';
  let studentOwnEnrolmentId = '';
  let managedEnrolmentId = '';
  let foreignCourseId = '';
  let foreignSubjectId = '';
  let courseLessStudentProfileId = '';
  let inactiveStudentProfileId = '';

  beforeAll(async () => {
    const seeded = await prisma.user.findUnique({ where: { email: 'estudante@smartcampus.demo' } });
    if (!seeded) throw new Error('Seed necessário antes dos testes (npm run db:seed)');

    adminToken = await tokenFor('admin@smartcampus.demo');
    coordinatorToken = await tokenFor('coordenador@smartcampus.demo');
    teacherToken = await tokenFor('docente@smartcampus.demo');
    studentToken = await tokenFor('estudante@smartcampus.demo');

    const subject = await prisma.subject.findUniqueOrThrow({ where: { code: 'PTP3' } });
    subjectId = subject.id;
    const course = await prisma.course.findUniqueOrThrow({ where: { code: 'LEI' } });

    const ownProfile = await prisma.studentProfile.findUniqueOrThrow({ where: { userId: seeded.id } });
    studentProfileId = ownProfile.id;

    const studentRole = await prisma.role.findUniqueOrThrow({ where: { code: 'STUDENT' } });
    const tempUser = await prisma.user.create({
      data: {
        email: `inscrito.${suffix}@test.local`,
        fullName: 'Inscrito Teste',
        passwordHash: 'test',
        roleId: studentRole.id,
      },
    });
    const tempProfile = await prisma.studentProfile.create({
      data: {
        userId: tempUser.id,
        studentNumber: `EI${suffix}`,
        courseId: course.id,
        yearOfStudy: 1,
        status: 'ACTIVE',
      },
    });
    tempStudentProfileId = tempProfile.id;

    const foreignCourse = await prisma.course.create({
      data: {
        code: `EXT${suffix}`,
        name: 'Curso de Teste Externo',
        departmentId: (await prisma.department.findUniqueOrThrow({ where: { code: 'DEI' } })).id,
      },
    });
    foreignCourseId = foreignCourse.id;
    foreignSubjectId = (
      await prisma.subject.create({
        data: { code: `EXT${suffix}`, name: 'Disciplina de Outro Curso', courseId: foreignCourse.id },
      })
    ).id;

    const courseLessUser = await prisma.user.create({
      data: {
        email: `semcurso.${suffix}@test.local`,
        fullName: 'Sem Curso Teste',
        passwordHash: 'test',
        roleId: studentRole.id,
      },
    });
    courseLessStudentProfileId = (
      await prisma.studentProfile.create({
        data: { userId: courseLessUser.id, studentNumber: `SC${suffix}`, status: 'ACTIVE' },
      })
    ).id;

    const inactiveUser = await prisma.user.create({
      data: {
        email: `inactivo.${suffix}@test.local`,
        fullName: 'Inactivo Teste',
        passwordHash: 'test',
        roleId: studentRole.id,
      },
    });
    inactiveStudentProfileId = (
      await prisma.studentProfile.create({
        data: {
          userId: inactiveUser.id,
          studentNumber: `IN${suffix}`,
          courseId: foreignCourse.id,
          status: 'SUSPENDED',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
    await prisma.studentProfile.deleteMany({ where: { studentNumber: { contains: suffix } } });
    await prisma.subject.deleteMany({ where: { code: { contains: suffix } } });
    await prisma.course.deleteMany({ where: { id: foreignCourseId } });
    await prisma.subjectEnrolment.deleteMany({
      where: { studentId: studentProfileId, academicYear: { in: [2098, 2097] } },
    });
  });

  it('rejeita listagem sem token (401)', async () => {
    const res = await request(app).get(`${api}/enrolments`);
    expect(res.status).toBe(401);
  });

  it('técnico não consulta inscrições (403)', async () => {
    const technicianToken = await tokenFor('tecnico@smartcampus.demo');
    const res = await request(app).get(`${api}/enrolments`).set(bearer(technicianToken));
    expect(res.status).toBe(403);
  });

  it('estudante só vê as suas inscrições', async () => {
    const res = await request(app).get(`${api}/enrolments`).set(bearer(studentToken));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((row: { studentId: string }) => row.studentId === studentProfileId)).toBe(
      true,
    );
    expect(res.body.data[0].student.fullName).toBeDefined();
    expect(res.body.data[0].subject.code).toBeDefined();
  });

  it('estudante inscreve-se numa disciplina (201 PENDING)', async () => {
    const res = await request(app)
      .post(`${api}/enrolments`)
      .set(bearer(studentToken))
      .send({ studentId: studentProfileId, subjectId, academicYear: 2098 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      studentId: studentProfileId,
      subjectId,
      academicYear: 2098,
      status: 'PENDING',
    });
    studentOwnEnrolmentId = res.body.data.id;

    const audit = await prisma.auditEvent.findFirst({
      where: { action: 'SUBJECT_ENROLMENT_CREATED', resourceId: studentOwnEnrolmentId },
    });
    expect(audit).not.toBeNull();
  });

  it('rejeita disciplina de outro curso (409 SUBJECT_NOT_IN_STUDENT_COURSE)', async () => {
    const res = await request(app)
      .post(`${api}/enrolments`)
      .set(bearer(adminToken))
      .send({ studentId: studentProfileId, subjectId: foreignSubjectId, academicYear: 2099 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SUBJECT_NOT_IN_STUDENT_COURSE');

    const created = await prisma.subjectEnrolment.findFirst({
      where: { studentId: studentProfileId, subjectId: foreignSubjectId },
    });
    expect(created).toBeNull();
  });

  it('rejeita estudante sem curso (409 STUDENT_WITHOUT_COURSE)', async () => {
    const res = await request(app)
      .post(`${api}/enrolments`)
      .set(bearer(adminToken))
      .send({ studentId: courseLessStudentProfileId, subjectId, academicYear: 2099 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STUDENT_WITHOUT_COURSE');
  });

  it('a ordem das causas mantém o estudante activo antes da pertença ao curso (409 STUDENT_NOT_ACTIVE)', async () => {
    const res = await request(app)
      .post(`${api}/enrolments`)
      .set(bearer(adminToken))
      .send({ studentId: inactiveStudentProfileId, subjectId, academicYear: 2099 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('STUDENT_NOT_ACTIVE');
  });

  it('rejeita inscrição duplicada (409)', async () => {
    const res = await request(app)
      .post(`${api}/enrolments`)
      .set(bearer(studentToken))
      .send({ studentId: studentProfileId, subjectId, academicYear: 2098 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_ENROLMENT');
  });

  it('estudante não inscreve outro estudante (403)', async () => {
    const res = await request(app)
      .post(`${api}/enrolments`)
      .set(bearer(studentToken))
      .send({ studentId: tempStudentProfileId, subjectId, academicYear: 2099 });
    expect(res.status).toBe(403);
  });

  it('docente não cria inscrições (403)', async () => {
    const res = await request(app)
      .post(`${api}/enrolments`)
      .set(bearer(teacherToken))
      .send({ studentId: tempStudentProfileId, subjectId, academicYear: 2099 });
    expect(res.status).toBe(403);
  });

  it('rejeita ano lectivo inválido (400)', async () => {
    const res = await request(app)
      .post(`${api}/enrolments`)
      .set(bearer(coordinatorToken))
      .send({ studentId: tempStudentProfileId, subjectId, academicYear: 1999 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejeita filtro de ano inválido na query (400)', async () => {
    const res = await request(app).get(`${api}/enrolments?academicYear=abc`).set(bearer(adminToken));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('coordenador inscreve outro estudante (201)', async () => {
    const res = await request(app)
      .post(`${api}/enrolments`)
      .set(bearer(coordinatorToken))
      .send({ studentId: tempStudentProfileId, subjectId, academicYear: 2099 });
    expect(res.status).toBe(201);
    managedEnrolmentId = res.body.data.id;
  });

  it('estudante não altera o estado (403)', async () => {
    const res = await request(app)
      .patch(`${api}/enrolments/${managedEnrolmentId}/status`)
      .set(bearer(studentToken))
      .send({ status: 'ACTIVE' });
    expect(res.status).toBe(403);
  });

  it('admin activa mas não conclui inscrição (403) e nada é alterado', async () => {
    const activate = await request(app)
      .patch(`${api}/enrolments/${managedEnrolmentId}/status`)
      .set(bearer(adminToken))
      .send({ status: 'ACTIVE' });
    expect(activate.status).toBe(200);
    expect(activate.body.data.status).toBe('ACTIVE');

    const complete = await request(app)
      .patch(`${api}/enrolments/${managedEnrolmentId}/status`)
      .set(bearer(adminToken))
      .send({ status: 'COMPLETED' });
    expect(complete.status).toBe(403);
    expect(complete.body.code).toBe('FORBIDDEN');

    const unchanged = await prisma.subjectEnrolment.findUniqueOrThrow({
      where: { id: managedEnrolmentId },
    });
    expect(unchanged.status).toBe('ACTIVE');
  });

  it('coordenação conclui a inscrição e bloqueia transição final (409)', async () => {
    const complete = await request(app)
      .patch(`${api}/enrolments/${managedEnrolmentId}/status`)
      .set(bearer(coordinatorToken))
      .send({ status: 'COMPLETED' });
    expect(complete.status).toBe(200);
    expect(complete.body.data.status).toBe('COMPLETED');

    const invalid = await request(app)
      .patch(`${api}/enrolments/${managedEnrolmentId}/status`)
      .set(bearer(coordinatorToken))
      .send({ status: 'ACTIVE' });
    expect(invalid.status).toBe(409);
    expect(invalid.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('estudante não elimina inscrição (403)', async () => {
    const res = await request(app)
      .delete(`${api}/enrolments/${managedEnrolmentId}`)
      .set(bearer(studentToken));
    expect(res.status).toBe(403);
  });

  it('coordenador elimina inscrição (200)', async () => {
    const res = await request(app)
      .delete(`${api}/enrolments/${managedEnrolmentId}`)
      .set(bearer(coordinatorToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: managedEnrolmentId, deleted: true });
  });

  it('lista com filtro por estudante (ADMIN)', async () => {
    const res = await request(app)
      .get(`${api}/enrolments?studentId=${studentProfileId}`)
      .set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(
      res.body.data.every((row: { studentId: string }) => row.studentId === studentProfileId),
    ).toBe(true);
  });

  it('elimina a inscrição criada pelo próprio estudante (limpeza)', async () => {
    const res = await request(app)
      .delete(`${api}/enrolments/${studentOwnEnrolmentId}`)
      .set(bearer(coordinatorToken));
    expect(res.status).toBe(200);
  });
});
