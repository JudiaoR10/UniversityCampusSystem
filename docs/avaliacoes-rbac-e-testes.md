# Módulo Avaliações e Notas — RBAC, OpenAPI e Testes

Preenchimento das entregáveis do **Guião Prático do Estudante — Módulos V e VI**
(Semana 5: Autenticação/Autorização/RBAC · Semana 6: Documentação e Testes).

- Router: `apps/api/src/modules/assessments/http/assessmentsRouter.ts`
- Router de horários (contrato G3): `apps/api/src/modules/schedules/http/schedulesRouter.ts`
- Serviço (regras de posse): `apps/api/src/modules/assessments/application/assessmentService.ts`
- Serviço de resultados (contrato G3): `apps/api/src/modules/assessments/application/resultService.ts`
- Serviço de horários (contrato G3): `apps/api/src/modules/schedules/application/scheduleService.ts`
- Middleware reutilizado do Core: `apps/api/src/middleware/auth.ts` (`authenticate` + `authorize` = `requireRole`)

## Tabela Rota → Roles do Meu Módulo

| Rota (método + caminho) | Roles permitidos | Testado? |
| --- | --- | --- |
| `GET /assessments` | STUDENT (só disciplinas do seu curso), TEACHER (só as que criou), COORDINATOR, ADMIN | S |
| `POST /assessments` | TEACHER **atribuído à disciplina** (ClassSchedule) — 403 para os restantes | S |
| `GET /assessments/options` | TEACHER (só as suas disciplinas), COORDINATOR, ADMIN (todas) | S |
| `GET /assessments/:id` | TEACHER (só as que criou), COORDINATOR, ADMIN | S |
| `PATCH /assessments/:id` | TEACHER (só as que criou), COORDINATOR, ADMIN | S |
| `GET /assessments/:id/grades` | TEACHER (só as que criou), COORDINATOR, ADMIN | S |
| `POST /assessments/:id/grades` | TEACHER **atribuído à disciplina** — 403 para COORDINATOR/ADMIN e docentes fora da disciplina | S |
| `GET /my/grades` | STUDENT (só os próprios dados) | S |
| `GET /my/final-grades` | STUDENT (só os próprios dados) | S |
| `GET /students/:id/grades` | STUDENT (só o próprio), TEACHER (só a quem lançou notas), COORDINATOR, ADMIN | S |
| `GET /students/:id/final-grades` | STUDENT (só o próprio), TEACHER (só a quem lançou notas), COORDINATOR, ADMIN | S |
| `GET /results` | STUDENT (só o próprio; `?studentId` de outro → 403), TEACHER (só resultados das suas avaliações), COORDINATOR, ADMIN | S |
| `POST /results` | TEACHER **atribuído à disciplina** — 403 para COORDINATOR/ADMIN e docentes fora da disciplina | S |
| `GET /assessments/subject/:subjectId/board` | TEACHER (disciplina leccionada), COORDINATOR, ADMIN | S |
| `PATCH /assessments/subject/:subjectId/rules` | TEACHER (disciplina leccionada), COORDINATOR, ADMIN | S |
| `POST /assessments/subject/:subjectId/publish` | TEACHER (disciplina leccionada), COORDINATOR, ADMIN | S |
| `GET /schedules` | STUDENT (só do seu curso; `?studentId` de outro → 403), TEACHER (só onde é docente), COORDINATOR, ADMIN | S |
| `POST /schedules` | COORDINATOR, ADMIN | S |
| `PATCH /schedules/:id` | COORDINATOR, ADMIN | S |

## Regras de negócio (definidas pelo módulo)

- **Só o docente da disciplina cria avaliações e lança notas**: a ligação
  docente↔disciplina é `ClassSchedule.teacherId + subjectId`
  (`assertTeacherTeachesSubject()`); STUDENT/TECHNICIAN/COORDINATOR/ADMIN e docentes
  fora da disciplina recebem 403.
- **O docente escolhe o peso**: campo `weight` (0.1–100) definido na criação/actualização da avaliação.
- **Avaliações padrão (seed)**: a disciplina PTP3 nasce com `Teste 1` (peso 50%)
  e `Teste 2` (peso 50%); o docente pode ajustar os pesos depois.
