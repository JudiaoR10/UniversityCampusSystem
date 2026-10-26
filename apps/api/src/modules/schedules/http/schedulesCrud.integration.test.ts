import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';

const app = createApp();

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.tokens.accessToken;
}

const stamper = Date.now();
const title = `Horário CRUD-${stamper}`;
const tmpCourseCode = `TST-C-${stamper}`;
const tmpSubjectCode = `TST-S-${stamper}`;

describe('CRUD e filtros de /schedules (módulo API HORARIO)', () => {
  let coordinatorToken = '';
  let teacherToken = '';
  let teacher2Token = '';
  let studentToken = '';
  let technicianToken = '';
  let adminToken = '';

  let subjectId = '';
  let courseId = '';
  let teacher2UserId = '';
  let studentUserId = '';
  let roomId = '';
  let tmpCourseId = '';
  let tmpSubjectId = '';

  let createdId = '';

  beforeAll(async () => {
    coordinatorToken = await loginAs('coordenador@smartcampus.demo', 'Coord123!');
    teacherToken = await loginAs('docente@smartcampus.demo', 'Docente123!');
    teacher2Token = await loginAs('docente2@smartcampus.demo', 'Docente123!');
    studentToken = await loginAs('estudante@smartcampus.demo', 'Estudante123!');
    technicianToken = await loginAs('tecnico@smartcampus.demo', 'Tecnico123!');
    adminToken = await loginAs('admin@smartcampus.demo', 'Admin123!');

    const subject = await prisma.subject.findUnique({ where: { code: 'PTP3' } });
    const teacher2 = await prisma.user.findUnique({ where: { email: 'docente2@smartcampus.demo' } });
    const student = await prisma.user.findUnique({ where: { email: 'estudante@smartcampus.demo' } });
    const room = await prisma.room.findFirst({ where: { code: 'A-101' } });
    const department = await prisma.department.findFirst();
    if (!subject || !teacher2 || !student || !room || !department) {
      throw new Error('Seed necessário antes dos testes (npm run db:seed)');
    }
    subjectId = subject.id;
    courseId = subject.courseId;
    teacher2UserId = teacher2.id;
    studentUserId = student.id;
    roomId = room.id;

    const tmpCourse = await prisma.course.create({
      data: { code: tmpCourseCode, name: 'Curso temporário de teste', departmentId: department.id },
    });
    tmpCourseId = tmpCourse.id;
    const tmpSubject = await prisma.subject.create({
      data: { code: tmpSubjectCode, name: 'Disciplina temporária de teste', courseId: tmpCourseId },
    });
    tmpSubjectId = tmpSubject.id;
  });

  afterAll(async () => {
    await prisma.classSchedule.deleteMany({ where: { title: { startsWith: `Horário CRUD-${stamper}` } } });
    if (tmpSubjectId) await prisma.subject.delete({ where: { id: tmpSubjectId } }).catch(() => undefined);
    if (tmpCourseId) await prisma.course.delete({ where: { id: tmpCourseId } }).catch(() => undefined);
  });

  describe('GET /schedules/options', () => {
    it('sem token → 401', async () => {
      const res = await request(app).get('/api/v1/schedules/options');
      expect(res.status).toBe(401);
    });

    it('STUDENT e TECHNICIAN → 403 (referência de gestão)', async () => {
      const student = await request(app).get('/api/v1/schedules/options').set('Authorization', `Bearer ${studentToken}`);
      expect(student.status).toBe(403);
      const technician = await request(app).get('/api/v1/schedules/options').set('Authorization', `Bearer ${technicianToken}`);
      expect(technician.status).toBe(403);
    });

    it('COORDINATOR recebe cursos, disciplinas, docentes e salas', async () => {
      const res = await request(app).get('/api/v1/schedules/options').set('Authorization', `Bearer ${coordinatorToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.courses)).toBe(true);
      expect(Array.isArray(res.body.data.subjects)).toBe(true);
      expect(Array.isArray(res.body.data.teachers)).toBe(true);
      expect(Array.isArray(res.body.data.rooms)).toBe(true);
      expect(res.body.data.courses.some((c: { id: string }) => c.id === courseId)).toBe(true);
      expect(res.body.data.teachers.some((t: { id: string }) => t.id === teacher2UserId)).toBe(true);
      expect(res.body.data.teachers.every((t: { id: string }) => t.id !== studentUserId)).toBe(true);
    });
  });

  describe('GET /schedules — filtros', () => {
    beforeAll(async () => {
      const start = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const res = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          title,
          subjectId,
          courseId,
          teacherId: teacher2UserId,
          roomId,
          startsAt: start.toISOString(),
          endsAt: new Date(start.getTime() + 90 * 60 * 1000).toISOString(),
        });
      expect(res.status).toBe(201);
      createdId = res.body.data.id;
      expect(res.body.data.room?.code).toBe('A-101');
    });

    it('filtra por curso, docente e sala', async () => {
      const byCourse = await request(app)
        .get(`/api/v1/schedules?courseId=${courseId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(byCourse.status).toBe(200);
      expect(byCourse.body.data.some((s: { id: string }) => s.id === createdId)).toBe(true);

      const byTeacher = await request(app)
        .get(`/api/v1/schedules?teacherId=${teacher2UserId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(byTeacher.status).toBe(200);
      expect(byTeacher.body.data.some((s: { id: string }) => s.id === createdId)).toBe(true);

      const byRoom = await request(app)
        .get(`/api/v1/schedules?roomId=${roomId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(byRoom.status).toBe(200);
      expect(byRoom.body.data.some((s: { id: string }) => s.id === createdId)).toBe(true);
    });

    it('filtra por período (from/to)', async () => {
      const inside = await request(app)
        .get(
          `/api/v1/schedules?from=${new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString()}&to=${new Date(
            Date.now() + 11 * 24 * 60 * 60 * 1000,
          ).toISOString()}`,
        )
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(inside.status).toBe(200);
      expect(inside.body.data.some((s: { id: string }) => s.id === createdId)).toBe(true);

      const outside = await request(app)
        .get(`/api/v1/schedules?from=${new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(outside.status).toBe(200);
      expect(outside.body.data.some((s: { id: string }) => s.id === createdId)).toBe(false);
    });

    it('data inválida → 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .get('/api/v1/schedules?from=nao-e-data')
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('TEACHER vê a sessão onde é docente e STUDENT do curso também', async () => {
      const teacher = await request(app).get('/api/v1/schedules').set('Authorization', `Bearer ${teacher2Token}`);
      expect(teacher.status).toBe(200);
      expect(teacher.body.data.some((s: { id: string }) => s.id === createdId)).toBe(true);

      const student = await request(app).get('/api/v1/schedules').set('Authorization', `Bearer ${studentToken}`);
      expect(student.status).toBe(200);
      expect(student.body.data.some((s: { id: string }) => s.id === createdId)).toBe(true);
    });
  });

  describe('POST /schedules — validação e permissões', () => {
    const validBody = () => ({
      title: `${title}-x`,
      subjectId,
      courseId,
      teacherId: teacher2UserId,
      roomId,
      startsAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
      endsAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
    });

    it('STUDENT e TEACHER → 403', async () => {
      const student = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(validBody());
      expect(student.status).toBe(403);
      const teacher = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send(validBody());
      expect(teacher.status).toBe(403);
    });

    it('título curto (400) e datas invertidas (400)', async () => {
      const short = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ ...validBody(), title: 'ab' });
      expect(short.status).toBe(400);
      expect(short.body.code).toBe('VALIDATION_ERROR');

      const inverted = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          ...validBody(),
          startsAt: new Date().toISOString(),
          endsAt: new Date(Date.now() - 60_000).toISOString(),
        });
      expect(inverted.status).toBe(400);
      expect(inverted.body.code).toBe('VALIDATION_ERROR');
    });

    it('referências inexistentes → 404; docente sem role TEACHER → 409; disciplina de outro curso → 409', async () => {
      const badSubject = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ ...validBody(), subjectId: 'nao-existe' });
      expect(badSubject.status).toBe(404);
      expect(badSubject.body.code).toBe('SUBJECT_NOT_FOUND');

      const wrongRole = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ ...validBody(), teacherId: studentUserId });
      expect(wrongRole.status).toBe(409);
      expect(wrongRole.body.code).toBe('TEACHER_ROLE_MISMATCH');

      const mismatch = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ ...validBody(), subjectId: tmpSubjectId, courseId });
      expect(mismatch.status).toBe(409);
      expect(mismatch.body.code).toBe('SUBJECT_COURSE_MISMATCH');
    });

    it('curso, docente e sala inexistentes → 404 com o código correto', async () => {
      const badCourse = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ ...validBody(), courseId: 'curso-nao-existe' });
      expect(badCourse.status).toBe(404);
      expect(badCourse.body.code).toBe('COURSE_NOT_FOUND');

      const badTeacher = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ ...validBody(), teacherId: 'docente-nao-existe' });
      expect(badTeacher.status).toBe(404);
      expect(badTeacher.body.code).toBe('TEACHER_NOT_FOUND');

      const badRoom = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ ...validBody(), roomId: 'sala-nao-existe' });
      expect(badRoom.status).toBe(404);
      expect(badRoom.body.code).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('Sobreposições de horário (docente, sala e curso)', () => {
    const overlapTitle = `${title}-overlap`;
    let baseStart = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    let overlapId = '';

    const body = (overrides: Record<string, unknown> = {}) => ({
      title: overlapTitle,
      subjectId,
      courseId,
      teacherId: teacher2UserId,
      roomId,
      startsAt: baseStart.toISOString(),
      endsAt: new Date(baseStart.getTime() + 90 * 60 * 1000).toISOString(),
      ...overrides,
    });

    afterAll(async () => {
      await prisma.classSchedule.deleteMany({ where: { title: { startsWith: overlapTitle } } });
    });

    it('cria sessão base e rejeita sobreposição para o mesmo docente/sala/curso → 409 SCHEDULE_OVERLAP', async () => {
      baseStart = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const created = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send(body());
      expect(created.status).toBe(201);
      overlapId = created.body.data.id;

      // Sobreposição parcial no mesmo docente, sala e curso.
      const partial = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send(
          body({
            title: `${overlapTitle}-parcial`,
            startsAt: new Date(baseStart.getTime() + 60 * 60 * 1000).toISOString(),
            endsAt: new Date(baseStart.getTime() + 150 * 60 * 1000).toISOString(),
          }),
        );
      expect(partial.status).toBe(409);
      expect(partial.body.code).toBe('SCHEDULE_OVERLAP');

      // Sessão contida noutra.
      const contained = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send(
          body({
            title: `${overlapTitle}-contida`,
            startsAt: new Date(baseStart.getTime() + 15 * 60 * 1000).toISOString(),
            endsAt: new Date(baseStart.getTime() + 45 * 60 * 1000).toISOString(),
          }),
        );
      expect(contained.status).toBe(409);
      expect(contained.body.code).toBe('SCHEDULE_OVERLAP');
    });

    it('sessões adjacentes (fim = início) e em horários distintos são permitidas', async () => {
      const adjacent = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send(
          body({
            title: `${overlapTitle}-adjacente`,
            startsAt: new Date(baseStart.getTime() + 90 * 60 * 1000).toISOString(),
            endsAt: new Date(baseStart.getTime() + 180 * 60 * 1000).toISOString(),
          }),
        );
      expect(adjacent.status).toBe(201);
      await prisma.classSchedule.delete({ where: { id: adjacent.body.data.id } }).catch(() => undefined);
    });

    it('PATCH que move a sessão para cima de outra → 409 SCHEDULE_OVERLAP; PATCH válido → 200', async () => {
      // Cria uma segunda sessão não sobreposta (horário diferente).
      const other = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send(
          body({
            title: `${overlapTitle}-outra`,
            startsAt: new Date(baseStart.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
            endsAt: new Date(baseStart.getTime() + 10 * 24 * 60 * 60 * 1000 + 90 * 60 * 1000).toISOString(),
          }),
        );
      expect(other.status).toBe(201);
      const otherId = other.body.data.id;

      // Tenta mover a sessão "outra" para cima da sessão base → 409.
      const conflictingMove = await request(app)
        .patch(`/api/v1/schedules/${otherId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          startsAt: new Date(baseStart.getTime() + 30 * 60 * 1000).toISOString(),
          endsAt: new Date(baseStart.getTime() + 120 * 60 * 1000).toISOString(),
        });
      expect(conflictingMove.status).toBe(409);
      expect(conflictingMove.body.code).toBe('SCHEDULE_OVERLAP');

      // PATCH válido: actualizar apenas o título (sem tocar nos horários).
      const validPatch = await request(app)
        .patch(`/api/v1/schedules/${otherId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ title: `${overlapTitle}-outra-editada` });
      expect(validPatch.status).toBe(200);
      expect(validPatch.body.data.title).toBe(`${overlapTitle}-outra-editada`);
    });

    it('PATCH para hora de fim anterior à de início → 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .patch(`/api/v1/schedules/${overlapId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          startsAt: new Date(baseStart.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          endsAt: new Date(baseStart.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('PATCH inexistente → 404 SCHEDULE_NOT_FOUND; STUDENT → 403', async () => {
      const missing = await request(app)
        .patch('/api/v1/schedules/id-inexistente')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ title: 'Qualquer título válido' });
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('SCHEDULE_NOT_FOUND');

      const forbidden = await request(app)
        .patch(`/api/v1/schedules/${overlapId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Tentativa de estudante' });
      expect(forbidden.status).toBe(403);
    });
  });

  describe('DELETE /schedules/:id', () => {
    it('TEACHER → 403; COORDINATOR elimina (200); repetir → 404', async () => {
      const forbidden = await request(app)
        .delete(`/api/v1/schedules/${createdId}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(forbidden.status).toBe(403);

      const deleted = await request(app)
        .delete(`/api/v1/schedules/${createdId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(deleted.status).toBe(200);
      expect(deleted.body.data.id).toBe(createdId);

      const again = await request(app)
        .delete(`/api/v1/schedules/${createdId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(again.status).toBe(404);
      expect(again.body.code).toBe('SCHEDULE_NOT_FOUND');
    });

    it('ADMIN consegue consultar as opções de horário', async () => {
      const res = await request(app).get('/api/v1/schedules/options').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });
  });
});
