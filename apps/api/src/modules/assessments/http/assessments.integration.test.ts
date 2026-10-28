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

describe('Módulo Avaliações — RBAC (Semana 5) e testes (Semana 6)', () => {
  let teacherToken = '';
  let teacher2Token = '';
  let studentAToken = '';
  let coordinatorToken = '';
  let subjectId = '';
  let studentAProfileId = '';
  let studentBProfileId = '';
  let assessmentId = '';
  let seedAssessmentId = '';
  const defaultGradeIds: string[] = [];

  const testTitle = `Teste automatizado-${Date.now()}`;

  beforeAll(async () => {
    teacherToken = await loginAs('docente@smartcampus.demo', 'Docente123!');
    teacher2Token = await loginAs('docente2@smartcampus.demo', 'Docente123!');
    studentAToken = await loginAs('estudante@smartcampus.demo', 'Estudante123!');
    coordinatorToken = await loginAs('coordenador@smartcampus.demo', 'Coord123!');

    const subject = await prisma.subject.findUnique({ where: { code: 'PTP3' } });
    if (!subject) throw new Error('Seed necessário antes dos testes (npm run db:seed)');
    subjectId = subject.id;

    // Garante estado conhecido: remove apenas avaliações desta própria suite.
    await prisma.grade.deleteMany({ where: { assessment: { subjectId, title: { startsWith: 'Teste automatizado-' } } } });
    await prisma.assessment.deleteMany({ where: { subjectId, title: { startsWith: 'Teste automatizado-' } } });

    const profileA = await prisma.studentProfile.findUnique({ where: { studentNumber: 'EST-2026-001' } });
    const profileB = await prisma.studentProfile.findUnique({ where: { studentNumber: 'EST-2026-002' } });
    if (!profileA || !profileB) throw new Error('Perfis de estudante A e B em falta no seed');
    studentAProfileId = profileA.id;
    studentBProfileId = profileB.id;

    // Garante pelo menos uma avaliação existente para o estudante visualizar.
    const teacherUser = await prisma.user.findUnique({ where: { email: 'docente@smartcampus.demo' } });
    if (!teacherUser) throw new Error('Docente em falta no seed');
    const seedAssessment = await prisma.assessment.create({
      data: {
        title: `${testTitle}-seed`,
        subjectId,
        type: 'TEST',
        gradingMode: 'PERCENTAGE',
        maxScore: 100,
        weight: 10,
        createdById: teacherUser.id,
      },
    });
    seedAssessmentId = seedAssessment.id;

    // Nota lançada ao estudante A nesta avaliação (para a pauta/final ficarem completos).
    await prisma.grade.create({
      data: {
        assessmentId: seedAssessment.id,
        studentId: studentAProfileId,
        value: 16,
        valuePercent: 80,
        gradedById: teacherUser.id,
      },
    });

    // Avaliações contínuas padrão (seed): Teste 1 (50%) + Teste 2 (50%) = 100%.
    // Garante que existem e que A está classificado nelas (regra dos 100% dos pesos).
    for (const title of ['Teste 1', 'Teste 2']) {
      const existing = await prisma.assessment.findFirst({ where: { subjectId, title } });
      const assessment =
        existing ??
        (await prisma.assessment.create({
          data: {
            title,
            subjectId,
            type: 'TEST',
            gradingMode: 'SCALE',
            maxScore: 20,
            weight: 50,
            createdById: teacherUser.id,
          },
        }));
      await prisma.grade.deleteMany({ where: { assessmentId: assessment.id, studentId: studentAProfileId } });
      const grade = await prisma.grade.create({
        data: {
          assessmentId: assessment.id,
          studentId: studentAProfileId,
          value: 16,
          valuePercent: 80,
          gradedById: teacherUser.id,
        },
      });
      defaultGradeIds.push(grade.id);
    }
  });

  afterAll(async () => {
    const ids = [assessmentId, seedAssessmentId].filter(Boolean);
    if (ids.length) {
      await prisma.grade.deleteMany({ where: { assessmentId: { in: ids } } });
      await prisma.assessment.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    }
    if (defaultGradeIds.length) {
      await prisma.grade.deleteMany({ where: { id: { in: defaultGradeIds } } });
    }
  });

  it('GET /assessments sem token devolve 401 UNAUTHENTICATED', async () => {
    const res = await request(app).get('/api/v1/assessments');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(res.body.correlationId).toBeTruthy();
  });

  it('GET /assessments com token inválido devolve 401', async () => {
    const res = await request(app)
      .get('/api/v1/assessments')
      .set('Authorization', 'Bearer token.assinar.mutado');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_INVALID');
  });

  it('GET /assessments: STUDENT vê as avaliações do seu curso (200), TECHNICIAN recebe 403', async () => {
    const studentRes = await request(app)
      .get('/api/v1/assessments')
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(studentRes.status).toBe(200);
    expect(Array.isArray(studentRes.body.data)).toBe(true);
    expect(studentRes.body.data.length).toBeGreaterThan(0);
    expect(studentRes.body.data.every((a: { subject: { courseId: string } }) => !!a.subject)).toBe(true);

    const technicianToken = await loginAs('tecnico@smartcampus.demo', 'Tecnico123!');
    const technicianRes = await request(app)
      .get('/api/v1/assessments')
      .set('Authorization', `Bearer ${technicianToken}`);
    expect(technicianRes.status).toBe(403);
  });

  it('GET /assessments devolve 200 para TEACHER, COORDINATOR e ADMIN', async () => {
    const teacherRes = await request(app)
      .get('/api/v1/assessments')
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(teacherRes.status).toBe(200);
    expect(Array.isArray(teacherRes.body.data)).toBe(true);

    const coordRes = await request(app)
      .get('/api/v1/assessments')
      .set('Authorization', `Bearer ${coordinatorToken}`);
    expect(coordRes.status).toBe(200);
  });

  it('POST /assessments: o docente cria um teste com peso (201)', async () => {
    const res = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        title: testTitle,
        description: 'Criado pela suite automatizada',
        subjectId,
        type: 'TEST',
        gradingMode: 'PERCENTAGE',
        weight: 30,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe(testTitle);
    expect(res.body.data.weight).toBe(30);
    expect(res.body.data.type).toBe('TEST');
    expect(res.body.data.createdById).toBeTruthy();
    assessmentId = res.body.data.id;
  });

  it('POST /assessments devolve 401 sem token e 403 para STUDENT', async () => {
    const noToken = await request(app)
      .post('/api/v1/assessments')
      .send({ title: 'X', subjectId, weight: 10 });
    expect(noToken.status).toBe(401);

    const studentRes = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ title: 'Tentativa estudante', subjectId, weight: 10 });
    expect(studentRes.status).toBe(403);
    expect(studentRes.body.code).toBe('FORBIDDEN');
  });

  it('POST /assessments devolve 400 para peso inválido (validação)', async () => {
    const res = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: 'Peso zero', subjectId, weight: 0 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /assessments/:id — o docente dono altera o peso (200) e outro docente recebe 403 (anti-BOLA escrita)', async () => {
    const ownerRes = await request(app)
      .patch(`/api/v1/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ weight: 35 });
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.data.weight).toBe(35);

    // Verificação de posse: apps/api/.../assessmentService.ts → assertCanManageAssessment()
    const otherTeacherRes = await request(app)
      .patch(`/api/v1/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${teacher2Token}`)
      .send({ weight: 99 });
    expect(otherTeacherRes.status).toBe(403);
    expect(otherTeacherRes.body.code).toBe('FORBIDDEN');

    const coordRes = await request(app)
      .patch(`/api/v1/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ weight: 30 });
    expect(coordRes.status).toBe(200);
  });

  it('POST /assessments/:id/grades — normaliza percentagem, pontos (aritmética) e escala', async () => {
    const percentageRes = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ grades: [{ studentId: studentAProfileId, value: 16 }] });
    expect(percentageRes.status).toBe(201);
    expect(percentageRes.body.data[0].valuePercent).toBe(80);

    const pointsAssessment = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: `${testTitle}-pontos`, subjectId, type: 'PRACTICAL', gradingMode: 'POINTS', maxScore: 20, weight: 10 });
    expect(pointsAssessment.status).toBe(201);
    const pointsId = pointsAssessment.body.data.id;

    const pointsRes = await request(app)
      .post(`/api/v1/assessments/${pointsId}/grades`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ grades: [{ studentId: studentAProfileId, value: 16 }] });
    expect(pointsRes.status).toBe(201);
    expect(pointsRes.body.data[0].value).toBe(16);
    expect(pointsRes.body.data[0].valuePercent).toBe(80);

    const scaleAssessment = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: `${testTitle}-escala`, subjectId, type: 'ASSIGNMENT', gradingMode: 'SCALE', maxScore: 20, weight: 10 });
    expect(scaleAssessment.status).toBe(201);
    const scaleId = scaleAssessment.body.data.id;

    const scaleRes = await request(app)
      .post(`/api/v1/assessments/${scaleId}/grades`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ grades: [{ studentId: studentAProfileId, value: 16 }] });
    expect(scaleRes.status).toBe(201);
    expect(scaleRes.body.data[0].valuePercent).toBe(80);

    await prisma.grade.deleteMany({ where: { assessmentId: { in: [pointsId, scaleId] } } });
    await prisma.assessment.deleteMany({ where: { id: { in: [pointsId, scaleId] } } });
  });

  it('POST /assessments/:id/grades rejeita nota fora do intervalo (400)', async () => {
    const res = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ grades: [{ studentId: studentAProfileId, value: 150 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_GRADE_VALUE');
  });

  it('PATCH /assessments/:id bloqueia alterar modo/escala depois de notas lançadas (409 GRADING_RULES_LOCKED)', async () => {
    const changeMode = await request(app)
      .patch(`/api/v1/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ gradingMode: 'SCALE' });
    expect(changeMode.status).toBe(409);
    expect(changeMode.body.code).toBe('GRADING_RULES_LOCKED');

    const changeScale = await request(app)
      .patch(`/api/v1/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ maxScore: 50 });
    expect(changeScale.status).toBe(409);
    expect(changeScale.body.code).toBe('GRADING_RULES_LOCKED');

    // Alterar apenas o título continua permitido mesmo com notas lançadas.
    const titleOnly = await request(app)
      .patch(`/api/v1/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: `${testTitle} (revisto)` });
    expect(titleOnly.status).toBe(200);
    expect(titleOnly.body.data.title).toBe(`${testTitle} (revisto)`);
  });

  it('anti-BOLA leitura: STUDENT A não lê as notas de STUDENT B (403), mas lê as suas (200)', async () => {
    // Verificação de posse: apps/api/.../assessmentService.ts → assertStudentDataAccess()
    const readB = await request(app)
      .get(`/api/v1/students/${studentBProfileId}/grades`)
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(readB.status).toBe(403);
    expect(readB.body.code).toBe('FORBIDDEN');

    const writeB = await request(app)
      .get(`/api/v1/students/${studentBProfileId}/final-grades`)
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(writeB.status).toBe(403);

    const readOwn = await request(app)
      .get(`/api/v1/students/${studentAProfileId}/grades`)
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(readOwn.status).toBe(200);

    const myGrades = await request(app).get('/api/v1/my/grades').set('Authorization', `Bearer ${studentAToken}`);
    expect(myGrades.status).toBe(200);
    expect(myGrades.body.data.length).toBeGreaterThan(0);
    expect(myGrades.body.data.every((g: { studentId: string }) => g.studentId === studentAProfileId)).toBe(true);
  });

  it('anti-BOLA escrita: STUDENT não lança notas (403) e docente 2 não lança na avaliação do docente 1 (403)', async () => {
    const studentWrite = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ grades: [{ studentId: studentAProfileId, value: 100 }] });
    expect(studentWrite.status).toBe(403);
    expect(studentWrite.body.code).toBe('FORBIDDEN');

    // Verificação de posse: apps/api/.../assessmentService.ts → assertCanManageAssessment()
    const otherTeacherWrite = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .set('Authorization', `Bearer ${teacher2Token}`)
      .send({ grades: [{ studentId: studentAProfileId, value: 100 }] });
    expect(otherTeacherWrite.status).toBe(403);
  });

  it('criação de avaliação e lançamento de notas são exclusivos do docente da disciplina (403)', async () => {
    // COORDINATOR não cria avaliações nem lança notas — só o docente da disciplina.
    const coordCreate = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ title: 'Coordenador não deve criar', subjectId, weight: 10 });
    expect(coordCreate.status).toBe(403);
    expect(coordCreate.body.code).toBe('FORBIDDEN');

    const coordGrade = await request(app)
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ grades: [{ studentId: studentAProfileId, value: 50 }] });
    expect(coordGrade.status).toBe(403);

    // Docente sem atribuição na disciplina (docente2) recebe 403.
    const teacher2Create = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${teacher2Token}`)
      .send({ title: 'Docente 2 fora da disciplina', subjectId, weight: 10 });
    expect(teacher2Create.status).toBe(403);
    expect(teacher2Create.body.code).toBe('FORBIDDEN');

    // POST /results também é exclusivo do docente.
    const coordResult = await request(app)
      .post('/api/v1/results')
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ assessmentId, studentId: studentAProfileId, value: 50 });
    expect(coordResult.status).toBe(403);
  });

  it('estudante DISPENSADO não pode receber nota de exame nem recorrência (409 STUDENT_DISPENSADO)', async () => {
    // Estudante A: média 80% → nota inteira 16 → DISPENSADO.
    const exam = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: `${testTitle}-exame`, subjectId, type: 'EXAM', gradingMode: 'SCALE', weight: 10 });
    expect(exam.status).toBe(201);
    const examId = exam.body.data.id;

    const blockedA = await request(app)
      .post(`/api/v1/assessments/${examId}/grades`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ grades: [{ studentId: studentAProfileId, value: 18 }] });
    expect(blockedA.status).toBe(409);
    expect(blockedA.body.code).toBe('STUDENT_DISPENSADO');

    // Recorrência: mesmo bloqueio.
    const recurrence = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ title: `${testTitle}-recorrencia`, subjectId, type: 'RECURRENCE', gradingMode: 'SCALE', weight: 5 });
    expect(recurrence.status).toBe(201);
    const recurrenceId = recurrence.body.data.id;

    const blockedRec = await request(app)
      .post(`/api/v1/assessments/${recurrenceId}/grades`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ grades: [{ studentId: studentAProfileId, value: 15 }] });
    expect(blockedRec.status).toBe(409);
    expect(blockedRec.body.code).toBe('STUDENT_DISPENSADO');

    // Estudante B não está dispensado (notas incompletas) → exame permitido.
    const allowedB = await request(app)
      .post(`/api/v1/assessments/${examId}/grades`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ grades: [{ studentId: studentBProfileId, value: 14 }] });
    expect(allowedB.status).toBe(201);

    await prisma.grade.deleteMany({ where: { assessmentId: { in: [examId, recurrenceId] } } });
    await prisma.assessment.deleteMany({ where: { id: { in: [examId, recurrenceId] } } });
  });

  it('situação fica em aberto enquanto os pesos contínuos não somam 100%', async () => {
    const t1 = await prisma.assessment.findFirst({ where: { subjectId, title: 'Teste 1' } });
    const t2 = await prisma.assessment.findFirst({ where: { subjectId, title: 'Teste 2' } });
    if (!t1 || !t2) throw new Error('Avaliações padrão Teste 1/Teste 2 em falta');

    // Limpa requiredTestCount para testar a regra dos pesos.
    const clearRes = await request(app)
      .patch(`/api/v1/assessments/subject/${subjectId}/required-test-count`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ requiredTestCount: null });
    expect(clearRes.status).toBe(200);
    expect(clearRes.body.data.requiredTestCount).toBeNull();

    // Reduz os pesos para 10+10 (+10 seed +30 principal = 60 < 100) → nada classificado.
    for (const [id, weight] of [[t1.id, 10], [t2.id, 10]] as const) {
      const res = await request(app)
        .patch(`/api/v1/assessments/${id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ weight });
      expect(res.status).toBe(200);
    }

    const open = await request(app)
      .get(`/api/v1/assessments/${assessmentId}/roster`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(open.status).toBe(200);
    const entryA = (open.body.data.entries as Array<{ studentProfileId: string; situacao: string | null }>).find(
      (e) => e.studentProfileId === studentAProfileId,
    );
    expect(entryA?.situacao).toBeNull();

    // Repõe os pesos padrão (50+50 = 100%) e requiredTestCount para os testes seguintes.
    for (const [id, weight] of [[t1.id, 50], [t2.id, 50]] as const) {
      const res = await request(app)
        .patch(`/api/v1/assessments/${id}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ weight });
      expect(res.status).toBe(200);
    }
    await request(app)
      .patch(`/api/v1/assessments/subject/${subjectId}/required-test-count`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ requiredTestCount: 2 });
  });

  it('roster devolve a situação académica de cada estudante', async () => {
    const res = await request(app)
      .get(`/api/v1/assessments/${assessmentId}/roster`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    const entries = res.body.data.entries as Array<{ studentProfileId: string; situacao: string | null }>;
    const entryA = entries.find((e) => e.studentProfileId === studentAProfileId);
    const entryB = entries.find((e) => e.studentProfileId === studentBProfileId);
    // A: todas as avaliações contínuas com nota → DISPENSADO (80% → 16).
    expect(entryA?.situacao).toBe('DISPENSADO');
    // B: avaliações por lançar → situação ainda não calculada.
    expect(entryB?.situacao).toBeNull();
  });

  it('nota final inteira calculada automaticamente: estudante A fica DISPENSADO com 16', async () => {
    const res = await request(app)
      .get(`/api/v1/students/${studentAProfileId}/final-grades`)
      .set('Authorization', `Bearer ${studentAToken}`);
    expect(res.status).toBe(200);
    const ptp3 = res.body.data.find((s: { subjectCode: string }) => s.subjectCode === 'PTP3');
    expect(ptp3).toBeTruthy();
    expect(ptp3.complete).toBe(true);
    expect(ptp3.finalGrade).toBe(16);
    expect(ptp3.status).toBe('DISPENSADO');
    expect(ptp3.totalWeight).toBeGreaterThan(0);
    expect(ptp3.breakdown.length).toBeGreaterThan(0);
  });

  it('estudante B (notas incompletas) tem finalGrade null e complete false', async () => {
    const res = await request(app)
      .get(`/api/v1/students/${studentBProfileId}/final-grades`)
      .set('Authorization', `Bearer ${coordinatorToken}`);
    expect(res.status).toBe(200);
    const ptp3 = res.body.data.find((s: { subjectCode: string }) => s.subjectCode === 'PTP3');
    expect(ptp3.complete).toBe(false);
    expect(ptp3.finalGrade).toBeNull();
    expect(ptp3.status).toBeNull();
  });

  it('docente define número de testes e situação aparece ao completar', async () => {
    // Define requiredTestCount = 1 para PTP3.
    const setRes = await request(app)
      .patch(`/api/v1/assessments/subject/${subjectId}/required-test-count`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ requiredTestCount: 1 });
    expect(setRes.status).toBe(200);
    expect(setRes.body.data.requiredTestCount).toBe(1);

    // Com 1 teste lançado (seed assessment), a situação deve aparecer mesmo com pesos < 100%.
    const rosterRes = await request(app)
      .get(`/api/v1/assessments/${seedAssessmentId}/roster`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(rosterRes.status).toBe(200);
    const entryA = (rosterRes.body.data.entries as Array<{ studentProfileId: string; situacao: string | null }>).find(
      (e) => e.studentProfileId === studentAProfileId,
    );
    expect(entryA?.situacao).toBe('DISPENSADO');

    // Repõe requiredTestCount = null (volta à regra dos 100%).
    const resetRes = await request(app)
      .patch(`/api/v1/assessments/subject/${subjectId}/required-test-count`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ requiredTestCount: null });
    expect(resetRes.status).toBe(200);
    expect(resetRes.body.data.requiredTestCount).toBeNull();
  });

  it('PATCH required-test-count: 403 para não docente da disciplina e 400 para valor inválido', async () => {
    const studentRes = await request(app)
      .patch(`/api/v1/assessments/subject/${subjectId}/required-test-count`)
      .set('Authorization', `Bearer ${studentAToken}`)
      .send({ requiredTestCount: 2 });
    expect(studentRes.status).toBe(403);

    const invalidRes = await request(app)
      .patch(`/api/v1/assessments/subject/${subjectId}/required-test-count`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ requiredTestCount: 0 });
    expect(invalidRes.status).toBe(400);
  });

  it('estudante só vê os seus próprios resultados (anti-BOLA /my/grades)', async () => {
    const myGrades = await request(app).get('/api/v1/my/grades').set('Authorization', `Bearer ${studentAToken}`);
    expect(myGrades.status).toBe(200);
    expect(myGrades.body.data.every((g: { studentId: string }) => g.studentId === studentAProfileId)).toBe(true);

    const myFinals = await request(app).get('/api/v1/my/final-grades').set('Authorization', `Bearer ${studentAToken}`);
    expect(myFinals.status).toBe(200);
    expect(
      myFinals.body.data.every(
        (s: { breakdown: unknown[] }) => Array.isArray(s.breakdown),
      ),
    ).toBe(true);
  });

  it('COORDINATOR pode ler notas e finais de qualquer estudante', async () => {
    const grades = await request(app)
      .get(`/api/v1/students/${studentBProfileId}/grades`)
      .set('Authorization', `Bearer ${coordinatorToken}`);
    expect(grades.status).toBe(200);

    const finals = await request(app)
      .get(`/api/v1/students/${studentBProfileId}/final-grades`)
      .set('Authorization', `Bearer ${coordinatorToken}`);
    expect(finals.status).toBe(200);
  });
});
