import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../../app.js';
import { prisma } from '../../../lib/prisma.js';

const app = createApp();
const api = '/api/v1';

// Sufixo único por execução: evita colisões de `code` (únicos globalmente) e permite limpar os dados criados.
const sufixo = Date.now().toString(36).slice(-5).toUpperCase();
const codigoDepartamento = `TD${sufixo}`;
const codigoCurso = `TC${sufixo}`;
const codigoDisciplina = `TS${sufixo}`;

async function iniciarSessao(email: string, password: string) {
  const res = await request(app).post(`${api}/auth/login`).send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.tokens.accessToken as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('API Gestão Académica (departamentos, cursos, disciplinas)', () => {
  let adminToken = '';
  let coordenadorToken = '';
  let docenteToken = '';
  let estudanteToken = '';
  let departamentoId = '';
  let cursoId = '';

  beforeAll(async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@smartcampus.demo' } });
    if (!admin) {
      throw new Error('Seed necessário antes dos testes (npm run db:seed)');
    }
    adminToken = await iniciarSessao('admin@smartcampus.demo', 'Admin123!');
    coordenadorToken = await iniciarSessao('coordenador@smartcampus.demo', 'Coord123!');
    docenteToken = await iniciarSessao('docente@smartcampus.demo', 'Docente123!');
    estudanteToken = await iniciarSessao('estudante@smartcampus.demo', 'Estudante123!');
  });

  afterAll(async () => {
    // Ordem inversa das dependências: disciplinas → cursos → departamentos.
    await prisma.subject.deleteMany({
      where: { OR: [{ code: { contains: sufixo } }, { course: { code: { contains: sufixo } } }] },
    });
    await prisma.course.deleteMany({ where: { code: { contains: sufixo } } });
    await prisma.department.deleteMany({ where: { code: { contains: sufixo } } });
  });

  describe('Autenticação', () => {
    it('pedido sem token é rejeitado (401 UNAUTHORIZED)', async () => {
      const res = await request(app).get(`${api}/departments`);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('token com assinatura inválida é rejeitado (401 TOKEN_INVALID)', async () => {
      const token = jwt.sign({ sub: 'x', email: 'x@x.pt', role: 'ADMIN' }, 'segredo-errado');
      const res = await request(app).get(`${api}/departments`).set(auth(token));
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('TOKEN_INVALID');
    });

    it('token expirado é rejeitado (401 TOKEN_INVALID)', async () => {
      const token = jwt.sign({ sub: 'x', email: 'x@x.pt', role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET!, {
        expiresIn: '-1s',
      });
      const res = await request(app).get(`${api}/courses`).set(auth(token));
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('TOKEN_INVALID');
    });
  });

  describe('Autorização por role (RBAC)', () => {
    it('estudante, docente e admin conseguem consultar as listas', async () => {
      for (const token of [estudanteToken, docenteToken, adminToken]) {
        for (const rota of ['departments', 'courses', 'subjects']) {
          const res = await request(app).get(`${api}/${rota}`).set(auth(token));
          expect(res.status).toBe(200);
          expect(Array.isArray(res.body.data)).toBe(true);
        }
      }
    });

    it('estudante não cria departamento (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post(`${api}/departments`)
        .set(auth(estudanteToken))
        .send({ code: `X${sufixo}`, name: 'Departamento de teste' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('docente não cria curso nem disciplina (403)', async () => {
      const curso = await request(app)
        .post(`${api}/courses`)
        .set(auth(docenteToken))
        .send({ code: `X${sufixo}`, name: 'Curso de teste', departmentId: 'qualquer' });
      expect(curso.status).toBe(403);

      const disciplina = await request(app)
        .post(`${api}/subjects`)
        .set(auth(docenteToken))
        .send({ code: `X${sufixo}`, name: 'Disciplina de teste', credits: 6, courseId: 'qualquer' });
      expect(disciplina.status).toBe(403);
    });

    it('estudante não elimina departamento nem usa o lote (403)', async () => {
      const eliminar = await request(app).delete(`${api}/departments/qualquer`).set(auth(estudanteToken));
      expect(eliminar.status).toBe(403);
      expect(eliminar.body.code).toBe('FORBIDDEN');

      const lote = await request(app)
        .post(`${api}/courses/batch-with-subjects`)
        .set(auth(estudanteToken))
        .send({
          course: { code: `X${sufixo}`, name: 'Curso de teste', departmentId: 'qualquer' },
          subjects: [{ code: `Y${sufixo}`, name: 'Disciplina de teste', credits: 6 }],
        });
      expect(lote.status).toBe(403);
    });
  });

  describe('Departamentos', () => {
    it('rejeita dados inválidos (400 VALIDATION_ERROR)', async () => {
      const res = await request(app)
        .post(`${api}/departments`)
        .set(auth(adminToken))
        .send({ code: 'A', name: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details.length).toBeGreaterThan(0);
    });

    it('admin cria departamento (201) com o DTO esperado', async () => {
      const res = await request(app)
        .post(`${api}/departments`)
        .set(auth(adminToken))
        .send({ code: codigoDepartamento, name: 'Departamento de Teste Académico' });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        code: codigoDepartamento,
        name: 'Departamento de Teste Académico',
        description: null,
      });
      expect(typeof res.body.data.id).toBe('string');
      expect(typeof res.body.data.createdAt).toBe('string');
      expect(res.body.meta.correlationId).toBeTruthy();
      departamentoId = res.body.data.id;
    });

    it('código repetido devolve 409 DEPARTMENT_CODE_EXISTS', async () => {
      const res = await request(app)
        .post(`${api}/departments`)
        .set(auth(adminToken))
        .send({ code: codigoDepartamento, name: 'Outro nome qualquer' });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DEPARTMENT_CODE_EXISTS');
    });

    it('obtém por id e devolve 404 para id inexistente', async () => {
      const ok = await request(app).get(`${api}/departments/${departamentoId}`).set(auth(estudanteToken));
      expect(ok.status).toBe(200);
      expect(ok.body.data.code).toBe(codigoDepartamento);

      const nao = await request(app).get(`${api}/departments/id-inexistente`).set(auth(estudanteToken));
      expect(nao.status).toBe(404);
      expect(nao.body.code).toBe('DEPARTMENT_NOT_FOUND');
    });

    it('a criação fica registada na auditoria', async () => {
      const audit = await request(app).get(`${api}/audit-events?limit=50`).set(auth(adminToken));
      expect(audit.status).toBe(200);
      expect(audit.body.data.some((e: { action: string }) => e.action === 'DEPARTMENT_CREATE')).toBe(true);
    });
  });

  describe('Cursos', () => {
    it('departamento inexistente devolve 404 DEPARTMENT_NOT_FOUND', async () => {
      const res = await request(app)
        .post(`${api}/courses`)
        .set(auth(adminToken))
        .send({ code: codigoCurso, name: 'Curso de Teste', departmentId: 'id-inexistente' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('DEPARTMENT_NOT_FOUND');
    });

    it('admin cria curso (201) com o departamento aninhado', async () => {
      const res = await request(app)
        .post(`${api}/courses`)
        .set(auth(adminToken))
        .send({ code: codigoCurso, name: 'Curso de Teste', departmentId: departamentoId });
      expect(res.status).toBe(201);
      expect(res.body.data.departmentId).toBe(departamentoId);
      expect(res.body.data.department).toEqual({
        id: departamentoId,
        code: codigoDepartamento,
        name: 'Departamento de Teste Académico',
      });
      cursoId = res.body.data.id;
    });

    it('código repetido devolve 409 COURSE_CODE_EXISTS', async () => {
      const res = await request(app)
        .post(`${api}/courses`)
        .set(auth(adminToken))
        .send({ code: codigoCurso, name: 'Curso repetido', departmentId: departamentoId });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('COURSE_CODE_EXISTS');
    });

    it('filtra a lista por departamento', async () => {
      const res = await request(app)
        .get(`${api}/courses?departmentId=${departamentoId}`)
        .set(auth(estudanteToken));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(
        res.body.data.every((c: { departmentId: string }) => c.departmentId === departamentoId),
      ).toBe(true);
      expect(res.body.data.some((c: { code: string }) => c.code === codigoCurso)).toBe(true);
    });
  });

  describe('Disciplinas', () => {
    it('curso inexistente devolve 404 COURSE_NOT_FOUND', async () => {
      const res = await request(app)
        .post(`${api}/subjects`)
        .set(auth(adminToken))
        .send({ code: `${codigoDisciplina}A`, name: 'Disciplina de Teste', credits: 6, courseId: 'id-inexistente' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('COURSE_NOT_FOUND');
    });

    it('créditos inválidos devolvem 400 VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post(`${api}/subjects`)
        .set(auth(adminToken))
        .send({ code: `${codigoDisciplina}A`, name: 'Disciplina de Teste', credits: 0, courseId: cursoId });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('coordenador cria disciplina (201) com o curso aninhado', async () => {
      const res = await request(app)
        .post(`${api}/subjects`)
        .set(auth(coordenadorToken))
        .send({ code: `${codigoDisciplina}A`, name: 'Disciplina de Teste', credits: 6, courseId: cursoId });
      expect(res.status).toBe(201);
      expect(res.body.data.credits).toBe(6);
      expect(res.body.data.course.code).toBe(codigoCurso);
    });

    it('código repetido devolve 409 SUBJECT_CODE_EXISTS', async () => {
      const res = await request(app)
        .post(`${api}/subjects`)
        .set(auth(adminToken))
        .send({ code: `${codigoDisciplina}A`, name: 'Disciplina repetida', credits: 4, courseId: cursoId });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('SUBJECT_CODE_EXISTS');
    });

    it('lista por curso, por filtro e pela rota aninhada', async () => {
      const filtro = await request(app).get(`${api}/subjects?courseId=${cursoId}`).set(auth(estudanteToken));
      expect(filtro.status).toBe(200);
      expect(filtro.body.data.some((s: { code: string }) => s.code === `${codigoDisciplina}A`)).toBe(true);

      const aninhada = await request(app).get(`${api}/courses/${cursoId}/subjects`).set(auth(estudanteToken));
      expect(aninhada.status).toBe(200);
      expect(aninhada.body.data.length).toBe(1);

      const inexistente = await request(app)
        .get(`${api}/courses/id-inexistente/subjects`)
        .set(auth(estudanteToken));
      expect(inexistente.status).toBe(404);
      expect(inexistente.body.code).toBe('COURSE_NOT_FOUND');
    });
  });

  describe('Criação em lote (transação atómica)', () => {
    it('cria curso e disciplinas numa só operação (201)', async () => {
      const res = await request(app)
        .post(`${api}/courses/batch-with-subjects`)
        .set(auth(adminToken))
        .send({
          course: { code: `TB${sufixo}`, name: 'Curso em Lote', departmentId: departamentoId },
          subjects: [
            { code: `${codigoDisciplina}B`, name: 'Disciplina B', credits: 5 },
            { code: `${codigoDisciplina}C`, name: 'Disciplina C', credits: 4 },
          ],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.course.code).toBe(`TB${sufixo}`);
      expect(res.body.data.subjects).toHaveLength(2);

      const lista = await request(app)
        .get(`${api}/courses/${res.body.data.course.id}/subjects`)
        .set(auth(adminToken));
      expect(lista.body.data).toHaveLength(2);
    });

    it('código duplicado faz rollback total (409 DUPLICATE_CODE)', async () => {
      const res = await request(app)
        .post(`${api}/courses/batch-with-subjects`)
        .set(auth(adminToken))
        .send({
          course: { code: `TR${sufixo}`, name: 'Curso que não deve ficar', departmentId: departamentoId },
          subjects: [
            { code: `${codigoDisciplina}D`, name: 'Disciplina D', credits: 5 },
            { code: `${codigoDisciplina}D`, name: 'Disciplina D repetida', credits: 5 },
          ],
        });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_CODE');

      const cursos = await request(app)
        .get(`${api}/courses?departmentId=${departamentoId}`)
        .set(auth(adminToken));
      expect(cursos.body.data.some((c: { code: string }) => c.code === `TR${sufixo}`)).toBe(false);
    });

    it('rejeita lote sem disciplinas (400) e departamento inexistente (404)', async () => {
      const semDisciplinas = await request(app)
        .post(`${api}/courses/batch-with-subjects`)
        .set(auth(adminToken))
        .send({
          course: { code: `TV${sufixo}`, name: 'Curso vazio', departmentId: departamentoId },
          subjects: [],
        });
      expect(semDisciplinas.status).toBe(400);
      expect(semDisciplinas.body.code).toBe('VALIDATION_ERROR');

      const semDepartamento = await request(app)
        .post(`${api}/courses/batch-with-subjects`)
        .set(auth(adminToken))
        .send({
          course: { code: `TV${sufixo}`, name: 'Curso vazio', departmentId: 'id-inexistente' },
          subjects: [{ code: `${codigoDisciplina}E`, name: 'Disciplina E', credits: 5 }],
        });
      expect(semDepartamento.status).toBe(404);
      expect(semDepartamento.body.code).toBe('DEPARTMENT_NOT_FOUND');
    });
  });

  describe('Eliminar departamento', () => {
    it('com cursos associados é bloqueado (400 BUSINESS_RULE_VIOLATION)', async () => {
      const res = await request(app).delete(`${api}/departments/${departamentoId}`).set(auth(adminToken));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BUSINESS_RULE_VIOLATION');

      const continua = await request(app).get(`${api}/departments/${departamentoId}`).set(auth(adminToken));
      expect(continua.status).toBe(200);
    });

    it('sem cursos nem docentes é eliminado (200) e deixa de existir', async () => {
      const criado = await request(app)
        .post(`${api}/departments`)
        .set(auth(coordenadorToken))
        .send({ code: `TE${sufixo}`, name: 'Departamento vazio' });
      expect(criado.status).toBe(201);

      const res = await request(app).delete(`${api}/departments/${criado.body.data.id}`).set(auth(coordenadorToken));
      expect(res.status).toBe(200);
      expect(res.body.data.ok).toBe(true);

      const depois = await request(app).get(`${api}/departments/${criado.body.data.id}`).set(auth(adminToken));
      expect(depois.status).toBe(404);
    });
  });

  describe('Eliminar cursos e disciplinas', () => {
    let cursoDescartavelId = '';
    let disciplinaDescartavelId = '';

    it('sem token devolve 401 e estudante ou docente recebem 403 FORBIDDEN', async () => {
      const semToken = await request(app).delete(`${api}/subjects/qualquer`);
      expect(semToken.status).toBe(401);

      for (const token of [estudanteToken, docenteToken]) {
        const curso = await request(app).delete(`${api}/courses/qualquer`).set(auth(token));
        expect(curso.status).toBe(403);
        expect(curso.body.code).toBe('FORBIDDEN');

        const disciplina = await request(app).delete(`${api}/subjects/qualquer`).set(auth(token));
        expect(disciplina.status).toBe(403);
        expect(disciplina.body.code).toBe('FORBIDDEN');
      }
    });

    it('curso com disciplinas não é eliminado (400 BUSINESS_RULE_VIOLATION)', async () => {
      const curso = await request(app)
        .post(`${api}/courses`)
        .set(auth(adminToken))
        .send({ code: `TX${sufixo}`, name: 'Curso descartável', departmentId: departamentoId });
      expect(curso.status).toBe(201);
      cursoDescartavelId = curso.body.data.id;

      const disciplina = await request(app)
        .post(`${api}/subjects`)
        .set(auth(adminToken))
        .send({ code: `${codigoDisciplina}X`, name: 'Disciplina descartável', credits: 3, courseId: cursoDescartavelId });
      expect(disciplina.status).toBe(201);
      disciplinaDescartavelId = disciplina.body.data.id;

      const res = await request(app).delete(`${api}/courses/${cursoDescartavelId}`).set(auth(adminToken));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BUSINESS_RULE_VIOLATION');
    });

    it('coordenador elimina disciplina (200) e repetir devolve 404 SUBJECT_NOT_FOUND', async () => {
      const res = await request(app).delete(`${api}/subjects/${disciplinaDescartavelId}`).set(auth(coordenadorToken));
      expect(res.status).toBe(200);
      expect(res.body.data.ok).toBe(true);

      const lista = await request(app).get(`${api}/subjects?courseId=${cursoDescartavelId}`).set(auth(adminToken));
      expect(lista.body.data).toHaveLength(0);

      const repetido = await request(app).delete(`${api}/subjects/${disciplinaDescartavelId}`).set(auth(adminToken));
      expect(repetido.status).toBe(404);
      expect(repetido.body.code).toBe('SUBJECT_NOT_FOUND');
    });

    it('admin elimina curso vazio (200) e repetir devolve 404 COURSE_NOT_FOUND', async () => {
      const res = await request(app).delete(`${api}/courses/${cursoDescartavelId}`).set(auth(adminToken));
      expect(res.status).toBe(200);
      expect(res.body.data.ok).toBe(true);

      const lista = await request(app).get(`${api}/courses?departmentId=${departamentoId}`).set(auth(adminToken));
      expect(lista.body.data.some((c: { id: string }) => c.id === cursoDescartavelId)).toBe(false);

      const repetido = await request(app).delete(`${api}/courses/${cursoDescartavelId}`).set(auth(adminToken));
      expect(repetido.status).toBe(404);
      expect(repetido.body.code).toBe('COURSE_NOT_FOUND');
    });

    it('o curso demo LEI (com estudante e disciplina) fica protegido (400)', async () => {
      const lei = await prisma.course.findUnique({ where: { code: 'LEI' } });
      expect(lei).not.toBeNull();
      const res = await request(app).delete(`${api}/courses/${lei!.id}`).set(auth(adminToken));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BUSINESS_RULE_VIOLATION');
    });

    it('as eliminações ficam registadas na auditoria', async () => {
      const audit = await request(app).get(`${api}/audit-events?limit=50`).set(auth(adminToken));
      expect(audit.status).toBe(200);
      const acoes = audit.body.data.map((e: { action: string }) => e.action);
      expect(acoes).toContain('SUBJECT_DELETE');
      expect(acoes).toContain('COURSE_DELETE');
    });
  });

  describe('Editar cursos e disciplinas', () => {
    let cursoEditavelId = '';
    let disciplinaEditavelId = '';

    it('sem token devolve 401 e estudante ou docente recebem 403 FORBIDDEN', async () => {
      const semToken = await request(app).patch(`${api}/courses/qualquer`).send({ name: 'Novo nome' });
      expect(semToken.status).toBe(401);

      for (const token of [estudanteToken, docenteToken]) {
        const curso = await request(app).patch(`${api}/courses/qualquer`).set(auth(token)).send({ name: 'Novo nome' });
        expect(curso.status).toBe(403);
        expect(curso.body.code).toBe('FORBIDDEN');

        const disciplina = await request(app)
          .patch(`${api}/subjects/qualquer`)
          .set(auth(token))
          .send({ name: 'Novo nome' });
        expect(disciplina.status).toBe(403);
        expect(disciplina.body.code).toBe('FORBIDDEN');
      }
    });

    it('admin edita curso (200) e as alterações persistem; descrição pode ser limpa', async () => {
      const criado = await request(app)
        .post(`${api}/courses`)
        .set(auth(adminToken))
        .send({ code: `TU${sufixo}`, name: 'Curso para editar', description: 'Descrição inicial', departmentId: departamentoId });
      expect(criado.status).toBe(201);
      cursoEditavelId = criado.body.data.id;

      const res = await request(app)
        .patch(`${api}/courses/${cursoEditavelId}`)
        .set(auth(adminToken))
        .send({ name: 'Curso editado', description: 'Nova descrição' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ code: `TU${sufixo}`, name: 'Curso editado', description: 'Nova descrição' });

      const lista = await request(app).get(`${api}/courses?departmentId=${departamentoId}`).set(auth(estudanteToken));
      expect(lista.body.data.find((c: { id: string }) => c.id === cursoEditavelId).name).toBe('Curso editado');

      const limpa = await request(app)
        .patch(`${api}/courses/${cursoEditavelId}`)
        .set(auth(adminToken))
        .send({ description: null });
      expect(limpa.status).toBe(200);
      expect(limpa.body.data.description).toBeNull();
    });

    it('rejeita edições inválidas de curso (400, 404 e 409)', async () => {
      const vazio = await request(app).patch(`${api}/courses/${cursoEditavelId}`).set(auth(adminToken)).send({});
      expect(vazio.status).toBe(400);
      expect(vazio.body.code).toBe('VALIDATION_ERROR');

      const inexistente = await request(app)
        .patch(`${api}/courses/id-inexistente`)
        .set(auth(adminToken))
        .send({ name: 'Novo nome' });
      expect(inexistente.status).toBe(404);
      expect(inexistente.body.code).toBe('COURSE_NOT_FOUND');

      const semDepartamento = await request(app)
        .patch(`${api}/courses/${cursoEditavelId}`)
        .set(auth(adminToken))
        .send({ departmentId: 'id-inexistente' });
      expect(semDepartamento.status).toBe(404);
      expect(semDepartamento.body.code).toBe('DEPARTMENT_NOT_FOUND');

      const repetido = await request(app)
        .patch(`${api}/courses/${cursoEditavelId}`)
        .set(auth(adminToken))
        .send({ code: codigoCurso });
      expect(repetido.status).toBe(409);
      expect(repetido.body.code).toBe('COURSE_CODE_EXISTS');
    });

    it('coordenador edita disciplina (200) e consegue mudá-la de curso', async () => {
      const criada = await request(app)
        .post(`${api}/subjects`)
        .set(auth(adminToken))
        .send({ code: `${codigoDisciplina}U`, name: 'Disciplina para editar', credits: 6, courseId: cursoEditavelId });
      expect(criada.status).toBe(201);
      disciplinaEditavelId = criada.body.data.id;

      const res = await request(app)
        .patch(`${api}/subjects/${disciplinaEditavelId}`)
        .set(auth(coordenadorToken))
        .send({ name: 'Disciplina editada', credits: 5 });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ code: `${codigoDisciplina}U`, name: 'Disciplina editada', credits: 5 });
      expect(res.body.data.course.code).toBe(`TU${sufixo}`);

      const movida = await request(app)
        .patch(`${api}/subjects/${disciplinaEditavelId}`)
        .set(auth(coordenadorToken))
        .send({ courseId: cursoId });
      expect(movida.status).toBe(200);
      expect(movida.body.data.course.code).toBe(codigoCurso);
    });

    it('rejeita edições inválidas de disciplina (400, 404 e 409)', async () => {
      const creditos = await request(app)
        .patch(`${api}/subjects/${disciplinaEditavelId}`)
        .set(auth(adminToken))
        .send({ credits: 0 });
      expect(creditos.status).toBe(400);
      expect(creditos.body.code).toBe('VALIDATION_ERROR');

      const vazio = await request(app).patch(`${api}/subjects/${disciplinaEditavelId}`).set(auth(adminToken)).send({});
      expect(vazio.status).toBe(400);

      const inexistente = await request(app)
        .patch(`${api}/subjects/id-inexistente`)
        .set(auth(adminToken))
        .send({ name: 'Novo nome' });
      expect(inexistente.status).toBe(404);
      expect(inexistente.body.code).toBe('SUBJECT_NOT_FOUND');

      const semCurso = await request(app)
        .patch(`${api}/subjects/${disciplinaEditavelId}`)
        .set(auth(adminToken))
        .send({ courseId: 'id-inexistente' });
      expect(semCurso.status).toBe(404);
      expect(semCurso.body.code).toBe('COURSE_NOT_FOUND');

      const repetido = await request(app)
        .patch(`${api}/subjects/${disciplinaEditavelId}`)
        .set(auth(adminToken))
        .send({ code: `${codigoDisciplina}A` });
      expect(repetido.status).toBe(409);
      expect(repetido.body.code).toBe('SUBJECT_CODE_EXISTS');
    });

    it('as edições ficam registadas na auditoria', async () => {
      const audit = await request(app).get(`${api}/audit-events?limit=50`).set(auth(adminToken));
      expect(audit.status).toBe(200);
      const acoes = audit.body.data.map((e: { action: string }) => e.action);
      expect(acoes).toContain('COURSE_UPDATE');
      expect(acoes).toContain('SUBJECT_UPDATE');
    });
  });

  // Os testes Anti-BOLA do módulo original (Jest) dependiam de um `checkOwnership` e de rotas
  // `/students/:id/...` que não existem no Core. Ficam como pendentes até essas rotas existirem.
  // Atenção: no Core o `studentId` é o `StudentProfile.id`, não o `user.id`.
  describe('Anti-BOLA em rotas de estudante (pendente)', () => {
    it.todo('estudante A não lê as matrículas do estudante B (403/404)');
    it.todo('estudante A não altera o perfil do estudante B (403/404)');
    it.todo('estudante A não cancela a matrícula do estudante B (403/404)');
  });
});