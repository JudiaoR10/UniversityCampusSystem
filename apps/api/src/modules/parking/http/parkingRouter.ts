import { Router } from 'express';
import { createPlateReadingSchema, ingestPlateReadingSchema, updateParkingSpotSchema } from '@smart-campus/validation';
import { authenticate, authenticateIngest, authorize } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import * as parkingService from '../application/parkingService.js';

export const parkingRouter = Router();

parkingRouter.get('/parking/overview', authenticate, async (_req, res, next) => {
  try {
    success(res, await parkingService.getParkingOverview());
  } catch (err) {
    next(err);
  }
});

parkingRouter.get('/parking/readings', authenticate, async (req, res, next) => {
  try {
    const limit = Number(req.query.limit ?? 30);
    success(res, await parkingService.listPlateReadings(limit));
  } catch (err) {
    next(err);
  }
});

parkingRouter.post('/parking/ingest', authenticateIngest, async (req, res, next) => {
  try {
    const body = ingestPlateReadingSchema.parse(req.body);
    const ingest = req.ingest!;
    const reading = await parkingService.ingestPlateReading(
      body,
      ingest.actorId,
      req.correlationId,
      ingest.sensorCode,
    );
    success(res, reading, 201);
  } catch (err) {
    next(err);
  }
});

parkingRouter.post(
  '/parking/readings',
  authenticate,
  authorize('TECHNICIAN', 'COORDINATOR', 'ADMIN'),
  async (req, res, next) => {
    try {
      const body = createPlateReadingSchema.parse(req.body);
      const reading = await parkingService.createPlateReading(body, req.user!.id, req.correlationId);
      success(res, reading, 201);
    } catch (err) {
      next(err);
    }
  },
);

parkingRouter.patch(
  '/parking/spots/:id',
  authenticate,
  authorize('TECHNICIAN', 'COORDINATOR', 'ADMIN'),
  async (req, res, next) => {
    try {
      const body = updateParkingSpotSchema.parse(req.body);
      const spot = await parkingService.updateParkingSpot(req.params.id, body, req.user!.id, req.correlationId);
      success(res, spot);
    } catch (err) {
      next(err);
    }
  },
);
