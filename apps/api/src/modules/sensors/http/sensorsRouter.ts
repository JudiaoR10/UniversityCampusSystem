import { Router } from 'express';
import { createSensorSchema, updateSensorSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as sensorService from '../application/sensorService.js';

export const sensorsRouter = Router();

sensorsRouter.get('/sensors', authenticate, async (_req, res, next) => {
  try {
    success(res, await sensorService.listSensors());
  } catch (err) {
    next(err);
  }
});

sensorsRouter.post('/sensors', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const body = createSensorSchema.parse(req.body);
    success(res, await sensorService.createSensor(body, req.user!.id, req.correlationId), 201);
  } catch (err) {
    next(err);
  }
});

sensorsRouter.patch(
  '/sensors/:id',
  authenticate,
  authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'),
  async (req, res, next) => {
    try {
      const body = updateSensorSchema.parse(req.body);
      success(res, await sensorService.updateSensor(req.params.id, body, req.user!.id, req.correlationId));
    } catch (err) {
      next(err);
    }
  },
);

sensorsRouter.delete('/sensors/:id', authenticate, authorize('ADMIN', 'COORDINATOR'), async (req, res, next) => {
  try {
    success(res, await sensorService.deleteSensor(req.params.id, req.user!.id, req.correlationId));
  } catch (err) {
    next(err);
  }
});

sensorsRouter.get('/readings', authenticate, async (req, res, next) => {
  try {
    const sensorId = typeof req.query.sensorId === 'string' ? req.query.sensorId : undefined;
    const metric = typeof req.query.metric === 'string' ? req.query.metric : undefined;
    const includeDemo = req.query.includeDemo === 'false' ? false : true;
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    success(res, await sensorService.listReadings({ sensorId, metric, includeDemo, limit }));
  } catch (err) {
    next(err);
  }
});
