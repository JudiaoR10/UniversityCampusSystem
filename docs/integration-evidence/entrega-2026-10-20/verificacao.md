# Verificação da entrega financeira

Execução concluída em 20 de Outubro de 2026, às 11:21 CAT (09:21 UTC).

Código testado: `a51ba5b16750f808dcfe6902efe7bf810297b16c`, na branch
`feature/financial-core-alignment`, sobre a base oficial `0e97767`.

## Preparação

Os ficheiros foram extraídos com `git archive` para uma pasta temporária.
Foram copiadas as dependências já instaladas, preservando as ligações dos
workspaces dentro dessa pasta. Não foi repetido `npm ci`; a verificação usou
as dependências locais disponíveis.

Foi executado `npm run test:financial:isolated`, com `PLAYWRIGHT_MODULE` a apontar
para a instalação local de Playwright e `CHROME_PATH=/usr/bin/google-chrome`.
O script criou um PostgreSQL 15 descartável, aplicou as quatro migrações,
executou o seed e removeu o contentor no fim. A base habitual não foi usada.

## Resultados

| Verificação | Resultado |
|---|---|
| Migrações oficiais e financeiras, a partir de uma base vazia | Aprovadas |
| Build de shared-types, validation, api-client, API e web | Aprovado |
| API: integração financeira e regressão do Core | 40 testes aprovados, 0 falhas, em 7 ficheiros |
| Teste web existente | 1 aprovado |
| Operações financeiras do router e do OpenAPI | As mesmas 14 operações |
| Referências internas do OpenAPI | Resolvidas |
| Health sem autenticação, fora de `/api/v1` | HTTP 200 |
| Swagger e respectivo ficheiro de inicialização | HTTP 200, com health e rotas financeiras |
| Chrome: criação de dívida, contestação e pagamento | Aprovado |
| Chrome: pagamento visível ao estudante | Estado REGULARIZADA, sem botão Contestar |
| Chrome: perfil TEACHER | Sem menu financeiro; acesso directo redireccionado para `/ops` |

No primeiro ensaio, a validação de navegador parou porque o script encontrou
vários botões de pagamento. O seletor foi corrigido no commit testado para
identificar a linha da dívida criada pelo próprio teste. A execução completa
foi repetida e terminou com sucesso.

A referência do pagamento exige 4–80 caracteres, em concordância com a
validação da API. Os outros fluxos conservam a sessão e os identificadores
oficiais do Core: `studentId` financeiro corresponde a `User.id`.

## Evidências

- [Resumo da execução](summary.json)
- [Verificações do navegador](browser.json)
- [Interface FINANCE depois de criar a dívida](finance-core.png)
- [Interface STUDENT depois de submeter a contestação](student-core.png)

As capturas foram feitas antes do pagamento. A verificação posterior do
pagamento e do perfil TEACHER está registada em `browser.json`.

O relatório bruto do executor não é publicado porque inclui caminhos locais
da máquina de desenvolvimento. O resultado necessário para a entrega está em
`summary.json`: 40 testes aprovados, nenhuma falha.

## Âmbito e limites

O README principal e o manual geral do Core não fazem parte das alterações
entregues. Também ficaram de fora a porta local do PostgreSQL, o proxy Vite
local e as mudanças gerais de URL nas outras páginas. A cópia testada não
dependia desses ficheiros alterados.

O teste de navegador usa o build web servido pela API na mesma origem. Não
substitui uma validação de produção com domínios separados. O Dockerfile inclui
agora a documentação, mas esta execução não reconstruiu a imagem Docker da API.

O build emitiu o aviso de bundle superior a 500 kB, sem falhar. As mensagens de
erro nos testes de auditoria e notificações são esperadas: verificam a reversão
da transacção e a resposta 503 quando não há receptor externo configurado.

A consulta de contestações pela interface FINANCE continua pendente. A
resolução por ID já existe na API. Não foi validado um serviço externo de
notificações nem uma integração académica de outro grupo.
