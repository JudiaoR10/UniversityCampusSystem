import { Router } from 'express';
import { createMaintenanceSchema, updateMaintenanceSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as maintenanceService from '../application/maintenanceService.js';

export const maintenanceRouter = Router();

maintenanceRouter.get('/maintenance', authenticate, async (_req, res, next) => {
  try {
    success(res, await maintenanceService.listMaintenance());
  } catch (err) {
    next(err);
  }
});

maintenanceRouter.post(
  '/maintenance',
  authenticate,
  authorize('TECHNICIAN', 'COORDINATOR', 'ADMIN'),
  async (req, res, next) => {
    try {
      const body = createMaintenanceSchema.parse(req.body);
      success(res, await maintenanceService.createMaintenance(body, req.user!.id, req.correlationId), 201);
    } catch (err) {
      next(err);
    }
  },
);

maintenanceRouter.patch(
  '/maintenance/:id',
  authenticate,
  authorize('TECHNICIAN', 'COORDINATOR', 'ADMIN'),
  async (req, res, next) => {
    try {
      const body = updateMaintenanceSchema.parse(req.body);
      success(res, await maintenanceService.updateMaintenance(req.params.id, body, req.user!.id, req.correlationId));
    } catch (err) {
      next(err);
    }
  },
);
