# Salários e relatórios mensais

Data: 2026-10-24.

## Responsabilidades confirmadas

O utilizador confirmou que FINANCE gere apenas salários e respectivos pagamentos. O cadastro académico permanece no módulo Estudantes e Docentes. ADMIN consulta os salários e os relatórios e pode imprimir; não cria, edita nem confirma salários, mesmo chamando directamente a API. A criação de utilizadores mantém-se no Core. A role técnica continua a chamar-se FINANCE.

## Funcionalidades

- Pesquisa de docentes existentes por nome ou código, com paginação e projecção mínima do perfil do Core.
- Um salário por docente e período mensal (AAAA-MM). Montante em MZN, até duas casas decimais; notas opcionais.
- FINANCE pode alterar montante/notas apenas enquanto o salário está pendente. O período e o docente não são alterados.
- Registo do pagamento integral já efectuado, com método e referência. Não transfere dinheiro nem integra bancos. A data de pagamento é o instante deste registo.
- Salário pago imutável. Não há pagamentos parciais, processamento fiscal, descontos, cancelamento ou estorno neste incremento.
- Relatórios mensais separados para recebimentos de estudantes e salários pagos a docentes, com detalhe completo, referências, datas, quantidade e total monetário.
- ADMIN e FINANCE podem consultar e imprimir. O PDF/diálogo de impressão contém todas as linhas devolvidas pelo relatório, sem menus da aplicação.

O relatório filtra `paidAt` pelo mês civil de Moçambique (Africa/Maputo, UTC+02:00). Salário de Setembro pago em Outubro entra no relatório de Outubro, mantendo o período salarial na descrição. Salários pendentes e regularizações por contestação não são pagamentos. Os totais são calculados com Decimal e a leitura usa uma transacção consistente. Acima de 10 000 movimentos, a API devolve 422 REPORT_TOO_LARGE; nunca imprime silenciosamente um relatório incompleto.

## API

Base: `/api/v1/financial`.

| Operação | Perfil |
|---|---|
| GET `/teachers?q=&offset=&limit=` | FINANCE, ADMIN |
| GET `/salaries?month=AAAA-MM&offset=&limit=` | FINANCE, ADMIN |
| POST `/salaries` | FINANCE |
| PATCH `/salaries/:id` | FINANCE |
| POST `/salaries/:id/payment` | FINANCE |
| GET `/reports/payments?month=AAAA-MM` | FINANCE, ADMIN |
| GET `/reports/salaries?month=AAAA-MM` | FINANCE, ADMIN |

A identidade de salário é `TeacherProfile.id`, devolvida como `teacherId`; não é `User.id` nem o código de funcionário. A consulta interna lê o perfil existente sem o editar. Não representa integração HTTP já aceite pelo grupo parceiro.

A migração `202610240001_teacher_salaries` acrescenta a tabela `teacher_salaries` e o enum SalaryStatus. Referências ao perfil docente são protegidas; a chave docente/mês evita duplicação e método/referência impede repetir pagamentos salariais. Edição e pagamento usam bloqueio transaccional e `expectedUpdatedAt` para detectar alterações concorrentes. A auditoria integra a mesma transacção; falha na auditoria reverte a operação.

## Frontend e arranque

Gestão financeira → Salários dos docentes; Gestão financeira → Relatórios mensais. A pesquisa de estudantes só aparece nas secções relacionadas com estudantes, sem interferir com salários ou relatórios.

O desenvolvimento carrega explicitamente o `.env` da raiz da API e recompila os pacotes partilhados antes de `npm run dev`, evitando executar contratos compilados antigos. O Docker web usa `/api/v1` e o Nginx encaminha `/api/` para o serviço api do mesmo compose, sem apontar para o localhost do computador do visitante.

As rotas de pesquisa de estudantes e contestações já existiam no código. Um 404 NOT_FOUND nessas rotas não indica falta de permissão; uma API actualizada responde 401 sem autenticação, 403 sem autorização ou 200 com dados autorizados. Backend e frontend têm de ser iniciados/actualizados juntos. As capturas fornecidas não indicavam o URL nem a versão da API usada, pelo que não permitem atribuir uma causa exacta ao ambiente anterior.

## Validação

`npm run test:financial:isolated` aplica as cinco migrações numa base descartável e testa as permissões reais, concorrência, duplicação, auditoria, limites do mês, totais e contrato OpenAPI. O navegador é validado com `scripts/financial-browser.mjs`, incluindo Finance a criar/editar/pagar, Admin apenas a consultar e a gerar PDF. Nunca se criam salários de teste na base habitual.

Resultado: 49 testes API e 15 frontend aprovados; browser com PDF aprovado; consultas locais do Admin e estudante com HTTP 200 pela origem do frontend. Migração aditiva aplicada à base local sem criar movimentos de teste. Ver [evidências](../integration-evidence/README.md).
