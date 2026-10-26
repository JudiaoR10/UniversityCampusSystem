# Módulo de Avaliações — o que fizemos, passo a passo

> Este documento conta a história completa das melhorias feitas no módulo de
> avaliações (G3) do sistema UniversityCampusSystem: o que o pedido pedia, o
> que corrigimos, como integramos tudo (API → pacotes partilhados → frontend)
> e como comprovamos que nada ficou partido. Escrito num tom directo, como se
> estivéssemos a contar a um colega de equipa.

---

## 1. O ponto de partida — o que existia e o que o pedido pedia

O módulo de avaliações já existia (criar avaliações, lançar notas, pauta do
estudante), mas tinha regras de negócio incompletas e um bug grave. O pedido
do utilizador trouxe o guia oficial
`Guia_Integracao_Frontend_API_Modulo7.md` e definiu as regras da instituição:

- Notas de **0 a 20**;
- **Peso** de cada avaliação escolhido pelo docente (0.1–100);
- Só o **docente da disciplina** cria avaliações e lança notas;
- O estudante vê **apenas as suas** notas (anti-BOLA);
- Média/nota final **calculada automaticamente**;
- Situação: `≤9` **Excluído**, `9.5–13` **Aprovado**, `13.5–20` **Dispensado**;
- Nota final = **(admissão + exame) / 2** (quando há exame);
- Estudante **dispensado não pode receber nota de exame/recorrência**.

Combinado com o utilizador, a regra mais importante ficou assim:

> **A situação académica só aparece quando os pesos das avaliações contínuas
> definidas somam 100% (ou mais) E todas têm nota lançada.** Até lá, fica
> **"Em aberto"** — nada de classificar o aluno com uma única nota.

E o seed deve mostrar, por omissão, **Teste 1 (50%)** e **Teste 2 (50%)** na
disciplina PTP3, prontos para o docente ajustar.

---

## 2. Passo 1 — diagnosticar o bug (não foi chute, foi repro)

Antes de mexer em código, reproduzimos o problema pela API com curl:

1. Criámos uma avaliação `Teste 1` com **peso 40**;
2. Lançámos **uma única nota** ao estudante A;
3. O roster devolveu `DISPENSADO` logo de seguida.

O motor antigo marcava `complete = true` assim que **todas as avaliações
existentes** tinham nota — o peso era irrelevante. Uma avaliação de peso 40
bastava para fechar a média e "dispensar" o aluno. Foi essa a causa raiz.

## 3. Passo 2 — extrair um motor puro e testável

Toda a matemática foi extraída para funções **puras** (sem Prisma, sem
express) dentro de
`apps/api/src/modules/assessments/application/assessmentService.ts`:

| Função | Papel |
|---|---|
| `computeSubjectFinalResult()` | Calcula admissão, exame, nota final, situação e o `breakdown` (linha a linha) |
| `computeSituationsByStudent()` | Classifica todos os alunos de uma disciplina (usado no roster e no bloqueio de exame) |
| `classifySituacao()` | Aplica as bandas: ≤9 Excluído, 10–13 Aprovado, ≥14 Dispensado |
| `normalizeGradeValue()` | Converte a nota lançada para `valuePercent` (0–100) |
| `assertGradeValueInRange()` | Valida o intervalo 0–20 (ou 0–maxScore em pontos) |

Com funções puras, os testes unitários ficam rápidos e não dependem de base de
dados — e foi assim que passámos a testar os limiares todos (9, 9.5, 13, 13.5…).

## 4. Passo 3 — notas de 0 a 20, normalização em valuePercent

O docente lança tudo em **0–20** (ou pontos, em modo `POINTS`), e o sistema
guarda sempre `valuePercent` (0–100):

- `PERCENTAGE` e `SCALE`: `valuePercent = (valor / 20) × 100` (ex.: 16 → 80%);
- `POINTS`: `valuePercent = (valor / maxScore) × 100` (ex.: 16/20 → 80%).

Corrigimos aqui um erro de semântica: em `PERCENTAGE` a validação passou a
aceitar 0–20 como os outros modos, para o docente nunca ter de fazer contas
mentais ao mudar de modo.

