# Manual Técnico — Módulo de Gestão de Infraestrutura (Core)

> **Projecto:** Smart Campus Core  
> **Instituição:** Universidade Joaquim Alberto Chissano (UJAC)  
> **Unidade curricular:** Prática Técnico-Profissional III (PTP III)  
> **Módulo:** Gestão de Infraestrutura (Grupo Infraestrutura)  
> **Versão:** 1.0  
> **Última actualização:** Novembro 2026  

---

## 1. Visão geral

O módulo de Gestão de Infraestrutura é responsável pelo cadastro e gestão de:
- **Edifícios** (buildings)
- **Salas** (rooms) — com estado de placa de porta
- **Laboratórios** — associados a salas
- **Equipamentos**
- **Estacionamento** — com leitura de matrículas
- **Pontos de Interesse (POI)** — entradas, WC, biblioteca, etc.
- **Placas de sinalização** — registo do texto de cada placa física

### Modelos Prisma

| Modelo | Tabela BD | Descrição |
|---|---|---|
| `Building` | `Building` | Edifício do campus |
| `Room` | `Room` | Sala (com `temPlaca`, estado AVAILABLE/OCCUPIED/MAINTENANCE/RESERVED) |
| `Laboratory` | `Laboratory` | Laboratório (associado a edifício e opcionalmente a sala) |
| `Equipment` | `Equipment` | Equipamento (associado a sala) |
| `ParkingLot` | `ParkingLot` | Parque de estacionamento |
| `ParkingSpot` | `ParkingSpot` | Vaga de estacionamento |
| `PlateReading` | `PlateReading` | Leitura de matrícula (IN/OUT) |
| `Placa` | `placas` | Placa de sinalização física (porta, entrada, quadro, direcional) |
| `POI` | `poi` | Ponto de interesse no campus |

---

## 2. Regras de negócio

### 2.1 Salas (Rooms)

| Regra | Descrição |
|---|---|
| **Criação** | Rejeita status `OCCUPIED` ou `MAINTENANCE` — apenas `AVAILABLE` ou `RESERVED` |
| **Atualização** | Apenas salas em estado `AVAILABLE` podem ser manipuladas |
| **Eliminação** | Apenas salas em estado `AVAILABLE` podem ser eliminadas |
| **Visibilidade por role** | Não-admin (COORDINATOR, TECHNICIAN, STUDENT, TEACHER) vê apenas salas com `temPlaca = true` |
| **Filtragem POI/Lab** | Salas associadas a POIs ou Laboratórios não aparecem na lista de salas |
| **temPlaca** | Campo booleano — apenas `ADMIN` pode ver/editar na UI |

### 2.2 Pontos de Interesse (POI)

| Regra | Descrição |
|---|---|
| **Associação a sala** | Se um POI está associado a uma sala, o piso é determinado automaticamente |
| **Coordenadas** | Mapa X/Y calculadas automaticamente com base no edifício selecionado |
| **Visibilidade** | Qualquer utilizador autenticado pode listar; ADMIN/COORDINATOR/TECHNICIAN podem criar/editar/eliminar |

### 2.3 Laboratórios

| Regra | Descrição |
|---|---|
| **Associação a sala** | Opcional — um laboratório pode estar associado a uma sala |
| **Visibilidade** | Qualquer utilizador autenticado pode listar |

### 2.4 Placas

| Regra | Descrição |
|---|---|
| **Idempotência** | Upsert por chave natural (tipo + edifício + piso + sala) |
| **Valores NULL** | Onde não há dados, grava-se NULL (não se inventam valores) |
| **sem_placa** | Nenhuma sala é marcada como `sem_placa` sem confirmação explícita |

---

## 3. Endpoints da API

### 3.1 Salas

| Método | Rota | Auth | Roles | Descrição |
|---|---|---|---|---|
| GET | `/rooms` | Sim | Qualquer | Listar salas (filtrado por role e POI/lab) |
| GET | `/rooms/:id` | Sim | Qualquer | Obter sala (404 para não-admin sem placa) |
| POST | `/rooms` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Criar sala |
| PATCH | `/rooms/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Actualizar sala |
| DELETE | `/rooms/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Eliminar sala |

### 3.2 Pontos de Interesse (POI)

| Método | Rota | Auth | Roles | Descrição |
|---|---|---|---|---|
| GET | `/pois` | Sim | Qualquer | Listar pontos de interesse |
| GET | `/pois/:id` | Sim | Qualquer | Obter ponto de interesse |
| POST | `/pois` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Criar ponto de interesse |
| PATCH | `/pois/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Actualizar ponto de interesse |
| DELETE | `/pois/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Eliminar ponto de interesse |

### 3.3 Laboratórios

