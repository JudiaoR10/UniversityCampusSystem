import type { AttendanceStatus, Prisma } from '@prisma/client';
import type { Pagination } from '../../../lib/pagination.js';
import type { MarkAttendanceInput } from '@smart-campus/validation';
import { conflict, forbidden, notFound } from '../../../lib/errors.js';
import { prisma } from '../../../lib/prisma.js';
import { audit } from '../../audit/application/auditService.js';
import type { Actor } from '../../assessments/application/assessmentService.js';

const STAFF_ROLES = ['TEACHER', 'COORDINATOR', 'ADMIN'];

type AttendanceRecord = {
  id: string;
  classScheduleId: string;
  studentProfileId: string;
  status: string;
  note: string | null;
  recordedById: string | null;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  classSchedule?: { id: string; title: string; startsAt: Date; endsAt: Date };
  studentProfile?: { id: string; studentNumber: string; user?: { fullName: string } | null };
};

function mapAttendance(a: AttendanceRecord) {
  return {
    id: a.id,
    classScheduleId: a.classScheduleId,
    classSchedule: a.classSchedule
      ? {
          id: a.classSchedule.id,
          title: a.classSchedule.title,
          startsAt: a.classSchedule.startsAt.toISOString(),
          endsAt: a.classSchedule.endsAt.toISOString(),
        }
      : undefined,
    studentProfileId: a.studentProfileId,
    student: a.studentProfile
      ? {
          id: a.studentProfile.id,
          studentNumber: a.studentProfile.studentNumber,
          fullName: a.studentProfile.user?.fullName,
        }
      : undefined,
    status: a.status,
    note: a.note,
    recordedById: a.recordedById,
    recordedAt: a.recordedAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

const attendanceInclude = {
  classSchedule: { select: { id: true, title: true, startsAt: true, endsAt: true } },
  studentProfile: { select: { id: true, studentNumber: true, user: { select: { fullName: true } } } },
} as const;

function assertStaff(actor: Actor) {
  if (!STAFF_ROLES.includes(actor.role)) {
    throw forbidden('Apenas docentes, coordenadores ou administradores registam assiduidade', 'FORBIDDEN');
  }
}

export type AttendanceFilters = {
  studentId?: string;
  scheduleId?: string;
  status?: AttendanceStatus;
};

/**
 * GET /attendance — assiduidade visível para o papel autenticado.
 * STUDENT: apenas os próprios registos; TEACHER: sessões que leciona;
 * COORDINATOR/ADMIN: todos. Os filtros opcionais nunca ampliam o acesso.
 */
async function attendanceWhere(actor: Actor, filters: AttendanceFilters): Promise<Prisma.AttendanceWhereInput> {
  const scope: Prisma.AttendanceWhereInput[] = [];

  if (actor.role === 'STUDENT') {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: actor.id } });
    if (!profile) throw notFound('STUDENT_PROFILE_NOT_FOUND', 'Perfil de estudante não encontrado');
    if (filters.studentId && filters.studentId !== profile.id) {
      throw forbidden('Um estudante só pode consultar a sua própria assiduidade', 'FORBIDDEN');
    }
    scope.push({ studentProfileId: profile.id });
  } else if (actor.role === 'TEACHER') {
    scope.push({ classSchedule: { teacherId: actor.id } });
  } else if (filters.studentId) {
    scope.push({ studentProfileId: filters.studentId });
  }

  const filter: Prisma.AttendanceWhereInput = {};
  if (filters.studentId) filter.studentProfileId = filters.studentId;
  if (filters.scheduleId) filter.classScheduleId = filters.scheduleId;
  if (filters.status) filter.status = filters.status;

  const conditions = Object.keys(filter).length > 0 ? [...scope, filter] : scope;

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function listAttendance(actor: Actor, filters: AttendanceFilters = {}, page: Pagination = {}) {
  const records = await prisma.attendance.findMany({
    where: await attendanceWhere(actor, filters),
    include: attendanceInclude,
    orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    ...page,
  });
  return records.map(mapAttendance);
}

/** A taxa considera presenças e atrasos; as contagens são feitas no banco. */
export async function attendanceSummary(actor: Actor, filters: AttendanceFilters = {}) {
  const groups = await prisma.attendance.groupBy({
    by: ['studentProfileId', 'status'],
    where: await attendanceWhere(actor, filters),
    _count: { _all: true },
  });
  const studentIds = [...new Set(groups.map((group) => group.studentProfileId))];
  if (studentIds.length === 0) return [];
  const students = await prisma.studentProfile.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, studentNumber: true, user: { select: { fullName: true } } },
    orderBy: [{ studentNumber: 'asc' }, { id: 'asc' }],
  });
  const counts = new Map<string, Record<string, number>>();
  for (const group of groups) {
    const entry = counts.get(group.studentProfileId) ?? { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0 };
    entry[group.status] = group._count._all;
    counts.set(group.studentProfileId, entry);
  }
  return students.map((student) => {
    const entry = counts.get(student.id)!;
    const total = entry.PRESENT + entry.ABSENT + entry.LATE + entry.JUSTIFIED;
    return {
      studentProfileId: student.id,
      studentNumber: student.studentNumber,
      fullName: student.user.fullName,
      present: entry.PRESENT,
      absent: entry.ABSENT,
      late: entry.LATE,
      justified: entry.JUSTIFIED,
      total,
      attendanceRate: total > 0 ? Math.round(((entry.PRESENT + entry.LATE) / total) * 10000) / 100 : 0,
    };
  });
}

