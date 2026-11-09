import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import { getDashboard } from '../application/dashboardService.js';

export const dashboardRouter = Router();

dashboardRouter.get('/dashboard', authenticate, async (req, res, next) => {
  try {
    success(res, await getDashboard(req.user!.id, req.user!.role));
  } catch (err) {
    next(err);
  }
});
