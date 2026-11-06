# Matriz de autorização

| Operação | STUDENT | TEACHER | TECHNICIAN | COORDINATOR | ADMIN |
| --- | --- | --- | --- | --- | --- |
| Consultar informação pública | Sim | Sim | Sim | Sim | Sim |
| Consultar perfil próprio | Sim | Sim | Sim | Sim | Sim |
| Criar ocorrência | Sim | Sim | Sim | Sim | Sim |
| Tratar ocorrência | Não | Não | Sim | Sim | Sim |
| Gerir salas | Não | Não | Parcial | Sim | Sim |
| Gerir utilizadores | Não | Não | Não | Parcial (listar) | Sim |
| Consultar auditoria | Não | Não | Não | Sim | Sim |
| Consultar departamentos, cursos e disciplinas | Sim | Sim | Sim | Sim | Sim |
| Gerir departamentos, cursos e disciplinas (criar e eliminar; editar cursos e disciplinas) | Não | Não | Não | Sim | Sim |

A autorização é aplicada no backend (`authenticate` + `authorize`).

## Inscrições em disciplinas

Uma inscrição nasce sempre `PENDING`. A activação e a conclusão são decisões
académicas da coordenação; o ADMIN pode criar/cancelar/eliminar, mas não activar
nem concluir.

| Operação | STUDENT | TEACHER | TECHNICIAN | COORDINATOR | ADMIN |
| --- | --- | --- | --- | --- | --- |
| Consultar inscrições | Apenas próprias | Sim | Não | Sim | Sim |
| Criar inscrição (fica pendente) | Apenas própria | Não | Não | Sim | Sim |
| Activar inscrição (`ACTIVE`) | Não | Não | Não | Sim | **Não** |
| Concluir inscrição (`COMPLETED`) | Não | Não | Não | Sim | **Não** |
| Cancelar inscrição | Não | Não | Não | Sim | Sim |
| Eliminar inscrição | Não | Não | Não | Sim | Sim |

A restrição de activação/conclusão é aplicada no router, no serviço e na
interface; a API devolve `403 FORBIDDEN`.

## Extensão financeira

FINANCE é um perfil acrescentado pelo módulo financeiro. Não recebe permissões ADMIN/COORDINATOR nos outros módulos.

| Operação financeira | STUDENT | FINANCE | ADMIN | Outros perfis |
|---|---|---|---|---|
| Consultar dívida, estado, histórico e avisos | Apenas próprios | Sim | Sim | Não |
| Listar dívidas do campus, bloqueados e fila de avisos | Não | Sim | Sim | Não |
| Criar dívida, emitir propina por matrícula e confirmar pagamento | Não | Sim | Sim | Não |
| Cancelar dívida aberta | Não | Sim | Sim | Não |
| Imprimir comprovativo de pagamento | Próprio | Sim | Sim | Não |
| Imprimir comprovativo salarial | Não | Sim | Sim | Não |
| Contestar dívida | Apenas própria | Não | Não | Não |
| Resolver contestação, consultar relatório, entrega e reenvio | Não | Sim | Sim | Não |
| Consultar/alterar política | Não | Não | Sim | Não |

## Interface financeira por perfil

A criação de utilizadores pertence exclusivamente ao Core. O módulo financeiro apenas pesquisa identidades de estudantes existentes (nome, matrícula opcional, estado da conta e `User.id`), sem acesso geral a `/users` para FINANCE.

| Acção na interface | STUDENT | FINANCE | ADMIN |
|---|---|---|---|
| Dívidas, histórico de pagamentos paginado, situação e avisos | Próprios | Campus ou estudante seleccionado | Campus ou estudante seleccionado |
| Pesquisar estudante por nome ou matrícula | Não | Sim | Sim |
| Registar dívida, cancelar, emitir propina e pagamento integral | Não | Sim | Sim |
| Submeter contestação | Própria | Não | Não |
| Consultar contestações e decisões | Próprias | Todas ou do estudante seleccionado | Todas ou do estudante seleccionado |
| Decidir contestação pendente com justificação | Não | Sim | Sim |
| Resumo com totais MZN, bloqueados e fila/reenvio de avisos | Não | Sim | Sim |
| Engrenagem de políticas: tolerância, limite vencido e bloqueio automático | Não | Não | Sim |

TEACHER, TECHNICIAN e COORDINATOR continuam sem acesso financeiro. A interface apresenta as acções autorizadas; a API mantém a verificação de perfil e propriedade, incluindo nas novas consultas de contestações.

Novas consultas: `GET /api/v1/financial/students`, `GET /api/v1/financial/analysis-requests` e `GET /api/v1/financial/analysis-requests/:id`. As duas listas usam `offset/limit`, total filtrado e `hasMore`. A pesquisa de identidades é uma leitura interna do Core, sem cópia de cadastros ou alteração de contratos académicos externos.

## Salários e relatórios mensais — 2026-10-24

| Operação | STUDENT | FINANCE | ADMIN | TEACHER/TECHNICIAN/COORDINATOR |
|---|---|---|---|---|
| Pesquisar docentes e consultar salários | Não | Sim | Sim | Não |
| Criar/editar salário pendente | Não | Sim | **Não** | Não |
| Registar pagamento salarial | Não | Sim | **Não** | Não |
| Consultar/imprimir relatórios mensais de recebimentos e salários pagos | Não | Sim | Sim | Não |

A restrição de escrita salarial é aplicada no router e no serviço, sem excepção para ADMIN. O Financeiro lê o cadastro académico; não edita perfis de docentes. Ver [decisão e endpoints](decisions/salarios-relatorios-mensais.md).