- **Modos de lançamento de nota** (`gradingMode`):
  - `PERCENTAGE` — valor 0–100 (%);
  - `POINTS` — aritmética 0–`maxScore` (ex.: 16/20 → 80%);
  - `SCALE` — escala 0–20 (ex.: 16 → 80%).
- Todas as notas são guardadas normalizadas em `valuePercent` (0–100).
- **Nota final (inteira, 0–20)** — calculada automaticamente quando os pesos
  das avaliações contínuas (TEST/ASSIGNMENT/PRACTICAL/ORAL/OTHER) definidas
  somam **100% (ou mais)** e todas têm nota lançada; até lá o estudante fica
  **Em aberto** (`situacao: null` / `complete: false`):
  - **Admissão** = `round(Σ(valuePercent × weight) / Σ(weight) × 20 / 100)`;
  - **Com exame/recorrência** (nota lançada): `final = (admissão + exame) / 2`
    (a recorrência substitui o exame quando ambas têm nota);
  - **Sem exame**: `final = admissão`.
  Exame/recorrência (EXAM/RECURRENCE) ficam fora do ciclo contínuo (não contam
  para `complete` nem para a admissão) mas entram no resultado final pela fórmula acima.
- **Situação** (`status`, a partir da nota inteira):
  - `<= 9` → **EXCLUIDO** (banda ≤9; valores 9.01–9.49 arredondam para baixo);
  - `10–13` → **APROVADO** (banda 9.5–13);
  - `>= 14` → **DISPENSADO** (banda 13.5–20).
- **Estudante dispensado não aceita nota de exame nem de recorrência**:
  `POST /assessments/:id/grades` e `POST /results` devolvem
  409 `STUDENT_DISPENSADO`; no roster (`GET /assessments/:id/roster`) o campo
  `situacao` permite ao frontend esconder a opção de lançamento.
- **Estudante fora do curso da disciplina** → 409 `STUDENT_COURSE_MISMATCH`
  (também no upsert em bloco).
- `gradingMode`/`maxScore` ficam bloqueados depois de existirem notas (409 `GRADING_RULES_LOCKED`).
- **O estudante só vê as suas notas** (`/my/grades`, `/my/final-grades`, `/results`)
  e a interface mostra a **nota inteira** (sem "14/20" nem percentagem interna).

## Decisão anti-BOLA (documentada e consistente)

Violações de posse devolvem **403 FORBIDDEN** (`FORBIDDEN`) em todo o módulo — nunca 404.
IDs inexistentes **pedidos como filtro** (ex.: `GET /results?studentId=…` de um
COORDINATOR com id que não existe) devolvem 404 `STUDENT_NOT_FOUND`, porque não há
posse em causa — apenas um recurso inexistente.

Verificações explícitas no código:

- `assessmentService.ts → assertCanManageAssessment()` — docente só actua sobre as avaliações que criou (leitura e edição de metadados).
- `assessmentService.ts → assertTeacherTeachesSubject()` — criação de avaliações e lançamento de notas (`POST /assessments`, `POST /assessments/:id/grades`, `POST /results`) são exclusivos do docente atribuído à disciplina via `ClassSchedule`.
- `assessmentService.ts → assertStudentDataAccess()` — STUDENT só acede ao próprio perfil; TEACHER só a estudantes cujas notas lançou.
- `resultService.ts / scheduleService.ts` — STUDENT com `?studentId` de outro estudante → 403.

Os testes falhariam se estas verificações fossem removidas
(`assessments.integration.test.ts` — casos "anti-BOLA leitura" e "anti-BOLA escrita";
`contract-g3.integration.test.ts` — casos `?studentId` em `/results` e `/schedules`).

## Contrato G3 — Financeiro ↔ Avaliações e Horários

Implementação do lado G3 de `03-financeiro-avaliacoes-horarios.md` (v0.2):

| Rota do contrato | Implementada em | Roles (matriz do contrato) |
| --- | --- | --- |
| `GET /assessments` | `assessmentsRouter` | STUDENT, TEACHER, COORDINATOR, ADMIN |
| `GET /schedules` | `schedulesRouter` | STUDENT, TEACHER, COORDINATOR, ADMIN |
| `GET /results` | `assessmentsRouter` | STUDENT, TEACHER, COORDINATOR, ADMIN |
| `POST /assessments` | `assessmentsRouter` | TEACHER, COORDINATOR, ADMIN |
| `POST /results` | `assessmentsRouter` | TEACHER, COORDINATOR, ADMIN |
| `POST /schedules` + `PATCH /schedules/:id` (escrita, definida por nós) | `schedulesRouter` | COORDINATOR, ADMIN |

