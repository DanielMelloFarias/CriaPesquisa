# Indicadores — importação da planilha e tela de revisão

Status: rascunho para revisão da Maryana (2026-10-15).
Antecedem: `2026-09-24-indicadores-design.md` (seção "Importação"), `2026-10-14-indicadores-novos-tipos-design.md`.
Depois desta vem o painel de indicadores (fase 4), com spec própria.

## O problema

Os indicadores do Cartão CRIA estão numa planilha do Google Sheets, exportada em
`Exportação Indicadores.xlsx` (aba `Planilha1`, 290 linhas de 8 projetos). O sistema já sabe
cadastrar e calcular todos os tipos de que esses indicadores precisam, mas o cadastro é feito
um a um pela API, sem tela. Falta trazer as 110 linhas do Cartão CRIA (56 Criança, 54 Gestante)
para o sistema e dar a quem conhece os indicadores uma tela para conferir e ativar cada um.

A decisão de base continua a da primeira spec: **a planilha é importada uma vez e vira
registro histórico; a fonte da verdade passa a ser o sistema.**

## O que a planilha tem

Colunas: ID, Setor, Projeto, Nome do Indicador, Formula Descritiva, Fórmula de Cálculo, Tipo de
Indicador, Objetivo do Indicador / O que mede, Meta, Nº Pergunta, Pergunta (Descrição),
Observações, Táticos relacionados, Operacionais relacionados, Apresentação, DtRegistro, Usuario.

Medido em 2026-10-15 contra as perguntas do banco, só nas 110 linhas do Cartão CRIA:

| Situação | Linhas |
|---|---|
| "Pergunta (Descrição)" casa com uma única pergunta da pesquisa certa | 73 |
| Casa com mais de uma (a linha cita duas perguntas, ex.: TRIA) | 5 |
| Nenhuma candidata boa | 15 |
| Sem "Pergunta (Descrição)" | 17 |

Outros fatos que pesam no desenho:
- **"Nº Pergunta" não serve para ligar** (foi escrito contra uma versão antiga do questionário).
- **"Tipo de Indicador" é categoria temática** (Renda, Pré-natal, Estratégico…), não tipo de cálculo.
- **"Meta" está vazia** nas 110 linhas.
- **"Apresentação"** (Escopo, Perfil, ou os dois) é o agrupamento do painel; preenchida em 109.
- **"Usuario" tem e-mails pessoais** de quem cadastrou. O repositório é público.

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Escopo | só as 110 linhas do Cartão CRIA | resposta 13-c do Emerson: os outros projetos numa segunda etapa |
| Como a importação roda | script de linha de comando, uma vez, idempotente | é importação única; não justifica tela de upload. Roda no deploy como o script da semana gestacional |
| O que entra como ATIVO | **nada**. Tudo nasce `DEFINICAO_INCOMPLETA` com a sugestão preenchida | regra da primeira spec: uma pessoa confere antes de o número aparecer |
| Indicadores já definidos com o Emerson | entram com a **config completa** pronta (MCC, MCG, IDTC e faixas, TRIA, segurança/insegurança alimentar, CPRE, CPUER, CVAC, VCRAS, Índice Socioeconômico, Atenção à Saúde, desnutrição, obesidade, IMC da gestante) | a definição já foi decidida em duas rodadas; a revisão vira "conferir e ativar" |
| Dados pessoais | `Usuario` e `DtRegistro` **não** são lidos; a planilha **não** entra no repositório | LGPD; o repositório é público |
| Onde a conferência acontece | tela nova "Indicadores" no frontend, só ADMIN e GESTOR | é a tela que faltava para o cadastro de qualquer forma; o painel (fase 4) vai consumir os mesmos indicadores |

## Importador

`backend/scripts/importar-indicadores.ts <arquivo.xlsx>`:

1. Lê a aba `Planilha1` e filtra `Projeto` em "Cartão CRIA (Criança)" e "Cartão CRIA (Gestante)".
   Confere o cabeçalho; coluna faltando ou renomeada → para com erro, não importa nada.
2. Para cada linha, monta o indicador:
   - `origemPlanilha` = coluna ID (chave de idempotência: linha já importada é pulada);
   - `nome`, `objetivo`, `formulaOriginal` (Fórmula de Cálculo + Fórmula Descritiva);
   - `apresentacao` (lista: Escopo e/ou Perfil) e `categoria` (a coluna "Tipo de Indicador") — campos novos;
   - `pesquisaId` = pesquisa Criança ou Gestante, pelo Projeto;
   - `codigo` = sigla conhecida quando houver (MCC, CPRE…), senão `CRIA-<C|G>-<ID>`;
   - `status: DEFINICAO_INCOMPLETA`, `motivoIncompleto` dizendo o que falta conferir.
3. **Definição conhecida**: se a linha está no mapa de definições decididas
   (`backend/scripts/definicoes-cartao-cria.ts`, por ID da planilha), usa tipo e config de lá.
   O motivo fica "definição pronta — conferir e ativar".
