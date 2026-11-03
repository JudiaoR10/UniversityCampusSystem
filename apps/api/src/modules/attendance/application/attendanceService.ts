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
  status?: string;
};

/**
 * GET /attendance — assiduidade visível para o papel autenticado.
 * STUDENT: apenas os próprios registos; TEACHER: sessões que leciona;
 * COORDINATOR/ADMIN: todos. Os filtros opcionais nunca ampliam o acesso.
 */
export async function listAttendance(actor: Actor, filters: AttendanceFilters = {}) {
  const scope: Record<string, unknown>[] = [];

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

  const filter: Record<string, unknown> = {};
  if (filters.scheduleId) filter.classScheduleId = filters.scheduleId;
  if (filters.status) filter.status = filters.status;

  const conditions = Object.keys(filter).length > 0 ? [...scope, filter] : scope;

  const records = await prisma.attendance.findMany({
    where: conditions.length > 0 ? { AND: conditions } : {},
    include: attendanceInclude,
    orderBy: { recordedAt: 'desc' },
  });
  return records.map(mapAttendance);
}

/**
 * GET /attendance/summary — total por estudante (presenças, faltas, atrasos,
 * justificações) e taxa de assiduidade. (PRESENT + LATE) / total.
 */
export async function attendanceSummary(actor: Actor, filters: AttendanceFilters = {}) {
  const records = await listAttendance(actor, filters);
  const byStudent = new Map<string, { student?: AttendanceRecord['studentProfile']; counts: Record<string, number> }>();

  for (const record of records) {
    const entry = byStudent.get(record.studentProfileId) ?? {
      student: {
        id: record.studentProfileId,
        studentNumber: record.student?.studentNumber ?? '',
        user: { fullName: record.student?.fullName ?? '' },
      },
      counts: { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0 },
    };
    entry.counts[record.status] = (entry.counts[record.status] ?? 0) + 1;
    byStudent.set(record.studentProfileId, entry);
  }

  return [...byStudent.entries()].map(([studentProfileId, entry]) => {
    const total = entry.counts.PRESENT + entry.counts.ABSENT + entry.counts.LATE + entry.counts.JUSTIFIED;
    const attended = entry.counts.PRESENT + entry.counts.LATE;
    return {
      studentProfileId,
      studentNumber: entry.student?.studentNumber ?? '',
      fullName: entry.student?.user?.fullName,
      present: entry.counts.PRESENT,
      absent: entry.counts.ABSENT,
      late: entry.counts.LATE,
      justified: entry.counts.JUSTIFIED,
      total,
      attendanceRate: total > 0 ? Math.round((attended / total) * 10000) / 100 : 0,
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

  const students = await prisma.studentProfile.findMany({
    where: { courseId: schedule.courseId },
    include: { user: { select: { fullName: true } } },
    orderBy: { studentNumber: 'asc' },
  });

  const records = await prisma.attendance.findMany({ where: { classScheduleId: scheduleId } });
  const byStudent = new Map(records.map((r) => [r.studentProfileId, r]));

  return {
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
        status: record?.status ?? null,
        note: record?.note ?? null,
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

  const foreign = students.filter((s) => s.courseId && s.courseId !== schedule.courseId);
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
