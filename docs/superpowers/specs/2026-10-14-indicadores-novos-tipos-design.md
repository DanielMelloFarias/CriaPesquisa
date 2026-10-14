# Indicadores — novos tipos de cálculo

Status: revisada após as respostas do Emerson à 2ª rodada (2026-10-14); aguardando revisão.
Antecede: `2026-09-24-indicadores-design.md` (catálogo, motor, recorte ANTES/APÓS).
Depois desta vêm a importação da planilha (fase 3) e o painel (fase 4), com specs próprias.

## O problema

As respostas do Emerson (`docs/perguntas-indicadores-abertas.md` e
`docs/perguntas-indicadores-rodada-2.md`) pedem contas que o catálogo de oito tipos não
expressa:

| Indicador | Decisão | O que falta no catálogo |
|---|---|---|
| CPRE | antes de 12 sem. = 100, após = 50, sem pré-natal = 0, não soube = fora | nota por opção (PROPORCAO só dá 0 ou 100) |
| Escolaridade, moradia e renda (Índice Socioeconômico) | nota pela ordem das opções | nota por opção |
| CPUER | consultas ÷ esperado pela Caderneta para a idade, teto 100 | meta que depende da idade |
| Índice Socioeconômico Familiar | z-score contra a própria pesquisa, pesos iguais | padronização contra a amostra |
| Desnutrição (IMC < P10), obesidade (IMC > P85) | percentil das **curvas da OMS** por idade e sexo | referência externa por idade e sexo |
| IMC atual da gestante | **Atalah** por semana gestacional | classificação por semana + pergunta nova |

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Referência do z-score | todas as respostas aprovadas da pesquisa do indicador, **sem** os filtros do painel | resposta 2.1-a; filtrar a referência faria a média do recorte ser sempre zero |
| Exibição do z-score | média do z do recorte filtrado (positivo = acima da média do estado) | resposta 2.2-a |
| Onde o filtro do painel atua | **depois** do cálculo individual, só na agregação | o z-score precisa da pesquisa inteira mesmo com o painel filtrado; um único universo de dados para todos os tipos |
| Tabelas de referência (OMS, Atalah, Caderneta) | dados versionados no repositório, lidos das fontes oficiais, com teste contra valores publicados | número de política pública não pode depender de tabela digitada de memória |
| Chave da nota por opção | texto da opção | o front grava texto, e motor e filtros já comparam texto |

## Tipos novos

| Tipo | Config | f(indivíduo) | Agregação |
|---|---|---|---|
| `ESCALA` | `perguntaId`, `notas: { [textoDaOpcao]: número 0–100 \| null }` | nota da opção marcada; `null` na tabela = fora do cálculo | média |
| `META_POR_IDADE` | `perguntaId` (número), `nascimentoPerguntaId` (data), `faixas: [{ deMeses, ateMeses, esperado }]` | `min(100, valor ÷ esperado × 100)` pela faixa da idade na data da entrevista | média |
| `ZSCORE` | `componentes: [{ indicadorId, peso }]` | média ponderada dos z de cada componente: `(x − média_ref) ÷ desvio_ref` | média |
| `PERCENTIL_OMS` | `imcIndicadorId`, `nascimentoPerguntaId`, `sexoPerguntaId`, `opcoesSexo: { masculino, feminino }`, `corte: { abaixoDe: P } \| { acimaDe: P }` | 100 se o IMC está além do percentil P da curva OMS para idade e sexo, senão 0 | média (= % de crianças) |
| `ATALAH` | `imcIndicadorId`, `semanaPerguntaId` | faixa de Atalah (baixo peso / adequado / sobrepeso / obesidade) para a semana gestacional | % por faixa |

Configuração dos indicadores com essas decisões:

- **CPRE** = `ESCALA` sobre "Quando iniciou o pré-natal?": antes de 12 semanas = 100, após = 50,
  sem pré-natal = 0, "Não soube informar" = `null`.
- **CPUER** = `META_POR_IDADE` com a tabela da Caderneta (resposta 4-a/c): 0–11 meses → 7,
  12–23 meses → 2, 24 meses ou mais → 1.
- **Índice Socioeconômico** = `ZSCORE` sobre três `ESCALA` (renda, escolaridade, moradia), peso 1 cada.
- **Desnutrição** = `PERCENTIL_OMS` sobre o IMC da criança (`DERIVADA`), `abaixoDe: 10`;
  **obesidade** = idem, `acimaDe: 85`.
- **IMC atual da gestante** = `ATALAH` sobre o IMC atual e a semana gestacional. O IMC
  pré-gestacional continua `CLASSIFICACAO` com as faixas de adulto (< 18,5 / 18,5–24,9 /
  25–29,9 / ≥ 30).

### Regras por tipo

