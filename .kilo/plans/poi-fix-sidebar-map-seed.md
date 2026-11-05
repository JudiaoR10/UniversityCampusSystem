# Plano: corrigir 500 em todos os endpoints (exceto POI) — schema/Prisma client desalinhado

## Estado atual
- POI funciona (retorna 401 sem auth, não 500)
- Todos os outros endpoints (`/rooms`, `/buildings`, etc.) retornam 500 Internal Server Error
- Último erro observado: `The column \`Room.temPlaca\` does not exist in the current database`
- A coluna `tem_placa` EXISTE na BD; o campo `temPlaca` EXISTE no `schema.prisma` (linha 315)
- O Prisma Client provavelmente está desatualizado ou corrompido após as alterações do modelo POI

## Causa-raiz provável
O `npx prisma generate` foi executado depois de adicionar o modelo POI ao schema, mas o cliente gerado pode estar inconsistente com o schema atual, ou o schema foi sobreescrito por `git pull`/`git checkout` durante as operações de merge, deixando o Prisma Client fora de sincronia com o schema que está efetivamente a ser usado pelo servidor.

## Objetivo
Restaurar o funcionamento de TODOS os endpoints existentes (sem 500), mantendo o POI funcional.

## Passos de execução

### 1. Diagnosticar o estado atual
- `npx prisma validate` — confirmar se o schema é válido
- Verificar se `temPlaca` está no schema.prisma no model `Room`
- Verificar se `tem_placa` existe na tabela `Room` na BD
- Verificar logs do servidor para o erro exato de cada endpoint com 500

### 2. Alinhar schema com BD (se necessário)
- Se o schema tem `temPlaca` mas a BD não tem `tem_placa`: remover `temPlaca` do schema OU adicionar a coluna via migration
- Se o schema não tem `temPlaca` mas o código da API referencia: adicionar ao schema
- O objetivo é: schema e BD devem estar 100% alinhados

### 3. Regenerar o Prisma Client
- `npx prisma generate` — gerar cliente baseado no schema alinhado
- Verificar que o cliente reconhece todos os modelos (Room, Building, POI, etc.)

### 4. Reiniciar o servidor
- Parar o `npm run dev` em execução
- `npm run dev` — iniciar de novo
- Confirmar que os endpoints respondem sem 500

### 5. Validar todos os endpoints
- `GET /api/v1/rooms` — deve retornar 401 (sem auth) ou 200 (com auth), não 500
- `GET /api/v1/buildings` — mesmo acima
- `GET /api/v1/pois` — já funciona, deve continuar
- Outros endpoints críticos (`/users`, `/incidents`, etc.)

## Rollback
- Se o 500 persistir após regenerar o cliente: rever `prisma/schema.prisma` para o estado que funciona com a BD atual
- Se necessário: `git stash` as alterações do POI no schema e regenerar, depois reaplicar com cuidado

## Observações
- Não modificar contratos existentes (openapi.yaml, rotas existentes, DTOs existentes)
- O `.kilo/plans/` foi removido por `git clean -fd` anteriormente — este plano está a ser recriado
- O servidor deve estar parado antes de regenerar o Prisma Client e reiniciado depois