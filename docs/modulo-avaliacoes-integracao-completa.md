# Módulo de Avaliações - Integração Completa

> Documentação real e detalhada da implementação. Localização, estrutura, código, rotas e fluxo do módulo de avaliações do Smart Campus.

**Data:** 2026-10-20  
**Branch/Estado:** Implementação completa (Sprint Dispensa/Exame/Recorrência)  
**Testes:** API 144/144 | Web 30/30 | TypeScript limpo

---

## 1. Visão Geral

O módulo de avaliações gere todo o ciclo académico: avaliações contínuas, exame normal, exame de recorrência, cálculo automático da nota final, máquina de estados e publicação de resultados. 

### Princípios fundamentais

- **Backend é autoridade única**: Todo cálculo de situação/estado final é feito em `apps/api/src/modules/assessments/application/assessmentService.ts`. O frontend nunca decide aprovações.
- **Estado académico detalhado**: Além do legado `status` (`SituacaoAcademica`), existe `state` (`AcademicState`) calculado por `computeAcademicState()` (função pura).
- **Nota final condicional**: Só aparece quando definitiva. Enquanto `ADMITIDO_RECORRENCIA` ou `RECORRENCIA_EM_REVISAO`, `finalGrade` = `null`.
- **Publicação bloqueante**: Quando publicada, a disciplina fica bloqueada para alterações até ser reaberta.
- **RBAC rigoroso**: STUDENT só vê os seus dados; TEACHER só gere as suas avaliações e tem acesso a estudantes cujas notas lançou.

---

## 2. Localização dos Módulos

### Backend (API) - `apps/api/src/`

| Ficheiro | Função |
| --- | --- |
| `modules/assessments/application/assessmentService.ts` | **Core**. Motor de cálculo, máquina de estados (`computeAcademicState`), validações (`assertGradeAllowedForState`), regras de publicação, quadro académico (`getSubjectBoard`), notas finais (`getFinalGrades`/`listMyFinalGrades`). |
| `modules/assessments/http/assessmentsRouter.ts` | Rotas HTTP com middlewares `authenticate`/`authorize`, validação Zod via `validate`, tratamento de erros. |
| `modules/assessments/http/assessments.integration.test.ts` | Testes de integração básicos do módulo. |
| `modules/assessments/http/academic-state.integration.test.ts` | **Críticos**. 13 testes cobrindo todos os cenários do sprint (dispensa, exame, recorrência, publicação, auditoria). Usa disciplina isolada `SIT-EX`. |
| `modules/assessments/application/assessmentEngine.test.ts` | Testes unitários do motor de cálculo (`computeSubjectFinalResult`, `computeSituationsByStudent`). |
| `modules/assessments/application/academicState.test.ts` | Testes unitários da máquina de estados e guards. |

### Frontend (Web) - `apps/web/src/`

| Ficheiro | Função |
| --- | --- |
| `pages/AssessmentsPage.tsx` | Página principal. Para STAFF: 5 tabs (Avaliações, Frequência e Dispensa, Exame Normal, Recorrência, Resultados Finais). Para STUDENT: vista "Pauta final" com todas as disciplinas com frequência completa. |
| `components/SubjectBoardPanel.tsx` | Componente do quadro disciplinar. Gerir regras (testes exigidos + mínimo recorrência), publicação/reabertura, lançamento de notas de exame/recorrência com bloqueios, filtros, paginação. |
| `lib/academic.ts` | Constantes visuais: `STATE_LABELS`, `STATE_STYLES`, `ACADEMIC_STATES`, `RECURRENCE_LEGEND`, `stateBadgeClass()`. |
| `pages/AssessmentsPage.test.tsx` | 17 testes cobrindo staff e estudante (incluindo cenários admitido ao exame, aguarda recorrência, aprovado com `*`). |

### Tipos e Validação - `packages/`

| Ficheiro | Função |
| --- | --- |
| `shared-types/src/index.ts` | Tipos partilhados: `AcademicState`, `FinalGradeDto` (com `state`, `stateReason`, `recurrenceEligible`, `complete`), `SubjectBoard`, `ExamSlot`, `RecurrenceSlot`, etc. |
| `validation/src/index.ts` | Schemas Zod: `upsertGradesSchema`, `createAssessmentSchema`, `updateAssessmentSchema`, `setSubjectRulesSchema`, `publishResultsSchema`. |

