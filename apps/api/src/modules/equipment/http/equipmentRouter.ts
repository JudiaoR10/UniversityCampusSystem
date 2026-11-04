import { Router } from 'express';
import { createEquipmentSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as equipmentService from '../application/equipmentService.js';

export const equipmentRouter = Router();

equipmentRouter.get('/equipment', authenticate, async (_req, res, next) => {
  try { success(res, await equipmentService.listEquipment()); }
  catch (err) { next(err); }
});

equipmentRouter.get('/equipment/:id', authenticate, async (req, res, next) => {
  try { success(res, await equipmentService.getEquipment(req.params.id)); }
  catch (err) { next(err); }
});

equipmentRouter.post('/equipment', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const body = createEquipmentSchema.parse(req.body);
    const item = await equipmentService.createEquipment(body, req.user!.id, req.correlationId);
    success(res, item, 201);
  } catch (err) { next(err); }
});

equipmentRouter.patch('/equipment/:id', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const body = createEquipmentSchema.partial().parse(req.body);
    const item = await equipmentService.updateEquipment(req.params.id, body, req.user!.id, req.correlationId);
    success(res, item);
  } catch (err) { next(err); }
});

equipmentRouter.delete('/equipment/:id', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const result = await equipmentService.deleteEquipment(req.params.id, req.user!.id, req.correlationId);
    success(res, result);
  } catch (err) { next(err); }
});
