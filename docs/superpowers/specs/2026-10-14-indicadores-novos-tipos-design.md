# Indicadores — novos tipos de cálculo

Status: desenho aprovado em conversa (2026-10-14), aguardando revisão desta spec.
Antecede: `2026-09-24-indicadores-design.md` (catálogo, motor, recorte ANTES/APÓS).
Depois desta vêm a importação da planilha (fase 3) e o painel (fase 4), com specs próprias.

## O problema

As respostas do Emerson (`docs/perguntas-indicadores-abertas.md`) pedem contas que o
catálogo de oito tipos não expressa:

| Indicador | Resposta | O que falta no catálogo |
|---|---|---|
| CPRE | 5-a: antes de 12 sem. = 100, após = 50, sem pré-natal = 0, não soube = fora | nota por opção (PROPORCAO só dá 0 ou 100) |
| Escolaridade e moradia no Índice Socioeconômico | "nota pela ordem das opções" | nota por opção |
| CPUER | 4-a: proporcional ao preconizado para a idade, teto 100 | meta que depende da idade |
| Índice Socioeconômico Familiar | 9-b: z-score | padronização contra a amostra |
| Desnutrição (IMC < P10), obesidade (IMC > P85) | 10-b: percentil da própria amostra | corte por percentil da amostra |

Três desses pontos voltaram ao Emerson na 2ª rodada (`docs/perguntas-indicadores-rodada-2.md`).
Esta spec constrói os tipos com a **referência e as tabelas como configuração do
indicador**: a resposta dele muda o cadastro, não o código. As curvas da OMS ficam fora até
ele as escolher — entrariam como mais um valor de `referencia`.

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Referência da padronização | `AMOSTRA_PESQUISA`: todas as respostas aprovadas da pesquisa do indicador, **sem** os filtros do painel | é a resposta 9-b/10-b; filtrar a referência faria a média do recorte ser sempre zero |
| Onde o filtro do painel atua | **depois** do cálculo individual, só na agregação | um único universo de dados para todos os tipos; a referência existe sem segunda consulta |
| Tipos novos ou parâmetros nos antigos | quatro tipos novos | cada um tem f(resposta) própria; encaixar em PROPORCAO/DERIVADA esconderia regra |
| Chave da nota por opção | texto da opção | o front grava texto e motor e filtros já comparam texto |

## Tipos novos

| Tipo | Config | f(indivíduo) | Agregação |
|---|---|---|---|
| `ESCALA` | `perguntaId`, `notas: { [textoDaOpcao]: número 0–100 \| null }` | nota da opção marcada; `null` na tabela = fora do cálculo | média |
| `META_POR_IDADE` | `perguntaId` (número), `nascimentoPerguntaId` (data), `faixas: [{ deMeses, ateMeses, esperado }]` | `min(100, valor ÷ esperado × 100)` pela faixa da idade na data da entrevista | média |
| `ZSCORE` | `componentes: [{ indicadorId, peso }]`, `referencia: "AMOSTRA_PESQUISA"` | média ponderada dos z de cada componente: `(x − média_ref) ÷ desvio_ref` | média |
| `PERCENTIL_CORTE` | `indicadorId`, `corte: { abaixoDe: P } \| { acimaDe: P }`, `referencia: "AMOSTRA_PESQUISA"` | 100 se o valor está além do percentil P da referência, senão 0 | média (= % de indivíduos) |

Exemplos: CPRE = `ESCALA` sobre "Quando iniciou o pré-natal?"; Índice Socioeconômico =
`ZSCORE` sobre três `ESCALA` (renda, escolaridade, moradia), pesos iguais; desnutrição =
`PERCENTIL_CORTE` sobre o IMC (`DERIVADA`), `abaixoDe: 10`.

### Regras por tipo

**ESCALA**
- Só para pergunta de escolha única. Marcação com zero ou mais de uma opção → `null`.
- Cadastro: toda opção da pergunta tem de estar em `notas` (com número ou `null`), e
  nenhuma chave de `notas` pode ser opção inexistente. Recusa com 422 citando as opções
  faltantes ou sobrando. Notas fora de 0–100 ou não finitas → 422.
- Motor: opção marcada que não está em `notas` (a pergunta ganhou opção depois do cadastro)
  → indicador `INCOMPLETO`, motivo "opção X sem nota". Não vira zero.

**META_POR_IDADE**
- Idade em meses completos entre `nascimentoPerguntaId` (`valorData`) e `enviadaEm` da
  resposta. Data ausente, idade negativa ou idade fora de todas as faixas → `null`.
- Valor em branco → `null`; zero consultas → 0 (zero não é branco).
- Cadastro: faixas em ordem, sem sobreposição (mesma regra da CLASSIFICACAO, com `ateMeses`
  exclusivo), `esperado` > 0 e finito; `perguntaId` numérica e `nascimentoPerguntaId` de data
  (conferido contra a pergunta, 422 se o tipo não bate).

