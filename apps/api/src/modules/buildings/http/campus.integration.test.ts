import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';

const app = createApp();
const api = '/api/v1';

const sufixo = Date.now().toString(36).slice(-5).toUpperCase();
const codigoEdificio = `TEB${sufixo}`;
const codigoLaboratorio = `TLB${sufixo}`;
const codigoEquipamento = `TEQ${sufixo}`;

async function iniciarSessao(email: string, password: string) {
  const res = await request(app).post(`${api}/auth/login`).send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.tokens.accessToken as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('API Grupo Infraestrutura (edifícios, laboratórios, equipamentos)', () => {
  let adminToken = '';
  let estudanteToken = '';
  let edificioId = '';
  let laboratorioId = '';
  let equipamentoId = '';

  beforeAll(async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@smartcampus.demo' } });
    if (!admin) {
      throw new Error('Seed necessário antes dos testes (npm run db:seed)');
    }
    adminToken = await iniciarSessao('admin@smartcampus.demo', 'Admin123!');
    estudanteToken = await iniciarSessao('estudante@smartcampus.demo', 'Estudante123!');
  });

  afterAll(async () => {
    await prisma.equipment.deleteMany({ where: { code: { contains: sufixo } } });
    await prisma.laboratory.deleteMany({ where: { code: { contains: sufixo } } });
    await prisma.building.deleteMany({ where: { code: { contains: sufixo } } });
  });

  it('rejeita pedidos sem token (401)', async () => {
    const res = await request(app).get(`${api}/buildings`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('estudante consulta mas não cria (403 FORBIDDEN)', async () => {
    const list = await request(app).get(`${api}/buildings`).set(auth(estudanteToken));
    expect(list.status).toBe(200);

    const res = await request(app)
      .post(`${api}/buildings`)
      .set(auth(estudanteToken))
      .send({ code: codigoEdificio, name: 'Edifício de teste' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('cria edifício e rejeita código duplicado (409)', async () => {
    const res = await request(app)
      .post(`${api}/buildings`)
      .set(auth(adminToken))
      .send({ code: codigoEdificio, name: 'Edifício de teste', floors: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe(codigoEdificio);
    expect(res.body.data.roomsCount).toBe(0);
    edificioId = res.body.data.id;

    const duplicado = await request(app)
      .post(`${api}/buildings`)
      .set(auth(adminToken))
      .send({ code: codigoEdificio, name: 'Outro nome' });
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.code).toBe('BUILDING_CODE_EXISTS');
  });

  it('consulta e actualiza edifício', async () => {
    const list = await request(app).get(`${api}/buildings`).set(auth(adminToken));
    expect(list.status).toBe(200);
    expect(list.body.data.some((b: { id: string }) => b.id === edificioId)).toBe(true);

    const res = await request(app)
      .patch(`${api}/buildings/${edificioId}`)
      .set(auth(adminToken))
      .send({ name: 'Edifício actualizado' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Edifício actualizado');
  });

  it('cria laboratório, valida edifício e rejeita duplicado (409)', async () => {
    const invalido = await request(app)
      .post(`${api}/laboratories`)
      .set(auth(adminToken))
      .send({ code: `TLX${sufixo}`, name: 'Laboratório inválido', buildingId: 'inexistente' });
    expect(invalido.status).toBe(404);
    expect(invalido.body.code).toBe('BUILDING_NOT_FOUND');

    const res = await request(app)
      .post(`${api}/laboratories`)
      .set(auth(adminToken))
      .send({ code: codigoLaboratorio, name: 'Laboratório de teste', buildingId: edificioId });
    expect(res.status).toBe(201);
    expect(res.body.data.building.id).toBe(edificioId);
    laboratorioId = res.body.data.id;

    const duplicado = await request(app)
      .post(`${api}/laboratories`)
      .set(auth(adminToken))
      .send({ code: codigoLaboratorio, name: 'Outro laboratório', buildingId: edificioId });
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.code).toBe('LABORATORY_CODE_EXISTS');
  });

  it('cria, consulta e actualiza equipamento', async () => {
    const res = await request(app)
      .post(`${api}/equipment`)
      .set(auth(adminToken))
      .send({ code: codigoEquipamento, name: 'Projector de teste', laboratoryId: laboratorioId });
    expect(res.status).toBe(201);
    expect(res.body.data.laboratory.id).toBe(laboratorioId);
    equipamentoId = res.body.data.id;

    const duplicado = await request(app)
      .post(`${api}/equipment`)
      .set(auth(adminToken))
      .send({ code: codigoEquipamento, name: 'Outro equipamento' });
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.code).toBe('EQUIPMENT_CODE_EXISTS');

    const detalhe = await request(app).get(`${api}/equipment/${equipamentoId}`).set(auth(adminToken));
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.data.code).toBe(codigoEquipamento);

    const actualizado = await request(app)
      .patch(`${api}/equipment/${equipamentoId}`)
      .set(auth(adminToken))
      .send({ name: 'Projector actualizado' });
    expect(actualizado.status).toBe(200);
    expect(actualizado.body.data.name).toBe('Projector actualizado');
  });

  it('apagar recursos inexistentes devolve 404 e não 500', async () => {
    const casos: Array<[string, string]> = [
    ['buildings', 'BUILDING_NOT_FOUND'],
    ['laboratories', 'LABORATORY_NOT_FOUND'],
    ['equipment', 'EQUIPMENT_NOT_FOUND'],
    ['rooms', 'ROOM_NOT_FOUND'],
    ];
    for (const [recurso, codigo] of casos) {
    const res = await request(app)
    .delete(`${api}/${recurso}/inexistente-${sufixo}`)
    .set(auth(adminToken));
    expect(res.status, recurso).toBe(404);
    expect(res.body.code, recurso).toBe(codigo);
    }
    });
    it('não apaga edifício que ainda tem laboratórios (409 BUILDING_IN_USE)', async () =>
   {
    const res = await request(app)
    .delete(`${api}/buildings/${edificioId}`)
    .set(auth(adminToken));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BUILDING_IN_USE');
    const continuaExistir = await request(app)
    .get(`${api}/buildings/${edificioId}`)
    .set(auth(adminToken));
    expect(continuaExistir.status).toBe(200);
    });
   
  it('remove equipamento, laboratório e edifício', async () => {
    const equipamento = await request(app)
      .delete(`${api}/equipment/${equipamentoId}`)
      .set(auth(adminToken));
    expect(equipamento.status).toBe(200);

    const laboratorio = await request(app)
      .delete(`${api}/laboratories/${laboratorioId}`)
      .set(auth(adminToken));
    expect(laboratorio.status).toBe(200);

    const edificio = await request(app)
      .delete(`${api}/buildings/${edificioId}`)
      .set(auth(adminToken));
    expect(edificio.status).toBe(200);

    const inexistente = await request(app)
      .get(`${api}/buildings/${edificioId}`)
      .set(auth(adminToken));
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.code).toBe('BUILDING_NOT_FOUND');
  });
});
