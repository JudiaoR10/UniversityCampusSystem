# Manual de Construção — Smart Campus Core

> **Projecto:** Smart Campus Core  
> **Instituição:** Universidade Joaquim Alberto Chissano (UJAC)  
> **Unidade curricular:** Prática Técnico-Profissional III (PTP III)  
> **Versão:** 1.0  
> **Última actualização:** Agosto 2026  
> **Objectivo:** Guia passo a passo para **conceber, construir e validar** o Core completo, alinhado com o repositório actual.

---

## Como usar este manual

| Situação | Como ler |
| --- | --- |
| **Reconstruir o Core do zero** | Seguir as Fases 0 → 12 pela ordem |
| **Compreender o que já existe** | Fases 0–2 + consultar o código nas pastas indicadas |
| **Correr o projecto actual** | Fase 11 (instalação) e Fase 12 (validação) |
| **Adicionar um módulo novo** | Fase 10 + [integration-guide.md](./integration-guide.md) |

Documentação complementar:

| Documento | Conteúdo |
| --- | --- |
| [architecture.md](./architecture.md) | Arquitectura, decisão monólito vs distribuído, modelo de dados |
| [api-conventions.md](./api-conventions.md) | Contratos REST |
| [authorization-matrix.md](./authorization-matrix.md) | Matriz RBAC |
| [openapi.yaml](./openapi.yaml) | Especificação OpenAPI |
| [integration-guide.md](./integration-guide.md) | Integração de módulos por grupos |
| [../README.md](../README.md) | Instalação rápida e credenciais demo |

---

## Mapa das fases

```text
Fase 0  Contexto e requisitos
Fase 1  Decisão arquitectural
Fase 2  Definição da infraestrutura tecnológica
Fase 3  Scaffold do monorepo
Fase 4  Pacotes partilhados (tipos, validação, api-client)
Fase 5  Persistência (Prisma + PostgreSQL + seed)
Fase 6  Fundação da API (middleware, erros, health, OpenAPI)
Fase 7  Módulo Auth + Users + Auditoria
Fase 8  Módulos de negócio Core (salas, ocorrências, dashboard, devices, parking)
Fase 9  Frontend (shell, auth, páginas, responsividade)
Fase 10 Extensão de módulos (padrão para grupos PTP III)
Fase 11 Infraestrutura operacional (Docker, env, CI)
Fase 12 Validação ponta-a-ponta e checklist de pronto
```

---

# Fase 0 — Contexto e requisitos

## 0.1 Problema a resolver

Criar um **Core comum** de Smart Campus onde vários grupos da PTP III integram módulos (académico, infraestrutura, IoT, relatórios) **sem duplicar**:

- autenticação e sessões;
- utilizadores e roles;
- auditoria e correlationId;
- formato de erros e respostas API;
- navegação frontend e catálogo de módulos;
- configuração e deploy.

## 0.2 Requisitos funcionais do Core

| ID | Requisito | Estado no projecto |
| --- | --- | --- |
| RF-01 | Login / logout / refresh JWT | Implementado |
| RF-02 | Perfis e roles (5 roles) | Implementado |
| RF-03 | CRUD/consulta de salas | Implementado |
| RF-04 | Ocorrências (criar + alterar estado) | Implementado |
| RF-05 | Auditoria de eventos relevantes | Implementado |
| RF-06 | Dashboard / Centro de Operações | Implementado |
| RF-07 | Dispositivos e alertas (parcial / demo) | Implementado |
| RF-08 | Estacionamento + LPR + matrículas MZ | Implementado |
| RF-09 | Navegação para todos os módulos (placeholders) | Implementado (sem placeholders) |
| RF-10 | Documentação OpenAPI / Swagger | Implementado |

## 0.3 Requisitos não funcionais

| ID | Requisito | Como é cumprido |
| --- | --- | --- |
| RNF-01 | Tipagem ponta-a-ponta | TypeScript + shared-types + Zod |
| RNF-02 | Segurança básica | Helmet, CORS, rate-limit, bcrypt, JWT, RBAC no backend |
| RNF-03 | Rastreabilidade | `correlationId` + `AuditEvent` |
| RNF-04 | Deploy reproduzível | Docker Compose + Dockerfile multi-stage |
| RNF-05 | UI responsiva | Layout drawer, scroll em tabelas, safe-area |
| RNF-06 | Demonstrabilidade académica | Seed + credenciais demo + labels DEMO |