## 5. Passo 4 — regras de situação e nota final

O motor passou a aplicar, nesta ordem:

1. **Ciclo contínuo** = todas as avaliações **excepto** EXAM/RECURRENCE
   (se não existirem contínuas, tudo conta);
2. **Completo** = pesos contínuos somam **≥ 100%** + todos lançados
   *(a regra dos 100%, ver passo 8)*;
3. **Admissão** = `Σ(valuePercent × peso) / Σ(peso)`;
4. **Com exame/recorrência**: `final% = (admissão + exame) / 2` — a
   **recorrência substitui o exame** quando ambas têm nota;
5. **Nota inteira** = arredondar `final% × 0.2`;
6. **Situação**: ≤9 `EXCLUIDO`, 10–13 `APROVADO`, ≥14 `DISPENSADO`; e
   **`ADMITIDO_AO_EXAME`** quando a admissão fica em 10–13 sem exame
   (novo estado partilhado em `SituacaoAcademica`, em `packages/shared-types`).

## 6. Passo 5 — disciplina e segurança (RBAC + anti-BOLA)

- `assertTeacherTeachesSubject()` — só o docente da disciplina
  (`ClassSchedule.teacherId + subjectId`) cria/edita avaliações e lança notas;
- `assertStudentDataAccess()` — o estudante só lê **as suas** notas;
  docente só lê alunos a quem já lançou nota; coordenador/admin lê tudo;
- Violações de posse → **403 FORBIDDEN** (nunca 404, para não escutar recursos);
- `assertAssessmentTypeAllowedForStudent()` — aluno `DISPENSADO` recebe
  **409 STUDENT_DISPENSADO** ao tentar lançar exame ou recorrência;
- Peso inválido (>100 numa avaliação) → **409 WEIGHT_EXCEEDED**;
- Mudar `gradingMode`/`maxScore` depois de existirem notas →
  **409 GRADING_RULES_LOCKED**.

## 7. Passo 6 — o frontend acompanha o backend

Em `apps/web/src/pages/AssessmentsPage.tsx`:

- Formulário e tabelas **0–20** (sem misturar com percentagem interna);
- Coluna **"Cálculo"** na pauta final, com o detalhe `(admissão+exame)/2`;
- Painel dedicado **"Notas de Exame / Recorrência"**;
- Botão de lançar exame/escondido para dispensados;
- Estado sem situação mostra **"Em aberto"** (badge e impressão);
- A pauta final só mostra disciplinas `complete` com nota calculada.

Os tipos circular sem cópia manual: o frontend importa de
`packages/shared-types` (`SituacaoAcademica`, `StudentSubjectResult`…), as
validações de corpo vêm de `packages/validation` e as chamadas passam por
`packages/api-client` — é esta a espinha dorsal da integração.

## 8. Passo 7 — a grande correção: a regra dos 100%

Foi a decisão final, confirmada com o utilizador. Em
`assessmentService.ts`, o cálculo de `complete` passou a exigir:

```ts
const baseWeight = round2(base.reduce((acc, a) => acc + a.weight, 0));
const complete = base.length > 0 && gradedBase.length === base.length && baseWeight >= 100;
```

Isto vale para **as duas** funções (`computeSituationsByStudent` e
`computeSubjectFinalResult`), para roster, pauta final e o bloqueio de exame
ficarem consistentes. Exame/recorrência **não contam** para a soma de 100 —
são ciclo final, não contínuo.

Comportamento verificado ao vivo (curl, servidor dev a correr):

| Situação | Resultado |
|---|---|
| Nota lançada só no Teste 1 (peso 50) | `situacao = null` → **Em aberto** |
| Notas no Teste 1 **e** Teste 2 (50+50=100) | `DISPENSADO` (16) |
| Estudante sem notas | `null` → Em aberto |

## 9. Passo 8 — seed com Teste 1 (50%) e Teste 2 (50%)

Em `prisma/seed.ts`, depois do subject PTP3 e do docente, garantimos as
avaliações padrão (só cria se não existirem, para o seed ser re-executável):

