import { Router } from 'express';
import { markAttendanceSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import { AppError } from '../../../lib/errors.js';
import * as attendanceService from '../application/attendanceService.js';
import { listSchedules } from '../../schedules/application/scheduleService.js';

export const attendanceRouter = Router();

const STAFF = ['TEACHER', 'COORDINATOR', 'ADMIN'];
const STUDENT_DATA_ROLES = ['STUDENT', 'TEACHER', 'COORDINATOR', 'ADMIN'];
const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED'];

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function parseStatus(value: unknown): string | undefined {
  const status = queryString(value);
  if (status === undefined) return undefined;
  if (!ATTENDANCE_STATUSES.includes(status)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Parâmetro status inválido — use um de: ${ATTENDANCE_STATUSES.join(', ')}`,
      400,
    );
  }
  return status;
}

attendanceRouter.get('/attendance/summary', authenticate, authorize(...STUDENT_DATA_ROLES), async (req, res, next) => {
  try {
    const filters = {
      studentId: queryString(req.query.studentId),
      scheduleId: queryString(req.query.scheduleId),
        status: parseStatus(req.query.status),
    };
    success(res, await attendanceService.attendanceSummary(req.user!, filters));
  } catch (err) {
    next(err);
  }
});

attendanceRouter.get('/attendance/sessions', authenticate, authorize(...STAFF), async (req, res, next) => {
  try {
    success(res, await listSchedules(req.user!));
  } catch (err) {
    next(err);
  }
});

attendanceRouter.get('/attendance/sessions/:scheduleId', authenticate, authorize(...STAFF), async (req, res, next) => {
  try {
    success(res, await attendanceService.getAttendanceRoster(req.params.scheduleId, req.user!));
  } catch (err) {
    next(err);
  }
});

attendanceRouter.post('/attendance/sessions/:scheduleId', authenticate, authorize(...STAFF), async (req, res, next) => {
  try {
    const body = markAttendanceSchema.parse(req.body);
    success(res, await attendanceService.markAttendance(req.params.scheduleId, body, req.user!, req.correlationId));
  } catch (err) {
    next(err);
  }
});

attendanceRouter.get('/attendance', authenticate, authorize(...STUDENT_DATA_ROLES), async (req, res, next) => {
  try {
    const filters = {
      studentId: queryString(req.query.studentId),
      scheduleId: queryString(req.query.scheduleId),
        status: parseStatus(req.query.status),
    };
    success(res, await attendanceService.listAttendance(req.user!, filters));
  } catch (err) {
    next(err);
  }
});
