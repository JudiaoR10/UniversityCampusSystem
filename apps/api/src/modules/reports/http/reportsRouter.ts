import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import { getReportSummary } from '../application/reportService.js';

export const reportsRouter = Router();

reportsRouter.get('/reports/summary', authenticate, async (req, res, next) => {
  try {
    success(res, await getReportSummary(req.user!.role));
  } catch (err) {
    next(err);
  }
});
