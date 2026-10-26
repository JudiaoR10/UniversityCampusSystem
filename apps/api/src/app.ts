import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import { loadEnv } from './config/env.js';
import financialRouter from './modules/financial/http/financialRouter.js';
import { createCorsOrigin } from './config/cors.js';
import { logger } from './lib/logger.js';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/http/authRouter.js';
import { usersRouter } from './modules/users/http/usersRouter.js';
import { roomsRouter } from './modules/rooms/http/roomsRouter.js';
import { buildingsRouter } from './modules/buildings/http/buildingsRouter.js';
import { laboratoriesRouter } from './modules/laboratories/http/laboratoriesRouter.js';
import { equipmentRouter } from './modules/equipment/http/equipmentRouter.js';
import { incidentsRouter } from './modules/incidents/http/incidentsRouter.js';
import { auditRouter } from './modules/audit/http/auditRouter.js';
import { devicesRouter } from './modules/devices/http/devicesRouter.js';
import { dashboardRouter } from './modules/dashboard/http/dashboardRouter.js';
import { parkingRouter } from './modules/parking/http/parkingRouter.js';
import { assessmentsRouter } from './modules/assessments/http/assessmentsRouter.js';
import { schedulesRouter } from './modules/schedules/http/schedulesRouter.js';
import { attendanceRouter } from './modules/attendance/http/attendanceRouter.js';
import { notificationsRouter } from './modules/notifications/http/notificationsRouter.js';
import { academicRouter } from './modules/academic/http/academicRouter.js';
import { studentRouter } from './modules/students/http/studentRouter.js';
import { teacherRouter } from './modules/teachers/http/teacherRouter.js';
import { enrolmentRouter } from './modules/enrolments/http/enrolmentRouter.js';

export function createApp() {
  const env = loadEnv();
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );
  app.use(
    cors({
      origin: createCorsOrigin(env),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(correlationIdMiddleware);
  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        code: 'RATE_LIMITED',
        message: 'Demasiados pedidos. Tente novamente mais tarde.',
        details: [],
        correlationId: 'rate-limit',
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'smart-campus-api',
      timestamp: new Date().toISOString(),
    });
  });

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const webDistCandidates = [
    join(process.cwd(), 'apps/web/dist'),
    join(moduleDir, '../../web/dist'),
  ];
  const webDist = webDistCandidates.find((p) => existsSync(p));
  const serveWebUi = Boolean(webDist && env.NODE_ENV === 'production');

  if (!serveWebUi) {
    app.get('/', (_req, res) => {
      res.json({
        service: 'smart-campus-api',
        docs: '/api/docs',
        health: '/health',
        api: '/api/v1',
      });
    });
  }

  try {
    const candidates = [
      join(process.cwd(), 'docs/openapi.yaml'),
      join(moduleDir, '../../../docs/openapi.yaml'),
      join(process.cwd(), 'apps/api/openapi.yaml'),
    ];
    const openapiPath = candidates.find((p) => existsSync(p));
    if (openapiPath) {
      const openapi = YAML.parse(readFileSync(openapiPath, 'utf8'));
      app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));
    } else {
      logger.warn('OpenAPI não encontrado', { cwd: process.cwd(), moduleDir });
    }
  } catch (err) {
    logger.warn('OpenAPI não carregado', { error: err instanceof Error ? err.message : 'unknown' });
  }

  const v1 = express.Router();
  v1.use('/auth', authRouter);
  v1.use('/financial', financialRouter);
  v1.use(usersRouter);
  v1.use(roomsRouter);
  v1.use(buildingsRouter);
  v1.use(laboratoriesRouter);
  v1.use(equipmentRouter);
  v1.use(incidentsRouter);
  v1.use(auditRouter);
  v1.use(devicesRouter);
  v1.use(dashboardRouter);
  v1.use(parkingRouter);
  v1.use(assessmentsRouter);
  v1.use(schedulesRouter);
  v1.use(attendanceRouter);
  v1.use(notificationsRouter);
  v1.use(studentRouter);
  v1.use(teacherRouter);
  v1.use(enrolmentRouter);
  v1.use(academicRouter);

  app.use('/api/v1', v1);

  if (serveWebUi && webDist) {
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path === '/health') {
        next();
        return;
      }
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  app.use((_req, res) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      message: 'Endpoint não encontrado',
      details: [],
      correlationId: (_req as express.Request).correlationId ?? 'unknown',
    });
  });

  app.use(errorHandler);
  return app;
}
