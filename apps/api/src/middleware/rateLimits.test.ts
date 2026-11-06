import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { configureRateLimits } from './rateLimits.js';
import { correlationIdMiddleware } from './correlationId.js';

const secret = 'rate-limit-test-secret-at-least-32-characters';

function appWithLimit(limit = 2) {
  const app = express();
  app.use(correlationIdMiddleware);
  configureRateLimits(app, { RATE_LIMIT_WINDOW_MS: 60_000, RATE_LIMIT_MAX: limit, JWT_ACCESS_SECRET: secret });
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/assets/app.js', (_req, res) => res.send('asset'));
  app.get('/api/v1/example', (_req, res) => res.json({ ok: true }));
  app.post('/api/v1/auth/login', (req, res) => res.sendStatus(req.header('x-test-login-ok') ? 200 : 401));
  return app;
}

describe('Limites de pedidos', () => {
  it('não conta ficheiros nem verificações de saúde e mantém a API limitada', async () => {
    const app = appWithLimit();
    for (let i = 0; i < 3; i++) {
      expect((await request(app).get('/health')).status).toBe(200);
      expect((await request(app).get('/assets/app.js')).status).toBe(200);
    }
    expect((await request(app).get('/api/v1/example')).status).toBe(200);
    expect((await request(app).get('/api/v1/example')).status).toBe(200);
    const blocked = await request(app).get('/api/v1/example').set('x-correlation-id', 'test-limit');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body).toMatchObject({ code: 'RATE_LIMITED', correlationId: 'test-limit' });
    expect((await request(app).get('/health')).status).toBe(200);
  });

  it('separa utilizadores no mesmo IP e mantém o limite após renovar o token', async () => {
    const app = appWithLimit(1);
    const token = jwt.sign({ sub: 'ana' }, secret);
    const renewed = jwt.sign({ sub: 'ana', jti: 'renewed' }, secret);
    const other = jwt.sign({ sub: 'rui' }, secret);
    expect((await request(app).get('/api/v1/example').auth(token, { type: 'bearer' })).status).toBe(200);
    expect((await request(app).get('/api/v1/example').auth(renewed, { type: 'bearer' })).status).toBe(429);
    expect((await request(app).get('/api/v1/example').auth(other, { type: 'bearer' })).status).toBe(200);
  });

  it('tokens falsificados não permitem mudar a quota anónima', async () => {
    const app = appWithLimit(1);
    for (const [index, sub] of ['ana', 'rui'].entries()) {
      const token = jwt.sign({ sub }, 'wrong-secret');
      expect((await request(app).get('/api/v1/example').auth(token, { type: 'bearer' })).status).toBe(index === 0 ? 200 : 429);
    }
  });

  it('não bloqueia logins bem-sucedidos e limita as tentativas falhadas em separado', async () => {
    const app = appWithLimit(600);
    for (let i = 0; i < 22; i++) {
      expect((await request(app).post('/api/v1/auth/login').set('x-test-login-ok', '1')).status).toBe(200);
    }
    for (let i = 0; i < 20; i++) {
      expect((await request(app).post('/api/v1/auth/login')).status).toBe(401);
    }
    expect((await request(app).post('/api/v1/auth/login')).status).toBe(429);
    expect((await request(app).get('/api/v1/example')).status).toBe(200);
  });
});
