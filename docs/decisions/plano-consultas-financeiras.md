# Plano para aprovação — pesquisa de estudantes e consulta de contestações

> Actualização de 2026-10-23: as consultas e a ligação ao frontend foram implementadas no âmbito do pedido de sincronização das acções por perfil. Ver [registo da implementação](frontend-financeiro-por-perfil.md). O texto abaixo preserva a proposta original.

**Data:** 2026-10-13 · **Estado:** proposta, aguardando aprovação do utilizador.

**Âmbito confirmado:** backend e cliente HTTP primeiro. A ligação à página financeira será uma etapa posterior do frontend. Este documento é o plano; as funcionalidades descritas ainda não foram implementadas.

## Resultado esperado

1. A tesouraria consegue pesquisar um estudante por nome ou matrícula e obter o `User.id` correcto para criar uma dívida, através de uma consulta restrita.
2. A tesouraria consegue descobrir contestações pendentes e consultar a justificação; cada estudante consegue consultar os seus próprios pedidos e decisões.
3. O frontend recebe métodos tipados, contratos documentados e paginação suficiente para construir estes fluxos.

Base de execução: `UniversityCampusSystem`, na branch local `feature/financial-core-alignment`, preservando as alterações de integração existentes. Referências: [arquitectura do Core](../architecture.md), [integração financeira actual](financial-core-alignment.md) e [contrato recebido de Estudantes e Docentes](../../../Contratos/recebidos/contratos-api-estudantes-docentes.md).

## Decisões propostas

| Tema | Decisão |
|---|---|
| Identidade | `studentId` financeiro continua a significar `User.id`. A matrícula é `StudentProfile.studentNumber` e serve para pesquisa/apresentação. |
| Origem dos dados | Serviço interno mínimo na área de utilizadores do Core, consultando `User` e a relação opcional com `StudentProfile` já existentes. Leitura pelo Prisma partilhado, sem copiar cadastros. |
| Fronteira dos módulos | A nova pesquisa é uma operação da tesouraria sob `/financial`. Não concede acesso a `/users` nem altera `/students` do parceiro. O serviço interno concentra a projecção mínima da identidade. |
| Perfis incompletos | Um utilizador STUDENT sem perfil académico continua pesquisável por nome; `studentNumber` será `null`. |
| Contas inactivas | São incluídas e identificadas por `isActive: false`. Este campo descreve a conta do Core, não o estado académico. Mantém-se a regra actual de criação de dívidas, que não exclui contas inactivas. |
| Base de dados | Os modelos existentes suportam estas consultas. Não se prevê alteração de schema ou migração neste incremento. |
| Alterações existentes | POST/PATCH de contestações e criação de dívidas mantêm contratos e regras actuais. As novas consultas usam DTOs de leitura próprios. |

O contrato recebido de Estudantes e Docentes descreve consultas HTTP e não concede FINANCE à listagem de estudantes. A interface interna proposta segue a arquitectura do Core local e deve ficar registada como decisão desta implementação, para alinhamento com Core/Estudantes e Docentes quando os módulos forem reunidos. A aprovação deste plano não representa aceite do parceiro nem autoriza chamadas às rotas dele com permissões inexistentes.

## 1. Fixar os contratos de leitura

Base comum: `/api/v1/financial`; autenticação e erros do Core.

| Nova rota | Perfis autorizados | Parâmetros |
|---|---|---|
| GET `/students` | FINANCE, ADMIN | `q?`, `offset?`, `limit?` |
| GET `/analysis-requests` | FINANCE, ADMIN; STUDENT apenas próprios | `status?`, `studentId?`, `debtId?`, `offset?`, `limit?` |
| GET `/analysis-requests/:id` | FINANCE, ADMIN; STUDENT proprietário | ID interno da contestação |

**Pesquisa de estudantes:** seleccionar apenas contas com `role.code = STUDENT`. Quando fornecido, `q` é aparado e tem 2–100 caracteres; pesquisa parcial por nome ou matrícula, sem distinguir maiúsculas/minúsculas. Sem `q`, devolver a primeira página. Ordenação estável por `fullName`, depois `id`.

**Listagem de contestações:** `status` aceita `PENDENTE_ANALISE`, `PROCEDENTE` ou `IMPROCEDENTE`; ausência inclui todos. IDs de filtro e detalhe são strings não vazias até 200 caracteres. Ordenação por `createdAt` descendente, depois `id` ascendente. `studentId`, quando usado, é sempre `User.id`.

