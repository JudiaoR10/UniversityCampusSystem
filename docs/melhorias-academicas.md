# Melhorias de avaliações, horários e assiduidade

- Docentes consultam notas e resultados finais apenas de disciplinas que lecionam, verificadas pelos horários atribuídos.
- O bloqueio financeiro aplica-se à consulta das próprias notas do estudante, incluindo `/results`. A equipa académica mantém acesso para gestão.
- Uma sessão com assiduidade não pode ser eliminada (`409 SCHEDULE_HAS_ATTENDANCE`). A verificação e a eliminação usam uma transação e bloqueio da sessão para impedir inserções concorrentes de presenças.
- A correção positiva de uma nota não escreve na marca `everNegative`. Só uma negativa pode defini-la como `true`, preservando o histórico também em atualizações concorrentes nos dois endpoints de lançamento.
- Os resultados finais incluem inscrições `COMPLETED`, além de `ACTIVE` e `PENDING`. Uma transferência de curso não oculta as disciplinas anteriormente frequentadas.
- O resumo de assiduidade usa agrupamento por estudante e estado no banco. A taxa continua a ser `(presenças + atrasos) / total`.

## Situação académica e dispensa

A situação académica só é calculada depois de todas as avaliações contínuas terem nota. O número mínimo de testes configurado continua a ser exigido, mas não permite ignorar outras avaliações por preencher. Exames não substituem notas de frequência em falta e uma dispensa manual não antecipa a situação enquanto a frequência estiver incompleta.

O docente define a nota mínima de dispensa em **Frequência e Dispensa → Nota mínima de dispensa → Guardar regras**. O cálculo usa esse valor; quando não está configurado, aplica 14. A marca permanente de negativa continua a impedir a dispensa. A interface apresenta “—” na situação enquanto faltam notas.

## Paginação das consultas

`GET /attendance`, `GET /results` e `GET /schedules` aceitam `offset` e `limit`. Exemplo: `/attendance?offset=50&limit=50`.

Quando algum dos parâmetros é enviado, o limite padrão é 50, o máximo é 100 e o offset máximo é 100000. Valores inválidos devolvem 400. A resposta mantém o array em `data`; filtros de acesso são aplicados antes da paginação, com ordenação estável por data e identificador.

Chamadas antigas sem estes parâmetros mantêm o comportamento existente. O histórico de assiduidade do estudante usa páginas de 50 linhas e consulta uma linha adicional para determinar se existe página seguinte. O resumo considera todos os registos autorizados, independentemente da página aberta.

## Verificação

Os testes em `apps/api/src/test/academicImprovements.test.ts` cobrem permissões, bloqueio financeiro, inscrições concluídas, marca de negativa, proteção de sessões, agregação e validação da paginação com dependências simuladas. O teste da página de assiduidade cobre a navegação entre páginas e a preservação do resumo.

Estes testes não substituem uma verificação de concorrência com PostgreSQL real.
