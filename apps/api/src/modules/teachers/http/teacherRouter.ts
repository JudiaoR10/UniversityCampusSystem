import { Router, type Request } from 'express';
import {
  createTeacherProfileSchema,
  listTeachersQuerySchema,
  updateOwnTeacherContactSchema,
  updateTeacherProfileSchema,
} from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as teacherService from '../application/teacherService.js';

export const teacherRouter = Router();

const STAFF = authorize('ADMIN', 'COORDINATOR', 'TEACHER');

function auditContext(req: Request) {
  return {
    actorId: req.user!.id,
    correlationId: req.correlationId,
    ip: req.ip,
    userAgent: req.header('user-agent') ?? undefined,
  };
}

teacherRouter.get('/teachers', authenticate, async (req, res, next) => {
  try {
    const filters = listTeachersQuerySchema.parse(req.query);
    success(res, await teacherService.list(filters));
  } catch (error) {
    next(error);
  }
});

teacherRouter.get('/teachers/me', authenticate, async (req, res, next) => {
  try {
    success(res, await teacherService.getByUserId(req.user!.id));
  } catch (error) {
    next(error);
  }
});

teacherRouter.get('/teachers/by-user/:userId', authenticate, STAFF, async (req, res, next) => {
  try {
    success(res, await teacherService.getByUserId(req.params.userId));
  } catch (error) {
    next(error);
  }
});

teacherRouter.get('/teachers/:id', authenticate, STAFF, async (req, res, next) => {
  try {
    success(res, await teacherService.getById(req.params.id));
  } catch (error) {
    next(error);
  }
});

teacherRouter.post('/teachers', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const input = createTeacherProfileSchema.parse(req.body);
    success(res, await teacherService.create(input, auditContext(req)), 201);
  } catch (error) {
    next(error);
  }
});

teacherRouter.patch('/teachers/me', authenticate, authorize('TEACHER'), async (req, res, next) => {
  try {
    const input = updateOwnTeacherContactSchema.parse(req.body);
    success(res, await teacherService.updateOwn(req.user!.id, input.phone, auditContext(req)));
  } catch (error) {
    next(error);
  }
});

teacherRouter.patch(
  '/teachers/:id',
  authenticate,
  authorize('ADMIN', 'COORDINATOR'),
  async (req, res, next) => {
    try {
      const input = updateTeacherProfileSchema.parse(req.body);
      success(res, await teacherService.update(req.params.id, input, auditContext(req)));
    } catch (error) {
      next(error);
    }
  },
);

teacherRouter.delete('/teachers/:id', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    success(res, await teacherService.remove(req.params.id, auditContext(req)));
  } catch (error) {
    next(error);
  }
});