**ZSCORE**
- Componentes são indicadores com valor por indivíduo (mesma regra da guarda 5b: CONTAGEM,
  DISTRIBUICAO e CLASSIFICACAO → `INCOMPLETO`). `peso` > 0 e finito.
- Para cada componente, média e desvio-padrão **amostral** sobre a referência. Indivíduo sem
  valor em algum componente → `null` (não se padroniza meia família).
- Desvio zero ou menos de 2 valores na referência → todos `null` → `SEM_DADOS`.
- O resultado não está em 0–100: um ZSCORE não pode ser termo de COMPOSTO nem fonte de
  CLASSIFICACAO de faixas 0–100. O motor marca `INCOMPLETO` o dependente que o use como termo
  de COMPOSTO, com motivo "depende de X, que não está em 0–100".

**PERCENTIL_CORTE**
- Percentil por interpolação linear (método 7, o `PERCENTIL.INC` do Excel) sobre os valores
  não nulos do indicador-fonte na referência.
- `abaixoDe: P` → 100 se `x < P_ref`; `acimaDe: P` → 100 se `x > P_ref`; `P` entre 1 e 99.
- Referência com menos de 2 valores → todos `null` → `SEM_DADOS`.

**Referência e pesquisa**
- `AMOSTRA_PESQUISA` = respostas aprovadas, não apagadas, da pesquisa do indicador
  (`pesquisaId`), ignorando os filtros do painel. Indicador sem `pesquisaId` → todas as
  respostas carregadas.
- Indicador pareado (ANTES/APÓS): cada cenário padroniza contra a referência **do mesmo
  cenário** — o z de "antes" usa a média de "antes".

## Mudança no fluxo de cálculo

Hoje o filtro do painel vai para o `where` do banco. Passa a ser assim:

```
carregar TODAS as respostas aprovadas (pesquisa não apagada)
        |
avaliar cada indicador por indivíduo, na ordem de dependência   <- ZSCORE/PERCENTIL
        |                                                         leem a referência aqui
máscara do recorte = resposta casa com os filtros (pesquisa, município, regional, sexo, período)
        |
agregar só onde noEscopo[i] = é da pesquisa do indicador E está no recorte
```

- `calcular` ganha o parâmetro `recorte: boolean[]` (alinhado com `respostas`). O
  `noEscopo[i]` que já existe passa a ser `daPesquisa[i] && recorte[i]` **na agregação**; na
  referência continua só `daPesquisa[i]`. Os vetores seguem nunca filtrados, só anulados.
- `RespostaAvaliavel` ganha `enviadaEm: Date`; `ItemAvaliavel` ganha `valorData`.
- A máscara é montada fora do motor (helper puro novo, testável sem banco), a partir de
  `municipio`, `regional`, `enviadaEm` e do item de sexo da resposta. O loader carrega esses
  campos; o casamento de sexo segue a regra atual (enunciado contém "Sexo biológico",
  opção por texto).
- `carregarRespostas` deixa de receber filtros. O cache continua por chave de filtro.
- Custo aceito: toda chamada fria carrega a base aprovada inteira (hoje alguns milhares de
  respostas). Se crescer, o passo seguinte é cachear os vetores individuais e reagregar por
  filtro — fora do escopo.

## Dados

- Migration: quatro valores novos no enum `TipoIndicador`. A config continua JSON validado
  por Zod (`indicadorConfig.ts`), um esquema `.strict()` por tipo, números `.finite()`.
- `perguntasReferenciadas` e `indicadoresReferenciados` cobrem os campos novos
  (`nascimentoPerguntaId`, `componentes[].indicadorId`, `indicadorId`).

## Erros

- Cadastro: 422 para config inválida, opção sem nota ou sobrando, faixa sobreposta, tipo de
  pergunta errado; 409 para ciclo (já existente).
- Motor: nunca inventa número. Tabela incompleta → `INCOMPLETO` com motivo; referência
  pequena demais ou desvio zero → `SEM_DADOS`.

## Testes

- **Por tipo**, no formato `f(resposta)`, incluindo branco, zero, opção sem nota, idade
  fora das faixas e marcação múltipla na ESCALA.
- **Referência ignora o filtro**: com um município filtrado, o z médio do recorte é diferente
  de zero e igual ao calculado à mão contra a pesquisa inteira; o P10 é o da pesquisa inteira.
- **Teste dourado novo**: ~8 respostas sintéticas com CPRE, CPUER, Índice Socioeconômico e
  desnutrição calculados no papel.
- **Regressão**: a suíte atual (311) passa sem mudar expectativas — mover o filtro para a
  agregação não pode mudar nenhum número dos tipos antigos. Os testes do loader que asseriam o
  `where` com filtros passam a asserir a máscara.
- **Integração** contra o banco real (padrão do `indicadoresIntegracao.test.ts`): ESCALA e
  PERCENTIL_CORTE com filtro de município.

## Fora do escopo

- Curvas da OMS e tabela de Atalah (aguardam a 2ª rodada).
- Importação da planilha e painel.
- Cache dos vetores individuais.
