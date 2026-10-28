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

/**
 * Sprint "Sistema Inteligente de Dispensa, Exame Normal e Recorrência".
 * Usa uma disciplina própria (SIT-EX) para não interferir com a suite
 * assessments.integration.test.ts, que assume o estado baseline de PTP3.
 */
describe('Sprint — Dispensa, Exame Normal e Recorrência', () => {
  let teacherToken = '';
  let coordinatorToken = '';
  let studentToken = '';
  let subjectId = '';
  let courseId = '';
  let teacherUserId = '';
  let studentAId = '';
  let test1Id = '';
  let test2Id = '';
  let examId = '';
  let recurrenceId = '';

  async function cleanupSprintSubject() {
    const subjects = await prisma.subject.findMany({ where: { code: { startsWith: 'SIT-' } } });
    for (const subject of subjects) {
      const assessments = await prisma.assessment.findMany({
        where: { subjectId: subject.id },
        select: { id: true },
      });
      const assessmentIds = assessments.map((a) => a.id);
      if (assessmentIds.length > 0) {
        await prisma.grade.deleteMany({ where: { assessmentId: { in: assessmentIds } } });
      }
      await prisma.assessment.deleteMany({ where: { subjectId: subject.id } });
      await prisma.classSchedule.deleteMany({ where: { subjectId: subject.id } });
      await prisma.subject.delete({ where: { id: subject.id } }).catch(() => undefined);
    }
  }

  async function resetStudent() {
    await prisma.grade.deleteMany({ where: { studentId: studentAId, assessment: { subjectId } } });
  }

  async function createAssessment(input: {
    title: string;
    type: 'TEST' | 'EXAM' | 'RECURRENCE';
    weight: number;
  }): Promise<string> {
    const res = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ ...input, subjectId, gradingMode: 'SCALE', maxScore: 20 });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  }

  async function postGrade(assessmentId: string, value: number) {
    return request(app)
      .post(`/api/v1/assessments/${assessmentId}/grades`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ grades: [{ studentId: studentAId, value }] });
  }

  /** Lança as duas avaliações contínuas com a mesma nota → média de admissão = nota. */
  async function setAdmission(value: number) {
    const a = await postGrade(test1Id, value);
    expect(a.status).toBe(201);
    const b = await postGrade(test2Id, value);
    expect(b.status).toBe(201);
  }

  async function getFinal() {
    const res = await request(app)
      .get(`/api/v1/students/${studentAId}/final-grades`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    const entry = res.body.data.find((s: { subjectCode: string }) => s.subjectCode === 'SIT-EX');
    expect(entry).toBeTruthy();
    return entry;
  }

  async function getBoard(token = teacherToken) {
    return request(app)
      .get(`/api/v1/assessments/subject/${subjectId}/board`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function studentBoardEntry() {
    const res = await getBoard();
    expect(res.status).toBe(200);
    const entry = res.body.data.entries.find((e: { studentProfileId: string }) => e.studentProfileId === studentAId);
    expect(entry).toBeTruthy();
    return entry;
  }

  async function setRules(payload: Record<string, unknown>, token = teacherToken) {
    return request(app)
      .patch(`/api/v1/assessments/subject/${subjectId}/rules`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);
  }

  beforeAll(async () => {
    teacherToken = await loginAs('docente@smartcampus.demo', 'Docente123!');
    coordinatorToken = await loginAs('coordenador@smartcampus.demo', 'Coord123!');
    studentToken = await loginAs('estudante@smartcampus.demo', 'Estudante123!');

    const ptp3 = await prisma.subject.findUnique({ where: { code: 'PTP3' } });
    if (!ptp3) throw new Error('Seed necessário antes dos testes (npm run db:seed)');
    courseId = ptp3.courseId;

    const teacherUser = await prisma.user.findUnique({ where: { email: 'docente@smartcampus.demo' } });
    if (!teacherUser) throw new Error('Docente em falta no seed');
    teacherUserId = teacherUser.id;

    const profileA = await prisma.studentProfile.findUnique({ where: { studentNumber: 'EST-2026-001' } });
    if (!profileA) throw new Error('Estudante A em falta no seed');
    studentAId = profileA.id;

    await cleanupSprintSubject();

    const subject = await prisma.subject.create({
      data: {
        code: 'SIT-EX',
        name: 'Dispensa e Exames (Sprint)',
        credits: 6,
        courseId,
        requiredTestCount: 2,
        recurrenceMinAdmission: 7,
      },
    });
    subjectId = subject.id;

    // Ligação docente↔disciplina exigida para criar avaliações e lançar notas.
    const dayMs = 24 * 60 * 60 * 1000;
    await prisma.classSchedule.create({
      data: {
        title: `Aula SIT-EX-${Date.now()}`,
        subjectId,
        courseId,
        teacherId: teacherUserId,
        startsAt: new Date(Date.now() + dayMs),
        endsAt: new Date(Date.now() + dayMs + 90 * 60 * 1000),
      },
    });

    test1Id = await createAssessment({ title: 'Contínuo 1 (Sprint)', type: 'TEST', weight: 50 });
    test2Id = await createAssessment({ title: 'Contínuo 2 (Sprint)', type: 'TEST', weight: 50 });
    examId = await createAssessment({ title: 'Exame Normal (Sprint)', type: 'EXAM', weight: 10 });
    recurrenceId = await createAssessment({ title: 'Recorrência (Sprint)', type: 'RECURRENCE', weight: 5 });
  });

  afterAll(async () => {
    await cleanupSprintSubject();
  });

  it('Cenário 1 — frequência ≥ 14 marca DISPENSADO e bloqueia exame e recorrência', async () => {
    await resetStudent();
    await setAdmission(16);

    const finals = await getFinal();
    expect(finals.state).toBe('DISPENSADO');
    expect(finals.status).toBe('DISPENSADO');
    expect(finals.finalGrade).toBe(16);
    expect(finals.recurrenceEligible).toBe(false);

    const examRes = await postGrade(examId, 15);
    expect(examRes.status).toBe(409);
    expect(examRes.body.code).toBe('STUDENT_DISPENSADO');

    const recurrenceRes = await postGrade(recurrenceId, 15);
    expect(recurrenceRes.status).toBe(409);
    expect(recurrenceRes.body.code).toBe('STUDENT_DISPENSADO');

    const entry = await studentBoardEntry();
    expect(entry.exam.editable).toBe(false);
    expect(entry.exam.blockedReason).toContain('Dispensado');
    expect(entry.recurrence.editable).toBe(false);
  });

  it('Cenário 2 — frequência < 10 marca EXCLUIDO e não admite exame nem recorrência', async () => {
    await resetStudent();
    await setAdmission(8);

    const finals = await getFinal();
    expect(finals.state).toBe('EXCLUIDO');
    expect(finals.status).toBe('EXCLUIDO');
    expect(finals.finalGrade).toBeNull();
    expect(finals.stateReason).toContain('Frequência abaixo de 10');

    const examRes = await postGrade(examId, 12);
    expect(examRes.status).toBe(409);
    expect(examRes.body.code).toBe('STUDENT_NAO_ADMITIDO_EXAME');

    const recurrenceRes = await postGrade(recurrenceId, 12);
    expect(recurrenceRes.status).toBe(409);
    expect(recurrenceRes.body.code).toBe('STUDENT_NAO_ADMITIDO_EXAME');
  });

  it('Cenário 3 — frequência 10–13 sem exame fica ADMITIDO_AO_EXAME (recorrência ainda bloqueada)', async () => {
    await resetStudent();
    await setAdmission(10);

    const finals = await getFinal();
    expect(finals.state).toBe('ADMITIDO_AO_EXAME');
    expect(finals.finalGrade).toBeNull();
    expect(finals.recurrenceGrade).toBeNull();

    const recurrenceRes = await postGrade(recurrenceId, 16);
    expect(recurrenceRes.status).toBe(409);
    expect(recurrenceRes.body.code).toBe('EXAM_PENDING');

    const examRes = await postGrade(examId, 8);
    expect(examRes.status).toBe(201);
  });

  it('Cenário 4 — exame aprovado (A+E)/2 ≥ 10: APROVADO_EXAME, nota final e "*" na recorrência', async () => {
    await resetStudent();
    await setAdmission(10);
    expect((await postGrade(examId, 16)).status).toBe(201);

    const finals = await getFinal();
    expect(finals.state).toBe('APROVADO_EXAME');
    expect(finals.finalGrade).toBe(13);
    expect(finals.admissionGrade).toBe(10);
    expect(finals.examGrade).toBe(16);
    expect(finals.recurrenceGrade).toBeNull();
    expect(finals.recurrenceEligible).toBe(false);

    const recurrenceRes = await postGrade(recurrenceId, 16);
    expect(recurrenceRes.status).toBe(409);
    expect(recurrenceRes.body.code).toBe('STUDENT_APROVADO_EXAME');

    const boardRes = await getBoard();
    expect(boardRes.status).toBe(200);
    const entry = boardRes.body.data.entries.find(
      (e: { studentProfileId: string }) => e.studentProfileId === studentAId,
    );
    expect(entry.recurrence.asterisk).toBe(true);
    expect(entry.recurrence.grade).toBeNull();
    expect(entry.recurrence.editable).toBe(false);
    expect(entry.recurrence.blockedReason).toContain('* Aprovado no exame normal');
    expect(boardRes.body.data.counters.aprovadosExame).toBeGreaterThanOrEqual(1);
  });

  it('Cenário 5 — exame reprovado com mínimo configurado: ADMITIDO_RECORRENCIA', async () => {
    await resetStudent();
    await setAdmission(10);
    expect((await postGrade(examId, 8)).status).toBe(201);

    const finals = await getFinal();
    expect(finals.state).toBe('ADMITIDO_RECORRENCIA');
    expect(finals.recurrenceEligible).toBe(true);
    // Aguarda recorrência: ainda não existe nota final.
    expect(finals.finalGrade).toBeNull();

    const entry = await studentBoardEntry();
    expect(entry.recurrence.editable).toBe(true);
    expect(entry.recurrence.blockedReason).toBeNull();
  });

  it('Cenário 5b — frequência abaixo do mínimo configurado: NAO_ELEGIVEL_RECORRENCIA', async () => {
    await resetStudent();
    await setAdmission(10);
    const raiseMin = await setRules({ recurrenceMinAdmission: 12 });
    expect(raiseMin.status).toBe(200);
    expect((await postGrade(examId, 8)).status).toBe(201);

    const finals = await getFinal();
    expect(finals.state).toBe('NAO_ELEGIVEL_RECORRENCIA');
    expect(finals.stateReason).toContain('12');

    const recurrenceRes = await postGrade(recurrenceId, 16);
    expect(recurrenceRes.status).toBe(409);
    expect(recurrenceRes.body.code).toBe('NOT_ELIGIBLE_FOR_RECURRENCE');

    const restore = await setRules({ recurrenceMinAdmission: 7 });
    expect(restore.status).toBe(200);
  });

  it('Cenário 6 — nota de recorrência decide o resultado: APROVADO/REPROVADO_RECORRENCIA', async () => {
    await resetStudent();
    await setAdmission(10);
    expect((await postGrade(examId, 8)).status).toBe(201);
    expect((await postGrade(recurrenceId, 16)).status).toBe(201);

    const approved = await getFinal();
    expect(approved.state).toBe('APROVADO_RECORRENCIA');
    expect(approved.finalGrade).toBe(13);
    expect(approved.examGrade).toBe(8);
    expect(approved.recurrenceGrade).toBe(16);

    expect((await postGrade(recurrenceId, 6)).status).toBe(201);
    const failed = await getFinal();
    expect(failed.state).toBe('REPROVADO_RECORRENCIA');
    expect(failed.finalGrade).toBe(8);
    expect(failed.stateReason).toBeNull();
  });

  it('Cenário 7 — exame alterado depois da recorrência: RECORRENCIA_EM_REVISAO e auditoria', async () => {
    await resetStudent();
    await setAdmission(10);
    expect((await postGrade(examId, 8)).status).toBe(201);
    expect((await postGrade(recurrenceId, 16)).status).toBe(201);
    // Corrigir a nota do exame depois de lançada a recorrência coloca o estado em revisão.
    expect((await postGrade(examId, 12)).status).toBe(201);

    const finals = await getFinal();
    expect(finals.state).toBe('RECORRENCIA_EM_REVISAO');
    expect(finals.stateReason).toContain('exame normal foi alterada');

    const auditEvents = await prisma.auditEvent.findMany({
      where: { action: 'EXAM_CHANGED_AFTER_RECURRENCE', resourceId: examId },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('Regras da disciplina são configuráveis e devolvidas no board (STUDENT sem acesso)', async () => {
    const updated = await setRules({ requiredTestCount: 1 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.requiredTestCount).toBe(1);

    const boardRes = await getBoard();
    expect(boardRes.status).toBe(200);
    expect(boardRes.body.data.rules.requiredTestCount).toBe(1);
    expect(boardRes.body.data.rules.rulesConfigured).toBe(true);
    expect(boardRes.body.data.rules.hasExamEpoch).toBe(true);
    expect(boardRes.body.data.rules.hasRecurrenceEpoch).toBe(true);

    const coordBoard = await getBoard(coordinatorToken);
    expect(coordBoard.status).toBe(200);

    const studentBoard = await getBoard(studentToken);
    expect(studentBoard.status).toBe(403);

    const studentRules = await setRules({ requiredTestCount: 2 }, studentToken);
    expect(studentRules.status).toBe(403);

    const invalidRules = await setRules({ recurrenceMinAdmission: 30 });
    expect(invalidRules.status).toBe(400);
    expect(invalidRules.body.code).toBe('VALIDATION_ERROR');

    const restore = await setRules({ requiredTestCount: 2 });
    expect(restore.status).toBe(200);
  });

  it('Publicação bloqueada enquanto os critérios de recorrência não estiverem configurados', async () => {
    const clearMin = await setRules({ recurrenceMinAdmission: null });
    expect(clearMin.status).toBe(200);

    const publish = await request(app)
      .post(`/api/v1/assessments/subject/${subjectId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ published: true });
    expect(publish.status).toBe(409);
    expect(publish.body.code).toBe('RULES_NOT_CONFIGURED');

    const restore = await setRules({ recurrenceMinAdmission: 7 });
    expect(restore.status).toBe(200);
  });

  it('Publicação bloqueia notas e regras até a pauta ser reaberta', async () => {
    const publish = await request(app)
      .post(`/api/v1/assessments/subject/${subjectId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ published: true });
    expect(publish.status).toBe(200);
    expect(publish.body.data.published).toBe(true);

    const blockedExam = await postGrade(examId, 14);
    expect(blockedExam.status).toBe(409);
    expect(blockedExam.body.code).toBe('RESULTS_PUBLISHED');

    const blockedResult = await request(app)
      .post('/api/v1/results')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ assessmentId: examId, studentId: studentAId, value: 14 });
    expect(blockedResult.status).toBe(409);
    expect(blockedResult.body.code).toBe('RESULTS_PUBLISHED');

    const blockedRules = await setRules({ requiredTestCount: 3 });
    expect(blockedRules.status).toBe(409);
    expect(blockedRules.body.code).toBe('RESULTS_PUBLISHED');

    const reopen = await request(app)
      .post(`/api/v1/assessments/subject/${subjectId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ published: false });
    expect(reopen.status).toBe(200);
    expect(reopen.body.data.published).toBe(false);

    const reopenedGrade = await postGrade(examId, 14);
    expect(reopenedGrade.status).toBe(201);
  });

  it('Board devolve contagens por estado e linhas com estado calculado no backend', async () => {
    await resetStudent();
    await setAdmission(14);

    const boardRes = await getBoard();
    expect(boardRes.status).toBe(200);
    const { counters, entries, rules } = boardRes.body.data;
    expect(rules.subjectCode).toBe('SIT-EX');
    expect(counters.total).toBeGreaterThanOrEqual(1);
    expect(counters.dispensados).toBeGreaterThanOrEqual(1);
    for (const entry of entries) {
      expect(typeof entry.state).toBe('string');
      expect(entry).toHaveProperty('exam');
      expect(entry).toHaveProperty('recurrence');
      expect(entry).toHaveProperty('admissionGrade');
    }
    const studentEntry = entries.find((e: { studentProfileId: string }) => e.studentProfileId === studentAId);
    expect(studentEntry.state).toBe('DISPENSADO');
  });

  it('Roster devolve o estado académico de cada estudante (legado + novo)', async () => {
    const res = await request(app)
      .get(`/api/v1/assessments/${test1Id}/roster`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    const entryA = res.body.data.entries.find((e: { studentProfileId: string }) => e.studentProfileId === studentAId);
    expect(entryA.situacao).toBe('DISPENSADO');
    expect(entryA.state).toBe('DISPENSADO');
  });

  it('Cenário 7 — dispensa ao critério do docente: DISPENSADO, sem exame/recorrência e auditada', async () => {
    await resetStudent();
    await setAdmission(11);
  
    // Sem dispensa automática (11 < 14): estaria admitido ao exame...
    const before = await getFinal();
    expect(before.state).toBe('ADMITIDO_AO_EXAME');
  
    // Estudante não pode dispensar.
    const denied = await request(app)
      .post(`/api/v1/assessments/subject/${subjectId}/exemptions`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ studentId: studentAId, exempted: true });
    expect(denied.status).toBe(403);
  
    // Docente dispensa livremente com nota escolhida.
    const exemptRes = await request(app)
      .post(`/api/v1/assessments/subject/${subjectId}/exemptions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ studentId: studentAId, exempted: true, reason: 'Critério do docente', grade: 15 });
    expect(exemptRes.status).toBe(200);
    expect(exemptRes.body.data.exempted).toBe(true);
    expect(exemptRes.body.data.grade).toBe(15);
  
    const finals = await getFinal();
    expect(finals.state).toBe('DISPENSADO');
    expect(finals.status).toBe('DISPENSADO');
    expect(finals.stateReason).toBe('Dispensado pelo docente');
    expect(finals.exempted).toBe(true);
    // Nota final = nota de dispensa (15); nada de exame/recorrência no resultado.
    expect(finals.finalGrade).toBe(15);
    expect(finals.examGrade).toBeNull();
    expect(finals.recurrenceGrade).toBeNull();
    expect(finals.usedExam).toBe(false);
  
    // Notas de exame e recorrência ficam bloqueadas.
    const examRes = await postGrade(examId, 12);
    expect(examRes.status).toBe(409);
    expect(examRes.body.code).toBe('STUDENT_DISPENSADO');
    const recurrenceRes = await postGrade(recurrenceId, 12);
    expect(recurrenceRes.status).toBe(409);
    expect(recurrenceRes.body.code).toBe('STUDENT_DISPENSADO');
  
    // Board expõe a bandeira da dispensa manual e a nota.
    const boardRes = await getBoard();
    expect(boardRes.status).toBe(200);
    const entry = boardRes.body.data.entries.find(
      (e: { studentProfileId: string }) => e.studentProfileId === studentAId,
    );
    expect(entry.exempted).toBe(true);
    expect(entry.exemptionGrade).toBe(15);
    expect(entry.state).toBe('DISPENSADO');
  
    // Auditoria registada.
    const audits = await prisma.auditEvent.count({ where: { action: 'SUBJECT_EXEMPTION_SET' } });
    expect(audits).toBeGreaterThanOrEqual(1);
  
    // Anular a dispensa devolve o estado calculado automaticamente.
    const revokeRes = await request(app)
      .post(`/api/v1/assessments/subject/${subjectId}/exemptions`)
      .set('Authorization', `Bearer ${coordinatorToken}`)
      .send({ studentId: studentAId, exempted: false });
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.exempted).toBe(false);
  
    const restored = await getFinal();
    expect(restored.state).toBe('ADMITIDO_AO_EXAME');
    expect(restored.finalGrade).toBeNull();
  });
});
