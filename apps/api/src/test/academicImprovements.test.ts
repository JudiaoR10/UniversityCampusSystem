import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  studentProfile: { findUnique: vi.fn(), findMany: vi.fn() },
  teacherProfile: { findUnique: vi.fn() },
  classSchedule: { findUnique: vi.fn(), delete: vi.fn() },
  subjectEnrolment: { findMany: vi.fn(), findFirst: vi.fn() },
  subject: { findMany: vi.fn() },
  subjectExemption: { findMany: vi.fn() },
  assessment: { findUnique: vi.fn() },
  grade: { findFirst: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
  financialStatus: { findUnique: vi.fn() },
  attendance: { count: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock('../lib/prisma.js', () => ({ prisma: db }));
vi.mock('../modules/audit/application/auditService.js', () => ({ audit: vi.fn() }));
vi.mock('../modules/assessments/application/assessmentService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../modules/assessments/application/assessmentService.js')>();
  return {
    ...actual,
    assertTeacherTeachesSubject: vi.fn(),
    loadAcademicStates: vi.fn().mockResolvedValue(new Map()),
  };
});

import { getFinalGrades, listStudentGrades } from '../modules/assessments/application/assessmentService.js';
import { createResult, listResults } from '../modules/assessments/application/resultService.js';
import { attendanceSummary, listAttendance } from '../modules/attendance/application/attendanceService.js';
import { deleteSchedule } from '../modules/schedules/application/scheduleService.js';
import { readPagination } from '../lib/pagination.js';

const student = { id: 'profile', userId: 'user', courseId: 'course' };
const actor = { id: 'teacher', role: 'TEACHER' };

beforeEach(() => {
  vi.clearAllMocks();
  db.studentProfile.findUnique.mockResolvedValue(student);
  db.financialStatus.findUnique.mockResolvedValue(null);
  db.grade.findFirst.mockResolvedValue({ id: 'grade' });
  db.grade.findMany.mockResolvedValue([]);
  db.subjectEnrolment.findMany.mockResolvedValue([]);
  db.subject.findMany.mockResolvedValue([]);
  db.subjectExemption.findMany.mockResolvedValue([]);
  db.$transaction.mockImplementation((operation) => operation(db));
});

describe('Proteção e histórico académico', () => {
  it('limita as notas do docente às disciplinas que leciona', async () => {
    await listStudentGrades(student.id, actor);
    expect(db.grade.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: student.id, assessment: { subject: { schedules: { some: { teacherId: actor.id } } } } },
    }));
    expect(db.financialStatus.findUnique).not.toHaveBeenCalled();
  });

  it('aplica o bloqueio financeiro também à rota de resultados', async () => {
    db.financialStatus.findUnique.mockResolvedValue({ status: 'BLOCKED' });
    await expect(listResults({ id: student.userId, role: 'STUDENT' })).rejects.toMatchObject({ code: 'FINANCIAL_BLOCKED' });
    expect(db.grade.findMany).not.toHaveBeenCalled();
  });

  it('restringe a rota de resultados às disciplinas atribuídas, antes de paginar', async () => {
    await listResults(actor, student.id, { skip: 10, take: 20 });
    expect(db.grade.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        studentId: student.id,
        assessment: { createdById: actor.id, subject: { schedules: { some: { teacherId: actor.id } } } },
      },
      skip: 10,
      take: 20,
    }));
  });

  it('mantém disciplinas concluídas mesmo depois de transferência de curso', async () => {
    db.subjectEnrolment.findMany.mockResolvedValue([{ subjectId: 'old-subject' }]);
    await getFinalGrades(student.id, { id: student.userId, role: 'STUDENT' });
    expect(db.subjectEnrolment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { studentId: student.id, status: { in: ['ACTIVE', 'PENDING', 'COMPLETED'] } },
    }));
    expect(db.subject.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['old-subject'] } } }));
  });

  it('filtra também as disciplinas dos resultados finais consultados pelo docente', async () => {
    db.subjectEnrolment.findMany.mockResolvedValue([{ subjectId: 'subject' }]);
    await getFinalGrades(student.id, actor);
    expect(db.subject.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['subject'] }, schedules: { some: { teacherId: actor.id } } },
    }));
  });

  it('uma correção positiva nunca limpa a marca permanente de negativa', async () => {
    db.assessment.findUnique.mockResolvedValue({
      id: 'assessment', subjectId: 'subject', gradingMode: 'SCALE', maxScore: 20,
      type: 'TEST', subject: { courseId: student.courseId, resultsPublishedAt: null },
    });
    db.subjectEnrolment.findFirst.mockResolvedValue({ id: 'enrolment' });
    const date = new Date();
    db.grade.upsert.mockImplementation(async ({ create, update }) => ({
      ...create, ...update, id: 'grade', createdAt: date, updatedAt: date,
    }));
    await createResult({ assessmentId: 'assessment', studentId: student.id, value: 8 }, actor, 'request');
    await createResult({ assessmentId: 'assessment', studentId: student.id, value: 18 }, actor, 'request');
    const negative = db.grade.upsert.mock.calls[0][0];
    const correction = db.grade.upsert.mock.calls[1][0];
    expect(negative.update.everNegative).toBe(true);
    expect(correction.update.everNegative).toBeUndefined();
    expect(correction.create.everNegative).toBe(false);
  });
});

