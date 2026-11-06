# Relatório técnico — módulo de gestão financeira

**Projeto:** Smart Campus — Universidade de Ciência e Tecnologia Joaquim Alberto Chissano

**Unidade curricular:** Prática de Tecnologias de Programação III

**Referência:** ficha «Módulo: Gestão Financeira de Estudantes (financial)», secção 3.2, V1

**Versão analisada:** commit `0a2ad58` (6 de novembro de 2026)

Este relatório descreve o código disponível na versão identificada. A presença de código e testes não substitui a aceitação funcional por utilizadores nem comprova a existência de dados reais ou de uma integração externa em produção.

## 1. Objetivo e âmbito

O módulo regista obrigações financeiras e pagamentos confirmados, calcula o estado financeiro dos estudantes, oferece histórico e pedidos de análise e disponibiliza informação à tesouraria e a outros componentes do Core. A solução também inclui operações de propinas por curso, funcionários e salários, que são extensões face à V1 centrada no estudante.

O pagamento registado representa uma confirmação administrativa. Não é, por si só, uma transferência bancária nem prova de integração com um operador de pagamentos.

## 2. Arquitetura e componentes

O Smart Campus é um monólito modular: uma API Express em TypeScript e uma base PostgreSQL partilhada, com Prisma como camada de persistência. A interface React comunica com a API versionada através do cliente comum. Autenticação, autorização, validação, envelope de respostas, identificador de correlação e infraestrutura são reutilizados do Core.

```text
Interface React /financial
       │ cliente HTTP do Core + sessão autenticada
       ▼
Router financeiro (Express, autenticação, RBAC e validação Zod)
       ▼
Serviços de aplicação e funções de domínio
       │                            └── cliente de notificações configurável
       ▼
Prisma ── PostgreSQL partilhado ── utilizadores, estudantes e inscrições do Core
```

O código principal reside em `apps/api/src/modules/financial`: `http/financialRouter.ts` expõe rotas, `application/` coordena casos de uso, `domain/` contém conversões e regras auxiliares, e `infrastructure/` contém acesso e integração de notificações. A interface está em `apps/web/src/pages/FinancialPage.tsx` e `apps/web/src/components/financial/`. Contratos partilhados e validação estão em `packages/shared-types` e `packages/validation`; o contrato HTTP está em `docs/openapi.yaml`.

## 3. Rastreabilidade da V1

| Item da ficha, §3.2 | Implementação observada | Situação e limite |
| --- | --- | --- |
| Registar dívida e detetar vencimento | `POST /financial/debts`; serviço calcula vencimento considerando data e tolerância da política. | Implementado; o período de tolerância influencia a classificação. |
| Registar pagamento/regularização | `POST /financial/payments` regista confirmação, regulariza e recalcula o estado em transação. | Implementado para liquidação integral; valores diferentes do total são rejeitados. |
| Consultar estado financeiro | `GET /financial/students/:studentId/status` e função interna de verificação. | Implementado para papéis humanos autorizados; o token `SERVICE_MODULE` previsto na ficha não está presente neste router. |
| Consultar histórico | `GET /financial/students/:studentId/history`. | Implementado com controlo de acesso ao próprio estudante. |
| Submeter e resolver pedidos de análise | `POST`, `GET` e `PATCH /financial/analysis-requests`. | Implementado; submissão por STUDENT e resolução por FINANCE. |
| Notificações automáticas | Criação de notificações financeiras e serviço de entrega/reenvio. | Implementação existente; entrega externa depende de configuração e disponibilidade do serviço recetor. |
| Relatórios agregados | `GET /financial/reports` e relatórios mensais de pagamentos e salários. | Implementado na API e com componentes de interface; aceitação manual depende da execução. |
| Política de bloqueio e auditoria | `GET/PATCH /financial/policies/:policyId`; eventos de auditoria em operações financeiras. | Implementado para ADMIN; verificar em teste funcional os eventos relevantes. |

**Conclusão de âmbito:** os oito grupos de funcionalidades têm implementação identificável. A conformidade integral com a ficha exige tratar as diferenças de permissões e de integração abaixo e concluir a validação funcional. Não se deve apresentar esta tabela como certificação de produção.

## 4. Fluxos e regras principais

