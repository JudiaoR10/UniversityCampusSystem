# Manual das APIs do Core — Smart Campus

> **Projecto:** Smart Campus Core (UJAC / PTP III)  
> **Base URL:** `http://localhost:4100/api/v1`  
> **Health:** `http://localhost:4100/health`  
> **Swagger UI:** http://localhost:4100/api/docs  
> **OpenAPI:** [openapi.yaml](./openapi.yaml)  
> **Versão:** 1.0 — Agosto 2026

Este documento lista **todas as APIs do Core**, explica **como foram criadas** (passo a passo) e mostra **como testá-las** com Swagger, Postman e curl.

---

## Índice

1. [Pré-requisitos para testar](#1-pré-requisitos-para-testar)
2. [Convenções comuns](#2-convenções-comuns)
3. [Catálogo completo das APIs](#3-catálogo-completo-das-apis)
4. [Como criar uma API do Core (padrão)](#4-como-criar-uma-api-do-core-padrão)
5. [Passo a passo por funcionalidade](#5-passo-a-passo-por-funcionalidade)
6. [Testar com Swagger](#6-testar-com-swagger)
7. [Testar com Postman](#7-testar-com-postman)
8. [Testar com curl](#8-testar-com-curl)
9. [Testar com Vitest / Supertest](#9-testar-com-vitest--supertest)
10. [Fluxos de teste recomendados](#10-fluxos-de-teste-recomendados)
11. [Códigos de erro](#11-códigos-de-erro)
12. [Checklist de cobertura](#12-checklist-de-cobertura)

---

## 1. Pré-requisitos para testar

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run db:generate
npm run db:migrate:dev
npm run db:seed
npm run build -w @smart-campus/shared-types
npm run build -w @smart-campus/validation
npm run build -w @smart-campus/api-client
npm run dev:api
```

Confirmar:

```bash
curl -s http://localhost:4100/health
```

### Credenciais demo

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | `admin@smartcampus.demo` | `Admin123!` |
| COORDINATOR | `coordenador@smartcampus.demo` | `Coord123!` |
| TEACHER | `docente@smartcampus.demo` | `Docente123!` |
| TECHNICIAN | `tecnico@smartcampus.demo` | `Tecnico123!` |
| STUDENT | `estudante@smartcampus.demo` | `Estudante123!` |

---

## 2. Convenções comuns

| Item | Valor |
| --- | --- |
| Prefixo | `/api/v1` |
| Formato | JSON (`Content-Type: application/json`) |
| Auth | `Authorization: Bearer <accessToken>` |
| Correlação | Header opcional `x-correlation-id` |
| Sucesso | `{ "data": ..., "meta": { "correlationId": "..." } }` |
| Erro | `{ "code": "...", "message": "...", "details": [], "correlationId": "..." }` |
Detalhe: [api-conventions.md](./api-conventions.md).

### Matriz rápida de autorização

| Operação | STUDENT | TEACHER | TECHNICIAN | COORDINATOR | ADMIN |
| --- | --- | --- | --- | --- | --- |
| Login / refresh | Sim | Sim | Sim | Sim | Sim |
| GET /me, salas, ocorrências, dashboard, devices, parking overview | Sim | Sim | Sim | Sim | Sim |
| Criar ocorrência | Sim | Sim | Sim | Sim | Sim |
| Criar sala | Não | Não | Sim | Sim | Sim |
| Confirmar alerta | Não | Não | Sim | Sim | Sim |
| Ver e marcar as minhas notificações | Sim | Sim | Sim | Sim | Sim |
| Criar dispositivo | Não | Não | Sim | Sim | Sim |
| Alterar estado de dispositivo | Não | Não | Sim | Sim | Sim |
| Eliminar dispositivo | Não | Não | Não | Sim | Sim |
| Tratar ocorrência | Não | Não | Sim | Sim | Sim |
| LPR entrada/saída | Não | Não | Sim | Sim | Sim |
| Listar users | Não | Não | Não | Sim | Sim |
| Criar user | Não | Não | Não | Não | Sim |
| Auditoria | Não | Não | Não | Sim | Sim |

---

## 3. Catálogo completo das APIs

### 3.1 Infraestrutura

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| GET | `/health` | Não | Saúde do serviço (fora de `/api/v1`) |

### 3.2 Autenticação

| Método | Rota | Auth | Roles | Descrição |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | Não | — | Autenticar e obter tokens |
| POST | `/auth/refresh` | Não | — | Renovar access/refresh |
| POST | `/auth/logout` | Sim | Qualquer | Revogar refresh token |

### 3.3 Utilizadores e perfil

| Método | Rota | Auth | Roles | Descrição |
| --- | --- | --- | --- | --- |
| GET | `/me` | Sim | Qualquer | Perfil do utilizador autenticado |
| GET | `/users` | Sim | ADMIN, COORDINATOR | Listar utilizadores |
| POST | `/users` | Sim | ADMIN | Criar utilizador |

### 3.4 Campus físico (salas / edifícios / laboratórios / equipamentos)

| Método | Rota | Auth | Roles | Descrição |
| --- | --- | --- | --- | --- |
| GET | `/rooms` | Sim | Qualquer | Listar salas |
| GET | `/rooms/:id` | Sim | Qualquer | Obter sala |
| POST | `/rooms` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Criar sala |
| PATCH | `/rooms/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Actualizar sala |
| DELETE | `/rooms/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Eliminar sala |
| GET | `/buildings` | Sim | Qualquer | Listar edifícios |
| GET | `/buildings/:id` | Sim | Qualquer | Obter edifício |
| POST | `/buildings` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Criar edifício |
| PATCH | `/buildings/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Actualizar edifício |
| DELETE | `/buildings/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Eliminar edifício |
| GET | `/laboratories` | Sim | Qualquer | Listar laboratórios |
| GET | `/laboratories/:id` | Sim | Qualquer | Obter laboratório |
| POST | `/laboratories` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Criar laboratório |
| PATCH | `/laboratories/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Actualizar laboratório |
| DELETE | `/laboratories/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Eliminar laboratório |
| GET | `/equipment` | Sim | Qualquer | Listar equipamentos |
| GET | `/equipment/:id` | Sim | Qualquer | Obter equipamento |
| POST | `/equipment` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Criar equipamento |
| PATCH | `/equipment/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Actualizar equipamento |
| DELETE | `/equipment/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Eliminar equipamento |

### 3.5 Ocorrências

| Método | Rota | Auth | Roles | Descrição |
| --- | --- | --- | --- | --- |
| GET | `/incidents` | Sim | Qualquer | Listar ocorrências |
| POST | `/incidents` | Sim | Qualquer | Criar ocorrência |
| PATCH | `/incidents/:id/status` | Sim | TECHNICIAN, COORDINATOR, ADMIN | Alterar estado |

### 3.6 Dashboard e auditoria

| Método | Rota | Auth | Roles | Descrição |
| --- | --- | --- | --- | --- |
| GET | `/dashboard` | Sim | Qualquer | Resumo operacional |
| GET | `/audit-events` | Sim | ADMIN, COORDINATOR | Eventos de auditoria (`?limit=`) |

### 3.7 IoT (parcial)

| Método | Rota | Auth | Roles | Descrição |
| --- | --- | --- | --- | --- |
| POST | `/devices` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Criar dispositivo |
| PATCH | `/devices/:id/status` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Alterar estado |
| DELETE | `/devices/:id` | Sim | ADMIN, COORDINATOR | Eliminar dispositivo |
| GET | `/devices` | Sim | Qualquer | Listar dispositivos + sensores |
| GET | `/sensors/:id/readings` | Sim | Qualquer | Leituras de um sensor |
| GET | `/alerts` | Sim | Qualquer | Listar alertas |
| GET | `/notifications` | Sim | Qualquer (só as suas) | Listar as minhas notificações |
| PATCH | `/notifications/:id/read` | Sim | Qualquer (só as suas) | Marcar como lida |
#### PATCH `/alerts/:id/ack`

Marca o alerta como confirmado (`acknowledged: true`). Sem corpo. Idempotente: confirmar de novo devolve o alerta sem alterar nada.

**Respostas:**

| Código | Quando |
| --- | --- |
| 200 | Alerta confirmado (mesma forma que `GET /alerts`) |
| 403 | Role sem permissão |
| 404 | `ALERT_NOT_FOUND` |

**Passos de criação:**

1. Serviço: procura o alerta, actualiza `acknowledged` e regista auditoria `ALERT_ACK`  
2. Rota com `authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN')`  
3. Método `ackAlert` no `api-client`
| PATCH | `/alerts/:id/ack` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Confirmar alerta |
### 3.8 Estacionamento

| Método | Rota | Auth | Roles | Descrição |
| --- | --- | --- | --- | --- |
| GET | `/parking/overview` | Sim | Qualquer | Parques, vagas e ocupação |
| GET | `/parking/readings` | Sim | Qualquer | Leituras LPR (`?limit=`) |
| POST | `/parking/readings` | Sim | TECHNICIAN, COORDINATOR, ADMIN | Registar entrada/saída LPR |
| PATCH | `/parking/spots/:id` | Sim | TECHNICIAN, COORDINATOR, ADMIN | Actualizar estado de vaga |

### 3.9 Grupo Académico (G3 — avaliações, notas, horários, resultados e assiduidade)

| Método | Rota | Auth | Roles | Descrição |
| --- | --- | --- | --- | --- |
| GET | `/assessments` | Sim | STUDENT, TEACHER, COORDINATOR, ADMIN | Listar avaliações (filtros por curso/disciplina) |
| GET | `/assessments/options` | Sim | TEACHER, COORDINATOR, ADMIN | Disciplinas disponíveis para criar avaliações |
| POST | `/assessments` | Sim | TEACHER (docente da disciplina) | Criar avaliação |
| GET | `/assessments/:id` | Sim | TEACHER, COORDINATOR, ADMIN | Obter avaliação |
| GET | `/assessments/:id/roster` | Sim | TEACHER, COORDINATOR, ADMIN | Pauta de notas (estudantes do curso + nota actual) |
| PATCH | `/assessments/:id` | Sim | TEACHER, COORDINATOR, ADMIN | Alterar avaliação |
| GET | `/assessments/:id/grades` | Sim | TEACHER, COORDINATOR, ADMIN | Notas da avaliação |
| POST | `/assessments/:id/grades` | Sim | TEACHER (docente da disciplina) | Lançar nota em bloco |
| GET | `/my/grades` | Sim | STUDENT | Notas do próprio estudante |
| GET | `/my/final-grades` | Sim | STUDENT | Nota final por disciplina (com exame: (admissão+exame)/2) |
| GET | `/students/:id/grades` | Sim | STUDENT, TEACHER, COORDINATOR, ADMIN | Notas do estudante (STUDENT: só o próprio) |
| GET | `/students/:id/final-grades` | Sim | STUDENT, TEACHER, COORDINATOR, ADMIN | Nota final por disciplina (STUDENT: só o próprio) |
| POST | `/results` | Sim | TEACHER (docente da disciplina) | Registar resultado/acta |
| GET | `/results` | Sim | STUDENT, TEACHER, COORDINATOR, ADMIN | Listar resultados (STUDENT: só os seus) |
| GET | `/schedules` | Sim | STUDENT, TEACHER, COORDINATOR, ADMIN | Horários (filtros `courseId`, `subjectId`, `teacherId`, `roomId`, `from`, `to`) |
| GET | `/schedules/options` | Sim | COORDINATOR, ADMIN | Dados de referência para gestão de horários |
| POST | `/schedules` | Sim | COORDINATOR, ADMIN | Criar sessão de horário |
| PATCH | `/schedules/:id` | Sim | COORDINATOR, ADMIN | Alterar sessão de horário |
| DELETE | `/schedules/:id` | Sim | COORDINATOR, ADMIN | Eliminar sessão de horário |
| GET | `/attendance` | Sim | STUDENT, TEACHER, COORDINATOR, ADMIN | Registos de assiduidade (scoping por role) |
| GET | `/attendance/summary` | Sim | STUDENT, TEACHER, COORDINATOR, ADMIN | Taxas de assiduidade por estudante |
| GET | `/attendance/sessions` | Sim | TEACHER, COORDINATOR, ADMIN | Sessões disponíveis para registar assiduidade |
| GET | `/attendance/sessions/:id` | Sim | TEACHER, COORDINATOR, ADMIN | Pauta de assiduidade da sessão |
| POST | `/attendance/sessions/:id` | Sim | TEACHER, COORDINATOR, ADMIN | Registar/actualizar assiduidade em bloco |

**Total Core documentado:** 1 health + **68 endpoints** em `/api/v1` (23 do Core base, incluindo 2 novos em `/rooms`, + 10 da Gestão Académica + 14 do Grupo Infraestrutura + 21 do Grupo Académico G3 — avaliações, notas, resultados, horários e assiduidade).

---

## 4. Como criar uma API do Core (padrão)

Seguir sempre esta ordem ao adicionar um endpoint novo.

### Passo 1 — Definir o contrato

1. Nome do recurso e verbo HTTP  
2. Roles permitidas  
3. Body / query / path params  
4. Forma de `data` na resposta  

Actualizar:

- `packages/shared-types` (DTO)  
- `packages/validation` (Zod)  
- `docs/openapi.yaml`  

### Passo 2 — Persistência (se necessário)

```bash
# editar prisma/schema.prisma
npx prisma migrate dev --name <descricao>
npm run db:generate
```

### Passo 3 — Camada de aplicação

```text
apps/api/src/modules/<modulo>/
├── domain/           # regras + testes
├── application/      # *Service.ts
└── http/             # *Router.ts
```

### Passo 4 — Router HTTP

Modelo mínimo:

```ts
router.get('/recurso', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const body = schema.parse(req.body); // se POST/PATCH
    const result = await service.acao(body, req.user!.id, req.correlationId);
    success(res, result, 201); // ou 200
  } catch (err) {
    next(err);
  }
});
```

### Passo 5 — Registar no app

Em `apps/api/src/app.ts`:

```ts
v1.use(meuRouter);
```

### Passo 6 — Cliente e UI (opcional mas recomendado)

- Método em `packages/api-client`  
- Página / chamada no frontend  

### Passo 7 — Testes e docs

```bash
npm run test:api
# actualizar docs/openapi.yaml e este manual
```

### Passo 8 — Auditoria

Chamar `audit({ action, resource, actorId, correlationId, ... })` em mutações relevantes.

---

## 5. Passo a passo por funcionalidade

### 5.1 Health

| Item | Detalhe |
| --- | --- |
| Ficheiro | `apps/api/src/app.ts` |
| Rota | `GET /health` |
| Auth | Não |

**Criação:** registar rota antes do prefixo `/api/v1`.

**Resposta esperada:**

```json
{
  "status": "ok",
  "service": "smart-campus-api",
  "timestamp": "2026-08-24T20:00:00.000Z"
}
```

---

### 5.2 Autenticação (`auth`)

| Item | Detalhe |
| --- | --- |
| Router | `apps/api/src/modules/auth/http/authRouter.ts` |
| Serviço | `apps/api/src/modules/auth/application/authService.ts` |
| Serviço (alertas) | `apps/api/src/modules/devices/application/alertService.ts` |
| Serviço (notificações) | `apps/api/src/modules/notifications/application/notificationService.ts` |
| Schemas | `loginSchema`, `refreshSchema` |

#### POST `/auth/login`

**Body:**

```json
{
  "email": "admin@smartcampus.demo",
  "password": "Admin123!"
}
```

**Resposta 200:**

```json
{
  "data": {
    "user": {
      "id": "...",
      "email": "admin@smartcampus.demo",
      "fullName": "Admin Demo",
      "role": "ADMIN",
      "isActive": true
    },
    "tokens": {
      "accessToken": "<jwt>",
      "refreshToken": "<hex>",
      "expiresIn": "15m"
    }
  },
  "meta": { "correlationId": "..." }
}
```

#### POST `/auth/refresh`

```json
{ "refreshToken": "<refresh>" }
```

#### POST `/auth/logout`

Headers: `Authorization: Bearer <access>`  
Body (recomendado): `{ "refreshToken": "<refresh>" }`

**Passos de criação (já feitos no Core):**

1. Modelo `User` + `RefreshToken` no Prisma  
2. Hash bcrypt (cost 12) + JWT access + refresh aleatório com hash SHA-256  
3. Schemas Zod  
4. Router + `audit` em login sucesso/falha  
5. Middleware `authenticate` para logout  

---

### 5.3 Utilizadores (`users` / `me`)

| Item | Detalhe |
| --- | --- |
| Router | `apps/api/src/modules/users/http/usersRouter.ts` |

#### GET `/me`

Devolve o `AuthUser` do token.

#### GET `/users`

Lista utilizadores (sem password). Roles: ADMIN, COORDINATOR.

#### POST `/users`

**Body:**

```json
{
  "email": "novo@smartcampus.demo",
  "password": "SenhaForte1!",
  "fullName": "Novo Utilizador",
  "role": "STUDENT"
}
```

Roles do body: `STUDENT` | `TEACHER` | `TECHNICIAN` | `COORDINATOR` | `ADMIN`  
Só **ADMIN** pode criar.

**Passos de criação:**

1. `createUserSchema` em validation  
2. `authService.createUser` + hash password  
3. `authorize('ADMIN')` no POST; `authorize('ADMIN','COORDINATOR')` no GET  
4. Auditoria `USER_CREATED`  

---

### 5.4 Salas e edifícios (`rooms` / `buildings`)

| Item | Detalhe |
| --- | --- |
| Router salas | `apps/api/src/modules/rooms/http/roomsRouter.ts` |
| Serviço salas | `apps/api/src/modules/rooms/application/roomService.ts` |
| Router edifícios | `apps/api/src/modules/buildings/http/buildingsRouter.ts` |
| Serviço edifícios | `apps/api/src/modules/buildings/application/buildingService.ts` |
| Modelos Prisma | `Building`, `Room`, enum `RoomStatus` (já existentes no Core) |

#### GET `/buildings` / GET `/buildings/:id`

Lista/obtém edifícios (seed: tipicamente A, B, …). O DTO inclui `roomsCount`. Estes endpoints são servidos pelo módulo `buildings`.

#### POST / PATCH / DELETE `/buildings(/:id)`

Roles ADMIN, COORDINATOR, TECHNICIAN. Código repetido → `409 BUILDING_CODE_EXISTS`. Auditoria: `BUILDING_CREATE`, `BUILDING_UPDATE`, `BUILDING_DELETE`.

#### GET `/rooms` / GET `/rooms/:id`

DTO inclui `building: { id, code, name }`.

#### POST `/rooms`

**Body:**

```json
{
  "code": "A-101",
  "name": "Sala de Aula 101",
  "capacity": 40,
  "floor": 1,
  "status": "AVAILABLE",
  "buildingId": "<id-do-edificio>"
}
```

`buildingId` obtém-se de `GET /buildings`.

#### PATCH `/rooms/:id`

Aceita os mesmos campos de `POST`, todos opcionais. Código repetido → `409 ROOM_CODE_EXISTS`. Auditoria `ROOM_UPDATE`.

#### DELETE `/rooms/:id`

Resposta `200` com `{ "id": "<id>" }`. Auditoria `ROOM_DELETE`.

**Passos de criação:**

1. Modelos `Building`, `Room` + enum `RoomStatus`  
2. `createRoomSchema`, `createBuildingSchema`  
3. Serviço list/get/create/update/delete + audit  
4. Roles mutação: ADMIN, COORDINATOR, TECHNICIAN  

---

### 5.5 Ocorrências (`incidents`)

| Item | Detalhe |
| --- | --- |
| Router | `apps/api/src/modules/incidents/http/incidentsRouter.ts` |
| Serviço | `apps/api/src/modules/incidents/application/incidentService.ts` |

#### POST `/incidents`

```json
{
  "title": "Projector sem imagem",
  "description": "Sala A-101 — projector não liga",
  "priority": "HIGH",
  "roomId": "<opcional>"
}
```

Prioridades: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`

#### PATCH `/incidents/:id/status`

```json
{
  "status": "IN_PROGRESS",
  "notes": "Técnico deslocado",
  "assigneeId": null
}
```

Estados: `OPEN` | `IN_PROGRESS` | `RESOLVED` | `CLOSED`

**Passos de criação:**

1. Modelo `Incident` + `MaintenanceAction`  
2. Schemas create + update status  
3. Qualquer autenticado cria; só TECHNICIAN+ altera estado  
4. Auditoria em create/update  

---

### 5.6 Dashboard

| Item | Detalhe |
| --- | --- |
| Router | `apps/api/src/modules/dashboard/http/dashboardRouter.ts` |
| Serviço | `apps/api/src/modules/dashboard/application/dashboardService.ts` |

#### GET `/dashboard`

Agrega: utilizador actual, contagens (salas, ocorrências abertas, devices), alertas recentes, actividade, estado `healthy`/`degraded`.

**Passos de criação:**

1. Serviço que consulta Prisma (counts + últimos eventos/alertas)  
2. DTO `DashboardSummary` em shared-types  
3. Endpoint autenticado sem RBAC extra  

---

### 5.7 Auditoria

| Item | Detalhe |
| --- | --- |
| Router | `apps/api/src/modules/audit/http/auditRouter.ts` |
| Serviço | `apps/api/src/modules/audit/application/auditService.ts` |

#### GET `/audit-events?limit=50`

Query: `limit` (default 50).

**Passos de criação:**

1. Modelo `AuditEvent`  
2. Função `audit(...)` usada pelos outros serviços  
3. Listagem só ADMIN/COORDINATOR  

---

### 5.8 IoT — devices, sensors, alerts, notifications

| Item | Detalhe |
| --- | --- |
| Router | `apps/api/src/modules/devices/http/devicesRouter.ts` |
| Serviço (criação) | `apps/api/src/modules/devices/application/deviceService.ts` |
| Router | `apps/api/src/modules/devices/http/devicesRouter.ts` |

#### GET `/devices`

Dispositivos com `sensors` e `room`.

#### POST `/devices`

**Body:**

```json
{
  "code": "TEMP-A-01",
  "name": "Sensor de temperatura A",
  "type": "sensor"
}
```

Campos opcionais: `status` (por omissão `UNKNOWN`), `roomId`, `mqttTopic`.

**Respostas:**

| Código | Quando |
| --- | --- |
| 201 | Dispositivo criado (mesma forma que `GET /devices`) |
| 400 | `VALIDATION_ERROR` com `details` por campo |
| 403 | Role sem permissão |
| 404 | `ROOM_NOT_FOUND` se o `roomId` não existir |
| 409 | `DEVICE_CODE_TAKEN` se o `code` já existir |

**Passos de criação:**

1. `createDeviceSchema` em `packages/validation`  
2. Serviço: verifica código único e sala, cria e regista auditoria `DEVICE_CREATE`  
3. Rota com `authorize('ADMIN', 'COORDINATOR', 'TECHNICIAN')`  
4. DTO `DeviceDto` em shared-types e método `createDevice` no `api-client`

#### GET `/sensors/:id/readings`

Até 100 leituras; campo `isDemo` indica dados fictícios.

#### GET `/alerts`

Últimos 50 alertas (`isDemo` quando aplicável).

**Passos de criação:**

1. Modelos `Device`, `Sensor`, `Reading`, `Alert`  
2. Seed com dados DEMO  
3. Routers GET autenticados (sem mutação nesta fase)  
4. Preparação futura MQTT via `Device.mqttTopic`  

#### GET `/notifications` e PATCH `/notifications/:id/read`

Cada utilizador só vê e marca as **suas** notificações (filtro por `userId` no serviço). Marcar uma notificação de outro utilizador devolve `404 NOTIFICATION_NOT_FOUND`, igual a um id inexistente, para não revelar que o id existe.

| Código | Quando |
| --- | --- |
| 200 | Lista, ou notificação marcada como lida (idempotente) |
| 404 | `NOTIFICATION_NOT_FOUND` |

**Passos de criação:**

1. `NotificationDto` em shared-types  
2. Serviço com filtro `userId` (isolamento entre utilizadores)  
3. Router só com `authenticate`, sem `authorize`: a segurança está no filtro  
4. Métodos `notifications` e `markNotificationRead` no `api-client`

---

### 5.9 Estacionamento (`parking`)

| Item | Detalhe |
| --- | --- |
| Router | `apps/api/src/modules/parking/http/parkingRouter.ts` |
| Serviço | `apps/api/src/modules/parking/application/parkingService.ts` |
| Domínio | `packages/validation/src/mozambiquePlate.ts` |

#### GET `/parking/overview`

Parques com contagens e lista de `spots`.

#### GET `/parking/readings?limit=30`

#### POST `/parking/readings`

```json
{
  "lotId": "<id-do-parque>",
  "plate": "AIT 954 MC",
  "direction": "IN",
  "sensorCode": "CAM-LPR-B-01",
  "confidence": 0.93,
  "photoUrl": "https://example.com/foto.jpg"
}
```

Matrículas válidas:

- Moderno: `AXX 123 MP` ou `AXX 123 MC` (**começa por A**)  
- Legado: `AAA 12 34`  

`IN` ocupa vaga livre; `OUT` liberta vaga com essa matrícula.

#### PATCH `/parking/spots/:id`

```json
{
  "status": "RESERVED",
  "plate": null
}
```

**Passos de criação:**

1. Modelos `ParkingLot`, `ParkingSpot`, `PlateReading`  
2. Migração Prisma  
3. Validação MZ + testes de domínio  
4. Serviço overview / readings / create / update spot  
5. Roles TECHNICIAN+ nas mutações  
6. Seed do parque demo  

### 5.10 Grupo Académico — Horários e Avaliações (G3)

| Item | Detalhe |
| --- | --- |
| Routers | `apps/api/src/modules/schedules/http/schedulesRouter.ts` e `apps/api/src/modules/assessments/http/assessmentsRouter.ts` |
| Serviços | `.../schedules/application/scheduleService.ts` e `.../assessments/application/*Service.ts` |
| Validação | `packages/validation/src/index.ts` (`createScheduleSchema`, `updateScheduleSchema`, `gradeSchema`, …) |
| UI | `apps/web/src/pages/SchedulesPage.tsx` (através de `useAuth().api`) |

#### GET `/schedules`

Devolve os horários visíveis para o papel autenticado (contrato G3):

- STUDENT: sessões do próprio curso; `?studentId` de outro estudante → **403** (anti-BOLA).
- TEACHER: sessões em que é docente.
- COORDINATOR/ADMIN: todas; `?studentId` resolve o curso do estudante.

Filtros opcionais (apenas restringem, nunca ampliam o acesso): `courseId`, `subjectId`, `teacherId`, `roomId`, `from`, `to`. Datas em ISO-8601; valor inválido → **400 `VALIDATION_ERROR`**.

#### GET `/schedules/options`

Apenas COORDINATOR/ADMIN. Devolve `{ courses, subjects, teachers, rooms }` para preencher o formulário de gestão. Docentes listados são utilizadores activos com role TEACHER.

#### POST `/schedules`

Apenas COORDINATOR/ADMIN.

```json
{
  "title": "Aula PTP3 — Projecto",
  "subjectId": "<subject-id>",
  "courseId": "<course-id>",
  "teacherId": "<user-id-role-TEACHER-ou-null>",
  "roomId": "<room-id-ou-null>",
  "startsAt": "2026-11-02T09:00:00.000Z",
  "endsAt": "2026-11-02T10:30:00.000Z"
}
```

Erros de negócio: disciplina inexistente (**404 `SUBJECT_NOT_FOUND`**), curso inexistente (**404 `COURSE_NOT_FOUND`**), docente inexistente (**404 `TEACHER_NOT_FOUND`**), sala inexistente (**404 `ROOM_NOT_FOUND`**), utilizador indicado como docente sem role TEACHER (**409 `TEACHER_ROLE_MISMATCH`**), disciplina de outro curso (**409 `SUBJECT_COURSE_MISMATCH`**), `endsAt <= startsAt` (**400**).

#### PATCH `/schedules/:id`

Alteração parcial; as validações de referências e datas são reaplicadas sobre o estado final.

#### DELETE `/schedules/:id`

Apenas COORDINATOR/ADMIN; devolve `{ "data": { "id": "..." } }`. Registado na auditoria (`SCHEDULE_DELETE`). Id inexistente → **404 `SCHEDULE_NOT_FOUND`**.

> Nota: `ClassSchedule.roomId` é uma referência solta (sem relação Prisma). O campo `room` do `ScheduleDto` é resolvido numa segunda consulta e pode vir `null`.

#### Avaliações e resultados

`POST /assessments` aceita `points` (com `maxPoints`) ou `percentage`; `POST /assessments/:id/grades` lança notas respeitando o tipo. `GET /my/grades` (STUDENT), `GET /students/:id/grades` e `/final-grades` (staff, com verificação anti-BOLA), `POST /results` e `GET /results` completam o contrato G3.

---

### 5.11 Grupo Académico — Assiduidade (G3)

| Item | Detalhe |
| --- | --- |
| Router | `apps/api/src/modules/attendance/http/attendanceRouter.ts` |
| Serviço | `apps/api/src/modules/attendance/application/attendanceService.ts` |
| Validação | `packages/validation/src/index.ts` (`attendanceStatusSchema`, `markAttendanceSchema`) |
| UI | `apps/web/src/pages/AttendancePage.tsx` (através de `useAuth().api`) |

#### GET `/attendance/sessions`

Apenas TEACHER (sessões que lecciona), COORDINATOR, ADMIN (todas). Reutiliza `listSchedules` para devolver as sessões onde se pode registar assiduidade.

#### GET `/attendance/sessions/:id`

Pauta da sessão: todos os estudantes do curso da sessão, com o estado actual (`PRESENT`, `ABSENT`, `LATE`, `JUSTIFIED`) ou `null` se ainda não registado. Apenas TEACHER (sessões que lecciona), COORDINATOR, ADMIN.

#### POST `/attendance/sessions/:id`

Registo/actualização em bloco (upsert). Body:

```json
{
  "records": [
    { "studentId": "<studentProfile-id>", "status": "PRESENT", "note": "Chegou atrasado" },
    { "studentId": "...", "status": "ABSENT", "note": null }
  ]
}
```

Validações: lista não vazia, estado válido, estudante existe, estudante pertence ao curso da sessão (senão **409 `STUDENT_COURSE_MISMATCH`**). Regista auditoria `ATTENDANCE_MARK`.

#### GET `/attendance`

Lista de registos (scoping por role):
- STUDENT: apenas os próprios.
- TEACHER: registos das sessões que lecciona.
- COORDINATOR/ADMIN: todos; filtros opcionais `studentId`, `scheduleId`, `status`.
- STUDENT a filtrar `studentId` de outro → **403** (anti-BOLA).

#### GET `/attendance/summary`

Taxa de assiduidade por estudante: `(PRESENT + LATE) / total * 100`. Scoping igual a `/attendance`. `studentId` opcional (STUDENT só o próprio; staff qualquer).

---

## 6. Testar com Swagger

### 6.1 Abrir a UI

1. Arrancar a API (`npm run dev:api`)  
2. Abrir http://localhost:4100/api/docs  
3. A especificação vem de `docs/openapi.yaml`

### 6.2 Autenticar no Swagger

1. Expandir `POST /auth/login` → **Try it out**  
2. Body:

```json
{
  "email": "admin@smartcampus.demo",
  "password": "Admin123!"
}
```

3. **Execute** → copiar `data.tokens.accessToken`  
4. Clicar **Authorize** (cadeado no topo)  
5. Colar: `Bearer <accessToken>` **ou** só o token (conforme o campo pedir)  
6. **Authorize** → **Close**

### 6.3 Testar endpoints protegidos

1. Expandir o endpoint (ex.: `GET /rooms`)  
2. **Try it out** → **Execute**  
3. Verificar **Code** 200 e corpo `data` / `meta`

### 6.4 Testar mutações no Swagger

Exemplo — criar ocorrência:

1. `POST /incidents`  
2. Body com `title`, `description`, `priority`  
3. Execute → 201  

Exemplo — alterar estado:

1. Copiar `id` da ocorrência  
2. `PATCH /incidents/{id}/status`  
3. Body `{ "status": "IN_PROGRESS" }`  

### 6.5 Dicas Swagger

| Problema | Solução |
| --- | --- |
| 401 em tudo | Reautorizar com access token fresco |
| Token expirado (~15m) | `POST /auth/refresh` ou novo login |
| 403 | Usar role correcta (ex.: admin para criar user) |
| OpenAPI desactualizado | Editar `docs/openapi.yaml` e reiniciar API |

---

## 7. Testar com Postman

### 7.1 Criar colecção

1. Abrir Postman → **New Collection** → nome `Smart Campus Core`  
2. Separadores (folders): `00 Health`, `01 Auth`, `02 Users`, `03 Rooms`, `04 Incidents`, `05 Dashboard`, `06 Audit`, `07 IoT`, `08 Parking`

### 7.2 Variáveis de colecção

| Variável | Valor inicial |
| --- | --- |
| `baseUrl` | `http://localhost:4100/api/v1` |
| `accessToken` | *(vazio)* |
| `refreshToken` | *(vazio)* |
| `roomId` | *(vazio)* |
| `incidentId` | *(vazio)* |
| `lotId` | *(vazio)* |
| `spotId` | *(vazio)* |
| `sensorId` | *(vazio)* |

Em **Authorization** da colecção: Type **Bearer Token**, Token `{{accessToken}}`.

### 7.3 Pedidos essenciais

#### Health

- `GET http://localhost:4100/health` (sem `/api/v1`)

#### Login (guardar tokens)

- `POST {{baseUrl}}/auth/login`  
- Body raw JSON (credenciais admin)  
- **Tests** (script Postman):

```js
const json = pm.response.json();
pm.collectionVariables.set('accessToken', json.data.tokens.accessToken);
pm.collectionVariables.set('refreshToken', json.data.tokens.refreshToken);
```

#### Me / Rooms / Incidents / Dashboard / Parking

Criar pedidos:

| Nome | Método | URL |
| --- | --- | --- |
| Me | GET | `{{baseUrl}}/me` |
| List rooms | GET | `{{baseUrl}}/rooms` |
| List buildings | GET | `{{baseUrl}}/buildings` |
| Create room | POST | `{{baseUrl}}/rooms` |
| List incidents | GET | `{{baseUrl}}/incidents` |
| Create incident | POST | `{{baseUrl}}/incidents` |
| Update incident | PATCH | `{{baseUrl}}/incidents/{{incidentId}}/status` |
| Dashboard | GET | `{{baseUrl}}/dashboard` |
| Audit | GET | `{{baseUrl}}/audit-events?limit=20` |
| Devices | GET | `{{baseUrl}}/devices` |
| Alerts | GET | `{{baseUrl}}/alerts` |
| Sensor readings | GET | `{{baseUrl}}/sensors/{{sensorId}}/readings` |
| Parking overview | GET | `{{baseUrl}}/parking/overview` |
| Parking readings | GET | `{{baseUrl}}/parking/readings` |
| Create LPR | POST | `{{baseUrl}}/parking/readings` |
| Update spot | PATCH | `{{baseUrl}}/parking/spots/{{spotId}}` |
| Refresh | POST | `{{baseUrl}}/auth/refresh` |
| Logout | POST | `{{baseUrl}}/auth/logout` |

Script útil após `GET /parking/overview`:

```js
const lots = pm.response.json().data;
if (lots[0]) {
  pm.collectionVariables.set('lotId', lots[0].id);
  if (lots[0].spots[0]) pm.collectionVariables.set('spotId', lots[0].spots[0].id);
}
```

Após `GET /devices`:

```js
const devices = pm.response.json().data;
if (devices[0]?.sensors?.[0]) {
  pm.collectionVariables.set('sensorId', devices[0].sensors[0].id);
}
```

### 7.4 Alternativa: Insomnia / Thunder Client / Bruno

Mesmo princípio:

1. Environment com `baseUrl` + `accessToken`  
2. Login → guardar token  
3. Header `Authorization: Bearer {{accessToken}}`  
4. Repetir catálogo da secção 3  

---

## 8. Testar com curl

Guardar o token numa variável de shell:

```bash
export API=http://localhost:4100/api/v1

# Login
export TOKEN=$(curl -s $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@smartcampus.demo","password":"Admin123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])")

export AUTH="Authorization: Bearer $TOKEN"
```

### Health

```bash
curl -s http://localhost:4100/health | jq
```

### Perfil e listagens

```bash
curl -s $API/me -H "$AUTH" | jq
curl -s $API/users -H "$AUTH" | jq
curl -s $API/buildings -H "$AUTH" | jq
curl -s $API/rooms -H "$AUTH" | jq
curl -s $API/incidents -H "$AUTH" | jq
curl -s $API/dashboard -H "$AUTH" | jq
curl -s $API/devices -H "$AUTH" | jq
curl -s $API/alerts -H "$AUTH" | jq
curl -s "$API/audit-events?limit=10" -H "$AUTH" | jq
curl -s $API/parking/overview -H "$AUTH" | jq
curl -s "$API/parking/readings?limit=10" -H "$AUTH" | jq
```

### Criar sala

```bash
BUILDING_ID=$(curl -s $API/buildings -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

curl -s $API/rooms -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"code\":\"T-999\",\"name\":\"Sala Teste\",\"capacity\":20,\"floor\":0,\"buildingId\":\"$BUILDING_ID\"}" | jq
```

### Fluxo ocorrência

```bash
ROOM_ID=$(curl -s $API/rooms -H "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

INCIDENT_ID=$(curl -s $API/incidents -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"title\":\"Teste API\",\"description\":\"Criada via curl\",\"priority\":\"MEDIUM\",\"roomId\":\"$ROOM_ID\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

curl -s $API/incidents/$INCIDENT_ID/status -H "$AUTH" -H 'Content-Type: application/json' \
  -X PATCH -d '{"status":"IN_PROGRESS","notes":"Em tratamento"}' | jq
```

### Parking LPR

```bash
LOT_ID=$(curl -s $API/parking/overview -H "$AUTH" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

curl -s $API/parking/readings -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"lotId\":\"$LOT_ID\",\"plate\":\"AIT 954 MC\",\"direction\":\"IN\",\"confidence\":0.95}" | jq

curl -s $API/parking/readings -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"lotId\":\"$LOT_ID\",\"plate\":\"AIT 954 MC\",\"direction\":\"OUT\",\"confidence\":0.95}" | jq
```

### Refresh e logout

```bash
# obter refresh no login (exemplo manual)
curl -s $API/auth/refresh -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq

curl -s $API/auth/logout -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq
```

---

## 9. Testar com Vitest / Supertest

### Correr testes da API

```bash
npm run test:api
```

### O que já existe

| Ficheiro | Cobertura |
| --- | --- |
| `apps/api/src/modules/auth/http/auth.integration.test.ts` | health, login, /me, dashboard 401, fluxo salas→ocorrências→audit, students sem /users |
| `apps/api/src/modules/auth/domain/validation.test.ts` | validação |
| `apps/api/src/modules/parking/domain/mozambiquePlate.test.ts` | matrículas MZ |

### Como adicionar um teste de endpoint

```ts
import request from 'supertest';
import { createApp } from '../../../app.js';

const app = createApp();

it('lista parking overview autenticado', async () => {
  const login = await request(app).post('/api/v1/auth/login').send({
    email: 'admin@smartcampus.demo',
    password: 'Admin123!',
  });
  const token = login.body.data.tokens.accessToken;

  const res = await request(app)
    .get('/api/v1/parking/overview')
    .set('Authorization', `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
});
```

---

## 10. Fluxos de teste recomendados

### Fluxo A — Transversal Core (obrigatório PTP III)

```text
1. POST /auth/login
2. GET  /me
3. GET  /rooms
4. POST /incidents
5. PATCH /incidents/:id/status   (admin/técnico)
6. GET  /audit-events
```

### Fluxo B — Gestão de salas

```text
1. Login (ADMIN ou COORDINATOR ou TECHNICIAN)
2. GET /buildings → buildingId
3. POST /rooms
4. GET /rooms/:id
```

### Fluxo C — Utilizadores

```text
1. Login ADMIN
2. GET /users
3. POST /users
4. Login STUDENT → GET /users → esperar 403
```

### Fluxo D — Estacionamento

```text
1. Login TECHNICIAN
2. GET /parking/overview → lotId
3. POST /parking/readings (IN)
4. GET /parking/overview → vaga OCCUPIED
5. POST /parking/readings (OUT)
6. GET /parking/readings
```

### Fluxo E — IoT leitura

```text
1. Login qualquer
2. GET /devices → sensorId
#### PATCH `/devices/:id/status`

**Body:** `{ "status": "MAINTENANCE" }` (`ONLINE`, `OFFLINE`, `MAINTENANCE` ou `UNKNOWN`).

Idempotente: pôr o estado que já tem devolve o dispositivo sem alterar nada. Passar para `OFFLINE`, ou de `OFFLINE` para `ONLINE`, cria um alerta e uma notificação por cada utilizador com role de gestão, na mesma transacção que o estado.

| Código | Quando |
| --- | --- |
| 200 | Dispositivo com o novo estado |
| 400 | `VALIDATION_ERROR` |
| 403 | Role sem permissão |
| 404 | `DEVICE_NOT_FOUND` |

#### DELETE `/devices/:id`

Só `ADMIN` e `COORDINATOR`. Um dispositivo `ONLINE` não se elimina.

| Código | Quando |
| --- | --- |
| 200 | Eliminado (devolve `{ "id": "..." }`) |
| 403 | Role sem permissão |
| 404 | `DEVICE_NOT_FOUND` |
| 409 | `DEVICE_ONLINE` |
3. GET /sensors/:id/readings
4. GET /alerts
```

### Fluxo F — Sessão

```text
1. Login → access + refresh
2. POST /auth/refresh
3. POST /auth/logout
4. GET /me com token antigo → 401
```

---

## 11. Códigos de erro

| HTTP | code típico | Significado |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Body inválido (Zod) |
| 401 | `UNAUTHORIZED` / `TOKEN_INVALID` / `USER_INACTIVE` | Sem auth ou token inválido |
| 403 | `FORBIDDEN` | Role sem permissão |
| 404 | `ROOM_NOT_FOUND`, `SENSOR_NOT_FOUND`, `PARKING_LOT_NOT_FOUND`, … | Recurso inexistente |
| 409 | `CONFLICT` | Ex.: email duplicado |
| 429 | `RATE_LIMITED` | Demasiados pedidos |
| 500 | `INTERNAL_ERROR` | Erro não tratado |

Exemplo:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Dados inválidos",
  "details": [{ "path": "email", "message": "Email inválido" }],
  "correlationId": "sc-..."
}
```

---

## 12. Checklist de cobertura

Marcar ao validar o Core:

### Infra

- [ ] `GET /health` → 200  

### Auth

- [ ] Login válido → 200 + tokens  
- [ ] Login inválido → 401  
- [ ] Refresh → novos tokens  
- [ ] Logout → refresh revogado  

### Users

- [ ] `/me` → perfil  
- [ ] `/users` admin/coord → 200  
- [ ] `/users` estudante → 403  
- [ ] `POST /users` admin → 201  

### Rooms

- [ ] Listar edifícios e salas  
- [ ] Obter sala por id  
- [ ] Criar sala (roles permitidas)  

### Incidents

- [ ] Listar / criar  
- [ ] Patch status (técnico+)  
- [ ] Estudante não altera status (403)  

### Dashboard / Audit

- [ ] `/dashboard` autenticado  
- [ ] `/audit-events` admin/coord  

### IoT

- [ ] Devices, readings, alerts  

### Parking

- [ ] Overview  
- [ ] Readings GET  
- [ ] IN / OUT com matrícula MZ  
- [ ] Matrícula inválida → 400  
- [ ] Patch spot  

### Documentação

- [ ] Swagger abre e autentica  
- [ ] OpenAPI cobre todos os paths desta lista  
- [ ] Postman / curl dos fluxos A–F passam  

---

## Anexo — Mapa código ↔ endpoint

| Endpoint | Ficheiro principal |
| --- | --- |
| `/health` | `apps/api/src/app.ts` |
| `/auth/*` | `modules/auth/http/authRouter.ts` |
| `/me`, `/users` | `modules/users/http/usersRouter.ts` |
| `/rooms`, `/buildings` | `modules/rooms/http/roomsRouter.ts` |
| `/incidents` | `modules/incidents/http/incidentsRouter.ts` |
| `/dashboard` | `modules/dashboard/http/dashboardRouter.ts` |
| `/audit-events` | `modules/audit/http/auditRouter.ts` |
| `/devices`, `/sensors/:id/readings`, `/alerts` | `modules/devices/http/devicesRouter.ts` |
| Criação de dispositivos | `modules/devices/application/deviceService.ts` |
| `/parking/*` | `modules/parking/http/parkingRouter.ts` |
| `/financial/*` | `modules/financial/http/financialRouter.ts` |
| Middleware JWT/RBAC | `apps/api/src/middleware/auth.ts` |
| Schemas Zod | `packages/validation/src/index.ts` |
| Cliente frontend | `packages/api-client/src/index.ts` |
| Confirmação de alertas | `modules/devices/application/alertService.ts` |

---

## Módulo financeiro

A interface `/financial` consome exclusivamente o cliente HTTP partilhado e apresenta as acções de acordo com o perfil autenticado:

- `STUDENT` consulta as próprias dívidas, pagamentos, contestações e avisos, e pode submeter uma contestação;
- `FINANCE` pesquisa estudantes do Core, gere dívidas e pagamentos, decide contestações, acompanha avisos, gere salários de docentes e emite relatórios mensais;
- `ADMIN` consulta os dados financeiros e salários, imprime relatórios e configura as políticas financeiras; não cria nem altera salários;
- os restantes perfis não têm acesso ao módulo financeiro.

A criação de utilizadores e os dados académicos de estudantes e docentes continuam sob responsabilidade do Core. A pesquisa financeira lê apenas a identidade mínima necessária. O registo de pagamento salarial confirma um pagamento já efectuado e não inicia transferências bancárias.

### Endpoints financeiros

| Área | Endpoints principais | Perfis |
| --- | --- | --- |
| Dívidas e pagamentos | `GET/POST /financial/debts`, `GET /financial/debts/:id`, `POST /financial/payments` | STUDENT lê os próprios dados; FINANCE/ADMIN consultam; FINANCE regista |
| Estado, histórico e avisos | `GET /financial/students/:id/status`, `GET /financial/students/:id/history`, `GET /financial/students/:id/notifications` | STUDENT próprio; FINANCE/ADMIN |
| Pesquisa de estudantes | `GET /financial/students` | FINANCE/ADMIN |
| Contestações | `GET/POST/PATCH /financial/analysis-requests` | STUDENT submete e consulta as próprias; FINANCE/ADMIN consultam; FINANCE decide |
| Resumo e políticas | `GET /financial/reports`, `GET/PATCH /financial/policies/:id` | FINANCE/ADMIN; política alterada apenas por ADMIN |
| Entrega de avisos | `GET/POST /financial/notifications/:id/delivery|retry` | FINANCE/ADMIN |
| Docentes e salários | `GET /financial/teachers`, `GET/POST/PATCH /financial/salaries`, `POST /financial/salaries/:id/payment` | FINANCE gere; ADMIN apenas consulta |
| Relatórios mensais | `GET /financial/reports/payments`, `GET /financial/reports/salaries` | FINANCE/ADMIN |

Os parâmetros, corpos, respostas e códigos de erro estão definidos em [openapi.yaml](./openapi.yaml). A matriz completa está em [authorization-matrix.md](./authorization-matrix.md).

### Verificação

```bash
npm run test:financial:isolated
```

O teste cria uma base PostgreSQL descartável, aplica todas as migrações, executa o build e valida API e frontend. As evidências e capturas estão em [integration-evidence/README.md](./integration-evidence/README.md).

---

## Documentação relacionada

| Documento | Uso |
| --- | --- |
| [openapi.yaml](./openapi.yaml) | Spec formal (Swagger) |
| [api-examples.md](./api-examples.md) | Exemplos curtos curl |
| [api-conventions.md](./api-conventions.md) | Formato sucesso/erro |
| [authorization-matrix.md](./authorization-matrix.md) | RBAC |
| [manual-construcao-core.md](./manual-construcao-core.md) | Construção do sistema |
| [architecture.md](./architecture.md) | Arquitectura |

---

*Fim do Manual das APIs do Core.*
