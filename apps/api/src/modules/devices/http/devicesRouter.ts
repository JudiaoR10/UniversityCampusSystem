import { Router } from 'express';
import { createDeviceSchema, updateDeviceSchema, updateDeviceStatusSchema } from '@smart-campus/validation';
import { authenticate, authorize } from '../../../middleware/auth.js';
import * as deviceService from '../application/deviceService.js';
import { success } from '../../../middleware/errorHandler.js';
import { prisma } from '../../../lib/prisma.js';
import { notFound } from '../../../lib/errors.js';
import * as alertService from '../application/alertService.js';

export const devicesRouter = Router();

devicesRouter.get('/devices', authenticate, async (_req, res, next) => {
  try {
    const devices = await prisma.device.findMany({
      include: { sensors: true, room: { select: { id: true, code: true, name: true } } },
      orderBy: { code: 'asc' },
    });
    success(res, devices);
  } catch (err) {
    next(err);
  }
});

devicesRouter.post('/devices', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const body = createDeviceSchema.parse(req.body);
    const device = await deviceService.createDevice(body, req.user!.id, req.correlationId);
    success(res, device, 201);
  } catch (err) {
    next(err);
  }
});

devicesRouter.patch('/devices/:id', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const body = updateDeviceSchema.parse(req.body);
    success(res, await deviceService.updateDevice(req.params.id, body, req.user!.id, req.correlationId));
  } catch (err) {
    next(err);
  }
});

devicesRouter.patch('/devices/:id/status', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    const body = updateDeviceStatusSchema.parse(req.body);
    success(res, await deviceService.updateDeviceStatus(req.params.id, body, req.user!.id, req.correlationId));
  } catch (err) {
    next(err);
  }
});

devicesRouter.delete('/devices/:id', authenticate, authorize('ADMIN', 'COORDINATOR'), async (req, res, next) => {
  try {
    success(res, await deviceService.deleteDevice(req.params.id, req.user!.id, req.correlationId));
  } catch (err) {
    next(err);
  }
});

devicesRouter.get('/sensors/:id/readings', authenticate, async (req, res, next) => {
  try {
    const sensor = await prisma.sensor.findUnique({ where: { id: req.params.id } });
    if (!sensor) throw notFound('SENSOR_NOT_FOUND', 'Sensor não encontrado');
    const readings = await prisma.reading.findMany({
      where: { sensorId: sensor.id },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    success(res, readings.map((r) => ({ ...r, recordedAt: r.recordedAt.toISOString(), isDemo: r.isDemo })));
  } catch (err) {
    next(err);
  }
});

devicesRouter.get('/alerts', authenticate, async (req, res, next) => {
  try {
    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : undefined;
    const alerts = await prisma.alert.findMany({
            where: deviceId ? { OR: [{ deviceId }, { sensor: { deviceId } }] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    success(
      res,
      alerts.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

devicesRouter.patch('/alerts/:id/ack', authenticate, authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN'), async (req, res, next) => {
  try {
    success(res, await alertService.acknowledgeAlert(req.params.id, req.user!.id, req.correlationId));
  } catch (err) {
    next(err);
  }
});