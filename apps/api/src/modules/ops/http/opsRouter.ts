import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import { getOpsSnapshot } from '../application/opsService.js';

export const opsRouter = Router();

opsRouter.get('/ops/snapshot', authenticate, async (req, res, next) => {
  try {
    success(res, await getOpsSnapshot(req.user!.role));
  } catch (err) {
    next(err);
  }
});