- **Teste 1** — tipo `TEST`, modo `SCALE`, peso **50**;
- **Teste 2** — tipo `TEST`, modo `SCALE`, peso **50**.

Sem notas — é o docente que lança. Como 50+50 = 100%, assim que lançar as
duas notas a situação calcula-se; enquanto falta uma, fica "Em aberto".
Também limpámos as avaliações de testes manuais que ficaram na base de dados
local (pesos soltos de repro) para o demo arrancar limpo.

## 10. Passo 9 — testes (e são eles que seguram a casa)

- **Unitários** (`assessmentEngine.test.ts`, 14 testes): limiares de
  arredondamento, média ponderada com pesos que somam 100, exame e
  recorrência, e **regressão** explícita: *peso 40 com nota lançada → em
  aberto, nunca classificado*;
- **Integração** (`assessments.integration.test.ts`, 21 testes): RBAC (403/401),
  anti-BOLA leitura e escrita, validação de peso, bloqueio GRADING_RULES_LOCKED,
  dispensa bloqueia exame (409), roster, nota final automática, e um teste
  novo que **baixa os pesos para <100%, confirma `situacao = null`, repõe
  50+50 e confirma DISPENSADO**;
- **Contrato** (`contract-g3.integration.test.ts`): o módulo de horários
  continua a funcionar com o assessments dentro do PTP3;
- **Frontend** (`AssessmentsPage.test.tsx`, 9 testes + 13 noutros ficheiros).

Resultado final: **API 107/107 ✓ · Web 22/22 ✓ · TypeScript limpo nos dois apps ✓**.

A suite usa `fileParallelism: false` e cada teste limpa por trás (só apaga o
que cria, com prefixo `Teste automatizado-`), por isso pode correr à vontade
contra a base de dados local.

## 11. Passo 10 — documentação também é código

- `docs/avaliacoes-rbac-e-testes.md` — regras de negócio actualizadas
  (regra dos 100%, seed padrão, bandas, 409s);
- `docs/openapi.yaml` — descrições de `finalGrade`, `complete` e `situacao`
  alinhadas com o comportamento real (gerado/conferido contra o código);
- Este próprio documento, para quem chega agora perceber a jornada inteira.

## 12. Passo 11 — Sprint: Dispensa, Exame Normal e Recorrência

O pedido seguinte foi o fluxo académico completo, por disciplina:

> **dispensa (admissão ≥ 14) → exame normal (admissão 10–13) → recorrência
> (exame reprovado + mínimo de admissão configurável, por omissão 7)**

Sem nada de componentes de demonstração — implementação real de motor, BD, API
e frontend.

### 12.1 Esquema e migração

Em `Subject`: `recurrenceMinAdmission` (Float?, default institucional 7),
`resultsPublishedAt` e `resultsPublishedById`. Migração
`20261019155638_add_academic_state_rules` aplicada às bases local e de teste.

### 12.2 Máquina de estados no motor

`computeAcademicState()` (função pura, testável) devolve
`{ state, reason }` com 11 estados (`AcademicState` em `shared-types`) — ver a
tabela em `docs/avaliacoes-rbac-e-testes.md`. O `state` passou a ser calculado
**só no backend** e devolvido em `FinalGradeDto.state`, no roster e no quadro.
O `status` legado ficou intacto (compatibilidade) e pode divergir: a fonte de
verdade é `state`.

### 12.3 Regras por disciplina e publicação

- `PATCH /assessments/subject/:id/rules` — `requiredTestCount` e
  `recurrenceMinAdmission` (pelo menos um);
- `POST /assessments/subject/:id/publish` — publicar/reabrir; exige regras
  configuradas (`RULES_NOT_CONFIGURED`) e bloqueia toda a escrita da disciplina
  (`RESULTS_PUBLISHED`) enquanto publicado;
- Audias: `SUBJECT_RULES_UPDATE`, `RESULTS_PUBLISH`, `RESULTS_UNPUBLISH`,
  `GRADE_UPSERT` (diff antes/depois) e `EXAM_CHANGED_AFTER_RECURRENCE`.

### 12.4 Frontend: 5 separadores e quadro disciplinar

