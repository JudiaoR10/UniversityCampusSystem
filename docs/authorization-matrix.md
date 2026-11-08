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

## Extensão financeira

FINANCE é um perfil acrescentado pelo módulo financeiro. Não recebe permissões ADMIN/COORDINATOR nos outros módulos.

| Operação financeira | STUDENT | FINANCE | ADMIN | Outros perfis |
|---|---|---|---|---|
| Consultar dívida, estado, histórico e avisos | Apenas próprios | Sim | Sim | Não |
| Listar dívidas do campus, bloqueados e fila de avisos | Não | Sim | Sim | Não |
| Criar dívida, emitir propina por matrícula e confirmar pagamento | Não | Sim | **Não** | Não |
| Cancelar dívida aberta | Não | Sim | **Não** | Não |
| Imprimir comprovativo de pagamento | Próprio | Sim | Sim | Não |
| Imprimir comprovativo salarial | Não | Sim | Sim | Não |
| Contestar dívida | Apenas própria | Não | Não | Não |
| Resolver contestação | Não | Sim | **Não** | Não |
| Consultar relatório e entrega de avisos | Não | Sim | Sim | Não |
| Reenviar aviso | Não | Sim | **Não** | Não |
| Consultar/alterar política | Não | Não | Sim | Não |

## Interface financeira por perfil

A criação de utilizadores pertence exclusivamente ao Core. O módulo financeiro apenas pesquisa identidades de estudantes existentes (nome, matrícula opcional, estado da conta e `User.id`), sem acesso geral a `/users` para FINANCE.

| Acção na interface | STUDENT | FINANCE | ADMIN |
|---|---|---|---|
| Dívidas, histórico de pagamentos paginado, situação e avisos | Próprios | Campus ou estudante seleccionado | Campus ou estudante seleccionado |
| Pesquisar estudante por nome ou matrícula | Não | Sim | Sim |
| Registar dívida, cancelar, emitir propina e pagamento integral | Não | Sim | **Não** |
| Submeter contestação | Própria | Não | Não |
| Consultar contestações e decisões | Próprias | Todas ou do estudante seleccionado | Todas ou do estudante seleccionado |
| Decidir contestação pendente com justificação | Não | Sim | **Não** |
| Resumo com totais MZN, bloqueados e fila de avisos | Não | Sim | Sim |
| Reenviar avisos pendentes ou falhados | Não | Sim | **Não** |
| Engrenagem de políticas: tolerância, limite vencido e bloqueio automático | Não | Não | Sim |

TEACHER, TECHNICIAN e COORDINATOR continuam sem acesso financeiro. A interface apresenta as acções autorizadas; a API mantém a verificação de perfil e propriedade, incluindo nas novas consultas de contestações.

Novas consultas: `GET /api/v1/financial/students`, `GET /api/v1/financial/analysis-requests` e `GET /api/v1/financial/analysis-requests/:id`. As duas listas usam `offset/limit`, total filtrado e `hasMore`. A pesquisa de identidades é uma leitura interna do Core, sem cópia de cadastros ou alteração de contratos académicos externos.

## Funcionários, salários, mensalidades e relatórios — 2026-10-27

| Operação | STUDENT | FINANCE | ADMIN | TEACHER/TECHNICIAN/COORDINATOR |
|---|---|---|---|---|
| Consultar funcionários do Core e externos | Não | Sim | Sim | Não |
| Cadastrar funcionário externo sem conta no sistema | Não | Sim | **Não** | Não |
| Propor criação/alteração salarial | Não | Sim | **Não** | Não |
| Aprovar ou rejeitar proposta salarial | Não | **Não** | Sim | Não |
| Gerar salário mensal com valor aprovado | Não | Sim | **Não** | Não |
| Registar pagamento salarial | Não | Sim | **Não** | Não |
| Consultar cursos e mensalidades | Não | Sim | Sim | Não |
| Definir mensalidade de curso | Não | Sim | **Não** | Não |
| Consultar/imprimir relatórios mensais de recebimentos e salários pagos | Não | Sim | Sim | Não |

O Financeiro propõe o valor salarial e o ADMIN decide. Só depois da aprovação é possível gerar o salário mensal; o valor não possui endpoint de edição directa. Docentes, técnicos e outros utilizadores são lidos do Core. Guardas, agentes de limpeza e outros trabalhadores sem conta recebem apenas um cadastro externo mínimo. Os cursos também são lidos do módulo académico, ficando apenas a mensalidade no domínio financeiro.
O Financeiro lê o cadastro académico e não edita perfis de docentes. Ver [decisão e endpoints](decisions/salarios-relatorios-mensais.md).