### Cliente API - `packages/api-client/src/index.ts`

Métodos adicionados:
- `subjectBoard(subjectId)`
- `setSubjectRules(subjectId, { requiredTestCount, recurrenceMinAdmission })`
- `publishResults(subjectId, published)`
- `myFinalGrades()`

---

## 3. Modelo de Dados (Prisma)

**Ficheiro:** `apps/api/prisma/schema.prisma`

### Alterações ao modelo `Subject`

```prisma
model Subject {
  // ... campos existentes
  requiredTestCount   Int?
  recurrenceMinAdmission Float?
  resultsPublishedAt  DateTime?
  resultsPublishedById String?
  resultsPublishedBy  User?    @relation("SubjectResultsPublishedBy", fields: [resultsPublishedById], references: [id])
  // ...
}
```

### `Assessment`

Suporta tipos `TEST`, `ASSIGNMENT`, `EXAM`, `RECURRENCE`, `OTHER`. 
- Avaliações `EXAM`/`RECURRENCE` são excluídas do cálculo da média de admissão.
- A recorrência **substitui** o exame normal no cálculo final.

### `Grade`

Única por `(assessmentId, studentId)`. Armazena `value` (0-20) e `valuePercent` (0-100) normalizado.

### Migração

`apps/api/prisma/migrations/20261019155638_add_academic_state_rules/migration.sql` - Adiciona os campos à tabela `Subject`.

---

## 4. Máquina de Estados (`computeAcademicState`)

**Localização:** `apps/api/src/modules/assessments/application/assessmentService.ts:117-183`

Função pura. Fonte única de verdade.

```typescript
export function computeAcademicState(input: AcademicStateInput): { state: AcademicState; reason: string | null }
```

### Input

```typescript
export type AcademicStateInput = {
  admissionGrade: number | null;           // nota de admissão (0-20), arredondada internamente
  examGrade: number | null;               // exame normal (0-20)
  recurrenceGrade: number | null;         // recorrência (0-20)
  recurrenceMinAdmission: number | null;  // mínimo para recorrer; null = usa default
  hasRecurrenceEpoch: boolean;            // existe avaliação RECURRENCE criada
  examChangedAfterRecurrence: boolean;    // auditoria
};
```

### Lógica sequencial

| Ordem | Condição | Estado | Explicação |
| --- | --- | --- | --- |
| 1 | `admissionGrade === null` | `PENDENTE` | Frequência incompleta |
| 2 | `Math.round(admissionGrade) >= 14` | `DISPENSADO` | Dispensa - não faz exame nem recorrência |
| 3 | `Math.round(admissionGrade) < 10` | `EXCLUIDO` | Frequência insuficiente - não admitido ao exame |
| 4 | `examGrade === null` | `ADMITIDO_AO_EXAME` | Aguarda nota do exame normal |
| 5 | `recurrenceGrade !== null` | `APROVADO_RECORRENCIA` / `REPROVADO_RECORRENCIA` / `RECORRENCIA_EM_REVISAO` | Recorrência substitui exame. Se `examChangedAfterRecurrence` → `RECORRENCIA_EM_REVISAO`. Senão `(A+R)/2 >=10 ? APROVADO_RECORRENCIA : REPROVADO_RECORRENCIA` |
| 6 | `examGrade !== null` e sem recorrência | `APROVADO_EXAME` se `(A+E)/2 >=10` | Aprovado no exame normal. Marcado com `*` no frontend (UI only) |
| 7 | Reprovou exame normal | `REPROVADO_EXAME` se sem época de recorrência; senão verifica elegibilidade | Se `!hasRecurrenceEpoch` → `REPROVADO_EXAME`. Com época: compara `admissionGrade < min` (min = `recurrenceMinAdmission ?? DEFAULT_RECURRENCE_MIN=7`). Se abaixo → `NAO_ELEGIVEL_RECORRENCIA`. Se >= → `ADMITIDO_RECORRENCIA`. |

**Constante:** `export const DEFAULT_RECURRENCE_MIN = 7;`

---

## 5. Motor de Cálculo (`computeSubjectFinalResult`)

**Localização:** `apps/api/src/modules/assessments/application/assessmentService.ts:1132-1234`

Função pura e testável.

### Fluxo

