# Validação isolada — 6 de novembro de 2026

Base de código: commit `0a2ad58`, com alterações locais posteriores de documentação, legenda do relatório salarial e roteiro de teste. Ambiente de teste: PostgreSQL 15 descartável, dados do seed de demonstração e Chrome headless. Não foram usados dados reais de estudantes ou pagamentos.

## Resultados

- As 14 migrações e o seed concluíram numa base descartável; o build passou.
- A API passou 324 testes, com 3 testes académicos marcados como `todo`. O resultado em JSON está em `../validacao-2026-11-06-repeticao/api-tests.json`.
- A interface passou 67 testes após correção de um seletor do teste novo.
- O roteiro do navegador passou na execução desta pasta: consultar `browser.json`. Registou dívida e pagamento fictícios, contestação e decisão, políticas, proposta e aprovação salarial, pagamento salarial, consulta do relatório e redirecionamento de docente sem acesso financeiro.
- O PDF é gerado pelo navegador em modo de impressão; não prova impressão física. O ensaio automatizado não substitui a aceitação humana nem valida uma integração bancária ou entrega externa de notificações.

As tentativas anteriores foram guardadas localmente em pastas separadas: o primeiro roteiro encontrou seletores ambíguos; outra tentativa encontrou um salário já existente no mês do seed; e uma execução anterior completou o percurso mas não terminou sozinha por uma ligação HTTP persistente. O roteiro foi corrigido e a execução desta pasta terminou com código zero.
