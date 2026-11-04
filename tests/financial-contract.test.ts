import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import YAML from 'yaml';
import { createApp } from '../apps/api/src/app.js';
import financialRouter from '../apps/api/src/modules/financial/http/financialRouter.js';

const specification = YAML.parse(
  readFileSync(new URL('../docs/openapi.yaml', import.meta.url), 'utf8'),
);

describe('Contrato financeiro e Swagger do Core', () => {
  it('documenta exactamente as operações montadas no router financeiro', () => {
    const implemented = financialRouter.stack.flatMap((layer) => {
      if (!layer.route) return [];
      const path = '/financial' + layer.route.path.replace(/:([^/]+)/g, '{$1}');
      return Object.keys(layer.route.methods).map((method) => `${method} ${path}`);
    });
    const documented = Object.entries(specification.paths)
      .filter(([path]) => path.startsWith('/financial/'))
      .flatMap(([path, operations]) =>
        Object.keys(operations as object)
          .filter((method) => ['get', 'post', 'patch', 'put', 'delete'].includes(method))
          .map((method) => `${method} ${path}`),
      );
    expect(documented.sort()).toEqual(implemented.sort());
    expect(implemented).toHaveLength(24);
  });

  it('resolve as referências internas da especificação', () => {
    const visit = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const ref = (value as { $ref?: string }).$ref;
      if (ref?.startsWith('#/')) {
        const resolved = ref.slice(2).split('/').reduce(
          (node, key) => node?.[key.replace(/~1/g, '/').replace(/~0/g, '~')],
          specification,
        );
        expect(resolved, ref).toBeDefined();
      }
      Object.values(value).forEach(visit);
    };
    visit(specification);
  });

  it('expõe health público na raiz e com a resposta documentada', async () => {
    const operation = specification.paths['/health'].get;
    expect(operation.security).toEqual([]);
    expect(operation.servers).toEqual(expect.arrayContaining([expect.objectContaining({ url: '/' })]));
    const response = await request(createApp()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'smart-campus-api',
      timestamp: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });

  it('serve o Swagger com health e as rotas financeiras', async () => {
    const app = createApp();
    expect((await request(app).get('/api/docs/')).status).toBe(200);
    const response = await request(app).get('/api/docs/swagger-ui-init.js');
    expect(response.status).toBe(200);
    expect(response.text).toContain('"/financial/debts"');
    expect(response.text).toContain('"/health"');
  });
});
