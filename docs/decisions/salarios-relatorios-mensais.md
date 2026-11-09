# Salários e relatórios mensais

Data: 2026-10-24.

## Responsabilidades confirmadas

FINANCE gere o quadro financeiro dos funcionários, propõe valores salariais, gera folhas mensais após aprovação e regista pagamentos. ADMIN aprova ou rejeita as propostas, consulta salários e relatórios e pode imprimir. O cadastro de utilizadores, docentes e cursos permanece no Core; trabalhadores sem conta recebem apenas um cadastro externo mínimo. A role técnica continua a chamar-se FINANCE.

## Funcionalidades

- Vista única de docentes, técnicos, coordenadores, administrativos, financeiros e pessoal externo.
- FINANCE envia uma proposta salarial justificada; somente ADMIN pode aprovar ou rejeitar.
- Um salário por funcionário e período mensal (AAAA-MM), sempre gerado a partir do último valor aprovado.
- Não existe edição directa do montante da folha mensal.
- Registo do pagamento integral já efectuado, com método e referência. Não transfere dinheiro nem integra bancos. A data de pagamento é o instante deste registo.
- Salário pago imutável. Não há pagamentos parciais, processamento fiscal, descontos, cancelamento ou estorno neste incremento.
- Definição de mensalidade para cursos existentes, sem copiar ou editar o cadastro académico.
- Relatórios mensais separados para recebimentos de estudantes e salários pagos a funcionários, com detalhe completo, referências, datas, quantidade e total monetário.
- ADMIN e FINANCE podem consultar e imprimir. O PDF/diálogo de impressão contém todas as linhas devolvidas pelo relatório, sem menus da aplicação.

O relatório filtra `paidAt` pelo mês civil de Moçambique (Africa/Maputo, UTC+02:00). Salário de Setembro pago em Outubro entra no relatório de Outubro, mantendo o período salarial na descrição. Salários pendentes e regularizações por contestação não são pagamentos. Os totais são calculados com Decimal e a leitura usa uma transacção consistente. Acima de 10 000 movimentos, a API devolve 422 REPORT_TOO_LARGE; nunca imprime silenciosamente um relatório incompleto.

## API

Base: `/api/v1/financial`.

| Operação | Perfil |
|---|---|
| GET `/employees?q=&category=&active=` | FINANCE, ADMIN |
| POST `/employees/external` | FINANCE |
| GET/POST `/salary-change-requests` | FINANCE e ADMIN consultam; FINANCE propõe |
| PATCH `/salary-change-requests/:id/review` | ADMIN |
| GET `/salaries?month=AAAA-MM&offset=&limit=` | FINANCE, ADMIN |
| POST `/salaries` | FINANCE |
| POST `/salaries/:id/payment` | FINANCE |
| GET `/course-tuitions` | FINANCE, ADMIN |
| PUT `/course-tuitions/:id` | FINANCE |
| GET `/reports/payments?month=AAAA-MM` | FINANCE, ADMIN |
| GET `/reports/salaries?month=AAAA-MM` | FINANCE, ADMIN |

A identidade financeira usa uma chave `CORE:<User.id>` ou `EXTERNAL:<ExternalEmployee.id>`. A consulta interna lê os perfis existentes sem os editar.

A migração `20261027100000_employees_salary_approval_course_tuition` preserva os salários docentes existentes e move-os para `employee_salaries`. Acrescenta funcionários externos, compensações aprovadas, propostas salariais e mensalidades. A chave funcionário/mês evita duplicação e método/referência impede repetir pagamentos. Aprovação e pagamento usam bloqueio transaccional; a auditoria integra a mesma transacção.

## Frontend e arranque

Gestão financeira → Funcionários; Gestão financeira → Mensalidades por curso; Gestão financeira → Relatórios mensais. Os filtros aparecem antes dos cartões e resultados.

O desenvolvimento carrega explicitamente o `.env` da raiz da API e recompila os pacotes partilhados antes de `npm run dev`, evitando executar contratos compilados antigos. O Docker web usa `/api/v1` e o Nginx encaminha `/api/` para o serviço api do mesmo compose, sem apontar para o localhost do computador do visitante.

As rotas de pesquisa de estudantes e contestações já existiam no código. Um 404 NOT_FOUND nessas rotas não indica falta de permissão; uma API actualizada responde 401 sem autenticação, 403 sem autorização ou 200 com dados autorizados. Backend e frontend têm de ser iniciados/actualizados juntos. As capturas fornecidas não indicavam o URL nem a versão da API usada, pelo que não permitem atribuir uma causa exacta ao ambiente anterior.

## Validação

`npm run test:financial:isolated` aplica todas as migrações numa base descartável e testa permissões, aprovação salarial, duplicação, auditoria, mensalidades, limites do mês, totais e contrato OpenAPI. O navegador é validado com `scripts/financial-browser.mjs`, incluindo a proposta por FINANCE, aprovação por ADMIN, pagamento e PDF.

Resultado actual: 82 testes API e 17 frontend aprovados, com 3 testes académicos já marcados como pendentes. Ver [evidências](../integration-evidence/README.md).