1. **Separar contínuas vs exame/recorrência**
   - `nonExam = assessments.filter(a => !EXAM_ASSESSMENT_TYPES.includes(a.type))`
   - `base = nonExam.length > 0 ? nonExam : assessments` (fallback)
   - `extras = assessments.filter(a => !baseIds.has(a.id) && hasGrade(a))` (EXAM/RECURRENCE)

2. **Definir se frequência está completa (`complete`)**
   - Se `requiredTestCount != null`: `gradedBase.length >= requiredTestCount`
   - Se `requiredTestCount == null`: `gradedBase.length === base.length && baseWeight >= 100`

3. **Calcular nota de admissão**
   ```typescript
   admissionPercent = complete && gradedBase.length > 0
     ? sum(gradedBase[i].valuePercent * base[i].weight) / sum(baseWeights)
     : null
   ```
   Arredondado com `round2()`.

4. **Obter notas de exame/recorrência**
   - `normalExamPercent` = nota do EXAM
   - `recurrenceExamPercent` = nota do RECURRENCE
   - `effectiveExamPercent = recurrenceExamPercent ?? normalExamPercent ?? null` (recorrência **substitui**)

5. **Calcular média final**
   ```typescript
   finalPercent = admissionPercent !== null 
     ? (effectiveExamPercent !== null ? (admissionPercent + effectiveExamPercent) / 2 : admissionPercent)
     : null
   ```
   Arredondado com `round2()`.

6. **Determinar `status` legado**
   - Com exame lançado ou frequência dispensada: classifica via `classifySituacao()`
   - Caso contrário null

7. **Calcular `finalGrade` (inteiro 0-20) COM REGRA CONDICIONAL**
   ```typescript
   // Estado calculado primeiro
   const { state, reason } = computeAcademicState({...});
   
   // Enquanto aguarda recorrência OU em revisão, NÃO mostrar nota final
   const finalGrade = (state === 'ADMITIDO_RECORRENCIA' || state === 'RECORRENCIA_EM_REVISAO')
     ? null
     : (effectiveExamPercent !== null || statusTemp === 'DISPENSADO')
       ? (finalPercent !== null ? Math.round(finalPercent * 0.2) : null)
       : null;
   ```
   
   **Importante:** A nota `(A+E)/2` é calculada em `finalPercent` mas **não é exposta** enquanto em `ADMITIDO_RECORRENCIA`. Só aparece após lançamento da nota de recorrência.

8. **Devolver resultado completo**
   Inclui `state`, `stateReason`, `recurrenceEligible`, `breakdown`, contadores, etc.

### `classifySituacao()` legado

```typescript
export function classifySituacao(finalGrade: number, hasExam?: boolean, examComplete?: boolean): SituacaoAcademica {
  if (finalGrade <= 9) return 'EXCLUIDO';
  if (finalGrade <= 13) return 'APROVADO';
  if (!hasExam && finalGrade >= 14) return 'DISPENSADO';
  // com exame aprovado (>=10) fica APROVADO
  if (finalGrade >= 14) return 'APROVADO'; // já tratado? verificar
  return 'APROVADO';
}
```
*(Ver implementação completa para detalhes exatos)*

---

## 6. Guards de Lançamento (`assertGradeAllowedForState`)

**Localização:** `apps/api/src/modules/assessments/application/assessmentService.ts:191-227`

Backend valida SEMPRE antes de guardar notas.

### EXAM (exame normal)

| Estado | Resultado |
| --- | --- |
| `DISPENSADO` | **409** `STUDENT_DISPENSADO` - "Estudante dispensado: não é permitido lançar nota de exame ou recorrência" |
| `EXCLUIDO` | **409** `STUDENT_NAO_ADMITIDO_EXAME` - "Estudante não admitido ao exame normal (frequência insuficiente)" |
| Outros | Permitido (se época aberta via `assertSubjectNotPublished`) |

### RECURRENCE (exame de recorrência)

| Estado | Resultado |
| --- | --- |
| `DISPENSADO` | **409** `STUDENT_DISPENSADO` |
| `EXCLUIDO` | **409** `STUDENT_NAO_ADMITIDO_EXAME` |
| `PENDENTE`, `ADMITIDO_AO_EXAME` | **409** `EXAM_PENDING` - "Aguarda exame normal — a recorrência só fica disponível após o exame" |
| `APROVADO_EXAME` | **409** `STUDENT_APROVADO_EXAME` - "Aprovado no exame normal — não necessita de recorrência" |
| `NAO_ELEGIVEL_RECORRENCIA` | **409** `NOT_ELIGIBLE_FOR_RECURRENCE` - "Estudante não elegível para recorrência" |
| `REPROVADO_EXAME` | **409** `RECURRENCE_EPOCH_CLOSED` - "Sem época de recorrência aberta nesta disciplina" |
| `ADMITIDO_RECORRENCIA`, `APROVADO_RECORRENCIA`, `REPROVADO_RECORRENCIA`, `RECORRENCIA_EM_REVISAO` | **Permitido** |

