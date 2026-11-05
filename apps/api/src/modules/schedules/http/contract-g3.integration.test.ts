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

describe('Contrato G3 — Financeiro ↔ Avaliações e Horários (03-financeiro-avaliacoes-horarios.md)', () => {
  let studentAToken = '';
  let studentBToken = '';
  let teacherToken = '';
  let teacher2Token = '';
  let coordinatorToken = '';
  let technicianToken = '';
  let adminToken = '';

  let studentAProfileId = '';
  let studentBProfileId = '';
  let studentAUserId = '';
  let subjectId = '';
  let courseId = '';
  let teacherUserId = '';
  let teacher2UserId = '';
  let roomId = '';

  let assessmentId = '';
  let createdScheduleId = '';
  let resultId = '';

  const scheduleTitle = `Horário contrato-G3-${Date.now()}`;
  const resultAssessmentTitle = `Avaliação contrato-G3-${Date.now()}`;

  beforeAll(async () => {
    studentAToken = await loginAs('estudante@smartcampus.demo', 'Estudante123!');
    studentBToken = await loginAs('estudante2@smartcampus.demo', 'Estudante123!');
    teacherToken = await loginAs('docente@smartcampus.demo', 'Docente123!');
    teacher2Token = await loginAs('docente2@smartcampus.demo', 'Docente123!');
    coordinatorToken = await loginAs('coordenador@smartcampus.demo', 'Coord123!');
    technicianToken = await loginAs('tecnico@smartcampus.demo', 'Tecnico123!');
    adminToken = await loginAs('admin@smartcampus.demo', 'Admin123!');

    const subject = await prisma.subject.findUnique({ where: { code: 'PTP3' } });
    const profileA = await prisma.studentProfile.findUnique({ where: { studentNumber: 'EST-2026-001' } });
    const profileB = await prisma.studentProfile.findUnique({ where: { studentNumber: 'EST-2026-002' } });
    const teacherUser = await prisma.user.findUnique({ where: { email: 'docente@smartcampus.demo' } });
    const teacher2User = await prisma.user.findUnique({ where: { email: 'docente2@smartcampus.demo' } });
    const room = await prisma.room.findFirst({ where: { code: 'D2-101' } });
    if (!subject || !profileA || !profileB || !teacherUser || !teacher2User || !room) {
      throw new Error('Seed necessário antes dos testes (npm run db:seed)');
    }
    subjectId = subject.id;
    courseId = subject.courseId;
    studentAProfileId = profileA.id;
    studentBProfileId = profileB.id;
    studentAUserId = profileA.userId;
    teacherUserId = teacherUser.id;
    teacher2UserId = teacher2User.id;
    roomId = room.id;

    const assessment = await prisma.assessment.create({
      data: {
        title: resultAssessmentTitle,
        subjectId,
        type: 'TEST',
        gradingMode: 'PERCENTAGE',
        weight: 5,
        maxScore: 100,
        createdById: teacherUserId,
      },
    });
    assessmentId = assessment.id;

    // Nota pré-existente para o estudante A (GET /results precisa de resultados antes do POST).
    await prisma.grade.create({
      data: {
        assessmentId: assessment.id,
        studentId: studentAProfileId,
        value: 16,
        valuePercent: 80,
        gradedById: teacherUserId,
      },
    });
  });

  afterAll(async () => {
    await prisma.grade.deleteMany({ where: { assessmentId } }).catch(() => undefined);
    if (assessmentId) await prisma.assessment.delete({ where: { id: assessmentId } }).catch(() => undefined);
    if (createdScheduleId) await prisma.classSchedule.delete({ where: { id: createdScheduleId } }).catch(() => undefined);
  });

  describe('GET /schedules — horários', () => {
    it('sem token → 401', async () => {
      const res = await request(app).get('/api/v1/schedules');
      expect(res.status).toBe(401);
      expect(res.body.correlationId).toBeTruthy();
    });

    it('TECHNICIAN → 403 (matriz de roles do contrato)', async () => {
      const res = await request(app).get('/api/v1/schedules').set('Authorization', `Bearer ${technicianToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('STUDENT vê horários do próprio curso (200) e com ?studentId de outro estudante → 403 (anti-BOLA)', async () => {
      const own = await request(app).get('/api/v1/schedules').set('Authorization', `Bearer ${studentAToken}`);
      expect(own.status).toBe(200);
      expect(Array.isArray(own.body.data)).toBe(true);
      expect(own.body.data.length).toBeGreaterThan(0);
      expect(own.body.data.every((s: { courseId: string }) => s.courseId === courseId)).toBe(true);

      const other = await request(app)
        .get(`/api/v1/schedules?studentId=${studentBProfileId}`)
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(other.status).toBe(403);
      expect(other.body.code).toBe('FORBIDDEN');
    });

    it('STUDENT B não vê sessões do docente de fora do seu curso-sessão é filtrada por curso (200)', async () => {
      const res = await request(app).get('/api/v1/schedules').set('Authorization', `Bearer ${studentBToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every((s: { courseId: string }) => s.courseId === courseId)).toBe(true);
    });

    it('TEACHER vê apenas sessões onde é docente (200)', async () => {
      const res = await request(app).get('/api/v1/schedules').set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every((s: { teacherId: string | null }) => s.teacherId === teacherUserId)).toBe(true);
    });

    it('COORDINATOR e ADMIN veem todos os horários (200)', async () => {
      const coord = await request(app).get('/api/v1/schedules').set('Authorization', `Bearer ${coordinatorToken}`);
      expect(coord.status).toBe(200);

      const admin = await request(app).get('/api/v1/schedules').set('Authorization', `Bearer ${adminToken}`);
      expect(admin.status).toBe(200);
    });

    it('COORDINATOR com ?studentId resolve o curso do estudante (200, filtrado por curso)', async () => {
      const res = await request(app)
        .get(`/api/v1/schedules?studentId=${studentBProfileId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every((s: { courseId: string }) => s.courseId === courseId)).toBe(true);
    });
  });

  describe('POST/PATCH /schedules — gestão de horários (COORDINATOR)', () => {
    it('STUDENT e TEACHER não criam horários (403)', async () => {
      const student = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ title: 'Tentativa', subjectId, courseId, startsAt: new Date(), endsAt: new Date(Date.now() + 3600000) });
      expect(student.status).toBe(403);

      const teacher = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Tentativa', subjectId, courseId, startsAt: new Date(), endsAt: new Date(Date.now() + 3600000) });
      expect(teacher.status).toBe(403);
    });

    it('COORDINATOR cria horário (201) com identidades de subjectId/courseId/teacherId/roomId', async () => {
      const start = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const res = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          title: scheduleTitle,
          subjectId,
          courseId,
          teacherId: teacher2UserId,
          roomId,
          startsAt: start.toISOString(),
          endsAt: new Date(start.getTime() + 90 * 60 * 1000).toISOString(),
        });
      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe(scheduleTitle);
      expect(res.body.data.subjectId).toBe(subjectId);
      expect(res.body.data.courseId).toBe(courseId);
      expect(res.body.data.teacherId).toBe(teacher2UserId);
      expect(res.body.data.roomId).toBe(roomId);
      createdScheduleId = res.body.data.id;
    });

    it('POST /schedules valida datas (400) e referências inexistentes (404)', async () => {
      const badDates = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ title: 'Datas invertidas', subjectId, courseId, startsAt: new Date(), endsAt: new Date(Date.now() - 3600000) });
      expect(badDates.status).toBe(400);
      expect(badDates.body.code).toBe('VALIDATION_ERROR');

      const badSubject = await request(app)
        .post('/api/v1/schedules')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ title: 'Referência inválida', subjectId: 'no-such-subject', courseId, startsAt: new Date(), endsAt: new Date(Date.now() + 3600000) });
      expect(badSubject.status).toBe(404);
      expect(badSubject.body.code).toBe('SUBJECT_NOT_FOUND');
    });

    it('PATCH /schedules/:id — COORDINATOR atualiza (200), TEACHER recebe 403, id inexistente → 404', async () => {
      const patch = await request(app)
        .patch(`/api/v1/schedules/${createdScheduleId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ title: `${scheduleTitle} (editado)` });
      expect(patch.status).toBe(200);
      expect(patch.body.data.title).toBe(`${scheduleTitle} (editado)`);

      const teacherPatch = await request(app)
        .patch(`/api/v1/schedules/${createdScheduleId}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Não pode' });
      expect(teacherPatch.status).toBe(403);

      const missing = await request(app)
        .patch('/api/v1/schedules/nao-existe')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ title: 'XYZ' });
      expect(missing.status).toBe(404);
    });
  });

  describe('GET /results — resultados de avaliação', () => {
    it('sem token → 401 e TECHNICIAN → 403', async () => {
      const noToken = await request(app).get('/api/v1/results');
      expect(noToken.status).toBe(401);

      const tech = await request(app).get('/api/v1/results').set('Authorization', `Bearer ${technicianToken}`);
      expect(tech.status).toBe(403);
    });

    it('STUDENT vê os próprios resultados com studentProfileId e studentUserId resolvidos (200)', async () => {
      const res = await request(app).get('/api/v1/results').set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      for (const r of res.body.data) {
        expect(r.studentProfileId).toBe(studentAProfileId);
        expect(r.studentUserId).toBe(studentAUserId);
        expect(typeof r.valuePercent).toBe('number');
      }
    });

    it('anti-BOLA: STUDENT A com ?studentId de B → 403', async () => {
      const res = await request(app)
        .get(`/api/v1/results?studentId=${studentBProfileId}`)
        .set('Authorization', `Bearer ${studentAToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('TEACHER vê resultados das suas disciplinas (200)', async () => {
      const res = await request(app).get('/api/v1/results').set('Authorization', `Bearer ${teacherToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('COORDINATOR filtra por ?studentId (StudentProfile.id) e id inexistente → 404', async () => {
      const res = await request(app)
        .get(`/api/v1/results?studentId=${studentBProfileId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.every((r: { studentProfileId: string }) => r.studentProfileId === studentBProfileId)).toBe(true);

      const missing = await request(app)
        .get('/api/v1/results?studentId=nao-existe')
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe('STUDENT_NOT_FOUND');
    });
  });

  describe('POST /results — criação de resultados (TEACHER)', () => {
    it('STUDENT não cria resultados (403)', async () => {
      const res = await request(app)
        .post('/api/v1/results')
        .set('Authorization', `Bearer ${studentAToken}`)
        .send({ assessmentId, studentId: studentAProfileId, value: 16 });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('TEACHER de outra disciplina não cria resultado (403 anti-BOLA)', async () => {
      // Atribuição docente↔disciplina é feita por ClassSchedule: remove a sessão
      // criada mais acima para garantir que docente2 já não está em PTP3.
      await prisma.classSchedule.deleteMany({ where: { teacherId: teacher2UserId, subjectId } });
      const res = await request(app)
        .post('/api/v1/results')
        .set('Authorization', `Bearer ${teacher2Token}`)
        .send({ assessmentId, studentId: studentAProfileId, value: 16 });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('TEACHER cria resultado (201): pedido usa StudentProfile.id e resposta devolve studentUserId', async () => {
      const res = await request(app)
        .post('/api/v1/results')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ assessmentId, studentId: studentAProfileId, value: 16, comment: 'Contrato G3' });
      expect(res.status).toBe(201);
      expect(res.body.data.assessmentId).toBe(assessmentId);
      expect(res.body.data.studentProfileId).toBe(studentAProfileId);
      expect(res.body.data.studentUserId).toBe(studentAUserId);
      expect(res.body.data.value).toBe(16);
      expect(res.body.data.valuePercent).toBe(80);
      expect(res.body.data.gradedById).toBe(teacherUserId);
      expect(res.body.meta.correlationId).toBeTruthy();
      resultId = res.body.data.id;
    });

    it('validação: nota fora do intervalo → 400 INVALID_GRADE_VALUE; ids inexistentes → 404', async () => {
      const outOfRange = await request(app)
        .post('/api/v1/results')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ assessmentId, studentId: studentAProfileId, value: 150 });
      expect(outOfRange.status).toBe(400);
      expect(outOfRange.body.code).toBe('INVALID_GRADE_VALUE');

      const badAssessment = await request(app)
        .post('/api/v1/results')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ assessmentId: 'nao-existe', studentId: studentAProfileId, value: 10 });
      expect(badAssessment.status).toBe(404);
      expect(badAssessment.body.code).toBe('ASSESSMENT_NOT_FOUND');

      const badStudent = await request(app)
        .post('/api/v1/results')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ assessmentId, studentId: 'nao-existe', value: 10 });
      expect(badStudent.status).toBe(404);
      expect(badStudent.body.code).toBe('STUDENT_NOT_FOUND');
    });

    it('idempotente: repetir o mesmo (assessmentId, studentId) atualiza em vez de duplicar', async () => {
      const res = await request(app)
        .post('/api/v1/results')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ assessmentId, studentId: studentAProfileId, value: 18 });
      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe(resultId);
      expect(res.body.data.value).toBe(18);

      const count = await prisma.grade.count({ where: { assessmentId, studentId: studentAProfileId } });
      expect(count).toBe(1);
    });
  });
});