**Paginação das duas novas listas:** `offset` padrão 0, intervalo 0–100000; `limit` padrão 20, intervalo 1–100. `meta.total` conta todos os resultados autorizados que satisfazem os filtros. Devolver também `offset`, `limit` e `hasMore`. Sem resultados: `data: []`, `total: 0`, `hasMore: false`. Um offset além do fim devolve lista vazia, preservando o total real. Não alterar a semântica das listas antigas neste trabalho.

Exemplo de pesquisa:

```json
{
  "data": [{ "userId": "user-001", "fullName": "Estudante Exemplo", "studentNumber": "20260001", "isActive": true }],
  "meta": { "correlationId": "corr-001", "offset": 0, "limit": 20, "total": 1, "hasMore": false }
}
```

Criar `StudentIdentitySummaryDto` para essa identificação. A selecção posterior no frontend enviará `resultado.userId` no campo já existente `CreateDebtInput.studentId`.

Criar `FinancialAnalysisRequestViewDto`, que estende o `AnalysisRequestDto` existente com `student: StudentIdentitySummaryDto` e `debt: { id, code, title, amount }`. Usar esse DTO tanto na nova lista como no detalhe. Assim, o frontend recebe justificação, estado, prazo, decisão quando existir, nome do estudante e identificação da dívida sem uma chamada adicional por linha. `amount` conserva o formato numérico em MZN da API actual. A projecção do titular de uma contestação histórica não deve desaparecer se a sua conta ficar inactiva ou mudar de papel.

Preservar o `AnalysisRequestDto` e os retornos actuais de POST/PATCH. O resumo de dívida das novas consultas não inclui estado calculado; o detalhe financeiro existente continua a fornecê-lo.

## 2. Implementar a pesquisa de estudantes

1. Criar `apps/api/src/modules/users/application/studentDirectoryService.ts` como serviço interno de leitura mínima, com operações de pesquisa e projecção da identidade necessárias aos fluxos autorizados.
2. Receber o contexto do actor autenticado e validar FINANCE/ADMIN para a pesquisa. Consultar por Prisma apenas os campos previstos no DTO; a consulta e a contagem usam os mesmos filtros.
3. Expor GET `/financial/students` pelo router financeiro, usando `authenticate`, `authorize`, schemas Zod e `success()` existentes.
4. A pesquisa não altera utilizadores, perfis académicos, inscrições ou permissões gerais. Não devolve email, telefone, credenciais ou campos internos adicionais.

## 3. Implementar as consultas de contestações

1. Acrescentar casos de uso de listagem e detalhe ao serviço financeiro, recebendo actor autenticado, filtros e paginação.
2. Aplicar autorização também na camada de aplicação. Para STUDENT, restringir todas as consultas e totais ao próprio `actor.id`; um filtro explícito para outro `studentId` devolve 403. Um `debtId` alheio intersectado com a restrição de proprietário devolve lista vazia, sem dados ou contagens de terceiros.
3. No detalhe, devolver 404 `ANALYSIS_REQUEST_NOT_FOUND` para ID inexistente e 403 `FORBIDDEN` para um pedido de outro estudante, seguindo a convenção actual do detalhe de dívidas. Autorizar antes de devolver ou projectar o contexto do estudante e da dívida.
4. Obter o contexto dos titulares através da interface interna de identidade e as referências das dívidas com consultas em lote/relações, evitando uma pesquisa de utilizador por linha. A projecção de identidade para STUDENT limita-se ao próprio utilizador; a procura livre continua exclusiva de FINANCE/ADMIN.
5. Montar os dois GET no router, preservando POST/PATCH. Nenhum GET decide a contestação, actualiza a dívida ou desencadeia envio de notificação.

Erros comuns das novas rotas: 400 `VALIDATION_ERROR`; 401 conforme autenticação do Core; 403 `FORBIDDEN`; 404 apenas no detalhe inexistente. TECHNICIAN, TEACHER e COORDINATOR não recebem acesso financeiro por esta alteração.

## 4. Preparar o cliente HTTP partilhado

Acrescentar métodos tipados em `@smart-campus/api-client`:

```ts
financialStudents({ q?, offset?, limit? })
financialAnalysisRequests({ status?, studentId?, debtId?, offset?, limit? })
financialAnalysisRequest(id)
```

Reutilizar a sessão, Bearer, renovação e `ApiClientError` existentes. Construir parâmetros com `URLSearchParams`, omitindo valores ausentes, e codificar IDs de caminhos. Acrescentar os campos opcionais de paginação ao tipo de `meta` partilhado; as novas rotas garantem-nos no contrato OpenAPI. Nenhum método usa credenciais de serviço ou segundo login.