async function findScheduleForStaff(scheduleId: string, actor: Actor) {
  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      subject: { select: { id: true, code: true, name: true } },
      course: { select: { id: true, code: true, name: true } },
    },
  });
  if (!schedule) throw notFound('SCHEDULE_NOT_FOUND', 'Sessão de horário não encontrada');
  if (actor.role === 'TEACHER' && schedule.teacherId !== actor.id) {
    throw forbidden('Só o docente da sessão pode registar assiduidade', 'FORBIDDEN');
  }
  return schedule;
}

/**
 * GET /attendance/sessions/:scheduleId — pauta de presenças da sessão:
 * estudantes do curso da sessão com o estado de assiduidade atual (se existir).
 */
export async function getAttendanceRoster(scheduleId: string, actor: Actor) {
  assertStaff(actor);
  const schedule = await findScheduleForStaff(scheduleId, actor);

  const enrolments = await prisma.subjectEnrolment.findMany({
    where: { subjectId: schedule.subjectId, status: { in: ['ACTIVE', 'PENDING'] }, student: { courseId: schedule.courseId } },
    include: { student: { include: { user: { select: { fullName: true } } } } },
    orderBy: { student: { studentNumber: 'asc' } },
  });
  const students = [...new Map(enrolments.map((row) => [row.student.id, row.student])).values()];

  const records = await prisma.attendance.findMany({ where: { classScheduleId: scheduleId } });
  const byStudent = new Map(records.map((r) => [r.studentProfileId, r]));

  // ClassSchedule has no academic term: use January–June and July–December.
  const year = schedule.startsAt.getUTCFullYear();
  const month = schedule.startsAt.getUTCMonth() < 6 ? 0 : 6;
  const semesterSessions = await prisma.classSchedule.findMany({
    where: {
      subjectId: schedule.subjectId,
      courseId: schedule.courseId,
      startsAt: { gte: new Date(Date.UTC(year, month, 1)), lt: new Date(Date.UTC(year, month + 6, 1)) },
      ...(actor.role === 'TEACHER' ? { teacherId: actor.id } : {}),
    },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    select: { id: true, title: true, startsAt: true, endsAt: true },
  });
  const semesterRecords = await prisma.attendance.findMany({
    where: {
      classScheduleId: { in: semesterSessions.map((session) => session.id) },
      studentProfileId: { in: students.map((student) => student.id) },
    },
    select: { classScheduleId: true, studentProfileId: true, status: true, note: true },
  });

  return {
    semester: {
      year,
      number: month === 0 ? 1 : 2,
      sessions: semesterSessions.map((session) => ({ ...session, startsAt: session.startsAt.toISOString(), endsAt: session.endsAt.toISOString() })),
      records: semesterRecords.map((record) => ({ scheduleId: record.classScheduleId, studentId: record.studentProfileId, status: record.status, note: record.note })),
    },
    schedule: {
      id: schedule.id,
      title: schedule.title,
      startsAt: schedule.startsAt.toISOString(),
      endsAt: schedule.endsAt.toISOString(),
      subject: schedule.subject,
      course: schedule.course,
    },
    entries: students.map((student) => {
      const record = byStudent.get(student.id);
      return {
        id: student.id,
        studentNumber: student.studentNumber,
        fullName: student.user?.fullName,
        attendanceId: record?.id ?? null,
        status: record?.status ?? 'ABSENT',
        note: record?.note ?? null,
        marked: Boolean(record),
      };
    }),
  };
}

/**
 * POST /attendance/sessions/:scheduleId — registar/atualizar assiduidade em bloco.
 * Só aceita estudantes do curso da sessão.
 */
export async function markAttendance(scheduleId: string, input: MarkAttendanceInput, actor: Actor, correlationId: string) {
  assertStaff(actor);
  const schedule = await findScheduleForStaff(scheduleId, actor);

  const studentIds = [...new Set(input.records.map((r) => r.studentId))];
  const students = await prisma.studentProfile.findMany({ where: { id: { in: studentIds } } });
  const found = new Map(students.map((s) => [s.id, s]));

  const missing = studentIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw notFound('STUDENT_NOT_FOUND', `Estudantes não encontrados: ${missing.join(', ')}`);
  }

  const enrolled = await prisma.subjectEnrolment.findMany({
    where: { subjectId: schedule.subjectId, status: { in: ['ACTIVE', 'PENDING'] }, studentId: { in: studentIds } },
    select: { studentId: true },
  });
  if (enrolled.length !== studentIds.length) {
    throw conflict('STUDENT_NOT_ENROLLED', 'Há estudantes que não estão inscritos nesta disciplina');
  }

  const foreign = students.filter((student) => student.courseId !== schedule.courseId);
  if (foreign.length > 0) {
    throw conflict('STUDENT_COURSE_MISMATCH', 'Há estudantes que não pertencem ao curso da sessão');
  }

  await prisma.$transaction(
    input.records.map((record) =>
      prisma.attendance.upsert({
        where: {
          classScheduleId_studentProfileId: {
            classScheduleId: scheduleId,
            studentProfileId: record.studentId,
          },
        },
        create: {
          classScheduleId: scheduleId,
          studentProfileId: record.studentId,
          status: record.status,
          note: record.note ?? null,
          recordedById: actor.id,
        },
        update: {
          status: record.status,
          note: record.note ?? null,
          recordedById: actor.id,
          recordedAt: new Date(),
        },
      }),
    ),
  );

  await audit({
    action: 'ATTENDANCE_MARK',
    resource: 'Attendance',
    resourceId: scheduleId,
    actorId: actor.id,
    correlationId,
    metadata: { classScheduleId: scheduleId, students: studentIds.length },
  });

  return getAttendanceRoster(scheduleId, actor);
}