Decisões de implementação:

- **Identidades distintas** (critério de aceitação n.º 1): o pedido `POST /results`
  usa `studentId` = `StudentProfile.id`; a resposta (`ResultDto`) devolve
  `studentProfileId` **e** `studentUserId` (`User.id`) resolvidos pelo backend.
- **Envelope**: sucesso `{ data, meta.correlationId }` e erro
  `{ code, message, details, correlationId }` — já fornecidos pelo Core
  (`success()` e `errorHandler`); nenhuma duplicação do JWT.
- **Bloqueio financeiro de resultados** (`FINANCIAL_ACCESS_BLOCKED` /
  `FINANCIAL_VERIFICATION_UNAVAILABLE` / consulta `/financial/integration/students/:id/standing`):
  **não implementado** — o contrato diz explicitamente "não aprovada / pendente de
  aprovação"; as rotas `/financial/integration/charges` pertencem ao grupo Financeiro.
- **Envolvente de âmbito do estudante**: `GET /assessments` para STUDENT devolve
  apenas as avaliações das disciplinas do seu curso; `GET /schedules` devolve as
  sessões do seu curso; `GET /results` devolve apenas os próprios resultados.

## Tabela do Meu Endpoint (Parte II)

| Campo | Valor |
| --- | --- |
| Endpoint escolhido (método + caminho) | `POST /assessments` |
| Documentado em openapi.yaml? | S |
| Validado no Swagger UI? | S (`/api/docs`, tag **Assessments**) |
| Testes 200/201, 401, 403 escritos? | S |
| npm test a passar? | S |

Endpoints documentados: `/assessments` (GET/POST), `/assessments/{id}` (GET/PATCH),
`/assessments/{id}/grades` (GET/POST), `/my/grades`, `/students/{id}/grades`,
`/students/{id}/final-grades`, `/results` (GET/POST), `/schedules` (GET/POST),
`/schedules/{id}` (PATCH).

## Testes automatizados

`apps/api/src/modules/assessments/http/assessments.integration.test.ts` (23 casos):

- 401 sem token e com token inválido;
- 403 para roles erradas (TECHNICIAN em rotas de staff; STUDENT em criação);
- 200 para STUDENT em `GET /assessments` (só disciplinas do seu curso);
- 200/201 para roles correctas (listagem, criação de teste, lançamento de notas);
- 400 para peso inválido e nota fora do intervalo;
- anti-BOLA leitura (A não lê notas de B) e escrita (docente 2 não escreve na avaliação do docente 1);
- cálculo da nota final ponderada (80 para o estudante A);
- limpeza dos dados criados no `afterAll` (testes independentes).

`apps/api/src/modules/schedules/http/contract-g3.integration.test.ts` (21 casos) —
contrato G3:

- `GET /schedules`: 401 sem token, 403 TECHNICIAN, STUDENT por curso + anti-BOLA
  `?studentId`, TEACHER só as próprias sessões, COORDINATOR/ADMIN globais;
- `POST/PATCH /schedules`: 403 STUDENT/TEACHER, 201/200 COORDINATOR, 400 datas
  invertidas, 404 referências inexistentes;
- `GET /results`: 401/403, STUDENT com `studentProfileId` + `studentUserId`
  resolvidos, anti-BOLA `?studentId`, COORDINATOR filtra por `StudentProfile.id`;
- `POST /results`: 403 STUDENT e docente de fora da disciplina (anti-BOLA),
  201 com identidades resolvidas, 400 nota fora do intervalo, 404 ids inexistentes,
  upsert idempotente (1 registo por par).

Seed de suporte (2 estudantes e 2 docentes distintos, como pedido no Passo 4):
`estudante@…` / `estudante2@…`, `docente@…` / `docente2@…`; inclui horários demo
(`ClassSchedule`) para o curso LEI / disciplina PTP3.

## Módulo Assiduidade (G3, adicionado depois)

