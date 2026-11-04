import { Router } from 'express';
import { createLaboratorySchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as laboratoryService from '../application/laboratoryService.js';

export const laboratoriesRouter = Router();

laboratoriesRouter.get('/laboratories', authenticate, async (_req, res, next) => {
  try { success(res, await laboratoryService.listLaboratories()); }
  catch (err) { next(err); }
});

laboratoriesRouter.get('/laboratories/:id', authenticate, async (req, res, next) => {
  try { success(res, await laboratoryService.getLaboratory(req.params.id)); }
  catch (err) { next(err); }
});

laboratoriesRouter.post('/laboratories', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const body = createLaboratorySchema.parse(req.body);
    const lab = await laboratoryService.createLaboratory(body, req.user!.id, req.correlationId);
    success(res, lab, 201);
  } catch (err) { next(err); }
});

laboratoriesRouter.patch('/laboratories/:id', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const body = createLaboratorySchema.partial().parse(req.body);
    const lab = await laboratoryService.updateLaboratory(req.params.id, body, req.user!.id, req.correlationId);
    success(res, lab);
  } catch (err) { next(err); }
});

laboratoriesRouter.delete('/laboratories/:id', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const result = await laboratoryService.deleteLaboratory(req.params.id, req.user!.id, req.correlationId);
    success(res, result);
  } catch (err) { next(err); }
});