`AssessmentsPage` ganhou a barra de separadores (Avaliações | Frequência e
Dispensa | Exame Normal | Recorrência | Resultados Finais) e o painel
`SubjectBoardPanel` (selector de disciplina, regras, publicação, contadores
por estado, filtros e lançamento de notas de exame/recorrência com campos
bloqueados e motivo). O `*` dos aprovados no exame é **só de UI** (nunca vai
para a BD) e tem legenda obrigatória.

### 12.5 Vista do estudante

A pauta final do estudante mostra **todas as disciplinas com frequência completa**,
mesmo antes de existir nota final (ex.: `ADMITIDO_AO_EXAME` → Exame Normal `—`,
Nota final `—`, cálculo "Aguarda exame normal"). A situação é o chip de
`AcademicState` (+ `stateReason`); a coluna Exame de Recorrência mostra `*`
(aprovado no exame normal, com legenda), a nota quando já lançada, "Aguarda
recorrência" para admitidos e `—` caso contrário. O mapa imprimível usa as
mesmas colunas e o estado calculado.

### 12.6 Testes do Sprint

- 13 testes de integração (`academic-state.integration.test.ts`) numa disciplina
  própria (`SIT-EX`), para não interferir com o PTP3 da suite existente;
- 18 testes unitários (`academicState.test.ts`) da máquina de estados, da guarda
  de lançamento por estado e dos campos novos do resultado final;
- 17 testes web (`AssessmentsPage.test.tsx`), incluindo os cenários da vista do
  estudante (dispensa, admitido ao exame, aprovado no exame com `*`, elegível a
  recorrência, recorrência lançada).

## Estado final dos testes (após o Sprint)

**API 144/144 ✓ · Web 30/30 ✓ · TypeScript limpo nos dois apps ✓ · build web ✓**

---

## Como está ligado (o mapa da integração)

```
docente lança nota (0–20)
        │
        ▼
apps/web  →  packages/validation (schema do corpo)
        │
        ▼
apps/api  →  assessmentsRouter (auth + RBAC)
        │
        ▼
assessmentService (valida intervalo, normaliza valuePercent,
                   calcula com o motor puro, persiste Grade)
        │
        ▼
Prisma/Postgres  ←  Grade (value + valuePercent, unique assessmentId_studentId)
        │
        ▼
roster / final-grades devolvem situacao + complete + breakdown
        │
        ▼
apps/web mostra "Em aberto" | Excluído | Aprovado | Dispensado | Admitido ao exame
```

## Estado actual e pendências conhecidas

- Tudo operacional: API `http://localhost:4100`, web `http://localhost:5173`;
- **Pendência institucional** (não introduzida por nós, mas detectada): o
  `prisma/schema.prisma` tem 3 erros de validação na relação
  `PeriodResult` ↔ `StudentProfile` (falta o campo inverso). Não afecta o
  módulo de avaliações (as migrações do Sprint correram bem, incluindo a
  `20261019155638_add_academic_state_rules`);
- **Decisões pendentes para a instituição**: valor exacto do default de
  recorrência (hoje 7), se `requiredTestCount` deve ser obrigatório (hoje
  opcional; null = regra de 100% do peso) e quem pode publicar reabrir
  resultados (hoje TEACHER/COORDINATOR/ADMIN).

## Comandos úteis

```bash
# seed (cria/actualiza utilizadores, PTP3, Teste 1/Teste 2)
DATABASE_URL='postgresql://smartcampus:smartcampus@localhost:5432/smart_campus?schema=public' \
  npx tsx prisma/seed.ts

# testes da API e do web
cd apps/api  && DATABASE_URL='...' npx vitest run
cd apps/web  && npx vitest run

# servidor de desenvolvimento (API + web)
npm run dev
```

Utilizadores de demonstração: `docente@smartcampus.demo` / `Docente123!`,
`estudante@smartcampus.demo` / `Estudante123!`, `coordenador@smartcampus.demo` /
`Coord123!` (e variantes 2/tecnico).

---

*Documento gerado na sequência das melhorias ao módulo G3 — Avaliações.*
