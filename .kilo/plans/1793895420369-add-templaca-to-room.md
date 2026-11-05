# Plano: adicionar campo `temPlaca` ao modelo `Room`

## Contexto

- Branch: `feature/grupo-gestao-campus-upstream` (está sincronizada com `origin/feature/grupo-gestao-campus-upstream`, HEAD `7d04b92`; `git pull` seria no-op)
- Não existe qualquer campo `tem_placa` / `temPlaca` nesta branch nem em nenhum commit passado do repositório (pesquisado em todo o histórico: `git log --all -S 'tem_placa'` e `-S 'temPlaca'` devolvem vazio).
- O utilizador reporta que houve uma decisão de projeto: "todas as salas apresentadas, só as alugadas pela universidade teriam `tem_placa = true`". Essa decisão não está registada no código.

## Estado atual (não-commitado)

- `prisma/schema.prisma:259` — já editado (working tree, não-staged): adicionado `temPlaca Boolean @default(false)` ao modelo `Room`.
- `prisma/migrations/` — diretório de migrações não contém nenhuma migração para `tem_placa`. O BD local tem migrações aplicadas que não estão no diretório (`20261028103000_room_tem_placa`, `20261028120000_add_poi`) → divergência schema/BD a resolver.

## Tarefas

1. **Manter a alteração a `prisma/schema.prisma`** — `temPlaca Boolean @default(false)` no modelo `Room` (linha 259). Confirmar que é o nome de campo desejado (`temPlaca` no Prisma → `tem_placa` na coluna SQL).

2. **Criar a migração Prisma** — `prisma/migrations/<timestamp>_add_tem_placa_to_room/migration.sql` com:
   ```sql
   -- AlterTable
   ALTER TABLE "Room" ADD COLUMN "tem_placa" BOOLEAN NOT NULL DEFAULT false;
   ```

3. **Atualizar `prisma/seed.ts`** — definir `temPlaca` nas salas criadas via `prisma.room.upsert` (linhas 206-243). **DECISÃO EM ABERTO**: quais salas ficam com `temPlaca = true`? Sem histórico de commits a consultar, recomendo: salas alugadas pela universidade = `true`, as restantes = `false`. O utilizador deve confirmar ou indicar critério.

4. **Resolver divergência de BD** — o BD local tem migrações aplicadas não registadas no diretório. Verificar se é seguro `prisma migrate deploy` ou se é necessário `migrate reset` (perde dados) / `prisma migrate dev --create-only` já executado anteriormente gerou aviso de divergência.

5. **Gerar cliente Prisma** — `npx prisma generate`.

6. **Validar** — `npx prisma validate`; confirmar que `Room` tem o campo `temPlaca`; rodar testes existentes se aplicável.

## Perguntas em aberto (resolver antes da implementação)

- Qual é o critério exato para `temPlaca = true` no seed (salas alugadas pela universidade? alguma outra regra)?
- Como lidar com a divergência do BD local (migrações aplicadas não registadas): `migrate reset` (perde dados) ou ajustar manualmente?

## Ficheiros afetados

- `prisma/schema.prisma` (modelo `Room`)
- `prisma/migrations/<timestamp>_add_tem_placa_to_room/migration.sql` (novo)
- `prisma/seed.ts` (opcional, consoante decisão)

## Validação

- `npx prisma validate` passa
- O campo `tem_placa` existe na tabela `Room` após aplicar a migração
- Seed preenche `temPlaca` conforme critério acordado
