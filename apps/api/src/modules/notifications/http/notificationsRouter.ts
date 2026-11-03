import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../../../middleware/auth.js';
import { success } from '../../../middleware/errorHandler.js';
import { prisma } from '../../../lib/prisma.js';
import { getEnv } from '../../../config/env.js';
import * as notificationService from '../application/notificationService.js';
import { notificationBus } from '../application/notificationService.js';

export const notificationsRouter = Router();

/**
 * SSE em tempo real: GET /notifications/stream?token=<accessToken>
 * (EventSource do browser não envia headers, por isso o token vem por query.)
 */
notificationsRouter.get('/notifications/stream', async (req, res, next) => {
  try {
    const token = String(req.query.token ?? '');
    const payload = jwt.verify(token, getEnv().JWT_ACCESS_SECRET) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { role: true } });
    if (!user || !user.isActive) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Token inválido' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ userId: user.id })}\n\n`);

    const heartbeat = setInterval(() => res.write(':ping\n\n'), 25_000);

    const onNotification = (dto: unknown) => {
      res.write(`event: notification\ndata: ${JSON.stringify(dto)}\n\n`);
    };
    notificationBus.on(user.id, onNotification);

    req.on('close', () => {
      clearInterval(heartbeat);
      notificationBus.off(user.id, onNotification);
    });
  } catch (err) {
    if (err instanceof Error && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError')) {
      res.status(401).json({ code: 'TOKEN_INVALID', message: 'Token inválido ou expirado' });
      return;
    }
    next(err);
  }
});

notificationsRouter.get('/notifications', authenticate, async (req, res, next) => {
  try {
    success(res, await notificationService.listMyNotifications(req.user!.id));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch('/notifications/:id/read', authenticate, async (req, res, next) => {
  try {
    success(res, await notificationService.markNotificationRead(req.params.id, req.user!.id));
  } catch (err) {
    next(err);
  }
});