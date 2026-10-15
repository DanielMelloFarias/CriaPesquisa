# Scripts utilitários (backend)

Rodar da pasta `backend/` com **tsx**: `npx tsx scripts/<arquivo>.ts`.
Todos usam o Prisma client (`src/config/prisma.js`) — o Postgres precisa estar no ar
(`node scripts/pg-local.mjs`).

| Script | O que faz | Muda o banco? |
|---|---|---|
| `pg-local.mjs` | Sobe o PostgreSQL embutido (porta 5433). Mantém em foreground. | — (infra) |
| `contar.ts` | Conta os registros de cada tabela. | Não (leitura) |
| `inspecionar-db.ts` | Lista as pesquisas ativas com seções, perguntas e opções. | Não (leitura) |
| `gerar-dicionario.ts` | Gera `docs/pesquisas-cartao-cria.md` a partir do banco. | Não (só escreve o `.md`) |
| `pesquisa-crianca-completa.ts` | (Re)cria a pesquisa **Cartão CRIA — Criança** (64 perguntas). Idempotente. | Sim |
| `pesquisa-gestante-completa.ts` | (Re)cria a pesquisa **Cartão CRIA — Gestante** (62 perguntas). Idempotente. | Sim |
| `migrar-credenciais.ts` | Padroniza e-mail (definido em `SEED_EMAIL_DOMINIO`) e senha das contas-base. Idempotente. | Sim |
| `aprovar-existentes.ts` | Aprova respostas que ficaram `PENDENTE`. | Sim |
| `backup.ts` | Gera `backups/criapesquisa-<data>.dump` e aplica a retenção. | Não (leitura) |
| `restaurar.ts` | Restaura um `.dump` por cima do banco atual. Exige `--confirmar`. | **Sim — destrutivo** |
| `adicionar-semana-gestacional.ts` | Acrescenta "Semana gestacional atual" à pesquisa Gestante já publicada. Idempotente. | Sim |
| `importar-indicadores.ts <arquivo.xlsx>` | Importa os indicadores do Cartão CRIA da planilha (não lê "DtRegistro"/"Usuario"). Tudo entra para revisão. Idempotente. | Sim |
| `ativar-indicadores-prontos.ts` | Ativa os indicadores com definição pronta, pela mesma validação e auditoria da tela. Idempotente. | Sim |
| `gerar-referencia-oms.ts <meninos.xlsx> <meninas.xlsx>` | Regera `referencias/oms-imc-idade.json` a partir das tabelas oficiais da OMS. | Não (só escreve o JSON) |

Em produção, rode-os pelo serviço `seed` do compose (ver "Deploy" no README da raiz).

## Fonte da verdade das pesquisas

As definições das duas pesquisas do Cartão CRIA ficam em
**`prisma/pesquisas-cartao-cria.ts`** (seções, perguntas, tipos, opções, obrigatoriedade).
Tanto o `seed` quanto os scripts `pesquisa-*-completa.ts` consomem esse módulo — então
há um único lugar para editar. Depois de alterar, rode o builder correspondente e o
`gerar-dicionario.ts` para atualizar o doc.

## Recriar do zero

`npm run prisma:deploy` → `npm run seed` recria usuários + as duas pesquisas reais
(sem respostas) + os dados de painel (municípios/benefícios).