Nesta etapa a página financeira continuará com a apresentação actual. O backend e o cliente ficarão prontos para substituir o campo manual por um selector e acrescentar a lista/detalhe quando iniciarmos o frontend.

## 5. Documentar e verificar

Actualizar `docs/openapi.yaml`, `docs/authorization-matrix.md`, a referência [API financeira existente](../../../Contratos/06-api-financeira-existente.md) e a nota de integração. Documentar a interface de leitura interna e a pendência de alinhamento com o parceiro sem reescrever o contrato recebido. A referência de API só deve anunciar as rotas como existentes após implementação e validação.

| Verificação de aceitação | Resultado esperado |
|---|---|
| FINANCE/ADMIN pesquisam nome e matrícula | Resultados correctos, DTO mínimo, matrícula anulável e identificação de conta inactiva |
| Pesquisa inclui contas de outros papéis na base | Apenas contas STUDENT aparecem nos resultados |
| STUDENT/TEACHER/TECHNICIAN/COORDINATOR tentam pesquisar | 403; a listagem geral `/users` continua proibida a FINANCE |
| Criar dívida usando `userId` devolvido pela pesquisa | Dívida associada ao utilizador correcto; nenhuma confusão com perfil ou matrícula |
| FINANCE/ADMIN listam e consultam contestações | Filtros correctos e contexto legível de estudante/dívida |
| Dois estudantes com pedidos próprios | Cada um vê apenas os seus dados e totais; filtro de outro estudante/detalhe alheio devolve 403 |
| Filtro `debtId` alheio enviado por STUDENT | Lista vazia sem informação de terceiros |
| Contestações pendentes e decididas | Todos os estados podem ser consultados; decisão já existente aparece correctamente |
| Consulta de contestação histórica após alteração do papel/inactivação do titular | FINANCE/ADMIN continuam a obter o pedido e a identificação do titular |
| Query inválida, repetida como array, limites inválidos, token ausente/inválido e ID inexistente | 400/401/404 conforme o contrato, com envelope e correlação oficiais |
| Várias páginas, sem resultados, offset além do fim, empates de nome/data | Totais filtrados correctos, limites respeitados, ordenação determinística e `hasMore` correcto |
| Métodos do cliente com paginação e filtros | Parâmetros e dados correctos, preservando o comportamento de autenticação/renovação do Core |
| Fluxo criar → listar → consultar → decidir → consultar | Estado final e notas da decisão visíveis, sem regressão das restrições de POST/PATCH |

Implementar testes Vitest/Supertest com login real do Core e PostgreSQL descartável, incluindo chamadas directas à camada de aplicação para comprovar que a autorização não depende apenas do router. Criar dados de teste específicos para perfis com e sem matrícula, homónimos e contas inactivas.

Executar `npm run test:financial:isolated`: o procedimento existente prepara uma base de testes, compila os workspaces e executa as suites API/web. Acrescentar os novos testes ao padrão já descoberto pelo Vitest e guardar os resultados com a data real. Notificações externas ficam desconfiguradas no ambiente de testes. Não executar testes de escrita sobre a base habitual.

## Ficheiros previstos e ordem de execução

| Passo | Ficheiros/responsabilidade | Entrega verificável |
|---|---|---|
| 1 — Contratos | `packages/shared-types/src/index.ts`, `packages/validation/src/index.ts` | DTOs e schemas das três consultas |
| 2 — Estudantes | Novo `users/application/studentDirectoryService.ts`; router financeiro | Pesquisa restrita e identidade reutilizável |
| 3 — Contestações | `financial/application/financialService.ts`, `financial/domain/financial.domain.ts`, `financial/http/financialRouter.ts` | Lista e detalhe com autorização por proprietário |
| 4 — Cliente | `packages/api-client/src/index.ts` | Três métodos tipados prontos para o frontend |
| 5 — Verificação | Novos testes nas áreas `users`/`financial` conforme o padrão `*.test.ts`; regressão existente | Fluxos e restrições comprovados em base descartável |
| 6 — Documentação | OpenAPI, matriz de autorização, referência da API e nota da decisão interna | Contrato final reflecte o código validado |

Tipos e contratos são definidos primeiro; implementação e testes avançam por funcionalidade. O incremento fica concluído quando as três consultas, o cliente e os testes passam, e a documentação coincide com o comportamento observado.

**Aprovação solicitada:** executar este plano para backend e cliente HTTP, incluindo a consulta interna mínima de identidade do Core. Notificações, ecrãs, expansão de relatórios e integrações académicas de cobrança permanecem fora deste incremento.
