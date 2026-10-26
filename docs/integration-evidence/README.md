# Resultados — Financeiro integrado no Core

## Sincronização com o Core e validação completa — 26 de Outubro de 2026

Branch sincronizada com o Core `3343c24`, que inclui as integrações académica e IoT. Build aprovado; **75 testes API e 15 testes frontend (90 no total)**. O contrato OpenAPI preserva as rotas académicas e IoT e corresponde às 24 operações financeiras. Migração salarial validada em PostgreSQL descartável, com auditoria transaccional, prevenção de duplicados, concorrência, limites mensais e proibição de escrita por ADMIN.

O navegador validou Finance a criar/editar/pagar salário e Admin a consultar e imprimir. [PDF gerado](monthly-salary-report.pdf) e [captura do relatório](monthly-salary-report.png) usam somente dados da base descartável. A impressão não inclui os menus da aplicação.

A migração aditiva foi também aplicada à base local `smart_campus` (localhost:5433), sem seed, limpeza ou criação de salários de teste. API e frontend foram iniciados com o código actual. Pela origem `http://localhost:5173/api/v1`, a pesquisa de estudantes por ADMIN e as contestações por STUDENT responderam **200**, tal como as consultas de docentes, salários e relatórios. [Resultados das consultas locais](local-endpoints-2026-10-24.json).

As capturas originais não identificavam o URL/versão da API anterior; não se atribui a falha passada a uma causa comprovada. A configuração de desenvolvimento carrega o `.env` correcto e prepara os pacotes partilhados. Docker usa API e frontend da mesma origem. Nenhum ambiente publicado foi alterado.

Regras e endpoints em [salários e relatórios mensais](../decisions/salarios-relatorios-mensais.md). As secções abaixo conservam as verificações anteriores; os ficheiros gerais de resultados são actualizados a cada execução.

## Interface por perfil — 23 de Outubro de 2026

Verificação executada sobre o estado local de trabalho, incluindo as alterações ainda não commitadas:

- Build dos cinco workspaces aprovado; build web repetido após a correcção da primeira configuração de políticas.
- 42 testes da API e 12 testes web aprovados (54 no total).
- Contrato OpenAPI verificado para as 17 operações financeiras.
- Browser com login real do Core: pesquisa de estudante, criação de dívida, contestação, decisão FINANCE visível ao STUDENT, pagamento e histórico, configuração ADMIN persistida após recarregar e bloqueio de TEACHER.
- Primeira configuração de política validada numa base sem política persistida; histórico validado a 390 px sem overflow horizontal da página.

As verificações de integração/browser usaram PostgreSQL descartável, removido no fim. Nenhuma política da base habitual foi alterada. O teste de navegador foi repetido isoladamente após corrigir o rótulo da decisão e a configuração inicial das políticas; os testes web também foram repetidos após estas correcções.

Evidências: [testes API](api-tests.json), [percursos do navegador](browser.json), [histórico móvel](financial-history-mobile.png) e [políticas ADMIN](financial-admin-policies.png). Âmbito e percursos em [interface financeira por perfil](../decisions/frontend-financeiro-por-perfil.md).

## Verificação da entrega — 20 de Outubro de 2026

A revisão da entrega de 20 de Outubro foi executada sobre uma cópia dos ficheiros do commit
`a51ba5b16750f808dcfe6902efe7bf810297b16c`. As alterações locais excluídas dos
commits não estavam nessa cópia. Foram aprovados o build dos cinco workspaces,
40 testes da API, 1 teste web e os fluxos de navegador com FINANCE, STUDENT e
TEACHER.

Os [resultados desta entrega](entrega-2026-10-20/verificacao.md) incluem a
verificação das 14 operações financeiras no Swagger e de `/health` público.
Para repetir a verificação, execute `npm run test:financial:isolated` numa
base descartável, conforme as instruções da integração financeira.
