import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';
import { bearer, tokenFor } from '../../../test/auth.js';

const app = createApp();
const api = '/api/v1';

describe('API Core completo', () => {
  let adminToken = '';
  let technicianToken = '';

  beforeAll(async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@smartcampus.demo' } });
    if (!admin) throw new Error('Seed necessário antes dos testes (npm run db:seed)');
    adminToken = await tokenFor('admin@smartcampus.demo');
    technicianToken = await tokenFor('tecnico@smartcampus.demo');
  });

  it('GET /ops/snapshot devolve ocupação e salas', async () => {
    const res = await request(app).get(`${api}/ops/snapshot`).set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        occupancyPeople: expect.any(Number),
        occupancyPercent: expect.any(Number),
        occupancyIsDemo: expect.any(Boolean),
        buildings: expect.any(Array),
        rooms: expect.any(Array),
      }),
    );
  });

  it('GET /reports/summary agrega indicadores reais', async () => {
    const res = await request(app).get(`${api}/reports/summary`).set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.roomsCount).toBeGreaterThan(0);
  });

  it('GET /admin/status devolve saúde do Core', async () => {
    const res = await request(app).get(`${api}/admin/status`).set(bearer(adminToken));
    expect(res.status).toBe(200);
    expect(['healthy', 'degraded']).toContain(res.body.data.coreStatus);
  });

  it('CRUD de sensor e acção de manutenção', async () => {
    const devices = await request(app).get(`${api}/devices`).set(bearer(adminToken));
    expect(devices.status).toBe(200);
    const deviceId = devices.body.data[0]?.id as string;
    expect(deviceId).toBeTruthy();

    const created = await request(app)
      .post(`${api}/sensors`)
      .set(bearer(adminToken))
      .send({
        code: `TST-${Date.now().toString(36).slice(-5)}`,
        name: 'Sensor de teste',
        metric: 'temperature',
        unit: '°C',
        deviceId,
      });
    expect(created.status).toBe(201);
    const sensorId = created.body.data.id as string;

    const patched = await request(app)
      .patch(`${api}/sensors/${sensorId}`)
      .set(bearer(adminToken))
      .send({ name: 'Sensor de teste actualizado' });
    expect(patched.status).toBe(200);

    await request(app).delete(`${api}/sensors/${sensorId}`).set(bearer(adminToken));

    const incidents = await request(app).get(`${api}/incidents`).set(bearer(adminToken));
    const incidentId = incidents.body.data[0]?.id as string | undefined;
    if (incidentId) {
      const action = await request(app)
        .post(`${api}/maintenance`)
        .set(bearer(technicianToken))
        .send({ incidentId, notes: 'Verificação de teste' });
      expect([200, 201]).toContain(action.status);
    }
  });

  it('LPR de laboratório marca isDemo e ingestão por dispositivo não', async () => {
    const lots = await request(app).get(`${api}/parking/overview`).set(bearer(adminToken));
    expect(lots.status).toBe(200);
    const lotId = lots.body.data[0]?.id as string;
    expect(lotId).toBeTruthy();

    const lab = await request(app)
      .post(`${api}/parking/readings`)
      .set(bearer(adminToken))
      .send({
        lotId,
        plate: 'AIT 954 MC',
        direction: 'IN',
        isDemo: true,
      });
    expect(lab.status).toBe(201);
    expect(lab.body.data.isDemo).toBe(true);

    const ingest = await request(app)
      .post(`${api}/parking/ingest`)
      .set('x-device-token', 'dev-lpr-cam-01')
      .send({
        lotId,
        plate: 'AMH 722 MP',
        direction: 'OUT',
      });
    expect(ingest.status).toBe(201);
    expect(ingest.body.data.isDemo).toBe(false);
  });
});