describe('Assiduidade e paginação', () => {
  it('impede apagar a sessão com presenças, dentro da transação', async () => {
    db.classSchedule.findUnique.mockResolvedValue({ id: 'session' });
    db.attendance.count.mockResolvedValue(1);
    await expect(deleteSchedule('session', { id: 'admin', role: 'ADMIN' }, 'request')).rejects.toMatchObject({ code: 'SCHEDULE_HAS_ATTENDANCE' });
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.classSchedule.delete).not.toHaveBeenCalled();
  });

  it('permite apagar uma sessão sem presenças', async () => {
    db.classSchedule.findUnique.mockResolvedValue({ id: 'session', title: 'Aula' });
    db.attendance.count.mockResolvedValue(0);
    await expect(deleteSchedule('session', { id: 'admin', role: 'ADMIN' }, 'request')).resolves.toEqual({ id: 'session' });
    expect(db.classSchedule.delete).toHaveBeenCalledWith({ where: { id: 'session' } });
  });

  it('agrega no banco com os mesmos filtros de acesso e mantém a taxa', async () => {
    db.attendance.groupBy.mockResolvedValue([
      { studentProfileId: student.id, status: 'PRESENT', _count: { _all: 2 } },
      { studentProfileId: student.id, status: 'LATE', _count: { _all: 1 } },
      { studentProfileId: student.id, status: 'ABSENT', _count: { _all: 1 } },
    ]);
    db.studentProfile.findMany.mockResolvedValue([{ ...student, studentNumber: '001', user: { fullName: 'Ana' } }]);
    const summary = await attendanceSummary(actor, { studentId: student.id });
    expect(summary[0]).toMatchObject({ total: 4, present: 2, late: 1, absent: 1, attendanceRate: 75 });
    expect(db.attendance.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ classSchedule: { teacherId: actor.id } }, { studentProfileId: student.id }] },
    }));
    expect(db.attendance.findMany).not.toHaveBeenCalled();
  });

  it('pagina os registos sem ampliar o acesso do estudante', async () => {
    db.attendance.findMany.mockResolvedValue([]);
    await listAttendance({ id: student.userId, role: 'STUDENT' }, {}, { skip: 50, take: 51 });
    expect(db.attendance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ studentProfileId: student.id }] }, skip: 50, take: 51,
    }));
  });

  it('valida limites e conserva o contrato das chamadas sem paginação', () => {
    expect(readPagination({})).toEqual({});
    expect(readPagination({ offset: '50', limit: '51' })).toEqual({ skip: 50, take: 51 });
    expect(() => readPagination({ limit: '1000' })).toThrow();
    expect(() => readPagination({ offset: '-1' })).toThrow();
  });
});