**ESCALA**
- Só para pergunta de escolha única. Nenhuma ou mais de uma opção marcada → `null`.
- Cadastro: toda opção da pergunta tem de estar em `notas` (com número ou `null`), e nenhuma
  chave pode ser opção inexistente. Recusa com 422 citando as faltantes ou sobrando. Nota
  fora de 0–100 ou não finita → 422.
- Motor: opção marcada que não está em `notas` (a pergunta ganhou opção depois do cadastro)
  → indicador `INCOMPLETO`, motivo "opção X sem nota". Nunca vira zero.

**META_POR_IDADE**
- Idade em meses completos entre `nascimentoPerguntaId` (`valorData`) e `enviadaEm`. Data
  ausente, idade negativa ou fora de todas as faixas → `null`.
- Valor em branco → `null`; zero consultas → 0 (zero não é branco).
- Cadastro: faixas em ordem, sem sobreposição, `ateMeses` exclusivo (a última pode ser
  aberta), `esperado` > 0 e finito; `perguntaId` numérica e `nascimentoPerguntaId` de data
  (conferido contra a pergunta; 422 se o tipo não bate).
- Limite conhecido, aceito na resposta 4-c: a criança com menos de 12 meses é comparada com 7
  consultas, embora só tenha vivido parte do ano. Um bebê de 3 meses com as 4 consultas em
  dia vale 57. Ver "Ponto a confirmar" abaixo.

**ZSCORE**
- Componentes precisam ter valor por indivíduo (CONTAGEM, DISTRIBUICAO, CLASSIFICACAO e ATALAH
  → `INCOMPLETO`, como a guarda 5b). `peso` > 0 e finito.
- Média e desvio-padrão **amostral** de cada componente sobre a referência. Indivíduo sem
  valor em algum componente → `null` (não se padroniza meia família).
- Desvio zero ou menos de 2 valores na referência → todos `null` → `SEM_DADOS`.
- O resultado não está em 0–100: um ZSCORE não pode ser termo de COMPOSTO nem fonte de
  CLASSIFICACAO. O motor marca `INCOMPLETO` quem o use assim.
- Indicador pareado (ANTES/APÓS): cada cenário padroniza contra a referência do mesmo cenário.

**PERCENTIL_OMS**
- Referência: padrões de crescimento infantil da OMS (2006), IMC-para-idade, 0 a 60 meses,
  por sexo, no formato LMS. O percentil da criança sai do escore-z
  `z = ((IMC ÷ M)^L − 1) ÷ (L × S)` e da normal padrão; compara-se com o percentil P do corte.
- Idade em dias completos na data da entrevista (as tabelas da OMS são por dia). Acima de
  60 meses, sem sexo, sem nascimento ou sem IMC → `null`.
- Sexo pela opção marcada em `sexoPerguntaId`, mapeada por `opcoesSexo` (texto das opções).
- Os cortes P10 e P85 vêm da planilha. A Caderneta usa P3/P15/P85/P97; trocar é só mudar
  `corte` no cadastro.

**ATALAH**
- Referência: curva de Atalah et al. (1997), adotada pelo Ministério da Saúde (SISVAN): para
  cada semana gestacional (6 a 42), os limites de IMC entre baixo peso, adequado, sobrepeso e
  obesidade.
- Semana fora de 6–42, semana em branco ou IMC em branco → `null` (sai da classificação). As
  respostas antigas não têm a pergunta: ficam fora, como decidido na resposta 3-a.
- Agrega como CLASSIFICACAO: % por faixa, com o arredondamento por maior resto já usado.

**Referência e pesquisa (ZSCORE)**
- Respostas aprovadas, não apagadas, da pesquisa do indicador (`pesquisaId`), ignorando os
  filtros do painel. Indicador sem `pesquisaId` → todas as respostas carregadas.

## Tabelas de referência

Ficam em `backend/src/helper/motor/referencias/` como dados (JSON), com um README dizendo a
fonte, a data de obtenção e como regenerar:

- **OMS IMC-para-idade**: tabelas LMS por dia, meninos e meninas, 0–1856 dias, dos arquivos
  oficiais da OMS (Child Growth Standards, "expanded tables").
- **Atalah**: limites por semana gestacional, da publicação do Ministério da Saúde (SISVAN /
  Caderneta da Gestante).
- **Caderneta (CPUER)**: não é tabela de arquivo — são três faixas na config do indicador.

Teste obrigatório: valores pontuais conferidos contra a fonte publicada (ex.: M, L e S de um
dia conhecido; IMC no P3/P50/P97 de uma idade conhecida; limites de Atalah de duas semanas).
Uma tabela que não puder ser obtida da fonte oficial **bloqueia** o tipo correspondente —
não se digita tabela de memória.

