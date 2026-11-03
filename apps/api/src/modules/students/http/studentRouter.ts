import { Router, type Request } from 'express';
import {
  createStudentProfileSchema,
  listStudentsQuerySchema,
  updateOwnStudentContactSchema,
  updateStudentProfileSchema,
} from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as studentService from '../application/studentService.js';

export const studentRouter = Router();

const STAFF = authorize('ADMIN', 'COORDINATOR', 'TEACHER');

function auditContext(req: Request) {
  return {
    actorId: req.user!.id,
    correlationId: req.correlationId,
    ip: req.ip,
    userAgent: req.header('user-agent') ?? undefined,
  };
}

studentRouter.get('/students', authenticate, STAFF, async (req, res, next) => {
  try {
    const filters = listStudentsQuerySchema.parse(req.query);
    success(res, await studentService.list(filters));
  } catch (error) {
    next(error);
  }
});

studentRouter.get('/students/me', authenticate, async (req, res, next) => {
  try {
    success(res, await studentService.getByUserId(req.user!.id));
  } catch (error) {
    next(error);
  }
});

studentRouter.get('/students/by-user/:userId', authenticate, STAFF, async (req, res, next) => {
  try {
    success(res, await studentService.getByUserId(req.params.userId));
  } catch (error) {
    next(error);
  }
});

studentRouter.get('/students/:id', authenticate, STAFF, async (req, res, next) => {
  try {
    success(res, await studentService.getById(req.params.id));
  } catch (error) {
    next(error);
  }
});

studentRouter.post(
  '/students',
  authenticate,
  authorize('ADMIN', 'COORDINATOR'),
  async (req, res, next) => {
    try {
      const input = createStudentProfileSchema.parse(req.body);
      success(res, await studentService.create(input, auditContext(req)), 201);
    } catch (error) {
      next(error);
    }
  },
);

studentRouter.patch('/students/me', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    const input = updateOwnStudentContactSchema.parse(req.body);
    success(res, await studentService.updateOwn(req.user!.id, input.phone, auditContext(req)));
  } catch (error) {
    next(error);
  }
});

studentRouter.patch(
  '/students/:id',
  authenticate,
  authorize('ADMIN', 'COORDINATOR'),
  async (req, res, next) => {
    try {
      const input = updateStudentProfileSchema.parse(req.body);
      success(res, await studentService.update(req.params.id, input, auditContext(req)));
    } catch (error) {
      next(error);
    }
  },
);

studentRouter.delete(
  '/students/:id',
  authenticate,
  authorize('ADMIN', 'COORDINATOR'),
  async (req, res, next) => {
    try {
      success(res, await studentService.remove(req.params.id, auditContext(req)));
    } catch (error) {
      next(error);
    }
  },
);