1. FINANCE seleciona o estudante e regista uma dívida. A identificação financeira `studentId` corresponde ao `User.id`; a matrícula académica é utilizada para pesquisa e apresentação.
2. O serviço determina o vencimento com a política aplicável. O bloqueio depende de bloqueio automático ativo, existência de dívida vencida e total vencido superior ao limite definido. A consulta recalcula o estado, tendo em conta a data e a tolerância.
3. FINANCE confirma o pagamento pelo valor integral. O sistema regista o pagamento, regulariza a dívida, recalcula o estado, cria uma notificação e regista auditoria. A operação usa transação e bloqueio do estudante para reduzir conflitos concorrentes.
4. STUDENT consulta os seus dados e pode submeter uma contestação sobre a sua dívida. FINANCE analisa e decide o pedido. Os acessos de estudante são sujeitos à verificação de propriedade.
5. Na extensão de pessoal, FINANCE propõe alterações salariais; ADMIN aprova ou rejeita. FINANCE regista salários e pagamentos, e FINANCE/ADMIN consultam comprovativos e relatórios.

## 5. Autorização e diferenças face à ficha

| Perfil | Acesso observado no router financeiro |
| --- | --- |
| STUDENT | Dívidas, estado, histórico, notificações e comprovativos próprios; consulta e submissão de pedidos de análise próprios. |
| FINANCE | Pesquisa de estudantes e docentes, dívidas, pagamentos, decisão de contestações, funcionários, salários e relatórios, segundo as rotas. |
| ADMIN | Consultas financeiras, políticas, revisão de propostas salariais e operações específicas, incluindo emissão por inscrições e cancelamento de dívidas. |

A ficha descreve ADMIN como podendo fazer tudo o que FINANCE faz. Na implementação, por exemplo, criar dívida individual, registar pagamento e resolver contestação estão autorizados apenas a FINANCE. A ficha também prevê um `SERVICE_MODULE` com acesso mínimo ao estado; o router de estado inspecionado autoriza STUDENT, FINANCE e ADMIN. Estas diferenças precisam de decisão explícita da equipa antes de afirmar aderência integral. As verificações de propriedade e regras de negócio aplicam-se além da lista de papéis.

A invariante INV-1 da ficha afirma que uma dívida vencida impede o estado ACTIVE. A regra efetiva é configurável: pode manter ACTIVE se o bloqueio automático estiver desligado ou o total vencido não ultrapassar o limite da política. Esta é outra diferença de regras a validar com a equipa, não uma equivalência automática à ficha.

## 6. Integração com outros módulos

As pesquisas financeiras de estudantes e docentes reutilizam serviços de diretório de utilizadores e os registos existentes no Core; não criam uma segunda fonte académica nem importam automaticamente dados de outra instalação. Inscrições utilizam `assertUserFinanciallyClear` do serviço financeiro em operações identificadas em `apps/api/src/modules/enrolments/application/enrolmentService.ts`. Essa verificação interna recusa estudantes bloqueados; não comprova integração com biblioteca, exames ou outros módulos mencionados como consumidores desejados na ficha.

A emissão de propinas por inscrições consulta inscrições ativas por curso e ano letivo. A implementação tenta evitar a criação de outra dívida de propina pendente ou vencida com o mesmo título para o estudante. O cadastro externo de funcionários é financeiro e não substitui um sistema completo de recursos humanos.

## 7. API e dados

A base das rotas é `/api/v1/financial`. A especificação completa de parâmetros, formatos e erros deve ser consultada no [OpenAPI](openapi.yaml) ou em `/api/docs` quando a API estiver ligada.

| Recurso | Operações principais |
| --- | --- |
| `students`, `teachers` | Pesquisa de identidades para FINANCE/ADMIN. |
| `debts`, `payments` | Consulta, registo, cancelamento, emissão por inscrições e comprovativo de pagamento. |
| `students/:studentId/status`, `history`, `notifications` | Estado, histórico e avisos com autorização. |
| `analysis-requests` | Submissão, consulta e decisão de contestações. |
| `policies/:policyId`, `reports` | Política e relatório financeiro agregado. |
| `employees`, `salary-change-requests`, `salaries`, `course-tuitions`, `reports/payments`, `reports/salaries` | Extensões de pessoal, salários, mensalidades e relatórios. |