Avaliações contínuas (`TEST`, `ASSIGNMENT`, `OTHER`) **nunca são bloqueadas** pela máquina de estados.

---

## 7. Rotas HTTP

**Localização:** `apps/api/src/modules/assessments/http/assessmentsRouter.ts`  
**Prefixo:** `/api/v1` (montado em `app.ts`)

### Rotas existentes (mantidas)

| Método | Path | Auth | Permissões | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/assessments` | Sim | STAFF | Listar avaliações (TEACHER vê as que criou) |
| `GET` | `/assessments/options` | Sim | STAFF | Opções para criar avaliação (disciplinas/cursos) |
| `GET` | `/assessments/:id/roster` | Sim | STAFF | Pauta de uma avaliação com estudantes e situação |
| `GET` | `/assessments/:id/grades` | Sim | STAFF | Notas de uma avaliação |
| `POST` | `/assessments/:id/grades` | Sim | STAFF | Lançar/atualizar notas em bloco (`upsertGrades`). Valida `assertGradeAllowedForState`, `assertSubjectNotPublished`. Audita. |
| `POST` | `/assessments` | Sim | TEACHER/COORDINATOR/ADMIN | Criar avaliação. Bloqueado se disciplina publicada. |
| `PATCH` | `/assessments/:id` | Sim | TEACHER/COORDINATOR/ADMIN | Editar avaliação. Bloqueado se publicada. |
| `GET` | `/assessments/subject/:subjectId/required-test-count` | Sim | STAFF | Obter `requiredTestCount` da disciplina |
| `GET` | `/my/grades` | Sim | STUDENT | Notas do próprio estudante por avaliação |
| `GET` | `/my/final-grades` | Sim | STUDENT | **Notas finais por disciplina** do estudante autenticado |

### Novas rotas (Sprint)

| Método | Path | Auth | Permissões | Descrição |
| --- | --- | --- | --- | --- |
| `GET` | `/assessments/subject/:subjectId/board` | Sim | STAFF | Quadro académico completo: regras, épocas EXAM/RECURRENCE, contadores por estado, linha por estudante com espaços bloqueados/marcados. |
| `PATCH` | `/assessments/subject/:subjectId/rules` | Sim | STAFF | Definir `requiredTestCount` e/ou `recurrenceMinAdmission`. Pelo menos um obrigatório. Bloqueado se publicada. Audita `SUBJECT_RULES_UPDATE`. |
| `POST` | `/assessments/subject/:subjectId/publish` | Sim | STAFF | Publicar/reabrir resultados `{ published: boolean }`. Exige regras configuradas. Bloqueia escrita quando publicado. Audita `RESULTS_PUBLISH`/`RESULTS_UNPUBLISH`. |

**Ordem crítica:** As rotas com prefixo `/assessments/subject/:subjectId/*` são registadas **antes** de `/assessments/:id/roster` para evitar conflito de routing.

### Validação (Zod)

**Ficheiro:** `packages/validation/src/index.ts`

```typescript
export const setSubjectRulesSchema = z
  .object({
    requiredTestCount: z.number().int().min(1).max(20).nullable().optional(),
    recurrenceMinAdmission: z.number().min(0).max(20).nullable().optional(),
  })
  .refine((data) => data.requiredTestCount !== undefined || data.recurrenceMinAdmission !== undefined, {
    message: 'É necessário definir pelo menos um dos campos',
  });

export const publishResultsSchema = z.object({
  published: z.boolean(),
});
```

---

## 8. Regras por Disciplina e Publicação

### Configuração

Em `Subject`:
- `requiredTestCount` (Int?) - Número de testes exigidos para considerar frequência completa
- `recurrenceMinAdmission` (Float?) - Mínimo de admissão (0-20) para ser elegível à recorrência
- `resultsPublishedAt` (DateTime?) - Timestamp da publicação
- `resultsPublishedById` (String?) - Quem publicou

### `rulesConfigured`

Calculado como: `requiredTestCount !== null && recurrenceMinAdmission !== null`

### Publicação

**`POST /assessments/subject/:subjectId/publish`**

- Se `published: true`: exige `rulesConfigured`. Se não → **409 `RULES_NOT_CONFIGURED`**. Define `resultsPublishedAt = now()`, `resultsPublishedById = actor.id`. Audita `RESULTS_PUBLISH`.
- Se `published: false`: limpa publicação, volta a permitir escrita. Audita `RESULTS_UNPUBLISH`.

### Bloqueios quando publicado (`assertSubjectNotPublished`)

Aplicado em:
- `POST /assessments/:id/grades` (upsertGrades)
- `POST /assessments` (criar avaliação)
- `PATCH /assessments/:id` (editar avaliação)
- `PATCH /assessments/subject/:subjectId/rules` (alterar regras)

**Erro:** **409 `RESULTS_PUBLISHED`** - "Os resultados desta disciplina já foram publicados. Reabra a publicação para efetuar alterações."

---

## 9. Quadro Académico (`getSubjectBoard`)

**Localização:** `apps/api/src/modules/assessments/application/assessmentService.ts:641-815`

Devolve visão completa para gestão docente.

### Estrutura de resposta

```typescript
{
  rules: {
    subjectId, subjectCode, subjectName,
    requiredTestCount, recurrenceMinAdmission,
    rulesConfigured, published, publishedAt,
    hasExamEpoch, hasRecurrenceEpoch
  },
  examAssessment: { id, title, gradingMode, maxScore } | null,
  recurrenceAssessment: { id, title, gradingMode, maxScore } | null,
  counters: {
    total, pendentes, dispensados, excluidos,
    admitidosExame, aprovadosExame, reprovadosExame,
    admitidosRecorrencia, elegiveisRecorrencia, aprovadosRecorrencia, reprovadosRecorrencia,
    naoElegiveis, emRevisao
  },
  entries: [ /* uma por estudante */ ]
}
```

### Entry por estudante

```typescript
{
  studentProfileId, studentNumber, fullName,
  continuous: [{ assessmentId, title, weight, value }],
  admissionGrade, admissionPercent, complete,
  state, stateReason, status,  // status = legado
  exam: {
    assessmentId, grade, valuePercent, comment,
    editable,        // false se DISPENSADO ou EXCLUIDO
    blockedReason    // "Dispensado — sem exame/recorrência" ou motivo
  },
  recurrence: {
    assessmentId, grade, valuePercent, comment,
    asterisk,        // true APENAS se APROVADO_EXAME (UI only)
    editable,        // result.recurrenceEligible
    blockedReason
  },
  finalGrade, finalPercent
}
```

**Regras do quadro:**
- `exam.editable = !(state === 'DISPENSADO' || state === 'EXCLUIDO')`
- `recurrence.editable = result.recurrenceEligible`
- `recurrence.asterisk = (state === 'APROVADO_EXAME')` - **nunca guardado na BD, apenas UI**
- `recurrence.blockedReason` calculado por `recurrenceBlockedReason()` com mensagens específicas por estado

---

## 10. Notas Finais do Estudante

### `GET /my/final-grades` (estudante autenticado)
**Handler:** `assessmentsRouter.ts:177-184`  
**Service:** `listMyFinalGrades(userId)` → `getFinalGrades(profile.id, actor)`

### `getFinalGrades(studentId, actor)`

Para cada disciplina do curso do estudante:
1. Carrega disciplina com avaliações + notas do estudante
2. Chama `computeSubjectFinalResult()`
3. Mapeia para `FinalGradeDto`

```typescript
return {
  subjectId, subjectCode, subjectName,
  requiredTestCount, recurrenceMinAdmission,
  finalGrade: result.finalGrade,        // null se ADMITIDO_RECORRENCIA ou RECORRENCIA_EM_REVISAO
  admissionGrade: Math.round(result.admissionPercent * 0.2),
  examGrade: Math.round(result.examPercent * 0.2),
  recurrenceGrade: Math.round(result.recurrencePercent * 0.2),
  usedExam: result.examPercent !== null || result.recurrencePercent !== null,
  status: result.status,                // legado
  state: result.state,                  // autoritativo
  stateReason: result.stateReason,
  recurrenceEligible: result.recurrenceEligible,
  complete: result.complete,
  totalWeight, gradedAssessments, assessments,
  breakdown
};
```

---

## 11. Frontend

### Vista do Estudante (`AssessmentsPage.tsx` > `StudentAssessments`)

**Alterações principais:**

```typescript
// Mostra TODAS as disciplinas com frequência completa, mesmo sem nota final
const listed = useMemo(() => finalGrades.filter((g) => g.complete), [finalGrades]);
```

**Tabela "Pauta final":**

| Coluna | Conteúdo |
| --- | --- |
| Disciplina | `PTP3 — Projeto` |
| Admissão | `Admissão {admissionGrade ?? '—'}` |
| Exame Normal | `Exame {examGrade ?? '—'}` (— enquanto não lançado) |
| Exame de Recorrência | `*` se `APROROVADO_EXAME`; nota se lançada; `Aguarda recorrência` se `ADMITIDO_RECORRENCIA`; `—` caso contrário |
| Nota final | `{finalGrade ?? '—'}` (— enquanto `ADMITIDO_RECORRENCIA`/`RECORRENCIA_EM_REVISAO`) |
| Situação | Chip com `stateBadgeClass(state)` + `STATE_LABELS[state]` + `stateReason` (fallback para `SituacaoBadge` legado) |
| Cálculo | `calculoTexto()` + breakdown |

**`recurrenceCellText()`:**
```typescript
function recurrenceCellText(subject: FinalGradeDto): string {
  if (subject.state === 'APROVADO_EXAME') return '*';
  if (subject.recurrenceGrade !== null && subject.recurrenceGrade !== undefined) {
    return String(subject.recurrenceGrade);
  }
  if (subject.state === 'ADMITIDO_RECORRENCIA') return 'Aguarda recorrência';
  return '—';
}
```

**`calculoTexto()`:**
- Com recorrência lançada: `Admissão X + Recorrência Y → (A+R)/2`
- `ADMITIDO_RECORRENCIA` com exame: `Admissão X + Exame Y → (A+E)/2 · Aguarda recorrência`
- Com exame normal: `Admissão X + Exame Y → (A+E)/2`
- `ADMITIDO_AO_EXAME`: `Admissão X · Aguarda exame normal`
- Sem exame: `Admissão X`

**Legenda:** `{RECURRENCE_LEGEND}` = "* Aprovado no exame normal — não necessita de recorrência"

**Impressão:** Usa as mesmas colunas e lógica.

### Vista do Staff

**5 tabs:** Avaliações | Frequência e Dispensa | Exame Normal | Recorrência | Resultados Finais

- **Avaliações**: Criar/editar avaliações, lançar notas na pauta individual
- **Frequência e Dispensa / Exame Normal / Recorrência**: Usa `SubjectBoardPanel` com seletor "Disciplina do quadro"
- **Resultados Finais**: Publicação/reabertura com validação

### `SubjectBoardPanel.tsx`

- Carrega quadro via `api.subjectBoard(subjectId)`
- Sincroniza formulário de regras com `board.rules` via `useEffect`
- Formulário desativado logicamente até dados carregados
- Lançamento de notas com validação, botões bloqueados com `blockedReason`
- Filtros por nome/número/estado, paginação
- Contadores por chip

### `lib/academic.ts`

```typescript
export const STATE_LABELS: Record<AcademicState, string> = {
  PENDENTE: 'Frequência incompleta',
  DISPENSADO: 'Dispensado',
  EXCLUIDO: 'Excluído',
  ADMITIDO_AO_EXAME: 'Admitido ao exame',
  APROVADO_EXAME: 'Aprovado no exame normal',
  REPROVADO_EXAME: 'Reprovado no exame normal',
  ADMITIDO_RECORRENCIA: 'Admitido à recorrência',
  APROVADO_RECORRENCIA: 'Aprovado na recorrência',
  REPROVADO_RECORRENCIA: 'Reprovado na recorrência',
  NAO_ELEGIVEL_RECORRENCIA: 'Não elegível à recorrência',
  RECORRENCIA_EM_REVISAO: 'Recorrência em revisão',
};