| Método | Rota | Auth | Roles | Descrição |
|---|---|---|---|---|
| GET | `/laboratories` | Sim | Qualquer | Listar laboratórios |
| GET | `/laboratories/:id` | Sim | Qualquer | Obter laboratório |
| POST | `/laboratories` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Criar laboratório |
| PATCH | `/laboratories/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Actualizar laboratório |
| DELETE | `/laboratories/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Eliminar laboratório |

### 3.4 Edifícios

| Método | Rota | Auth | Roles | Descrição |
|---|---|---|---|---|
| GET | `/buildings` | Sim | Qualquer | Listar edifícios |
| GET | `/buildings/:id` | Sim | Qualquer | Obter edifício |
| POST | `/buildings` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Criar edifício |
| PATCH | `/buildings/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Actualizar edifício |
| DELETE | `/buildings/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Eliminar edifício |

### 3.5 Equipamentos

| Método | Rota | Auth | Roles | Descrição |
|---|---|---|---|---|
| GET | `/equipment` | Sim | Qualquer | Listar equipamentos |
| GET | `/equipment/:id` | Sim | Qualquer | Obter equipamento |
| POST | `/equipment` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Criar equipamento |
| PATCH | `/equipment/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Actualizar equipamento |
| DELETE | `/equipment/:id` | Sim | ADMIN, COORDINATOR, TECHNICIAN | Eliminar equipamento |

---

## 4. Tipos partilhados (packages/shared-types)

### RoomDto
```typescript
export type RoomDto = {
  id: string;
  code: string;
  name: string;
  capacity: number;
  floor: number;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "RESERVED";
  building: { id: string; code: string; name: string };
  temPlaca: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### POIDto
```typescript
export type POIDto = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  edificioId: string | null;
  edificio: { id: string; code: string; name: string } | null;
  sala_codigo: string | null;
  sala: { id: string; code: string; name: string; status: string } | null;
  piso: number | null;
  mapX: number;
  mapY: number;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### LaboratoryDto
```typescript
export type LaboratoryDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  buildingId: string;
  building: { id: string; code: string; name: string };
  sala_codigo: string | null;
  sala: { id: string; code: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
};
```

---

## 5. Schemas de validação (packages/validation)

### createRoomSchema
```typescript
export const createRoomSchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(120),
  capacity: z.number().int().positive().max(1000),
  floor: z.number().int().min(-5).max(100).default(0),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED']).optional(),
  buildingId: z.string().min(1),
  temPlaca: z.boolean().optional(),
});
```

### createPOISchema
```typescript
export const createPOISchema = z.object({
  nome: z.string().min(2).max(120),
  descricao: z.string().max(500).optional().nullable(),
  tipo: z.enum(['ENTRADA', 'SAIDA', 'WC', 'REFEITORIO', 'BIBLIOTECA', 'SECRETARIA', 'AUDITORIO', 'LABORATORIO', 'SALA_AULA', 'ESCADA', 'ELEVADOR', 'OUTRO']),
  edificioId: z.string().optional().nullable(),
  sala_codigo: z.string().optional().nullable(),
  piso: z.number().int().min(-5).max(100).optional().nullable(),
  mapX: z.number().int().min(0).max(1000).default(0),
  mapY: z.number().int().min(0).max(1000).default(0),
  ativo: z.boolean().default(true),
});
```

### createLaboratorySchema
```typescript
export const createLaboratorySchema = z.object({
  code: z.string().min(2).max(32),
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  buildingId: z.string().min(1),
  sala_codigo: z.string().optional().nullable(),
});
```

---

## 6. Migrações

| Migração | Descrição |
|---|---|
| `20261028103000_room_tem_placa` | Adiciona coluna `tem_placa` (BOOLEAN, default false) à tabela `Room` |
| `20261105174500_add_placas_table` | Cria tabela `placas` + enum `PlacaTipo` + FK para `Room.code` |
| `20261105190500_add_poi_table` | Cria tabela `poi` + enum `POITipo` + FKs para `Building.id` e `Room.code` |
| `20261105210500_add_sala_codigo_to_laboratory` | Adiciona coluna `sala_codigo` (nullable FK para `Room.code`) à tabela `Laboratory` |

---

## 7. Seeds

### 7.1 Placas do D2 (`scripts/seed-placas-d2.ts`)
Regista 13 placas do edifício D2:
- 8 placas de porta (D2-101, D2-103, D2-104, D2-201, D2-202, D2-203, D2-204, D2-205)
- 1 placa de entrada (sem piso, sem sala)
- 2 quadros de informação (piso 1 e piso 2)
- 2 placas direcionais (piso 1 e piso 2, direção direita)

Marca `temPlaca = true` nas 8 salas com placa de porta.

### 7.2 POIs do D2 (`scripts/seed-pois-d2.ts`)
Regista 3 pontos de interesse:
- WC (piso 1)
- WC (piso 2)
- Gabinete de Avaliação e Qualidade (piso 2)

---

## 8. Frontend

### 8.1 Páginas

| Página | Rota | Descrição |
|---|---|---|
| `RoomsPage` | `/rooms` | Gestão de salas (com coluna "Tem Placa" apenas para admin) |
| `LaboratoriesPage` | `/laboratories` | Gestão de laboratórios (com associação a sala) |
| `POIPage` | `/pois` | Gestão de pontos de interesse |
| `CampusTwinPage` | `/campus/twin` | Gémeo digital do D2 com marcadores POI |

### 8.2 Sidebar (AppLayout)
O item "Pontos de Interesse" aparece no grupo "Campus" (apenas se o módulo estiver disponível).

### 8.3 Comportamento por role

| Role | Salas visíveis | Coluna "Tem Placa" | Criar/Editar/Eliminar |
|---|---|---|---|
| ADMIN | Todas (incluindo sem placa) | Sim | Sim |
| COORDINATOR | Apenas com placa | Não | Sim |
| TECHNICIAN | Apenas com placa | Não | Sim |
| STUDENT/TEACHER | Apenas com placa | Não | Não |

---

## 9. Ficheiros alterados (resumo)

### Backend (API)
- `apps/api/src/app.ts` — registo do `poiRouter`
- `apps/api/src/modules/poi/` — novo módulo (application + http)
- `apps/api/src/modules/rooms/application/roomService.ts` — regras de negócio + filtragem por role
- `apps/api/src/modules/rooms/http/roomsRouter.ts` — passa role ao service
- `apps/api/src/modules/laboratories/application/laboratoryService.ts` — associação sala
- `apps/api/src/modules/dashboard/application/dashboardService.ts` — contagem filtrada por role + canSeeAlerts
- `apps/api/src/modules/ops/application/opsService.ts` — salas filtradas por role
- `apps/api/src/modules/reports/application/reportService.ts` — contagem filtrada por role

### Frontend (Web)
- `apps/web/src/App.tsx` — rota `/pois`
- `apps/web/src/layouts/AppLayout.tsx` — POI na sidebar
- `apps/web/src/pages/RoomsPage.tsx` — coluna "Tem Placa" (admin only)
- `apps/web/src/pages/LaboratoriesPage.tsx` — dropdown de sala + coluna "Sala"
- `apps/web/src/pages/POIPage.tsx` — novo (formulário + tabela)
- `apps/web/src/pages/CampusTwinPage.tsx` — marcadores POI

### Pacotes partilhados
- `packages/shared-types/src/index.ts` — `POIDto`, `temPlaca` em `RoomDto`, `sala_codigo` em `LaboratoryDto`, POI em `campusModules`
- `packages/validation/src/index.ts` — `createPOISchema`, `updatePOISchema`, `temPlaca` em `createRoomSchema`, `sala_codigo` em `createLaboratorySchema`
- `packages/api-client/src/index.ts` — métodos `pois`, `poi`, `createPoi`, `updatePoi`, `deletePoi`

### Schema e migrações
- `prisma/schema.prisma` — `temPlaca` em Room, model `Placa`, model `POI`, `sala_codigo` em Laboratory
- `prisma/migrations/` — 4 novas migrações

### Documentação
- `docs/manual-apis-core.md` — 5 endpoints POI adicionados
- `docs/openapi.yaml` — endpoints POI + schemas `CreatePOIRequest` e `POIDto`

### Scripts
- `scripts/seed-placas-d2.ts` — seed de 13 placas do D2
- `scripts/seed-pois-d2.ts` — seed de 3 POIs do D2

---

## 10. Como executar

### 10.1 Pré-requisitos
- Node.js 22+, npm 10+
- PostgreSQL 15+ (ou Docker)
- Variável `DATABASE_URL` configurada no `.env`

### 10.2 Instalação
```bash
npm install
npm run db:generate
npm run build -w @smart-campus/shared-types
npm run build -w @smart-campus/validation
npm run build -w @smart-campus/api-client
```

### 10.3 Migrações
```bash
npx prisma migrate deploy
```

### 10.4 Seeds (opcional)
```bash
npx tsx scripts/seed-placas-d2.ts
npx tsx scripts/seed-pois-d2.ts
```

### 10.5 Desenvolvimento
```bash
npm run dev
```
- API: `http://localhost:4100`
- Web: `http://localhost:5173`
- Swagger: `http://localhost:4100/api/docs`

---

## 11. Testes

```bash
# Validar schema
npx prisma validate

# Gerar cliente
npx prisma generate

# Build de todos os pacotes
npm run build

# Testar endpoints (sem auth → 401)
curl http://localhost:4100/api/v1/rooms
curl http://localhost:4100/api/v1/pois
curl http://localhost:4100/api/v1/laboratories
```