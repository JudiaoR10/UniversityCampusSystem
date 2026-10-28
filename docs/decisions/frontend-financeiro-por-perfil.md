# Interface financeira por perfil

Data: 2026-10-23.

## Âmbito

Pedido do utilizador: manter a criação de utilizadores no Core, disponibilizar histórico de pagamentos aos estudantes, expor as acções de cada perfil no frontend e colocar as políticas do Admin numa engrenagem. O incremento usa os processos existentes: dívidas, pagamento integral, contestação, avisos, resumo de contagens e políticas. Não acrescenta prestações, financiamento, reembolsos, exportação ou alteração manual do estado financeiro.

## Percursos

- STUDENT: Gestão financeira → Dívidas → Contestar; Histórico de pagamentos com paginação e totais; Contestações para acompanhar decisões; Avisos.
- FINANCE: pesquisar e seleccionar estudante existente → Dívidas para registar cobrança ou pagamento integral; consultar histórico/avisos. Contestações apresenta a fila pendente, filtrável por estado, e permite decidir com justificação. Sem estudante seleccionado, a fila abrange todos. Resumo do campus apresenta as contagens existentes.
- ADMIN: mesmas operações de gestão, mais a engrenagem Políticas financeiras. Configura dias de tolerância (0–60), limite de dívida vencida (0–1 000 000 MZN) e bloqueio automático. As consultas/operações seguintes aplicam a regra guardada. Numa instalação sem política persistida, o formulário apresenta os valores padrão em uso (5 dias, limite zero e bloqueio activo) e permite guardar a primeira configuração.
- Outros perfis: sem acesso ao módulo financeiro.

O histórico apresenta apenas pagamentos confirmados; uma dívida regularizada por contestação não aumenta o total pago. Aceitar uma contestação regulariza a dívida; rejeitar mantém a cobrança. O estado de envio de um aviso não prova leitura pelo estudante.

## Consultas adicionadas

Implementadas as três leituras propostas em `plano-consultas-financeiras.md`: pesquisa de estudantes, listagem e detalhe de contestações. O pedido actual autoriza a ligação ao frontend. O documento anterior é mantido como contexto da proposta original; esta nota regista a implementação.

`studentDirectoryService` pertence à área de utilizadores do Core e projecta somente `userId`, `fullName`, `studentNumber` e `isActive`. Não cria nem altera contas. FINANCE/ADMIN pesquisam por nome ou matrícula. Contas inactivas e estudantes sem perfil académico continuam identificáveis, conforme as regras existentes de cobrança.

As consultas de contestações verificam perfil/propriedade também na camada de aplicação. Estudantes recebem apenas os próprios dados e contagens. As listas têm ordenação estável, limite máximo de 100 e contagem filtrada; lista e contagem partilham uma transacção de leitura consistente. GET não altera contestações nem envia notificações.

A leitura interna não constitui aceite de integração por outros módulos. A identidade continua a usar `User.id` do Core e não `StudentProfile.id`.

## Verificação reproduzível

- `npm run build`
- `npm run test:web`: percursos STUDENT/FINANCE/ADMIN, perfis proibidos, histórico paginado, submissão/decisão, política, erros de consulta e respostas tardias ao trocar estudante.
- `npm run test:financial:isolated`: PostgreSQL descartável, migrações, login real do Core, pesquisa/contestações com permissões, propriedade, filtros, contagens e regressão financeira.
- `scripts/financial-browser.mjs`: percurso no browser, quando `PLAYWRIGHT_MODULE` estiver configurado.

Resultado em 2026-10-23: build aprovado, 42 testes API e 12 testes web aprovados, e percursos no browser confirmados em base descartável. Ver [evidências](../integration-evidence/README.md).
