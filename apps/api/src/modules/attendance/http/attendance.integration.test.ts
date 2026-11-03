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
const prefix = `Assiduidade ${stamper}`;
const tmpCourseCode = `ATT-C-${stamper}`;
const tmpSubjectCode = `ATT-S-${stamper}`;

describe('Módulo Assiduidade — /attendance', () => {
  let coordinatorToken = '';
  let teacherToken = '';
  let teacher2Token = '';
  let studentToken = '';
  let technicianToken = '';

  let subjectId = '';
  let courseId = '';
  let teacher2UserId = '';
  let roomId = '';
  let tmpCourseId = '';
  let tmpSubjectId = '';

  let studentAProfileId = '';
  let studentBProfileId = '';

  let sched1Id = '';
  let sched2Id = '';
  let tmpSchedId = '';

  beforeAll(async () => {
    coordinatorToken = await loginAs('coordenador@smartcampus.demo', 'Coord123!');
    teacherToken = await loginAs('docente@smartcampus.demo', 'Docente123!');
    teacher2Token = await loginAs('docente2@smartcampus.demo', 'Docente123!');
    studentToken = await loginAs('estudante@smartcampus.demo', 'Estudante123!');
    technicianToken = await loginAs('tecnico@smartcampus.demo', 'Tecnico123!');

    const subject = await prisma.subject.findUnique({ where: { code: 'PTP3' } });
    const teacher2 = await prisma.user.findUnique({ where: { email: 'docente2@smartcampus.demo' } });
    const studentAUser = await prisma.user.findUnique({ where: { email: 'estudante@smartcampus.demo' } });
    const studentBUser = await prisma.user.findUnique({ where: { email: 'estudante2@smartcampus.demo' } });
    const studentA = studentAUser
      ? await prisma.studentProfile.findUnique({ where: { userId: studentAUser.id } })
      : null;
    const studentB = studentBUser
      ? await prisma.studentProfile.findUnique({ where: { userId: studentBUser.id } })
      : null;
    const room = await prisma.room.findFirst({ where: { code: 'D2-101' } });
    const department = await prisma.department.findFirst();
    if (!subject || !teacher2 || !studentA || !studentB || !room || !department) {
      throw new Error('Seed necessário antes dos testes (npm run db:seed)');
    }
    subjectId = subject.id;
    courseId = subject.courseId;
    teacher2UserId = teacher2.id;
    roomId = room.id;
    studentAProfileId = studentA.id;
    studentBProfileId = studentB.id;

    const tmpCourse = await prisma.course.create({
      data: { code: tmpCourseCode, name: 'Curso temporário de assiduidade', departmentId: department.id },
    });
    tmpCourseId = tmpCourse.id;
    const tmpSubject = await prisma.subject.create({
      data: { code: tmpSubjectCode, name: 'Disciplina temporária de assiduidade', courseId: tmpCourseId },
    });
    tmpSubjectId = tmpSubject.id;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { action: 'ATTENDANCE_MARK' } });
    await prisma.classSchedule.deleteMany({ where: { title: { startsWith: prefix } } });
    if (tmpSubjectId) await prisma.subject.delete({ where: { id: tmpSubjectId } }).catch(() => undefined);
    if (tmpCourseId) await prisma.course.delete({ where: { id: tmpCourseId } }).catch(() => undefined);
  });

  async function createSchedule(
    title: string,
    dayOffset: number,
    extra: Record<string, unknown> = {},
  ): Promise<string> {
    // Dias fixos e distintos por sessão: a API rejeita sobreposições para o
    // mesmo docente, sala ou curso, pelo que os dados de teste não podem colidir.
    const start = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
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
        ...extra,
      });
    expect(res.status).toBe(201);
    return res.body.data.id;
  }

  describe('GET /attendance/sessions', () => {
    it('sem token → 401; STUDENT e TECHNICIAN → 403', async () => {
      const anon = await request(app).get('/api/v1/attendance/sessions');
      expect(anon.status).toBe(401);

      const student = await request(app)
        .get('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(student.status).toBe(403);

      const technician = await request(app)
        .get('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${technicianToken}`);
      expect(technician.status).toBe(403);
    });

    it('COORDINATOR recebe as sessões de horário; TEACHER as suas', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/sessions')
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /attendance/sessions/:scheduleId — pauta', () => {
    beforeAll(async () => {
      sched1Id = await createSchedule(`${prefix}-1`, 20);
      sched2Id = await createSchedule(`${prefix}-2`, 21);
      tmpSchedId = await createSchedule(`${prefix}-T`, 22, { subjectId: tmpSubjectId, courseId: tmpCourseId });
    });

    it('sessão inexistente → 404 SCHEDULE_NOT_FOUND', async () => {
      const res = await request(app)
        .get('/api/v1/attendance/sessions/nao-existe')
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('SCHEDULE_NOT_FOUND');
    });

    it('TEACHER sem relação com a sessão → 403 (anti-BOLA)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/sessions/${sched1Id}`)
        .set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('docente titular e COORDINATOR recebem a pauta do curso', async () => {
      const owner = await request(app)
        .get(`/api/v1/attendance/sessions/${sched1Id}`)
        .set('Authorization', `Bearer ${teacher2Token}`);
      expect(owner.status).toBe(200);
      expect(owner.body.data.schedule.course.id).toBe(courseId);
      expect(owner.body.data.entries.length).toBeGreaterThanOrEqual(2);
      expect(owner.body.data.entries.every((e: { status: string | null }) => e.status === null)).toBe(true);
      expect(owner.body.data.entries.some((e: { studentNumber: string }) => e.studentNumber === 'EST-2026-001')).toBe(true);
      expect(owner.body.data.entries.some((e: { studentNumber: string }) => e.studentNumber === 'EST-2026-002')).toBe(true);

      const coord = await request(app)
        .get(`/api/v1/attendance/sessions/${sched1Id}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(coord.status).toBe(200);
      expect(coord.body.data.entries.length).toBe(owner.body.data.entries.length);
    });

    it('sessão de curso sem estudantes devolve pauta vazia', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/sessions/${tmpSchedId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.entries).toEqual([]);
    });
  });

  describe('POST /attendance/sessions/:scheduleId — registo', () => {
    it('STUDENT e TECHNICIAN → 403', async () => {
      const student = await request(app)
        .post(`/api/v1/attendance/sessions/${sched1Id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ records: [{ studentId: studentAProfileId, status: 'PRESENT' }] });
      expect(student.status).toBe(403);

      const technician = await request(app)
        .post(`/api/v1/attendance/sessions/${sched1Id}`)
        .set('Authorization', `Bearer ${technicianToken}`)
        .send({ records: [{ studentId: studentAProfileId, status: 'PRESENT' }] });
      expect(technician.status).toBe(403);
    });

    it('TEACHER que não é o titular → 403', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/sessions/${sched1Id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ records: [{ studentId: studentAProfileId, status: 'PRESENT' }] });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('validação: lista vazia, estado inválido e sessão inexistente', async () => {
      const empty = await request(app)
        .post(`/api/v1/attendance/sessions/${sched1Id}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ records: [] });
      expect(empty.status).toBe(400);
      expect(empty.body.code).toBe('VALIDATION_ERROR');

      const badStatus = await request(app)
        .post(`/api/v1/attendance/sessions/${sched1Id}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ records: [{ studentId: studentAProfileId, status: 'DORMIU' }] });
      expect(badStatus.status).toBe(400);
      expect(badStatus.body.code).toBe('VALIDATION_ERROR');

      const missingSchedule = await request(app)
        .post('/api/v1/attendance/sessions/nao-existe')
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ records: [{ studentId: studentAProfileId, status: 'PRESENT' }] });
      expect(missingSchedule.status).toBe(404);
      expect(missingSchedule.body.code).toBe('SCHEDULE_NOT_FOUND');

      const missingStudent = await request(app)
        .post(`/api/v1/attendance/sessions/${sched1Id}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ records: [{ studentId: 'nao-existe', status: 'PRESENT' }] });
      expect(missingStudent.status).toBe(404);
      expect(missingStudent.body.code).toBe('STUDENT_NOT_FOUND');
    });

    it('estudante de outro curso → 409 STUDENT_COURSE_MISMATCH', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/sessions/${tmpSchedId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ records: [{ studentId: studentAProfileId, status: 'PRESENT' }] });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('STUDENT_COURSE_MISMATCH');
    });

    it('docente titular registra presenças e a pauta reflecte o estado', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/sessions/${sched1Id}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({
          records: [
            { studentId: studentAProfileId, status: 'PRESENT' },
            { studentId: studentBProfileId, status: 'LATE', note: 'Chegou 10 min atrasado' },
          ],
        });
      expect(res.status).toBe(200);

      const a = res.body.data.entries.find((e: { id: string }) => e.id === studentAProfileId);
      const b = res.body.data.entries.find((e: { id: string }) => e.id === studentBProfileId);
      expect(a.status).toBe('PRESENT');
      expect(b.status).toBe('LATE');
      expect(b.note).toBe('Chegou 10 min atrasado');
      expect(b.attendanceId).toBeTruthy();
    });

    it('voltar a registar atualiza (upsert) em vez de duplicar', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/sessions/${sched2Id}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ records: [{ studentId: studentAProfileId, status: 'ABSENT' }] });
      expect(res.status).toBe(200);

      const again = await request(app)
        .post(`/api/v1/attendance/sessions/${sched2Id}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ records: [{ studentId: studentAProfileId, status: 'JUSTIFIED' }] });
      expect(again.status).toBe(200);
      expect(again.body.data.entries.find((e: { id: string }) => e.id === studentAProfileId).status).toBe('JUSTIFIED');

      const count = await prisma.attendance.count({ where: { classScheduleId: sched2Id } });
      expect(count).toBe(1);
    });

    it('deixa registo de auditoria ATTENDANCE_MARK', async () => {
      const event = await prisma.auditEvent.findFirst({ where: { action: 'ATTENDANCE_MARK', resourceId: sched1Id } });
      expect(event).not.toBeNull();
      expect(event?.resource).toBe('Attendance');
    });
  });

  describe('GET /attendance — consulta e scoping', () => {
    it('STUDENT vê apenas os próprios registos', async () => {
      const res = await request(app).get('/api/v1/attendance').set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.every((r: { studentProfileId: string }) => r.studentProfileId === studentAProfileId)).toBe(true);
      expect(res.body.data.every((r: { classSchedule: { title: string } }) => r.classSchedule.title.startsWith(prefix))).toBe(true);
    });

    it('STUDENT a filtrar por outro estudante → 403 (anti-BOLA)', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance?studentId=${studentBProfileId}`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('TEACHER vê apenas as sessões que leciona', async () => {
      const res = await request(app).get('/api/v1/attendance').set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((r: { classScheduleId: string }) => r.classScheduleId === sched1Id)).toBe(false);

      const owner = await request(app).get('/api/v1/attendance').set('Authorization', `Bearer ${teacher2Token}`);
      expect(owner.status).toBe(200);
      expect(owner.body.data.some((r: { classScheduleId: string }) => r.classScheduleId === sched1Id)).toBe(true);
    });

    it('COORDINATOR filtra por sessão e estado', async () => {
      const bySchedule = await request(app)
        .get(`/api/v1/attendance?scheduleId=${sched1Id}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(bySchedule.status).toBe(200);
      expect(bySchedule.body.data.length).toBe(2);
      expect(bySchedule.body.data.every((r: { classScheduleId: string }) => r.classScheduleId === sched1Id)).toBe(true);

      const byStatus = await request(app)
        .get(`/api/v1/attendance?status=PRESENT`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(byStatus.status).toBe(200);
      expect(byStatus.body.data.every((r: { status: string }) => r.status === 'PRESENT')).toBe(true);
    });

    it('estado inválido no query → 400 VALIDATION_ERROR (GET /attendance e /summary)', async () => {
      const list = await request(app)
        .get('/api/v1/attendance?status=QUALQUER_ESTADO')
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(list.status).toBe(400);
      expect(list.body.code).toBe('VALIDATION_ERROR');

      const summary = await request(app)
        .get('/api/v1/attendance/summary?status=BOGUS')
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(summary.status).toBe(400);
      expect(summary.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /attendance/summary — taxas', () => {
    it('STUDENT vê o próprio resumo', async () => {
      const res = await request(app).get('/api/v1/attendance/summary').set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      const row = res.body.data[0];
      expect(row.studentProfileId).toBe(studentAProfileId);
      expect(row.present).toBe(1);
      expect(row.justified).toBe(1);
      expect(row.total).toBe(2);
      expect(row.attendanceRate).toBe(50);
    });

    it('COORDINATOR vê o resumo de toda a turma com taxa parcial', async () => {
      const res = await request(app).get('/api/v1/attendance/summary').set('Authorization', `Bearer ${coordinatorToken}`);
      expect(res.status).toBe(200);
      const a = res.body.data.find((r: { studentProfileId: string }) => r.studentProfileId === studentAProfileId);
      const b = res.body.data.find((r: { studentProfileId: string }) => r.studentProfileId === studentBProfileId);
      expect(a.total).toBe(2);
      expect(a.attendanceRate).toBe(50);
      expect(a.studentNumber).toBe('EST-2026-001');
      expect(b.total).toBe(1);
      expect(b.late).toBe(1);
      expect(b.attendanceRate).toBe(100);
    });

    it('ABSENT e JUSTIFIED não contam como presença (taxa 0%)', async () => {
      const mark = await request(app)
        .post(`/api/v1/attendance/sessions/${sched1Id}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ records: [{ studentId: studentAProfileId, status: 'ABSENT' }] });
      expect(mark.status).toBe(200);

      const res = await request(app)
        .get(`/api/v1/attendance/summary?studentId=${studentAProfileId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(res.status).toBe(200);
      const row = res.body.data.find((r: { studentProfileId: string }) => r.studentProfileId === studentAProfileId);
      expect(row.present).toBe(0);
      expect(row.absent).toBe(1);
      expect(row.justified).toBe(1);
      expect(row.total).toBe(2);
      expect(row.attendanceRate).toBe(0);

      await request(app)
        .post(`/api/v1/attendance/sessions/${sched1Id}`)
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ records: [{ studentId: studentAProfileId, status: 'PRESENT' }] });
    });
  });
});