## Pergunta nova no questionário da Gestante

"Semana gestacional atual" (número, inteiro de 1 a 42), na seção de antropometria, logo
depois de "Qual é o peso atual da gestante?". A pesquisa Gestante já está publicada, e o
sistema recusa editar pesquisa publicada (409 `PESQUISA_PUBLICADA`). Então:

- a fonte da verdade (`backend/prisma/pesquisas-cartao-cria.ts` e
  `docs/pesquisas-cartao-cria.md`) ganha a pergunta;
- um script idempotente (`backend/scripts/`) acrescenta a pergunta à pesquisa publicada,
  ajusta a ordem das seguintes e registra na auditoria; rodar duas vezes não duplica;
- respostas existentes não mudam: ficam sem esse item e saem da classificação de Atalah.

## Mudança no fluxo de cálculo

Hoje o filtro do painel vai para o `where` do banco. Passa a ser:

```
carregar TODAS as respostas aprovadas (pesquisa não apagada)
        |
avaliar cada indicador por indivíduo, na ordem de dependência   <- o ZSCORE lê a referência aqui
        |
máscara do recorte = resposta casa com os filtros (pesquisa, município, regional, sexo, período)
        |
agregar só onde noEscopo[i] = é da pesquisa do indicador E está no recorte
```

- `calcular` ganha `recorte: boolean[]`, alinhado com `respostas`. O `noEscopo[i]` existente
  passa a ser `daPesquisa[i] && recorte[i]` **na agregação**; na referência continua só
  `daPesquisa[i]`. Os vetores seguem nunca filtrados, só anulados.
- `RespostaAvaliavel` ganha `enviadaEm: Date`; `ItemAvaliavel` ganha `valorData`.
- A máscara é montada fora do motor (helper puro novo, testável sem banco), a partir de
  `municipio`, `regional`, `enviadaEm` e do item de sexo (regra atual: enunciado contém
  "Sexo biológico", opção por texto). O `ate` só com data inclui o dia inteiro.
- `carregarRespostas` deixa de receber filtros. O cache continua por chave de filtro.
- Custo aceito: toda chamada fria carrega a base aprovada inteira (hoje alguns milhares de
  respostas).

## Dados

- Migration: cinco valores novos no enum `TipoIndicador` (`ESCALA`, `META_POR_IDADE`,
  `ZSCORE`, `PERCENTIL_OMS`, `ATALAH`). A config continua JSON validado por Zod, um esquema
  `.strict()` por tipo, números `.finite()`.
- `perguntasReferenciadas` e `indicadoresReferenciados` cobrem os campos novos.

## Erros

- Cadastro: 422 para config inválida, opção sem nota ou sobrando, faixa sobreposta, pergunta
  de tipo errado, `opcoesSexo` com opção inexistente; 409 para ciclo.
- Motor: nunca inventa número. Tabela incompleta ou opção sem nota → `INCOMPLETO` com motivo;
  referência pequena ou desvio zero → `SEM_DADOS`; idade/semana fora da tabela → indivíduo `null`.

## Testes

- **Por tipo**, no formato `f(resposta)`: branco, zero, opção sem nota, idade fora das
  faixas, marcação múltipla na ESCALA, sexo ausente, semana fora de 6–42.
- **Tabelas** contra valores publicados (ver acima).
- **Referência ignora o filtro**: com um município filtrado, o z médio do recorte é diferente
  de zero e igual ao calculado à mão contra a pesquisa inteira.
- **Teste dourado novo**: ~8 respostas sintéticas com CPRE, CPUER, Índice Socioeconômico,
  desnutrição e Atalah calculados à mão.
- **Regressão**: a suíte atual passa sem mudar expectativas. Mover o filtro para a agregação
  não pode mudar nenhum número dos tipos antigos. Os testes do loader que conferiam o `where`
  com filtros passam a conferir a máscara.
- **Integração** contra o banco real: ESCALA e PERCENTIL_OMS com filtro de município; o
  script da pergunta nova rodado duas vezes.

## Ponto a confirmar com o Emerson

A resposta 4-c compara toda criança de 0–11 meses com 7 consultas. Um bebê de 3 meses com
as consultas em dia (1ª semana, 1 e 2 meses = 3 ou 4) vale ~50, e o CPUER do recorte cai
quanto mais bebês novos houver nele. Alternativa simples, sem mudar a tabela: para menores
de 12 meses, o esperado é o número de consultas do calendário já vencidas na idade dele.
A spec segue a resposta dada; a alternativa entra só se ele quiser — é mudar a config, não o tipo.

## Fora do escopo

- Importação da planilha e painel.
- Curvas da OMS acima de 5 anos (o Cartão CRIA atende primeira infância).
- Cache dos vetores individuais.
