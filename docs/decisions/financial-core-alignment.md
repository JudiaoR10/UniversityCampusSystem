# Integração financeira sobre o Core oficial

> Actualização de 2026-10-23: a [interface por perfil](frontend-financeiro-por-perfil.md) disponibiliza histórico, fila/decisão de contestações, políticas, resumo e avisos. A pesquisa de estudantes e a lista de contestações acrescentam paginação com total filtrado. A descrição abaixo documenta a integração inicial de 2026-10-08.

Data: 2026-10-08. Branch local: `feature/financial-core-alignment`.
Base oficial: `0e97767ea41051599a32031628064046f7caae74`.

## Decisão

O módulo financeiro é uma extensão do monorepo do docente, em `apps/api/src/modules/financial`. Reutiliza autenticação, renovação, perfil, erros, cliente Prisma e cliente HTTP oficiais. Não foi transplantado o Core alternativo do projecto SMART CAMPUS.

O projecto SMART CAMPUS permanece como referência separada. As suas migrações de utilizadores e sessões não são aplicadas ao Core oficial. Os 109 testes anteriores continuam a descrever aquela implementação; os resultados desta integração encontram-se em `docs/integration-evidence`.

## Alterações concretas

- `FINANCE` acrescentado a RoleCode, validação de criação de utilizadores, tipos partilhados e seed. A migração cria também o registo de Role necessário. A alteração está nesta branch; não representa aceitação upstream pelo docente.
- Entidades financeiras ligadas a `User.id` oficial, sem confundir esse ID com `StudentProfile.id` ou matrícula. Duas migrações aditivas; nenhuma tabela do Core é apagada ou substituída.
- `requireStudent` carrega `role.code`. O bloqueio transaccional usa a tabela oficial `"User"`.
- Auditoria financeira usa `actorId`, `resource` e `metadata`, dentro da mesma transacção das operações de negócio.
- Rotas usam `authenticate` e `authorize(...roles)` oficiais. Excepções de negócio são `AppError`; conflitos Prisma do router financeiro devolvem 409.
- Sucessos usam `success()` do Core, sem exigir `meta.timestamp`. Listagens financeiras conservam `offset/limit`; `meta.total`, quando enviado, é a contagem da página retornada, não o total global. O histórico mantém os seus totais explícitos.
- Métodos financeiros acrescentados a `createApiClient`, conservando `ApiSuccess<T>` e a renovação automática oficial. `/api/v1/me`, `fullName` e resposta de refresh permanecem oficiais.
- OpenAPI financeiro integrado no YAML lido pelo Core, com paths relativos a `/api/v1`.
- Navegação `/financial` usa a sessão oficial. A página permite listar/paginar, criar dívida, confirmar pagamento integral e contestar. O módulo está assinalado `partial`: resolução de contestações, política, relatórios e reenvio têm API/Swagger, mas não formulário próprio nesta página.
- Dispatcher de notificações iniciado e encerrado com a API. URL/token vazios mantêm avisos pendentes. Não foi criado um receptor de notificações fictício nem consideradas implementadas as propostas de integração académica.

## Contratos e permissões

| Operação | Autorização |
|---|---|
| Consultar dívidas/estado/histórico/notificações | STUDENT (apenas próprios), FINANCE, ADMIN |
| Criar dívida, confirmar pagamento, resolver contestação, relatórios, entrega/reenvio | FINANCE, ADMIN |
| Criar contestação | STUDENT proprietário da dívida |
| Consultar/alterar política | ADMIN |

Todas as rotas estão sob `/api/v1/financial`. A política padrão é usada como fallback pelo cálculo; para persistir/configurar, ADMIN faz PATCH `/financial/policies/DEFAULT_POLICY` no Swagger. GET de uma política não persistida devolve 404.

O logout e o ciclo de tokens conservam a semântica oficial: o logout revoga o refresh fornecido; esta adaptação não introduz revogação imediata do access token através de AuthSession. A segurança acrescentada no Core alternativo não é automaticamente atribuída ao Core oficial.

## Instalar numa base própria do Core

Não reutilizar a DATABASE_URL do projecto SMART CAMPUS: os schemas de identidade são diferentes. Para uma instalação local nova, seguir o README oficial e configurar uma base dedicada.

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build
npm run dev
```

O seed cria apenas dados de demonstração e não é um procedimento de migração
de contas reais. As credenciais usadas no ambiente local não são documentação
do contrato do módulo e não devem ser reutilizadas em produção.

Não foi migrada a base antiga nem copiados IDs/contas. Uma migração de dados históricos exige mapear os utilizadores oficiais e conservar referências de dívidas/pagamentos num trabalho separado.

## Validação reproduzível

```bash
npm run test:financial:isolated
```

Requer Docker. Cria PostgreSQL 15 descartável, aplica as migrações oficiais e financeiras desde zero, executa o seed, compila todos os workspaces e executa os testes API/web. O contentor é removido ao terminar. Não escreve no `.env` ou nas bases habituais.

Opcionalmente, com uma instalação de Playwright e Chrome disponível:

```bash
PLAYWRIGHT_MODULE=/caminho/para/playwright CHROME_PATH=/usr/bin/google-chrome npm run test:financial:isolated
```

O teste browser usa o build com `VITE_API_BASE_URL=/api/v1`, servido na mesma origem pela API temporária, e guarda capturas de FINANCE e STUDENT. Sem essa variável, a validação de browser não é executada nessa repetição; verificar a data dos artefactos existentes.

Os testes integrados criam estudantes através de POST `/api/v1/users`, autenticam através de POST `/api/v1/auth/login` e usam os tokens resultantes nas rotas financeiras. Verificam leitura, escrita, BOLA, permissões, 400/401/403/404/409/503, pagamento concorrente, auditoria atómica e renovação do token pelo cliente oficial. Nenhuma autenticação é simulada nesses fluxos.

## Limites desta entrega

- A entrega é feita na branch `feature/financial-core-alignment`. A incorporação na `main` do Core depende da revisão do docente.
- Avisos externos continuam dependentes de um receptor e credenciais acordados. Os testes não comprovam um serviço externo real.
- As propostas académicas C1–C4 não são implementadas por esta adaptação.
- A suite executada cobre a integração e a regressão oficial; não equivale à migração integral dos 109 testes da implementação anterior nem a uma auditoria completa de segurança do Core.
