# Smart Campus Core

Plataforma integrada **Smart Campus** para a unidade curricular **Prática Técnico-Profissional III (PTP III)** da **Universidade Joaquim Alberto Chissano (UJAC)**.

O repositório fornece o **Core comum**: autenticação, utilizadores/roles, API versionada, auditoria, salas, ocorrências, dashboard e navegação para todos os módulos (funcionais, parciais ou em desenvolvimento).

## Pré-requisitos

- Node.js 20+ (recomendado 22)
- npm 10+
- Docker / Docker Compose (PostgreSQL)

## Instalação rápida

```bash
cp .env.example .env
npm install
docker compose up -d db
npm run db:generate
npm run db:migrate:dev -- --name init
npm run db:seed
npm run build -w @smart-campus/shared-types
npm run build -w @smart-campus/validation
npm run build -w @smart-campus/api-client
npm run dev
```

- Frontend: http://localhost:5173
- Home pós-login: `/ops` (Centro de Operações)
- Dashboard clássico: `/dashboard`
- API: http://localhost:4100
- Health: http://localhost:4100/health
- Swagger: http://localhost:4100/api/docs

## Credenciais de demonstração (apenas desenvolvimento)

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | admin@smartcampus.demo | Admin123! |
| COORDINATOR | coordenador@smartcampus.demo | Coord123! |
| TEACHER | docente@smartcampus.demo | Docente123! |
| TECHNICIAN | tecnico@smartcampus.demo | Tecnico123! |
| STUDENT | estudante@smartcampus.demo | Estudante123! |

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | API + Web |
| `npm run db:migrate:dev` | Migrações em desenvolvimento |
| `npm run db:seed` | Dados fictícios |
| `npm test` | Testes |
| `npm run build` | Build de todos os workspaces |

## Docker completo

```bash
cp .env.example .env
docker compose up --build
```

## Deploy gratuito (GitHub → Internet)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/acorreialabs/UniversityCampusSystem)

Publicar online **sem custo** com PostgreSQL [Neon](https://neon.tech) + API e frontend [Render](https://render.com):

```bash
cp .env.deploy.example .env.deploy
# Editar .env.deploy → NEON_API_KEY (https://console.neon.tech/app/settings/api-keys)
export $(grep -v '^#' .env.deploy | xargs)
npm run provision:deploy
# Colar DATABASE_URL no Render quando pedido → npm run verify:deploy
```

Guia completo: **[docs/deploy-gratuito.md](docs/deploy-gratuito.md)** · Blueprint: [`render.yaml`](render.yaml)

## Documentação

- [**Deploy gratuito (Neon + Render)**](docs/deploy-gratuito.md) — publicar a partir do GitHub
- [**Manual de construção do Core**](docs/manual-construcao-core.md) — passo a passo completo (arquitectura → infraestrutura → validação)
- [**Manual das APIs do Core**](docs/manual-apis-core.md) — todas as APIs, criação e testes (Swagger, Postman, curl)
- [Arquitectura](docs/architecture.md)
- [Convenções de API](docs/api-conventions.md)
- [Exemplos curl](docs/api-examples.md)
- [Matriz de roles](docs/authorization-matrix.md)
- [Guia de integração](docs/integration-guide.md)
- [Contribuição](CONTRIBUTING.md)

## Fluxo transversal

1. Login com utilizador demo
2. Consultar perfil (`/api/v1/me`)
3. Consultar salas
4. Criar ocorrência
5. Alterar estado (técnico/coordenador/admin)
6. Ver auditoria

## Limitações actuais

- Módulos académicos/IoT/relatórios estão parcialmente preparados (placeholders + schema)
- MQTT ainda não está ligado (estrutura e dados demo apenas)
- Notificações UI marcadas como preparadas

## Colaboração no GitHub (grupos PTP III)

Repositório oficial: **https://github.com/acorreialabs/UniversityCampusSystem**

| Guia | Descrição |
| --- | --- |
| **[Guia de contribuição para grupos](docs/guia-contribuicao-grupos.md)** | **Começar aqui** — fork, clone, setup local, branch, PR |
| [Colaboração GitHub](docs/colaboracao-github.md) | Regras técnicas e governança do repositório |
| [Módulos por grupo](docs/modulos-por-grupo.md) | Mapa de módulos e branches sugeridas |
| [Contribuição](CONTRIBUTING.md) | Commits, PRs, definição de pronto |

### Início rápido para um grupo

1. **Fork** em https://github.com/acorreialabs/UniversityCampusSystem  
2. **Clone** do fork → ver [guia-contribuicao-grupos.md](docs/guia-contribuicao-grupos.md)  
3. Instalar e correr (`npm install`, Docker, `npm run dev`)  
4. Branch `feature/grupo-<area>-<modulo>-<obj>` → PR para `main`

## Gestão financeira — branch de integração

O módulo financeiro usa o login e o cliente oficial do Core. Abrir `/financial` após login como STUDENT, FINANCE ou ADMIN. Conta demo da tesouraria: `financas@smartcampus.demo` / `Finance123!` (após seed).

- [Decisões, contratos e passos de integração](docs/decisions/financial-core-alignment.md)
- [Resultados da validação](docs/integration-evidence/README.md)
- Testes em base descartável: `npm run test:financial:isolated`
