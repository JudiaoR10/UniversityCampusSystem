import { Router } from 'express';
import { createScheduleSchema, updateScheduleSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import { AppError } from '../../../lib/errors.js';
import * as scheduleService from '../application/scheduleService.js';
import type { ScheduleFilters } from '../application/scheduleService.js';

export const schedulesRouter = Router();

const STUDENT_DATA_ROLES = ['STUDENT', 'TEACHER', 'COORDINATOR', 'ADMIN'];
const MANAGE_ROLES = ['COORDINATOR', 'ADMIN'];

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function queryDate(value: unknown, field: string): Date | undefined {
  const raw = queryString(value);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError('VALIDATION_ERROR', `Parâmetro ${field} não é uma data válida`, 400);
  }
  return parsed;
}

function parseFilters(query: Record<string, unknown>): ScheduleFilters {
  return {
    studentId: queryString(query.studentId),
    courseId: queryString(query.courseId),
    subjectId: queryString(query.subjectId),
    teacherId: queryString(query.teacherId),
    roomId: queryString(query.roomId),
    from: queryDate(query.from, 'from'),
    to: queryDate(query.to, 'to'),
  };
}

schedulesRouter.get('/schedules/options', authenticate, authorize(...MANAGE_ROLES), async (req, res, next) => {
  try {
    success(res, await scheduleService.listScheduleOptions(req.user!));
  } catch (err) {
    next(err);
  }
});

schedulesRouter.get('/schedules', authenticate, authorize(...STUDENT_DATA_ROLES), async (req, res, next) => {
  try {
    success(res, await scheduleService.listSchedules(req.user!, parseFilters(req.query)));
  } catch (err) {
    next(err);
  }
});

schedulesRouter.post('/schedules', authenticate, authorize(...MANAGE_ROLES), async (req, res, next) => {
  try {
    const body = createScheduleSchema.parse(req.body);
    success(res, await scheduleService.createSchedule(body, req.user!, req.correlationId), 201);
  } catch (err) {
    next(err);
  }
});

schedulesRouter.patch('/schedules/:id', authenticate, authorize(...MANAGE_ROLES), async (req, res, next) => {
  try {
    const body = updateScheduleSchema.parse(req.body);
    success(res, await scheduleService.updateSchedule(req.params.id, body, req.user!, req.correlationId));
  } catch (err) {
    next(err);
  }
});

schedulesRouter.delete('/schedules/:id', authenticate, authorize(...MANAGE_ROLES), async (req, res, next) => {
  try {
    success(res, await scheduleService.deleteSchedule(req.params.id, req.user!, req.correlationId));
  } catch (err) {
    next(err);
  }
});