## 0.4 Fluxo transversal mínimo (obrigatório)

```text
Login → GET /me → listar salas → criar ocorrência → alterar estado → ver auditoria
```

Este fluxo deve funcionar no fim da construção (Fase 12).

---

# Fase 1 — Decisão arquitectural

## 1.1 Escolha oficial

| Aspecto | Decisão |
| --- | --- |
| Estilo | **Monólito modular** |
| Repositório | **Monorepo npm workspaces** |
| Deploy | API + Web + PostgreSQL |
| Microserviços | **Não** nesta fase |

Justificação completa: [architecture.md §2](./architecture.md#2-decisão-arquitectural-monólito-modular-vs-distribuído).

## 1.2 Camadas do monólito

```text
Apresentação (apps/web)
        ↓ HTTP/JSON + JWT
Interface HTTP (apps/api/.../http)
        ↓
Aplicação (apps/api/.../application)
        ↓
Domínio (apps/api/.../domain)
        ↓
Persistência (Prisma → PostgreSQL)
```

## 1.3 Fronteiras de módulo (padrão de pastas)

Para cada módulo de negócio:

```text
apps/api/src/modules/<modulo>/
├── domain/          # regras puras / testes de domínio
├── application/     # casos de uso / serviços
└── http/            # routers Express
```

**Regra:** módulos do Core comunicam por **chamadas internas** a serviços, não por HTTP entre si.

## 1.4 Evolução futura (não fazer agora)

Manter no monólito: auth, users, salas, ocorrências, auditoria, dashboard.  
Extrair só quando necessário: ingestão MQTT, processamento LPR pesado.

---

# Fase 2 — Definição da infraestrutura tecnológica

## 2.1 Matriz tecnológica (oficial do projecto)

### Linguagens

| Linguagem | Uso |
| --- | --- |
| TypeScript 5.8 | API, Web, pacotes, seed, testes |
| SQL | Migrações Prisma |
| YAML | OpenAPI, Docker Compose, CI |
| CSS | `index.css` + Tailwind |
| HTML | Entry Vite |
| Markdown | Documentação |

### Runtime e tooling

| Tecnologia | Versão | Função |
| --- | --- | --- |
| Node.js | ≥ 20 (recomendado **22**) | Runtime |
| npm | 10+ | Workspaces |
| Vite | 6.x | Frontend build/dev |
| tsx | 4.x | Executar TS em dev (API + seed) |
| Prisma | 6.5 | ORM + migrações |
| Vitest | 3.x | Testes |
| Supertest | 7.x | Testes HTTP |
| Docker / Compose | — | PostgreSQL + deploy |
| Nginx | Alpine | Servir SPA em produção |
| GitHub Actions | — | CI |

### Backend

| Biblioteca | Função |
| --- | --- |
| Express 4 | HTTP |
| jsonwebtoken | Access + refresh |
| bcryptjs | Hash passwords |
| Zod | Validação |
| helmet / cors / express-rate-limit | Segurança |
| swagger-ui-express + yaml | Docs |

### Frontend

| Biblioteca | Função |
| --- | --- |
| React 19 | UI |
| React Router 7 | Rotas SPA |
| Tailwind CSS 3 | Estilos |
| Fraunces + Manrope | Tipografia |

### Dados

| Tecnologia | Função |
| --- | --- |
| PostgreSQL 16 | SGBD |
| Prisma Client | Acesso tipado |

## 2.2 Portas e URLs padrão

| Serviço | Porta / URL |
| --- | --- |
| Frontend (Vite) | http://localhost:5173 |
| API | http://localhost:4100 |
| Health | http://localhost:4100/health |
| Swagger | http://localhost:4100/api/docs |
| API base | http://localhost:4100/api/v1 |
| PostgreSQL | localhost:5432 |

> **Nota:** a API usa a porta **4100** (não 3000) para evitar conflitos comuns em desenvolvimento.

## 2.3 Variáveis de ambiente (definição)

Ficheiro: `.env.example` → copiar para `.env`.

| Variável | Exemplo | Obrigatória |
| --- | --- | --- |
| `NODE_ENV` | `development` | Não (default) |
| `API_PORT` | `4100` | Não |
| `API_HOST` | `0.0.0.0` | Não |
| `CORS_ORIGIN` | `http://localhost:5173` | Sim (prática) |
| `DATABASE_URL` | `postgresql://smartcampus:smartcampus@localhost:5432/smart_campus?schema=public` | Sim |
| `JWT_ACCESS_SECRET` | ≥ 32 caracteres | Sim |
| `JWT_REFRESH_SECRET` | ≥ 32 caracteres | Sim |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Não |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Não |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Não |
| `RATE_LIMIT_MAX` | `600` | Não |
| `VITE_API_BASE_URL` | `http://localhost:4100/api/v1` | Sim (frontend) |
| `LOG_LEVEL` | `info` | Não |

Validação no backend: `apps/api/src/config/env.ts` (schema Zod).

O limite normal é de 600 pedidos por minuto, por utilizador com token válido; pedidos anónimos usam o IP. Aplica-se apenas a `/api/v1`: ficheiros da interface, documentação e `/health` não consomem a quota. O login tem ainda um limite independente de 20 tentativas falhadas por IP em 15 minutos; entradas bem-sucedidas não consomem esse limite. As respostas 429 incluem `Retry-After` e o identificador do pedido. Reinicie a API após alterar estas variáveis.

## 2.4 Credenciais PostgreSQL (Docker local)

| Campo | Valor |
| --- | --- |
| User | `smartcampus` |
| Password | `smartcampus` |
| Database | `smart_campus` |
| Image | `postgres:16-alpine` |

Definidas em `docker-compose.yml`.

## 2.5 Roles do sistema (RBAC)

| Código | Nome | Uso típico |
| --- | --- | --- |
| `STUDENT` | Estudante | Consulta + criar ocorrências |
| `TEACHER` | Docente | Consulta |
| `TECHNICIAN` | Técnico | Ocorrências, parking, IoT |
| `COORDINATOR` | Coordenador | Gestão + auditoria |
| `ADMIN` | Administrador | Acesso total |

Matriz: [authorization-matrix.md](./authorization-matrix.md).

## 2.6 Convenções de API (contrato)

- Base: `/api/v1`
- Sucesso: `{ data, meta: { correlationId, ... } }`
- Erro: `{ code, message, details, correlationId }`
- Auth: `Authorization: Bearer <accessToken>`
- Datas: ISO-8601
- Nunca devolver passwords, tokens em claro, stack traces ou queries SQL

Detalhe: [api-conventions.md](./api-conventions.md).

---

# Fase 3 — Scaffold do monorepo

## 3.1 Estrutura alvo

```text
UniversityCampusSystem/
├── apps/
│   ├── api/                 # @smart-campus/api
│   └── web/                 # @smart-campus/web
├── packages/
│   ├── shared-types/        # @smart-campus/shared-types
│   ├── validation/          # @smart-campus/validation
│   └── api-client/          # @smart-campus/api-client
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── docs/
├── .github/workflows/
├── docker-compose.yml
├── Dockerfile
├── package.json             # workspaces raiz
├── tsconfig.base.json
├── .env.example
└── README.md
```

## 3.2 Passo a passo — criar a raiz

1. Criar pasta do projecto e inicializar git.
2. Criar `package.json` raiz com:

```json
{
  "name": "smart-campus",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "engines": { "node": ">=20" }
}
```

3. Criar `tsconfig.base.json` com `strict: true`, `target: ES2022`, `module: NodeNext`.
4. Adicionar dependências raiz:

```bash
npm install -D typescript tsx prisma concurrently
npm install @prisma/client bcryptjs
```

5. Scripts raiz (já presentes no projecto):

| Script | Função |
| --- | --- |
| `npm run dev` | API + Web em paralelo |
| `npm run build` | Build na ordem correcta dos workspaces |
| `npm test` | Testes API + Web |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate:dev` | Migrações em desenvolvimento |
| `npm run db:seed` | Seed de demonstração |

## 3.3 Ordem de build (obrigatória)

```text
shared-types → validation → api-client → api → web
```

Sem esta ordem, o frontend/API falham a importar pacotes locais.

## 3.4 Checklist Fase 3

- [ ] Workspaces reconhecidos (`npm install` na raiz)
- [ ] `tsconfig.base.json` existe
- [ ] Pastas `apps/` e `packages/` criadas
- [ ] `.gitignore` inclui `node_modules`, `dist`, `.env`

---

# Fase 4 — Pacotes partilhados

## 4.1 `@smart-campus/shared-types`

**Pasta:** `packages/shared-types/`

**Conteúdo mínimo:**

1. Tipos de API: `ApiSuccess<T>`, `ApiError`
2. Auth: `AuthUser`, `AuthTokens`, `LoginResponse`, `RoleCode`
3. DTOs de negócio: `RoomDto`, `IncidentDto`, `DashboardSummary`, `ParkingLotOverview`, `PlateReadingDto`
4. Catálogo `campusModules[]` com:
   - `key`, `label`, `path`, `description`
   - `status`: `available` | `partial` | `development`
   - `requiredRoles?`, `groupHint?`

**Build:**

```bash
npm run build -w @smart-campus/shared-types
```

**Regra:** o frontend **não inventa** lista de módulos — usa `campusModules`.

## 4.2 `@smart-campus/validation`

**Pasta:** `packages/validation/`

**Dependência:** `zod`

Schemas essenciais:

| Schema | Uso |
| --- | --- |
| `loginSchema` | POST `/auth/login` |
| `refreshSchema` | POST `/auth/refresh` |
| `createUserSchema` | POST `/users` |
| `createRoomSchema` | POST `/rooms` |
| `createIncidentSchema` | POST `/incidents` |
| `updateIncidentStatusSchema` | PATCH `/incidents/:id/status` |
| `createPlateReadingSchema` | POST `/parking/readings` |
| `updateParkingSpotSchema` | PATCH `/parking/spots/:id` |
| `mozambiquePlateSchema` | Matrículas MZ (`AXX 123 MP|MC` ou legado `AAA 12 34`) |

Ficheiro de domínio: `packages/validation/src/mozambiquePlate.ts`.

```bash
npm run build -w @smart-campus/validation
```

## 4.3 `@smart-campus/api-client`

**Pasta:** `packages/api-client/`

Implementar `createApiClient(baseUrl, tokenStore)` com:

1. Header `Authorization: Bearer …`
2. Refresh automático em HTTP 401
3. Métodos tipados: `login`, `me`, `rooms`, `incidents`, `dashboard`, `parkingOverview`, etc.
4. Classe `ApiClientError`

```bash
npm run build -w @smart-campus/api-client
```

## 4.4 Checklist Fase 4

- [ ] Três pacotes compilam
- [ ] `campusModules` inclui ops, dashboard, rooms, incidents, parking, audit, iot, placeholders
- [ ] Validação de matrícula MZ tem testes (API)

---

# Fase 5 — Persistência (Prisma + PostgreSQL)

## 5.1 Subir a base de dados

```bash
docker compose up -d db
```

Confirmar health: contentor `smart-campus-db` healthy.

## 5.2 Schema Prisma

**Ficheiro:** `prisma/schema.prisma`

Domínios a modelar (já no projecto):

| Domínio | Modelos |
| --- | --- |
| Identidade | `Role`, `User`, `RefreshToken` |
| Académico | `Department`, `Course`, `Subject`, `StudentProfile`, `TeacherProfile`, `Enrolment` |
| Campus | `Building`, `Room`, `Laboratory`, `Equipment` |
| Manutenção | `Incident`, `MaintenanceAction` |
| IoT | `Device`, `Sensor`, `Reading`, `Alert` |
| Notificações | `Notification` |
| Auditoria | `AuditEvent` |
| Estacionamento | `ParkingLot`, `ParkingSpot`, `PlateReading` |

Enums: `RoleCode`, `IncidentStatus`, `RoomStatus`, `DeviceStatus`, `ParkingSpotStatus`, `PlateDirection`, etc.

## 5.3 Migrações

No projecto actual existem:

1. `20260812204626_init` — schema inicial  
2. `20260812212238_parking_module` — estacionamento  

Comandos:

```bash
# Gerar client
npm run db:generate

# Desenvolvimento (cria migração)
npm run db:migrate:dev -- --name <nome>

# Aplicar migrações existentes (CI / produção)
npm run db:migrate
```

## 5.4 Seed de demonstração

**Ficheiro:** `prisma/seed.ts`

Deve criar, no mínimo:

1. 5 roles  
2. 5 utilizadores demo (um por role)  
3. Departamento / curso / disciplina exemplo  
4. Edifícios + salas  
5. Dispositivos / sensores / alertas demo  
6. Parque + vagas + leituras LPR com matrículas MZ  

```bash
npm run db:seed
```

### Credenciais demo (desenvolvimento apenas)

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | admin@smartcampus.demo | Admin123! |
| COORDINATOR | coordenador@smartcampus.demo | Coord123! |
| TEACHER | docente@smartcampus.demo | Docente123! |
| TECHNICIAN | tecnico@smartcampus.demo | Tecnico123! |
| STUDENT | estudante@smartcampus.demo | Estudante123! |

## 5.5 Checklist Fase 5

- [ ] PostgreSQL a correr
- [ ] `prisma generate` sem erros
- [ ] Migrações aplicadas
- [ ] Seed conclui e login com `admin@smartcampus.demo` é possível após Auth

---

# Fase 6 — Fundação da API

## 6.1 Bootstrap

Ficheiros:

| Ficheiro | Função |
| --- | --- |
| `apps/api/src/index.ts` | Listen + shutdown graceful |
| `apps/api/src/app.ts` | Composição Express |
| `apps/api/src/config/env.ts` | Validação env |
| `apps/api/src/lib/prisma.ts` | Cliente Prisma singleton |
| `apps/api/src/lib/logger.ts` | Logging estruturado |
| `apps/api/src/lib/errors.ts` | `AppError`, helpers `unauthorized`, `forbidden` |

## 6.2 Middleware (ordem)

Em `createApp()`:

1. `helmet()`  
2. `cors({ origin: CORS_ORIGIN.split(',') })`  
3. `express.json({ limit: '100kb' })`  
4. `correlationIdMiddleware` — gera / propaga `x-correlation-id`  
5. `rateLimit`  
6. Rotas `/health` e `/api/docs`  
7. Router `/api/v1`  
8. 404 JSON  
9. `errorHandler`  

Implementações:

- `apps/api/src/middleware/correlationId.ts`
- `apps/api/src/middleware/errorHandler.ts` (`success()` + handler Zod/AppError)
- `apps/api/src/middleware/auth.ts` (`authenticate`, `authorize`)

## 6.3 Health e OpenAPI

```http
GET /health → { status: "ok", service: "smart-campus-api", timestamp }
```

Swagger: ler `docs/openapi.yaml` e servir em `/api/docs`.

## 6.4 Registar routers v1

Em `app.ts`:

```text
/auth          → authRouter
usersRouter, roomsRouter, incidentsRouter,
auditRouter, devicesRouter, dashboardRouter, parkingRouter
```

## 6.5 Checklist Fase 6

- [ ] `GET /health` responde 200
- [ ] `/api/docs` abre Swagger
- [ ] Env inválida falha no arranque com mensagem clara
- [ ] Erros Zod devolvem `VALIDATION_ERROR`

---

# Fase 7 — Auth, Users e Auditoria

## 7.1 Auth (construção)

**Pasta:** `apps/api/src/modules/auth/`

| Endpoint | Comportamento |
| --- | --- |
| `POST /auth/login` | Validar Zod → bcrypt → emitir access + refresh → guardar hash refresh → auditar |
| `POST /auth/refresh` | Validar refresh → emitir novos tokens |
| `POST /auth/logout` | Revogar refresh (authenticate) |

Regras:

- Access ~15m; Refresh ~7d (configurável)
- Password nunca em logs nem respostas
- Refresh guardado como hash em `RefreshToken`

## 7.2 Users / Me

| Endpoint | Roles |
| --- | --- |
| `GET /me` | autenticado |
| `GET /users` | ADMIN, COORDINATOR |
| `POST /users` | ADMIN |

## 7.3 Auditoria

**Serviço:** `apps/api/src/modules/audit/application/auditService.ts`

Registar eventos em acções críticas (login, criar sala, alterar ocorrência, leitura LPR, etc.) com:

- `action`, `resource`, `resourceId`
- `actorId`, `correlationId`
- `ipAddress`, `userAgent`, `metadata` (JSON)

| Endpoint | Roles |
| --- | --- |
| `GET /audit-events` | ADMIN, COORDINATOR |

## 7.4 Checklist Fase 7

- [ ] Login devolve `user` + `tokens`
- [ ] Pedido sem Bearer → 401
- [ ] Role incorrecta → 403
- [ ] Logout revoga refresh
- [ ] Eventos de auditoria visíveis após acções

---

# Fase 8 — Módulos de negócio Core

Construir pela ordem do fluxo transversal e depois os restantes.

## 8.1 Salas (`rooms`)

| Endpoint | Roles |
| --- | --- |
| `GET /rooms` | autenticado |
| `GET /rooms/:id` | autenticado |
| `POST /rooms` | COORDINATOR, ADMIN |

Validar com `createRoomSchema`. Incluir `building` no DTO.

## 8.2 Ocorrências (`incidents`)

| Endpoint | Roles |
| --- | --- |
| `GET /incidents` | autenticado |
| `POST /incidents` | autenticado (qualquer role) |
| `PATCH /incidents/:id/status` | TECHNICIAN, COORDINATOR, ADMIN |

Estados: `OPEN` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`.

## 8.3 Dashboard

| Endpoint | Roles |
| --- | --- |
| `GET /dashboard` | autenticado |

Devolver `DashboardSummary`: contagens, alertas recentes, actividade, estado do core.

## 8.4 Devices / Alerts (parcial)

| Endpoint | Roles |
| --- | --- |
| `GET /devices` | autenticado |
| `GET /alerts` | autenticado |
| `GET /buildings` | autenticado |

Marcar dados fictícios com `isDemo: true`.

## 8.5 Estacionamento (`parking`)

| Endpoint | Roles |
| --- | --- |
| `GET /parking/overview` | autenticado |
| `GET /parking/readings` | autenticado |
| `POST /parking/readings` | TECHNICIAN, COORDINATOR, ADMIN |
| `PATCH /parking/spots/:id` | TECHNICIAN, COORDINATOR, ADMIN |

Regras de domínio:

- Validar matrícula MZ em `@smart-campus/validation`
- `IN` → ocupar vaga livre com matrícula
- `OUT` → libertar vaga
- Fotos/leituras demo claramente marcadas

## 8.6 Testes mínimos da API

```bash
npm run test:api
```

Cobrir pelo menos:

- validação login
- matrículas MZ
- fluxo auth integração (Supertest)

## 8.7 Checklist Fase 8

- [ ] Fluxo salas + ocorrências funciona via curl/Swagger
- [ ] Parking overview devolve vagas e percentagens
- [ ] Autorização aplicada em **todos** os endpoints mutáveis

---

# Fase 9 — Frontend

## 9.1 Scaffold Vite + React

**Pasta:** `apps/web/`

Dependências: React 19, React Router 7, Tailwind 3, pacotes `@smart-campus/*`.

Entry:

```text
main.tsx → AuthProvider → BrowserRouter → App
```

Env: `VITE_API_BASE_URL=http://localhost:4100/api/v1`

## 9.2 Auth no cliente

**Ficheiro:** `apps/web/src/lib/auth.tsx`

1. `tokenStore` em `localStorage` (`sc_access`, `sc_refresh`)
2. `createApiClient(baseUrl, tokenStore)`
3. `login` / `logout` / `refreshProfile` (`/me`)
4. Hook `useAuth()`

## 9.3 Shell da aplicação

**Ficheiro:** `apps/web/src/layouts/AppLayout.tsx`

- Sidebar com módulos filtrados por role + `campusModules`
- Drawer mobile + overlay + lock de scroll
- Header sticky com título da área actual
- Safe-area e tipografia académica (`BrandMark`)

## 9.4 Rotas (`App.tsx`)

| Rota | Página | Notas |
| --- | --- | --- |
| `/login` | `LoginPage` | pública |
| `/` | redirect → `/ops` | protegida |
| `/ops` | `CampusOpsPage` | home operacional |
| `/dashboard` | `DashboardPage` | clássico |
| `/users` | `UsersPage` | ADMIN/COORD |
| `/rooms` | `RoomsPage` | |
| `/incidents` | `IncidentsPage` | |
| `/parking` | `ParkingPage` | |
| `/iot` | `IotHubPage` | parcial |
| `/devices` | `DevicesPage` | |
| `/alerts` | `AlertsPage` | |
| `/audit` | `AuditPage` | ADMIN/COORD |
| `/admin` | `AdminPage` | ADMIN |
| hubs | `AcademicHubPage`, `CampusHubPage`, `CampusTwinPage` | |

## 9.5 Design system e responsividade

- Classes: `.surface`, `.btn-primary`, `.btn-secondary`, `.field-input`, `.eyebrow`
- Paleta `campus-*` no Tailwind
- Fontes Fraunces + Manrope
- Utilitários: `.table-scroll`, `.parking-map-scroll`
- Viewport: `viewport-fit=cover`
- Alvos de toque ≥ 44px em mobile

## 9.6 Páginas Core a implementar (ordem sugerida)

1. Login  
2. Layout + Dashboard  
3. Rooms + Incidents (fluxo transversal)  
4. Users + Audit  
5. Campus Ops (`useCampusOpsData`)  
6. Parking  
7. IoT hub + Devices + Alerts  
8. Placeholders dos módulos em desenvolvimento  

## 9.7 Checklist Fase 9

- [ ] Login redirecciona para `/ops`
- [ ] Menu mobile abre/fecha
- [ ] Fluxo transversal na UI
- [ ] Tabelas não partem o layout em telemóvel
- [ ] `npm run build -w @smart-campus/web` passa

---

# Fase 10 — Extensão de um módulo (padrão PTP III)

Usar sempre este procedimento ao adicionar funcionalidade.

## 10.1 Backend

1. Actualizar `prisma/schema.prisma` (se necessário)  
2. `npx prisma migrate dev --name <descricao>`  
3. Criar pasta `apps/api/src/modules/<modulo>/`  
4. Schemas Zod em `@smart-campus/validation`  
5. DTOs em `@smart-campus/shared-types`  
6. Serviço + router + `authenticate` / `authorize`  
7. Registar router em `app.ts`  
8. Actualizar `docs/openapi.yaml`  
9. Testes Vitest  

## 10.2 Frontend

1. Método no `@smart-campus/api-client`  
2. Entrada em `campusModules` com estado correcto  
3. Página + rota em `App.tsx`  
4. Item de navegação (via catálogo)  
5. Labels **DEMO** se dados forem fictícios  

## 10.3 Branch e PR

```bash
git checkout -b feature/<modulo>-<objectivo>
```

Seguir [CONTRIBUTING.md](../CONTRIBUTING.md) e template de PR.

---

# Fase 11 — Infraestrutura operacional

## 11.1 Desenvolvimento local (recomendado)

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run db:generate
npm run db:migrate:dev
# se BD nova sem migrações aplicadas, usar o nome da primeira migração conforme README
npm run db:seed
npm run build -w @smart-campus/shared-types
npm run build -w @smart-campus/validation
npm run build -w @smart-campus/api-client
npm run dev
```

Abrir:

- Web: http://localhost:5173  
- API: http://localhost:4100/health  
- Swagger: http://localhost:4100/api/docs  

## 11.2 Docker completo (API + Web + DB)

```bash
cp .env.example .env
docker compose up --build
```

| Serviço | Contentor | Porta host |
| --- | --- | --- |
| `db` | smart-campus-db | 5432 |
| `api` | smart-campus-api | 4100 |
| `web` | smart-campus-web | 5173→80 |

`Dockerfile` multi-stage:

1. `base` — install workspaces  
2. `api-build` / `api` — migrate deploy + Node  
3. `web-build` / `web` — Nginx SPA (`apps/web/nginx.conf`)  

## 11.3 CI (GitHub Actions)

Ficheiro: `.github/workflows/ci.yml`

Pipeline:

1. Node 22 + PostgreSQL service  
2. `npm install`  
3. `prisma generate` + `migrate deploy` + `seed`  
4. Build pacotes partilhados  
5. `npm test`  

## 11.4 Segurança operacional (mínimo)

| Prática | Acção |
| --- | --- |
| Segredos | Nunca commitir `.env` |
| Produção | Rodar JWT secrets longos e únicos |
| CORS | Restringir a origem real do frontend |
| HTTPS | Terminar TLS no reverse proxy |
| Backups | Backup periódico do PostgreSQL |

## 11.5 Checklist Fase 11

- [ ] `docker compose up -d db` healthy  
- [ ] `docker compose up --build` sobe os 3 serviços  
- [ ] CI verde em PR para `main`  

---

# Fase 12 — Validação ponta-a-ponta

## 12.1 Checklist funcional

### Auth

- [ ] Login com cada role demo  
- [ ] Access expirado → refresh automático no cliente  
- [ ] Logout limpa tokens e impede `/me`  

### Fluxo transversal

```bash
# 1. Login
curl -s http://localhost:4100/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@smartcampus.demo","password":"Admin123!"}'

# 2. Usar accessToken em:
# GET /api/v1/me
# GET /api/v1/rooms
# POST /api/v1/incidents
# PATCH /api/v1/incidents/:id/status
# GET /api/v1/audit-events
```

Exemplos: [api-examples.md](./api-examples.md).

### UI

- [ ] `/ops` carrega mapa e métricas  
- [ ] `/rooms` cria sala (admin/coord)  
- [ ] `/incidents` cria e altera estado  
- [ ] `/parking` mapa de vagas + simulação LPR  
- [ ] `/audit` lista eventos  
- [ ] Layout utilizável em telemóvel  

### Qualidade

```bash
npm test
npm run build
```

- [ ] Testes passam  
- [ ] Build completo passa  

## 12.2 Definição de «Core pronto»

O Core está **pronto para demonstração PTP III** quando:

1. Monorepo corre com `npm run dev` ou Docker  
2. Auth JWT + 5 roles funcionam  
3. Fluxo transversal completo (API + UI)  
4. Auditoria regista acções  
5. Módulos não prontos aparecem como `partial` / `development` sem partir navegação  
6. Documentação (`architecture`, OpenAPI, este manual) está actualizada  
7. Dados DEMO estão claramente marcados  

---

## Anexo A — Mapa rápido ficheiro → responsabilidade

| Área | Caminho principal |
| --- | --- |
| Decisão arquitectural | `docs/architecture.md` |
| Schema BD | `prisma/schema.prisma` |
| Seed | `prisma/seed.ts` |
| App Express | `apps/api/src/app.ts` |
| Auth middleware | `apps/api/src/middleware/auth.ts` |
| Módulos API | `apps/api/src/modules/*` |
| Tipos / catálogo | `packages/shared-types/src/index.ts` |
| Zod | `packages/validation/src/index.ts` |
| Cliente HTTP | `packages/api-client/src/index.ts` |
| Rotas UI | `apps/web/src/App.tsx` |
| Auth UI | `apps/web/src/lib/auth.tsx` |
| Layout | `apps/web/src/layouts/AppLayout.tsx` |
| Campus Ops | `apps/web/src/pages/CampusOpsPage.tsx` |
| Parking UI | `apps/web/src/pages/ParkingPage.tsx` |
| Docker | `docker-compose.yml`, `Dockerfile` |
| CI | `.github/workflows/ci.yml` |
| OpenAPI | `docs/openapi.yaml` |

## Anexo B — Ordem recomendada de construção (resumo visual)

```text
[Requisitos] → [Monólito modular] → [Stack + env + portas]
      → [Monorepo] → [shared-types / validation / api-client]
      → [PostgreSQL + Prisma + seed]
      → [API: middleware + health + OpenAPI]
      → [Auth + Users + Audit]
      → [Rooms + Incidents + Dashboard]
      → [Devices/Alerts + Parking]
      → [Web: Auth + Layout + páginas]
      → [Docker + CI]
      → [Validar fluxo transversal]
```

## Anexo C — Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| Import de `@smart-campus/*` falha | Pacotes não buildados | Build na ordem da Fase 3.3 |
| API não arranca | `.env` inválido / JWT curto | Segredos ≥ 32 chars; ver `env.ts` |
| Erro de BD | Postgres parado | `docker compose up -d db` |
| CORS no browser | Origem diferente | Ajustar `CORS_ORIGIN` |
| Login OK mas UI vazia | `VITE_API_BASE_URL` incorrecto | Conferir `.env` e reiniciar Vite |
| Porta em uso | 4100/5173 ocupadas | Parar processo ou alterar env |
| Migração falha | Schema desactualizado | `db:generate` + `migrate:dev` |

---

## Anexo D — Entrega académica sugerida

Para apresentar o Core na PTP III:

1. Diagrama de arquitectura (monólito modular) — `architecture.md` §2–3  
2. Stack tecnológica — Fase 2 deste manual  
3. Demo ao vivo: fluxo transversal + parking + ops  
4. Swagger aberto em `/api/docs`  
5. Explicar módulos `available` (já sem placeholders)
6. Mostrar CI e Docker Compose  

---

*Fim do Manual de Construção — Smart Campus Core.*
