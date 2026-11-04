# Módulos por grupo — Smart Campus Core

> Mapa de responsabilidades para forks e branches.  
> A coordenação pode preencher a coluna **Grupo atribuído** conforme a turma.

## Legenda de estado

| Estado | Significado |
| --- | --- |
| `available` | Implementado no Core |
| `partial` | Schema ou UI parcial |
| `development` | Placeholder — **alvo principal dos grupos** |

---

## Grupo Académico

**Branch prefix:** `feature/grupo-academico-*`  
**groupHint:** Grupo Académico

| key | Módulo | Rota | Estado | Grupo atribuído | Branch sugerida |
| --- | --- | --- | --- | --- | --- |
| academic | Hub académico | `/academic` | partial | _a definir_ | — |
| departments | Departamentos | `/departments` | development | _a definir_ | `feature/grupo-academico-departments-crud` |
| courses | Cursos | `/courses` | development | _a definir_ | `feature/grupo-academico-courses-crud` |
| subjects | Disciplinas | `/subjects` | development | _a definir_ | `feature/grupo-academico-subjects-crud` |
| students | Estudantes | `/students` | partial | _a definir_ | `feature/grupo-academico-students-ui` |
| teachers | Docentes | `/teachers` | partial | _a definir_ | `feature/grupo-academico-teachers-ui` |
| enrolments | Matrículas | `/enrolments` | development | _a definir_ | `feature/grupo-academico-enrolments-crud` |
| assessments | Avaliações e notas | `/assessments` | available | G3 | `feature/grupo-academico-assessments-crud` |
| schedules | Horários | `/schedules` | available | G3 | `feature/grupo-academico-schedules-crud` |
| attendance | Assiduidade | `/attendance` | available | G3 | `feature/grupo-academico-attendance-crud` |

**Modelos Prisma já existentes:** `Department`, `Course`, `Subject`, `StudentProfile`, `TeacherProfile`, `Enrolment`, `Assessment`, `Grade`, `ClassSchedule`, `Attendance`.

---

## Grupo Infraestrutura

**Branch prefix:** `feature/grupo-infra-*`  
**groupHint:** Grupo Infraestrutura

| key | Módulo | Rota | Estado | Grupo atribuído | Branch sugerida |
| --- | --- | --- | --- | --- | --- |
| campus | Hub campus | `/campus` | partial | _a definir_ | — |
| buildings | Edifícios | `/buildings` | **available** | Grupo Infraestrutura | `feature/grupo-infra-campus-crud` |
| rooms | Salas | `/rooms` | **available** | Core | — |
| laboratories | Laboratórios | `/laboratories` | **available** | Grupo Infraestrutura | `feature/grupo-infra-campus-crud` |
| equipment | Equipamentos | `/equipment` | **available** | Grupo Infraestrutura | `feature/grupo-infra-campus-crud` |
| parking | Estacionamento | `/parking` | **available** | Core | — |

**Modelos Prisma:** `Building`, `Room`, `Laboratory`, `Equipment`, `ParkingLot`, `ParkingSpot`, `PlateReading`.

---

## Grupo Manutenção

**Branch prefix:** `feature/grupo-manutencao-*`

| key | Módulo | Rota | Estado | Grupo atribuído | Branch sugerida |
| --- | --- | --- | --- | --- | --- |
| incidents | Ocorrências | `/incidents` | **available** | Core | — |
| maintenance | Manutenção | `/maintenance` | partial | _a definir_ | `feature/grupo-manutencao-actions-ui` |

**Modelos Prisma:** `Incident`, `MaintenanceAction`.

---

## Grupo IoT

**Branch prefix:** `feature/grupo-iot-*`

| key | Módulo | Rota | Estado | Grupo atribuído | Branch sugerida |
| --- | --- | --- | --- | --- | --- |
| iot | Hub IoT | `/iot` | partial | _a definir_ | `feature/grupo-iot-hub-mqtt` |
| devices | Dispositivos | `/devices` | partial | _a definir_ | `feature/grupo-iot-devices-crud` |
| sensors | Sensores | `/sensors` | development | _a definir_ | `feature/grupo-iot-sensors-crud` |
| readings | Leituras | `/readings` | development | _a definir_ | `feature/grupo-iot-readings-mqtt` |
| alerts | Alertas | `/alerts` | partial | _a definir_ | `feature/grupo-iot-alerts-rules` |

**Modelos Prisma:** `Device`, `Sensor`, `Reading`, `Alert` (+ campo `mqttTopic`).

---

## Grupo Financeiro

**Branch prefix:** `feature/grupo-financeiro-*`

| key | Módulo | Rota | Estado | Grupo atribuído | Branch sugerida |
| --- | --- | --- | --- | --- | --- |
| financial | Gestão financeira | `/financial` | **available** | Grupo Financeiro | `feature/grupo-financeiro-financial-integracao` |

**Modelos Prisma:** `Debt`, `Payment`, `FinancialStatus`, `AnalysisRequest`, `FinancialPolicy`, `FinancialNotification`, `TeacherSalary`.

---

## Grupo Relatórios

**Branch prefix:** `feature/grupo-relatorios-*`

| key | Módulo | Rota | Estado | Grupo atribuído | Branch sugerida |
| --- | --- | --- | --- | --- | --- |
| reports | Relatórios | `/reports` | development | _a definir_ | `feature/grupo-relatorios-dashboard-pdf` |

---

## Core (coordenação)

**Branch prefix:** `feature/grupo-core-*` — **só com autorização**

| key | Módulo | Rota | Estado | Notas |
| --- | --- | --- | --- | --- |
| ops | Operações | `/ops` | available | Centro de operações |
| dashboard | Dashboard | `/dashboard` | available | |
| users | Utilizadores | `/users` | available | |
| audit | Auditoria | `/audit` | available | |
| admin | Administração | `/admin` | partial | |
| notifications | Notificações | `/notifications` | development | Core ou grupo dedicado |

---

## Como registar atribuição de grupo

1. Editar este ficheiro na coluna **Grupo atribuído** (ex.: «Grupo 3 — Alpha»).  
2. Abrir issue **Module proposal** no GitHub.  
3. Criar branch com o prefixo correcto.  
4. Actualizar `campusModules` em `packages/shared-types` quando o módulo evoluir de `development` → `partial` → `available`.

---

## Ficheiros partilhados (todos os grupos)

Qualquer módulo novo deve actualizar, quando aplicável:

| Ficheiro | Acção |
| --- | --- |
| `packages/shared-types/src/index.ts` | DTO + `campusModules` |
| `packages/validation/src/index.ts` | Schemas Zod |
| `packages/api-client/src/index.ts` | Métodos HTTP |
| `apps/api/src/app.ts` | Registar router |
| `apps/web/src/App.tsx` | Registar rota |
| `prisma/schema.prisma` | Modelos + migração |
| `docs/openapi.yaml` | Endpoints |
| `docs/manual-apis-core.md` | Documentação API |
