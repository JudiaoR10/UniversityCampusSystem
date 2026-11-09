import { Router } from 'express';
import { createPOISchema, updatePOISchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as poiService from '../application/poiService.js';

export const poiRouter = Router();

poiRouter.get('/pois', authenticate, async (_req, res, next) => {
  try {
    success(res, await poiService.listPOIs());
  } catch (err) {
    next(err);
  }
});

poiRouter.get('/pois/:id', authenticate, async (req, res, next) => {
  try {
    success(res, await poiService.getPOI(req.params.id));
  } catch (err) {
    next(err);
  }
});

poiRouter.post('/pois', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const body = createPOISchema.parse(req.body);
    const poi = await poiService.createPOI(body, req.user!.id, req.correlationId);
    success(res, poi, 201);
  } catch (err) {
    next(err);
  }
});

poiRouter.patch('/pois/:id', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const body = updatePOISchema.parse(req.body);
    const poi = await poiService.updatePOI(req.params.id, body, req.user!.id, req.correlationId);
    success(res, poi);
  } catch (err) {
    next(err);
  }
});

poiRouter.delete('/pois/:id', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const result = await poiService.deletePOI(req.params.id, req.user!.id, req.correlationId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});
