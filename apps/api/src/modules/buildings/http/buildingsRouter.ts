
import { Router } from 'express';
import { createBuildingSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as buildingService from '../application/buildingService.js';

export const buildingsRouter = Router();

// GET todos
buildingsRouter.get('/buildings', authenticate, async (_req, res, next) => {
  try { success(res, await buildingService.listBuildings()); }
  catch (err) { next(err); }
});

// GET um
buildingsRouter.get('/buildings/:id', authenticate, async (req, res, next) => {
  try { success(res, await buildingService.getBuilding(req.params.id)); }
  catch (err) { next(err); }
});

// POST (criar) — só ADMIN/COORDINATOR/TECHNICIAN
buildingsRouter.post('/buildings', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const body = createBuildingSchema.parse(req.body);
    const building = await buildingService.createBuilding(body, req.user!.id, req.correlationId);
    success(res, building, 201);
  } catch (err) { next(err); }
});

// PATCH (alterar)
buildingsRouter.patch('/buildings/:id', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const body = createBuildingSchema.partial().parse(req.body);
    const building = await buildingService.updateBuilding(req.params.id, body, req.user!.id, req.correlationId);
    success(res, building);
  } catch (err) { next(err); }
});

// DELETE (apagar)
buildingsRouter.delete('/buildings/:id', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const result = await buildingService.deleteBuilding(req.params.id, req.user!.id, req.correlationId);
    success(res, result);
  } catch (err) { next(err); }
});