- Router: `apps/api/src/modules/attendance/http/attendanceRouter.ts`
- Serviço: `apps/api/src/modules/attendance/application/attendanceService.ts`
- Validação: `packages/validation/src/index.ts` (`attendanceStatusSchema`, `markAttendanceSchema`)

| Rota (método + caminho) | Roles permitidos | Testado? |
| --- | --- | --- |
| `GET /attendance` | STUDENT (só o próprio), TEACHER (só sessões que lecciona), COORDINATOR, ADMIN | S |
| `GET /attendance/summary` | STUDENT (só o próprio), TEACHER (só as suas sessões), COORDINATOR, ADMIN | S |
| `GET /attendance/sessions` | TEACHER (só as suas), COORDINATOR, ADMIN | S |
| `GET /attendance/sessions/:id` | TEACHER (só a sua sessão), COORDINATOR, ADMIN | S |
| `POST /attendance/sessions/:id` | TEACHER (só a sua sessão), COORDINATOR, ADMIN | S |

Cobertura: `apps/api/src/modules/attendance/http/attendance.integration.test.ts` (20 casos) —
sessões, pauta, marcação em bloco, scoping por papel, anti-BOLA, `STUDENT_COURSE_MISMATCH`,
cálculo da taxa de assiduidade (`(PRESENT + LATE) / total`) e auditoria `ATTENDANCE_MARK`.

## Sprint — Dispensa, Exame Normal e Recorrência

Implementação completa do fluxo académico pedido: **dispensa → exame normal →
recorrência**, com regras por disciplina, publicação de resultados e auditoria.

### Máquina de estados (`AcademicState`)

Estado **autoritativo**, calculado no backend (`computeAcademicState()`), nunca
editável pelo cliente:

| Estado | Quando |
| --- | --- |
| `PENDENTE` | Faltam notas/continuidade (pesos < 100% ou `requiredTestCount` por cumprir) |
| `DISPENSADO` | Admissão arredondada ≥ 14 — sem exame/recorrência |
| `EXCLUIDO` | Admissão < 10 — sem exame/recorrência |
| `ADMITIDO_AO_EXAME` | Admissão 10–13 sem nota de exame |
| `APROVADO_EXAME` | `(A+E)/2 ≥ 10` (no frontend marcado com `*`, nunca guardado na BD) |
| `REPROVADO_EXAME` | Exame reprovado sem época de recorrência aberta |
| `ADMITIDO_RECORRENCIA` | Exame reprovado + época aberta + admissão ≥ mínimo configurado. **Sem nota final** — a média `(A+E)/2` é provisória e só se torna final com a nota de recorrência |
| `NAO_ELEGIVEL_RECORRENCIA` | Exame reprovado + admissão < mínimo configurado |
| `APROVADO_RECORRENCIA` / `REPROVADO_RECORRENCIA` | `(A+R)/2 ≥ 10` / `< 10` |
| `RECORRENCIA_EM_REVISAO` | Exame alterado depois de recorrência lançada (audita `EXAM_CHANGED_AFTER_RECURRENCE`) |

O campo legado `status` (`SituacaoAcademica`) mantém-se para compatibilidade e
pode divergir (ex.: `status=APROVADO` com `state=ADMITIDO_AO_EXAME`). A fonte
de verdade é `state`.

### Regras por disciplina (`Subject`)

- `requiredTestCount` — n.º de testes exigidos para acionar a situação; `null`
  = regra clássica de 100% do peso;
- `recurrenceMinAdmission` — mínimo de admissão (0–20) para recorrência;
  `null` = default institucional **7** (`DEFAULT_RECURRENCE_MIN`); a comparação
  usa a admissão **sem arredondar**;
- `resultsPublishedAt` / `resultsPublishedById` — publicação dos resultados.

`PATCH /assessments/subject/:subjectId/rules` define ambos (pelo menos um);
`rulesConfigured = requiredTestCount !== null && recurrenceMinAdmission !== null`.

### Publicação de resultados

`POST /assessments/subject/:subjectId/publish` (`{ published: boolean }`):

- Exige regras configuradas → senão **409 `RULES_NOT_CONFIGURED`**;
- Publicar bloqueia lançamento de notas (`upsertGrades`, `createResult`),
  alteração de regras e criação/edição de avaliações → **409 `RESULTS_PUBLISHED`**;