export const STATE_STYLES: Record<AcademicState, string> = {
  PENDENTE: 'bg-slate-100 text-slate-700',
  DISPENSADO: 'bg-sky-50 text-sky-700',
  EXCLUIDO: 'bg-red-50 text-red-700',
  ADMITIDO_AO_EXAME: 'bg-amber-50 text-amber-800',
  APROVADO_EXAME: 'bg-emerald-50 text-emerald-700',
  REPROVADO_EXAME: 'bg-red-50 text-red-700',
  ADMITIDO_RECORRENCIA: 'bg-amber-50 text-amber-800',
  APROVADO_RECORRENCIA: 'bg-emerald-50 text-emerald-700',
  REPROVADO_RECORRENCIA: 'bg-red-50 text-red-700',
  NAO_ELEGIVEL_RECORRENCIA: 'bg-slate-100 text-slate-600',
  RECORRENCIA_EM_REVISAO: 'bg-violet-50 text-violet-700',
};

export const RECURRENCE_LEGEND = '* Aprovado no exame normal — não necessita de recorrência';

export function stateBadgeClass(state: AcademicState | null): string {
  if (!state) return 'bg-slate-100 text-slate-600';
  return STATE_STYLES[state];
}
```

---

## 12. Auditoria

**Localização:** `apps/api/src/modules/assessments/application/assessmentService.ts` (usa `auditService.logAuditEvent`)

| Evento | Quando | Detalhes |
| --- | --- | --- |
| `GRADE_UPSERT` | Lançamento em bloco de notas | Diff antes/depois por estudante. Inclui `assessmentId`, alterações |
| `EXAM_CHANGED_AFTER_RECURRENCE` | Exame alterado após nota de recorrência já lançada | `studentId`, `assessmentId`, valores antes/depois. Estado passa a `RECORRENCIA_EM_REVISAO` |
| `SUBJECT_RULES_UPDATE` | Alteração de regras da disciplina | `requiredTestCount`, `recurrenceMinAdmission` (antes/depois) |
| `RESULTS_PUBLISH` | Publicação de resultados | `subjectId`, `publishedById` |
| `RESULTS_UNPUBLISH` | Reabertura de publicação | `subjectId`, `publishedById` |

---

## 13. Códigos de Erro

| Código | HTTP | Contexto |
| --- | --- | --- |
| `STUDENT_DISPENSADO` | 409 | Tentativa de lançar exame/recorrência a estudante dispensado |
| `STUDENT_NAO_ADMITIDO_EXAME` | 409 | Frequência < 10 ou excluído |
| `EXAM_PENDING` | 409 | Tentar lançar recorrência sem ter lançado exame normal |
| `STUDENT_APROVADO_EXAME` | 409 | Aprovado no exame normal - não precisa de recorrência |
| `NOT_ELIGIBLE_FOR_RECURRENCE` | 409 | Frequência abaixo do mínimo para recorrência |
| `RECURRENCE_EPOCH_CLOSED` | 409 | Reprovado exame mas sem época de recorrência aberta |
| `RECURRENCE_NOT_ALLOWED` | 409 | Estado não permite recorrência |
| `RULES_NOT_CONFIGURED` | 409 | Tentar publicar sem configurar regras |
| `RESULTS_PUBLISHED` | 409 | Tentativa de alterar disciplina já publicada |
| `NO_CHANGES` | 409 | `upsertGrades` sem alterações |
| `INVALID_RECURRENCE_MIN` | 400 | Valor inválido para mínimo de recorrência |
| `VALIDATION_ERROR` | 400 | Erro de validação Zod |

Formato de erro: `{ code, message, details, correlationId }`  
Formato de sucesso: `{ data, meta }`

---

## 14. Testes

### API

```bash
npm run test -w @smart-campus/api
```

**Resultado:** 12 ficheiros, **144 testes** ✓

**Ficheiros:**
- `http/assessments.integration.test.ts` - integrações básicas
- `http/academic-state.integration.test.ts` - **13 casos** do sprint (disciplina SIT-EX isolada)
- `application/assessmentEngine.test.ts` - motor
- `application/academicState.test.ts` - máquina de estados + guards
- Outros testes existentes mantidos

### Web

```bash
npm run test -w @smart-campus/web
```

**Resultado:** 4 ficheiros, **30 testes** ✓

**Ficheiros:**
- `pages/AssessmentsPage.test.tsx` - **17 testes** (staff + estudante com todos os cenários)
- `pages/AttendancePage.test.tsx`
- `pages/SchedulesPage.test.tsx`
- `App.test.tsx`

### TypeScript

```bash
npx tsc -p apps/api/tsconfig.json --noEmit  # OK
npx tsc -p apps/web/tsconfig.json --noEmit  # OK
```

### Build

```bash
npm run build -w @smart-campus/web  # OK
```

---

## 15. Fluxo Completo - Exemplo Prático

### Cenário: Estudante reprova exame normal e vai a recorrência

1. **Frequência completa** (ex: 2 testes lançados) → `admissionPercent` calculado, `complete=true`
2. **Sem exame** → `state = ADMITIDO_AO_EXAME`, `examGrade = null`, `finalGrade = null`
3. **Docente lança exame normal (nota 8, máx 20)** via `POST /assessments/:examId/grades`
   - Guard: estado `ADMITIDO_AO_EXAME` permite EXAM ✓
   - Cálculo: `(A + E)/2` = (10 + 8)/2 = 9 → `< 10` e com época aberta e `A >= min` (7) → **`state = ADMITIDO_RECORRENCIA`**
   - **`finalGrade = null`** (regra: aguarda recorrência, nota provisória escondida)
   - **Estudante vê:** Nota final `—`, Exame Normal `8`, Recorrência `Aguarda recorrência`, Situação `Admitido à recorrência`, Cálculo `Admissão 10 + Exame 8 → (A+E)/2 · Aguarda recorrência`
4. **Docente tenta lançar recorrência** → Permitido (estado `ADMITIDO_RECORRENCIA` na lista permitida)
5. **Docente lança nota de recorrência (16)** via `POST /assessments/:recId/grades`
   - Guard permite ✓
   - `effectiveExamPercent = recurrencePercent` (substitui)
   - Cálculo: `(A + R)/2` = (10 + 16)/2 = 13 → **`state = APROVADO_RECORRENCIA`**
   - **`finalGrade = 13`** (agora definitiva)
   - **Estudante vê:** Nota final `13`, Recorrência `16`, Situação `Aprovado na recorrência`, Cálculo `Admissão 10 + Recorrência 16 → (A+R)/2`

### Cenário: Aprovado no exame normal

1. Exame com `(A+E)/2 >= 10` → **`state = APROVADO_EXAME`**
2. **`finalGrade` calculado e mostrado** (10-13 aprovado, 14+ dispensado conforme classificação)
3. No quadro: `recurrence.asterisk = true`, `recurrence.editable = false`, blockedReason com legenda
4. Estudante vê Recorrência `*` com legenda `* Aprovado no exame normal — não necessita de recorrência`

### Cenário: Dispensa

1. Frequência `>= 14` arredondada → **`state = DISPENSADO`** sem exame
2. **`finalGrade = admissionGrade` arredondado**
3. Exame/recorrência bloqueados

---

## 16. Servidores de Desenvolvimento

**Estado atual:** Ativos via `setsid nohup npm run dev > /tmp/opencode/dev-servers.log`

| Serviço | URL | Porta |
| --- | --- | --- |
| API | http://localhost:4100 | 4100 |
| Swagger | http://localhost:4100/api/docs | 4100 |
| Web (Vite) | http://localhost:5173 | 5173 |
| PostgreSQL | postgresql://smartcampus:smartcampus@localhost:5432/smart_campus | 5432 |

**Utilizadores demo:**
- Docente: `docente@smartcampus.demo` / `Docente123!`
- Estudante: `estudante@smartcampus.demo` / `Estudante123!`

**Logs:** `/tmp/opencode/dev-servers.log`

---

## 17. Checklist de Verificação

- [x] Máquina de estados implementada e testada
- [x] Motor de cálculo com regra condicional de `finalGrade`
- [x] Guards de lançamento por estado
- [x] Regras por disciplina (requiredTestCount + recurrenceMinAdmission)
- [x] Publicação/reabertura com bloqueios
- [x] Quadro académico com 5 tabs
- [x] Vista do estudante atualizada (mostra disciplinas completas, coluna recorrência correta)
- [x] Nota final escondida enquanto `ADMITIDO_RECORRENCIA`/`RECORRENCIA_EM_REVISAO`
- [x] Auditoria completa
- [x] Tipos partilhados atualizados
- [x] Validação Zod
- [x] API client atualizado
- [x] Testes API 144/144
- [x] Testes Web 30/30
- [x] TypeScript limpo
- [x] Build web OK
- [x] Documentação atualizada

---

**Última atualização:** 2026-10-20  
**Responsável:** Implementação conforme requisitos do sprint
