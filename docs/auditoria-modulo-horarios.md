# Auditoria — Módulo Horários & Avaliações (contrato G3)

**Data:** 2026-10-16 · **Âmbito:** `UniversityCampusSystem-main` · **Fonte:** `03-financeiro-avaliacoes-horarios.md` (v0.2, contrato G3) e `docs/openapi.yaml`.
**Método:** confronto requisito → evidência de código/testes; bateria de testes e smoke test ao vivo. As referências apontam para funções e ficheiros (não para números de linha, que mudam com frequência).

## Bateria de validação

| Verificação | Comando | Resultado |
| --- | --- | --- |
| Build monorepo | `npm run build` | OK |
| Testes API | `DATABASE_URL=…5432 npx vitest run` (apps/api) | 85/85 PASS |
| Testes Web | `npx vitest run` (apps/web) | 16/16 PASS |
| Lint | `npm run lint` | OK |
| Typecheck | `tsc -p apps/api` e `tsc -b apps/web` | OK |
| Smoke test | API local + `curl` (login, `GET /rooms`, `/schedules`, `/assessments`, `/results`, `/attendance`, `GET/POST/DELETE /schedules`) | OK (200 com token, 401 sem token, 403 em falta de permissão) |

## Critérios mínimos de aceitação (ficha G3)

| # | Requisito | Estado | Evidência |
| --- | --- | --- | --- |
| 1 | `GET /assessments` 200, 401, 403 | PASS | `assessmentsRouter.ts` (`GET /assessments`); `assessments.integration.test.ts` |
| 2 | `GET /schedules` 200, 401, 403 | PASS | `schedulesRouter.ts` (`GET /schedules`); smoke test (401 sem token, 200 com token) |
| 3 | `GET /results` 200, 401, 403 | PASS | `assessmentsRouter.ts` (`GET /results`); `contract-g3.integration.test.ts` |
| 4 | `POST /assessments` 201, 400/401/403 | PASS | `assessmentsRouter.ts` (`POST /assessments`); `assessments.integration.test.ts` |
| 5 | `POST /results` 201, 400/401/403 | PASS | `assessmentsRouter.ts` (`POST /results`); `contract-g3.integration.test.ts` |
| 6 | STUDENT só vê os seus resultados/horários | PASS | `resultService.listResults`, `scheduleService.listSchedules`; anti-BOLA testado (403) |
| 7 | TEACHER não gere avaliações/resultados de disciplina alheia | PASS | `assessmentService.assertCanManageAssessment`, `resultService` |
| 8 | Rota de gestão de horários do COORDINATOR definida | PASS | `POST/PATCH/DELETE /schedules`, roles COORDINATOR/ADMIN |
| 9 | Resolver `StudentProfile.id → User.id` e IDs coerentes | PASS | `resultService.mapResult` (devolve `studentProfileId` e `studentUserId`); IDs na resposta coincidem |
| 10 | Envelope `{ data, meta.correlationId }` e correlação propagada | PASS | `errorHandler.ts` (`success`); header `x-correlation-id` confirmado no smoke test |
| 11 | DTOs, campos, filtros e códigos de erro definidos | PASS | `packages/shared-types`, `docs/openapi.yaml` (ScheduleDto, ScheduleOptions, ResultDto, AttendanceDto, erros) |
| 12 | Bloqueio financeiro em `GET /results` | N-A | Não aprovado pela ficha; **deliberadamente não implementado** |
| 13 | Rotas financeiras (`/financial/integration/*`, cobranças) | N-A | Pertencem ao Financeiro; fora do âmbito G3 |
| 14 | Path frontend `/schedules` | PASS | `apps/web/src/pages/SchedulesPage.tsx`, rota em `App.tsx`, menu em `AppLayout.tsx` |
| 15 | Paths frontend `/assessments` e `/attendance` | PASS | `AssessmentsPage.tsx` (staff: criar/editar/lançar notas; aluno: pauta final e notas) e `AttendancePage.tsx` (staff: marcar; aluno: resumo e registos). Ambos os módulos estão `available` em `campusModules`. |

## Funcionalidades de UI por módulo

| Módulo | Página | Funcionalidades cobertas |
| --- | --- | --- |
| Horários | `SchedulesPage.tsx` | Listagem agrupada por dia, filtros (curso, docente, sala, período), criar/editar/eliminar (COORDINATOR/ADMIN), estados de carregamento/erro/vazio |
| Avaliações e notas | `AssessmentsPage.tsx` | Staff: criar, **editar** (`PATCH /assessments/:id`), abrir pauta e lançar/guardar notas; Aluno: pauta final ponderada e notas por avaliação |
| Assiduidade | `AttendancePage.tsx` | Staff: escolher sessão, marcar presenças/faltas/atrasos/justificações e observações; Aluno: resumo e registos próprios |

Os endpoints `GET /results`/`POST /results` são consumidos pelo contrato G3 e testados no backend; a consulta de notas do lado do aluno é apresentada via `GET /my/grades` e `GET /my/final-grades`, que devolvem a mesma informação com scoping por titularidade.

## Desvios e riscos (a confirmar com a coordenação)

- **ADMIN na gestão de horários.** A ficha não declara ADMIN para o G3. Concedemos ADMIN como superutilizador por convenção de RBAC do projeto (`MANAGE_ROLES = ['COORDINATOR','ADMIN']`). Confirmar se é aceitável.
- **`studentId` ambíguo** (`User.id` no endpoint financeiro vs `StudentProfile.id` em matrículas/G3). No nosso `GET /results` e `GET /schedules?studentId`, o valor é **`StudentProfile.id`** e está anti-BOLA — documentado em `docs/manual-apis-core.md`.
- **Sem deteção de conflitos de horário.** Não consta da ficha; não implementado de propósito.
- **`ClassSchedule.roomId` sem relação Prisma.** O campo `room` do DTO é resolvido por segunda consulta; nunca `include: { room }` (causa erro runtime).
- **Sem paginação** em `/schedules`/`/assessments`. A ficha aponta paginação como "a definir"; aceitável por agora.

## Veredicto

As cinco rotas declaradas, a titularidade (anti-BOLA), a gestão de horários pelo COORDINATOR e as páginas de horários, avaliações/notas e assiduidade estão **implementados e testados**. As dependências financeiras propostas (regularidade/cobranças) **não** foram implementadas, em conformidade com a ficha (não aprovadas). **Aprovado para o âmbito G3**, com os desvios acima registados para confirmação.
