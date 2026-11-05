import { Router } from 'express';
import { updateAdminSettingsSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as adminService from '../application/adminService.js';

export const adminRouter = Router();

adminRouter.get('/admin/settings', authenticate, authorize('ADMIN'), async (_req, res, next) => {
  try {
    success(res, await adminService.getAdminSettings());
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/admin/settings', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const body = updateAdminSettingsSchema.parse(req.body);
    success(res, await adminService.updateAdminSettings(body, req.user!.id, req.correlationId));
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/admin/status', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (_req, res, next) => {
  try {
    success(res, await adminService.getAdminStatus());
  } catch (err) {
    next(err);
  }
});
