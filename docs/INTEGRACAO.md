# Integração — API de Avaliações e Horários (G3)

## Visão geral

A API G3 disponibiliza avaliações, notas, médias/resultados, horários, pautas e catálogos académicos. A base URL local é `http://localhost:4100` e todas as rotas de negócio usam o prefixo `/api/v1`.

- Swagger UI: `GET /api/docs`
- Contrato OpenAPI: `GET /api/openapi.json` (cópia versionada: `docs/openapi.yaml`)
- Saúde: `GET /api/v1/health`

As respostas bem-sucedidas usam o envelope `{ "data": ..., "meta": { "correlationId": "..." } }`. Em listas, `meta` inclui também `page`, `pageSize` e `total`.

## Preparação local

1. Instale as dependências: `npm install`.
2. Copie `.env.example` para `.env` e troque todos os segredos de exemplo antes de qualquer ambiente partilhado.
3. Gere o cliente Prisma: `npm run prisma:generate`.
4. Inicie o PostgreSQL: `docker compose up -d`.
5. Crie a estrutura e dados locais: `npm run db:deploy` e `npm run db:seed`.
6. Em outro terminal, inicie os serviços de contrato necessários para fluxos que consultam estudantes, docentes, matrículas e financeiro: `npm run dev:services`.
7. Inicie o G3: `npm run dev`.

Confirme com:

```bash
curl http://localhost:4100/api/v1/health
```

Para desenvolvimento isolado, a autenticação é local por omissão (`AUTH_MODE=standalone`). Para delegar autenticação ao Core, defina `AUTH_MODE=core`, `CORE_AUTH_URL` e, se o Core publicar chaves assimétricas, `CORE_JWKS_URI`, `CORE_JWT_ISSUER` e `CORE_JWT_AUDIENCE`. Os serviços de contrato e respetivos timeouts são configurados pelas variáveis `*_SERVICE_URL` e `CONTRACT_TIMEOUT_MS`.

## Autenticação

Somente `POST /auth/login` e `POST /auth/refresh` são públicos. Todas as demais rotas exigem `Authorization: Bearer <accessToken>`.

O seed local cria, entre outros, estes utilizadores de desenvolvimento:

| Papel | E-mail | Palavra-passe |
| --- | --- | --- |
| SUPER_ADMIN | `admin@ucjac.ac.mz` | `admin123` |
| TEACHER | `prof1@ucjac.ac.mz` | `prof123` |
| STUDENT | `aluno1@student.ucjac.ac.mz` | `aluno123` |

Essas credenciais são exclusivamente locais; não as reutilize fora do ambiente de desenvolvimento.

```bash
curl -X POST http://localhost:4100/api/v1/auth/login \
  -H 'content-type: application/json' \
  -H 'x-request-id: integracao-exemplo-001' \
  -d '{"email":"admin@ucjac.ac.mz","password":"admin123"}'
```

Guarde `data.accessToken` para chamadas autenticadas. O access token expira em 15 minutos por padrão; envie `data.refreshToken` a `POST /api/v1/auth/refresh` para obter um novo par. Finalize a sessão com `POST /api/v1/auth/logout`, enviando o refresh token no corpo e o access token no cabeçalho.

## Chamadas principais

Use UUIDs reais retornados pelos catálogos (`/schools`, `/academic-years`, `/terms`, `/classes`, `/subjects`, `/teachers` e `/students`).

```bash
export API=http://localhost:4100/api/v1
export TOKEN='cole-o-access-token-aqui'

curl "$API/assessments?page=1&pageSize=20" \
  -H "authorization: Bearer $TOKEN"

curl -X POST "$API/schedules" \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "termId":"<uuid>",
    "academicYearId":"<uuid>",
    "classId":"<uuid>",
    "subjectId":"<uuid>",
    "teacherId":"<uuid>",
    "dayOfWeek":"MONDAY",
    "startTime":"08:00",
    "endTime":"10:00",
    "room":"B-12"
  }'
```

| Grupo | Rotas |
| --- | --- |
| Avaliações | `/assessments`, `/assessments/plan`, `/assessments/{id}` |
| Notas | `/assessments/{assessmentId}/grades` e `/assessments/{assessmentId}/grades/{gradeId}` |
| Horários | `/schedules`, `/schedules/{id}`, `/print/class/{classId}/schedule` |
| Resultados | `/results`, `/results/{id}`, `/results/calculate`, `/results/calculation-methods` |
| Pautas | `/print/class/{classId}/pauta` |
| Financeiro do estudante | `/me/financial-status` |
| Catálogos | `/schools`, `/academic-years`, `/terms`, `/classes`, `/subjects`, `/teachers`, `/students` |

Consulte o Swagger para métodos, parâmetros, exemplos completos e respostas de cada rota. A tabela de permissões é gerada em `docs/ROUTE_ACCESS.md`: além do papel, várias rotas verificam se o estudante/docente é dono ou pertence ao recurso solicitado.

## Regras de integração importantes

- Envie `x-request-id` para rastreabilidade; a API devolve o mesmo valor (ou cria um) em `x-request-id` e em `meta.correlationId`.
- `page` inicia em 1 e `pageSize` aceita no máximo 100.
- Datas de avaliações devem ser ISO-8601 com offset; horas de horários usam `HH:mm`.
- A API bloqueia acesso a notas e resultados quando a situação financeira do estudante não está regular. Se o serviço financeiro estiver indisponível, certas leituras retornam `503 FINANCIAL_VERIFICATION_UNAVAILABLE` (fail-closed).
- Os corpos são estritos: campos desconhecidos ou UUIDs/formatações inválidos retornam `400 VALIDATION_ERROR`.

## Erros

O formato de erro é:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dados inválidos",
  "details": [{ "field": "startTime", "message": "Hora inválida (HH:mm)" }],
  "correlationId": "integracao-exemplo-001"
}
```

Os códigos HTTP usuais são `400` (validação), `401` (token ausente/inválido), `403` (papel, posse ou bloqueio financeiro), `404`, `409` (conflito de regra ou duplicidade), `500` e `503` (dependência indisponível). Registre sempre o `correlationId` ao abrir um incidente.

## Validação antes de integrar

```bash
npm run typecheck
npm run docs
npm run build
```

Na revisão de 21-10-2026, os comandos acima e `npm run test:unit` concluíram; a suíte unitária tem 214 testes. O projeto fixa o Vite `6.3.5`, compatível com o Vitest `3.2.7`, para impedir a falha `ERR_REQUIRE_ESM` observada com Vite 7. Antes de promover a API, execute também `npm run test:e2e` e `npm run test:services` com PostgreSQL e os serviços Core disponíveis.