4. **Senão, sugestão**:
   - casa "Pergunta (Descrição)" com as perguntas da pesquisa por texto normalizado
     (sem acento, sem pontuação, sem o número inicial, sem o sufixo "— ANTES/APÓS do Cartão CRIA"),
     por semelhança de palavras; aceita a melhor candidata se a semelhança for ≥ 0,5 e nenhuma
     outra estiver a menos de 0,05 dela;
   - se as duas melhores são o par ANTES/APÓS da mesma pergunta → sugere recorte `ANTES_APOS`
     com a substituição;
   - tipo sugerido pela pergunta e pela fórmula:
     - escolha única/múltipla + "por <algo>" ou "distribuição" na fórmula → `DISTRIBUICAO`;
     - escolha única/múltipla + "/ total" ou "x 100" → `PROPORCAO`, com `opcoesNumerador`
       vazio (a pessoa marca as opções na revisão);
     - número + "média" → `MEDIA`;
     - "total de" sem pergunta → `CONTAGEM`;
     - nada disso → sem tipo; motivo "definir tipo e pergunta".
   - config que ainda não valida (ex.: PROPORCAO sem opções) é gravada assim mesmo: o status
     `DEFINICAO_INCOMPLETA` já impede o cálculo, e o motor nunca vê config pela metade como número.
5. Imprime um resumo: importadas, puladas (já existiam), por situação (definição pronta /
   pergunta sugerida / ambígua / sem candidata / sem descrição) e a lista de IDs de cada grupo.

Saída de exemplo: `110 lidas · 110 importadas · 0 já existiam · 21 definição pronta · 61 com pergunta sugerida · ...`.

## Tela "Indicadores" (frontend)

Menu lateral, seção Administração, visível para ADMIN e GESTOR.

**Lista**: nome, código, pesquisa, apresentação, tipo, status. Filtros por status (padrão:
"Para revisar" = `DEFINICAO_INCOMPLETA`), pesquisa e apresentação. Contadores no topo
("21 prontos para ativar · 89 para definir").

**Revisão de um indicador** (duas colunas):
- à esquerda, o que veio da planilha: nome, fórmula de cálculo, fórmula descritiva, pergunta
  (descrição), objetivo, observações;
- à direita, o cadastro: pergunta (busca entre as perguntas da pesquisa, com a sugerida já
  marcada), tipo, e o formulário do tipo.

Formulários por tipo:
- PROPORCAO: as opções da pergunta como caixas de marcar (numerador);
- DISTRIBUICAO, MEDIA, CONTAGEM: só a pergunta;
- ESCALA: uma nota (0–100 ou "fora") para cada opção da pergunta;
- os demais (COMPOSTO, CLASSIFICACAO, CRUZAMENTO, DERIVADA, META_POR_IDADE, ZSCORE,
  PERCENTIL_OMS, ATALAH): editor de JSON com a config, validado pela API — eles chegam prontos
  do mapa de definições, e editar estrutura assim é raro;
- recorte ANTES/APÓS: liga/desliga e escolha da pergunta do par.

**Botões**: "Salvar" (continua `DEFINICAO_INCOMPLETA`), "Ativar" (muda para `ATIVO`; a API
valida tudo e devolve os problemas — 422 — que a tela mostra no campo certo), "Inativar".
Depois de ativar, a tela mostra o número calculado do indicador (chamada ao endpoint de
cálculo filtrada pela pesquisa), para a pessoa ver na hora se faz sentido.

## Dados

- Migration: `Indicador.apresentacao String[] @default([])` e `Indicador.categoria String?`.
  Validators e endpoints aceitam e devolvem os dois. O painel (fase 4) agrupa por `apresentacao`.
- `GET /api/indicadores` ganha filtros `status`, `pesquisaId` (já existem no model) e
  `apresentacao`, e os contadores por status.
- `GET /api/pesquisas/:id/perguntas` (ou o que já existir) serve a busca de pergunta da tela.

## Limites conhecidos

- **MCB** (média ponderada entre crianças e gestantes) não cabe no catálogo — é uma conta entre
  pesquisas, e o motor calcula por indivíduo. Entra `DEFINICAO_INCOMPLETA` com esse motivo, e
  fica para quando houver um tipo de agregação entre pesquisas.
- **Linhas que citam duas perguntas** (5) chegam sem pergunta sugerida; a pessoa escolhe na revisão.
- **Meta** fica vazia; a tela permite preencher.
- Os outros 7 projetos da planilha ficam fora até a segunda etapa.

## Testes

- Importador:
  - lê um xlsx de teste (gerado no próprio teste com ExcelJS, sem dado pessoal) e grava o
    esperado;
  - rodar duas vezes não duplica;
  - cabeçalho errado para sem gravar nada;
  - nunca grava `Usuario`;
  - casamento de texto (normalização, limiar, desempate, par ANTES/APÓS) com casos unitários;
  - definição conhecida tem prioridade sobre a sugestão.
- Mapa de definições: toda config do mapa passa em `validarConfig` e em `problemasDasPerguntas`
  contra as perguntas reais do seed (teste contra o banco).
- Tela: lista com filtro, formulário de PROPORCAO marcando opções, "Ativar" mostrando o 422 da
  API, e o número calculado após ativar.

## Fora do escopo

- Painel de indicadores (fase 4).
- Outros projetos da planilha.
- Upload da planilha pela tela.
