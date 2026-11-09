# Plano: tabela `placas` + `temPlaca` em `Room`, com dados D2 — IMPLEMENTADO

## Objetivo (concluído)
Adicionar tabela `placas` e manter `temPlaca` (Boolean) na tabela `Room` para o ecrã CRUD do admin. Inserir dados das placas do edifício D2 (UJAC) de forma idempotente numa única transação. Validar com queries. `estado_placa` foi removido por ser redundante com `temPlaca`.

## O que foi implementado

### 1. `prisma/schema.prisma`
- Mantido `temPlaca Boolean @default(false)` no model `Room` (linha 259)
- Adicionado enum `PlacaTipo` (PORTA, ENTRADA, QUADRO_INFORMACAO, DIRECIONAL)
- Adicionado model `Placa` completo com relação `sala → Room` via `sala_codigo` FK
- Adicionado `placas Placa[]` ao model `Room`
- Adicionado `@@map("placas")` para mapear para tabela `placas` (lowercase)

### 2. Migrações criadas
- `prisma/migrations/20261105174500_add_placas_table/migration.sql` — cria tabela `placas`, enum `PlacaTipo`, índices e FK
- `prisma/migrations/20261028103000_room_tem_placa/migration.sql` — recriado ficheiro em falta para a coluna `tem_placa` (já existia na BD e no `_prisma_migrations`)

### 3. Dados inseridos (idempotente, transação única)
**13 placas para o edifício D2:**
- 8 placas de porta (D2-101, D2-103, D2-104, D2-201, D2-202, D2-203, D2-204, D2-205)
- 1 placa de entrada (sem piso, sem sala)
- 2 quadros de informação (piso 1 e piso 2)
- 2 placas direcionais (piso 1 e piso 2, direção direita)

**4 salas em falta criadas:** D2-103, D2-202, D2-205, D2-207A

**`tem_placa = true` em 8 salas:** D2-101, D2-103, D2-104, D2-201, D2-202, D2-203, D2-204, D2-205

### 4. Script de execução
`scripts/seed-placas-d2.ts` — script idempotente com upsert de placas e update de `tem_placa`

## Resultados da validação

**Contagem de placas por tipo (D2):**
| tipo | total |
|------|-------|
| PORTA | 8 |
| ENTRADA | 1 |
| QUADRO_INFORMACAO | 2 |
| DIRECIONAL | 2 |
| **Total** | **13** |

**Salas D2 com `tem_placa = true` (8):** D2-101, D2-103, D2-104, D2-201, D2-202, D2-203, D2-204, D2-205

**Salas D2 com `tem_placa = false` (17):**
- Piso 1: D2-102, D2-105, D2-106, D2-107, D2-108, D2-109, D2-110, D2-111, D2-112
- Piso 2: D2-206, D2-207, D2-207A, D2-208, D2-209, D2-210, D2-211, D2-212, D2-213

**Salas com `sem_placa`:** 0 (não marcado sem confirmação)

## Discrepâncias registadas (observacoes)
- D2-104: porta diz "Serviços de Apoio ao Estudante"; direcional piso 1 diz "Gabinete de Apoio ao Estudante"
- D2-205: "Sala de Aula" na placa vs "Laboratorio" na etiqueta e no quadro

## Rollback
- `prisma migrate rollback` (remove tabela `placas`, coluna `tem_placa`, ENUMs)
- Ou manualmente: `DROP TABLE "placas"; ALTER TABLE "Room" DROP COLUMN "tem_placa"; DROP TYPE "PlacaTipo";`

## Observações
- O campo `temPlaca` está disponível para o ecrã CRUD do admin
- Requisito de visibilidade por role (apenas admin vê/edita) é alteração de API/frontend, fora do escopo deste plano
- Script em `scripts/seed-placas-d2.ts` é idempotente (pode ser re-executado com segurança)