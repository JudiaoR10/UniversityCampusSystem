import { Router, type Request } from 'express';
import {
  createEnrolmentSchema,
  listEnrolmentsQuerySchema,
  updateEnrolmentStatusSchema,
} from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as enrolmentService from '../application/enrolmentService.js';

export const enrolmentRouter = Router();

function auditContext(req: Request) {
  return {
    actorId: req.user!.id,
    correlationId: req.correlationId,
    ip: req.ip,
    userAgent: req.header('user-agent') ?? undefined,
  };
}

enrolmentRouter.get(
  '/enrolments',
  authenticate,
  authorize('ADMIN', 'COORDINATOR', 'TEACHER', 'STUDENT'),
  async (req, res, next) => {
    try {
      const filters = listEnrolmentsQuerySchema.parse(req.query);
      success(res, await enrolmentService.list(filters, { id: req.user!.id, role: req.user!.role }));
    } catch (error) {
      next(error);
    }
  },
);

enrolmentRouter.post('/enrolments', authenticate, async (req, res, next) => {
  try {
    const input = createEnrolmentSchema.parse(req.body);
    const created = await enrolmentService.create(
      input,
      { id: req.user!.id, role: req.user!.role },
      auditContext(req),
    );
    success(res, created, 201);
  } catch (error) {
    next(error);
  }
});

enrolmentRouter.patch(
  '/enrolments/:id/status',
  authenticate,
  authorize('ADMIN', 'COORDINATOR'),
  async (req, res, next) => {
    try {
      const input = updateEnrolmentStatusSchema.parse(req.body);
      success(
        res,
        await enrolmentService.updateStatus(
          req.params.id,
          input,
          { id: req.user!.id, role: req.user!.role },
          auditContext(req),
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

enrolmentRouter.delete(
  '/enrolments/:id',
  authenticate,
  authorize('ADMIN', 'COORDINATOR'),
  async (req, res, next) => {
    try {
      success(res, await enrolmentService.remove(req.params.id, auditContext(req)));
    } catch (error) {
      next(error);
    }
  },
);
