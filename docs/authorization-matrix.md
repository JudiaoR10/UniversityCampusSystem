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

A autorização é aplicada no backend (`authenticate` + `authorize`).

## Extensão financeira

FINANCE é um perfil acrescentado pelo módulo financeiro. Não recebe permissões ADMIN/COORDINATOR nos outros módulos.

| Operação financeira | STUDENT | FINANCE | ADMIN | Outros perfis |
|---|---|---|---|---|
| Consultar dívida, estado, histórico e avisos | Apenas próprios | Sim | Sim | Não |
| Criar dívida e confirmar pagamento | Não | Sim | Sim | Não |
| Contestar dívida | Apenas própria | Não | Não | Não |
| Resolver contestação, consultar relatório, entrega e reenvio | Não | Sim | Sim | Não |
| Consultar/alterar política | Não | Não | Sim | Não |

## Interface financeira por perfil

A criação de utilizadores pertence exclusivamente ao Core. O módulo financeiro apenas pesquisa identidades de estudantes existentes (nome, matrícula opcional, estado da conta e `User.id`), sem acesso geral a `/users` para FINANCE.

| Acção na interface | STUDENT | FINANCE | ADMIN |
|---|---|---|---|
| Dívidas, histórico de pagamentos paginado, situação e avisos | Próprios | Estudante seleccionado | Estudante seleccionado |
| Pesquisar estudante por nome ou matrícula | Não | Sim | Sim |
| Registar dívida e pagamento integral | Não | Sim | Sim |
| Submeter contestação | Própria | Não | Não |
| Consultar contestações e decisões | Próprias | Todas ou do estudante seleccionado | Todas ou do estudante seleccionado |
| Decidir contestação pendente com justificação | Não | Sim | Sim |
| Resumo de contagens do campus; estado/reenvio de avisos | Não | Sim | Sim |
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
