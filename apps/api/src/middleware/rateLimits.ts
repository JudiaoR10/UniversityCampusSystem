import type { Express, Request } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import type { Env } from '../config/env.js';

type RateLimitEnv = Pick<Env, 'RATE_LIMIT_WINDOW_MS' | 'RATE_LIMIT_MAX' | 'JWT_ACCESS_SECRET'>;

function clientKey(req: Request, secret: string): string {
  const header = req.header('authorization');
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), secret, { algorithms: ['HS256'] });
      if (typeof payload !== 'string' && payload.sub) return `user:${payload.sub}`;
    } catch {
      // Invalid or expired tokens share the anonymous IP quota.
    }
  }
  return `ip:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`;
}

export function configureRateLimits(app: Express, env: RateLimitEnv) {
  // Keep login failures separate from normal navigation and successful logins.
  app.use('/api/v1/auth/login', rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    skip: (req) => req.method !== 'POST',
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Demasiadas tentativas de entrada falhadas. Aguarde antes de tentar novamente.',
      details: [],
      correlationId: req.correlationId,
    }),
  }));

  // Assets, print documents, health probes and documentation do not consume API quota.
  app.use('/api/v1', rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    keyGenerator: (req) => clientKey(req, env.JWT_ACCESS_SECRET),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      const seconds = Number(res.getHeader('Retry-After')) || Math.ceil(env.RATE_LIMIT_WINDOW_MS / 1000);
      res.status(429).json({
        code: 'RATE_LIMITED',
        message: `Foram feitos muitos pedidos num curto intervalo. Tente novamente dentro de ${seconds} segundos.`,
        details: [],
        correlationId: req.correlationId,
      });
    },
  }));
}
