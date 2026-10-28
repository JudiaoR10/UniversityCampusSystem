# Evidência — teste de fumo do Core

**Data/hora:** 19 de Outubro de 2026, 10:55–10:56 (CAT)

**Estado:** aprovado

## Objectivo

Confirmar rapidamente que os percursos essenciais do Smart Campus Core
continuam operacionais depois da integração financeira: serviço disponível,
autenticação, autorização e uma escrita transversal na API.

## Execução reproduzível

Na raiz de `UniversityCampusSystem` foi executado:

```bash
npm run test:financial:isolated
```

O executor criou uma instância PostgreSQL 15 descartável, aplicou as quatro
migrações, executou o seed, compilou todos os workspaces e removeu o contentor
no fim. Não foi usada a base de dados habitual do projecto.

## Resultado observado

| Verificação | Resultado |
|---|---:|
| Compilação (shared-types, validation, api-client, API e web) | Aprovada |
| Testes da API | **36 aprovados, 0 falhas** |
| Suites da API | **13 aprovadas, 0 falhas** |
| Teste web de rotas principais | **1 aprovado** |
| Teste de fumo transversal | **6 cenários aprovados** |

Os números provêm do relatório gerado pela execução:
[summary.json](./summary.json) e [api-tests.json](./api-tests.json).

## Cenários do teste de fumo

A suite `apps/api/src/modules/auth/http/auth.integration.test.ts` confirmou:

1. `GET /health` responde `200` com `status: "ok"`.
2. Login com credenciais inválidas responde `401` e mantém o envelope de erro.
3. Login de ADMIN devolve token e permite consultar `/api/v1/me`.
4. Dashboard sem token responde `401`.
5. ADMIN consulta uma sala, cria uma ocorrência e altera o seu estado.
6. STUDENT não consegue consultar a gestão de utilizadores (`403`).

Este é um teste de fumo transversal: não substitui as suites financeiras
detalhadas, mas demonstra que o núcleo, autenticação, permissões e uma operação
de escrita essencial funcionam juntos.

## Critério de aprovação

O teste é aprovado quando a compilação e as três suites (API, web e fluxo
transversal) terminam sem falhas. Todos os critérios foram satisfeitos nesta
execução.