O esquema Prisma contém entidades para dívida, pagamento, estado financeiro, pedido de análise, notificações e política, bem como entidades para a extensão salarial. Os montantes são tratados com `Decimal` no servidor; conversões para os DTOs devem ser consideradas ao consumir JSON. O código cria eventos de auditoria com ator e identificador de correlação em operações financeiras relevantes; a cobertura de cada operação deve ser confirmada nos testes e na revisão do código.

## 8. Instalação e operação local

Requisitos do projeto: Node.js 20 ou superior, npm 10 ou superior, Docker e Docker Compose. Em ambiente novo de desenvolvimento, a partir da raiz do repositório:

```bash
cp .env.example .env
npm install
docker compose up -d db mosquitto
npm run db:generate
npm run db:migrate
npm run dev
```

Configurar `.env` para a base correta antes de aplicar migrações. `npm run db:migrate` aplica migrações existentes; não executar reset sobre bases com dados a preservar. `npm run db:seed` cria dados de demonstração e só deve ser executado numa base adequada, após rever o efeito sobre os dados existentes. As migrações são partilhadas com o Core em `prisma/migrations`; em bases antigas ou divergentes é necessária uma análise específica do histórico e uma cópia de segurança antes de qualquer correção.

Interface: `http://localhost:5173/financial`; API: `http://localhost:4100`; saúde: `/health`; Swagger: `/api/docs`. Portas e disponibilidade dependem da configuração local. Contas de demonstração e instruções gerais encontram-se no [README](../README.md); não utilizar credenciais de demonstração em produção.

## 9. Qualidade e verificação

O repositório contém testes de integração financeiros e salariais, testes da interface e o comando `npm run test:financial:isolated`, concebido para uma base descartável. Os comandos gerais são `npm run build`, `npm run test:api` e `npm run test:web`.

Na validação de 6 de novembro de 2026, numa cópia de trabalho baseada no commit `0a2ad58` com alterações locais de documentação e da legenda de relatórios, passaram as 14 migrações, o build e 324 testes da API, ficando 3 testes académicos marcados como pendentes. A execução posterior dos testes da interface passou com 67 testes. O relatório JSON da API está em [evidências da repetição](integration-evidence/validacao-2026-11-06-repeticao/api-tests.json). A base usada para estes testes foi descartável, com dados fictícios; estes números não são uma certificação da instalação de produção.

O [ensaio automatizado no navegador](integration-evidence/validacao-2026-11-06-browser-verificado/browser.json) executou os percursos de estudante, tesouraria e administrador, com criação e pagamento de dívida, contestação, política, proposta e aprovação salarial e relatório. Também verificou o redirecionamento de um docente. As capturas e o PDF gerado respeitam a mesma base isolada; a revisão humana final permanece pendente.

Para aceitação, executar com dados sintéticos: acesso por STUDENT, FINANCE e ADMIN; criação e pagamento integral de dívida; histórico e contestação; recusa de acesso ao recurso de outro estudante; política e recálculo; proposta e decisão salarial; relatórios e comprovativos. Registar separadamente os resultados manuais e os automatizados. Um teste de browser ou uma captura só deve ser declarado quando efetivamente realizado.

## 10. Limitações e pontos em aberto

- Falta decidir e validar as divergências V1 de ADMIN e `SERVICE_MODULE` indicadas na secção 5.
- A política configurável pode conduzir a resultado diferente da regra absoluta da INV-1 da ficha.
- A base de desenvolvimento e o seed usam dados de demonstração. A existência, origem, autorização de acesso e qualidade dos dados reais não foram estabelecidas por esta análise.
- Gateway de pagamentos, integração bancária e parcelamento não são parte comprovada da V1. A confirmação registada deve corresponder a uma verificação realizada pela instituição.
- Notificações externas dependem da configuração do endpoint e token e do funcionamento do recetor; criar um registo local não prova entrega externa.
- O serviço interno em inscrições não demonstra, por si, o consumo por todos os módulos indicados na ficha.
- Antes da entrega, associar ao commit final os resultados de testes e a revisão manual, e conferir a documentação gerada e o manual contra a interface efetivamente executada.

## Referências

- Ficha de arquitetura `Modulo - Financial.pdf`, em particular §§1, 3.2–3.4.
- [Contrato OpenAPI](openapi.yaml), [README do projeto](../README.md) e [decisão de salários e relatórios](decisions/salarios-relatorios-mensais.md).
- `apps/api/src/modules/financial/http/financialRouter.ts`, serviços financeiros e `prisma/schema.prisma` na versão identificada.