- Reabrir volta a permitir a escrita. Audita `RESULTS_PUBLISH`/`RESULTS_UNPUBLISH`.

### Quadro (`GET /assessments/subject/:subjectId/board`)

Devolve `rules`, `examAssessment`, `recurrenceAssessment`, `counters`
(contagem por estado) e `entries` (uma por estudante) com espaços
`exam`/`recurrence` (`editable`, `blockedReason`, `asterisk`). No frontend,
`SubjectBoardPanel.tsx` mostra os 5 separadores (Frequência e Dispensa, Exame
Normal, Recorrência, Resultados Finais) e filtra/pagina as linhas.

### Auditoria

- `GRADE_UPSERT` — diff antes/depois de cada lançamento em bloco;
- `EXAM_CHANGED_AFTER_RECURRENCE` — alteração de exame com recorrência existente;
- `SUBJECT_RULES_UPDATE`, `RESULTS_PUBLISH`, `RESULTS_UNPUBLISH`.

### Erros novos

`STUDENT_NAO_ADMITIDO_EXAME`, `EXAM_PENDING`, `STUDENT_APROVADO_EXAME`,
`NOT_ELIGIBLE_FOR_RECURRENCE`, `RECURRENCE_EPOCH_CLOSED`, `RESULTS_PUBLISHED`,
`RULES_NOT_CONFIGURED`, `NO_CHANGES`, `INVALID_RECURRENCE_MIN`.

### Testes

- `academic-state.integration.test.ts` (13 casos): dispensa, exclusão, admissão
  ao exame, aprovação/reprovação no exame, elegibilidade de recorrência
  (mínimo configurado e default), publicação e bloqueios, revisão de recorrência
  + auditoria, RBAC das rotas novas (usa disciplina própria `SIT-EX`);
- `academicState.test.ts` (18 casos, unitários): máquina de estados, guarda de
  lançamento por estado e campos novos do `computeSubjectFinalResult`.

## Frontend ligado à API real

- `apps/web/src/pages/AssessmentsPage.tsx` — staff cria, **edita** (`PATCH /assessments/:id`)
  e lança notas na pauta; staff tem 5 separadores (Avaliações, Frequência e Dispensa,
  Exame Normal, Recorrência, Resultados Finais);
- **Vista do estudante (Pauta final)** — mostra **todas as disciplinas com frequência
  completa**, mesmo sem nota final ainda calculada (ex.: admitido ao exame). Colunas:
  Disciplina, Admissão, Exame Normal (`—` enquanto não lançado), Exame de Recorrência
  (`*` se aprovado no exame normal; nota se já lançada; "Aguarda recorrência" se
  admitido; `—` caso contrário), Nota final (`—` até estar calculada; **`—` também
  enquanto aguarda recorrência**, pois a média do exame normal é provisória),
  Situação (chip de `AcademicState` + `stateReason`) e Cálculo (fórmula + "Aguarda
  exame normal"/"Aguarda recorrência" conforme o estado). Legenda do `*` por baixo da tabela;
- `apps/web/src/components/SubjectBoardPanel.tsx` — quadro disciplinar (regras,
  publicação, estados, lançamento bloqueado com motivo);
- `apps/web/src/lib/academic.ts` — rótulos/estilos de `AcademicState` e legenda do `*`;
- `apps/web/src/pages/AttendancePage.tsx` — staff escolhe a sessão e marca estados/observações;
  o aluno vê o resumo e os registos próprios. A coluna de texto livre chama-se **Observação**
  (campo `note`), não "Nota".
- `apps/web/src/pages/SchedulesPage.tsx` — listagem por dia, filtros e CRUD para COORDINATOR/ADMIN.

Testes de frontend: `AssessmentsPage.test.tsx` (17 testes — inclui separadores,
quadro, publicação, regras e cenários da vista do estudante: dispensa, admitido ao
exame, aprovado no exame com `*`, elegível a recorrência, recorrência lançada),
`AttendancePage.test.tsx`, `SchedulesPage.test.tsx`
(mock de `useAuth().api`; cobrem sucesso, edição, estados de erro e ausência de permissões).
Total web: **30/30**; total API: **144/144**.
