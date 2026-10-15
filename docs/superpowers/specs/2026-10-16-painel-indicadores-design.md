# Painel de indicadores

Status: rascunho para revisão da Maryana (2026-10-16). Última fase do projeto de indicadores.
Antecedem: `2026-09-24-indicadores-design.md` (seção "Painel"), `2026-10-14-indicadores-novos-tipos-design.md`,
`2026-10-15-importacao-indicadores-design.md`.

## O problema

O sistema já calcula todos os indicadores do Cartão CRIA (`GET /api/indicadores/calculo`) e já tem
a tela de revisão para ativá-los. Falta a tela que mostra os números para quem acompanha o
programa: hoje o resultado só aparece pela API ou indicador a indicador na tela de revisão.

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde | página nova **"Painel de indicadores"** (`/painel-indicadores`), no menu Principal | é leitura, para todos os papéis; a tela "Indicadores" (Administração) continua sendo a de cadastro |
| Quem vê | todo usuário autenticado | a API de cálculo já é aberta a todos os papéis |
| O que entra | só indicadores **ATIVO** | rascunho não tem número; incompleto ativo aparece com o motivo |
| Agrupamento | abas **Escopo** e **Perfil** (coluna "Apresentação"); dentro de cada aba, uma seção por pesquisa (Criança, Gestante, e "Ambas" para indicador sem pesquisa) | é o agrupamento que a planilha usa; indicador com as duas apresentações aparece nas duas abas |
| Filtros | pesquisa, município, regional, sexo, período (de/até) | os mesmos que o cálculo já aceita; mudam todos os cartões de uma vez |
| Backend | **nenhuma mudança**, salvo se faltar uma lista de regionais para o filtro | o cálculo e a listagem já existem |

## Cartão de cada indicador, pelo resultado

| Resultado | Como aparece |
|---|---|
| `OK` | número grande. Unidade pelo tipo: **%** para PROPORCAO, CRUZAMENTO e PERCENTIL_OMS; **índice 0–100** para COMPOSTO, ESCALA e META_POR_IDADE; número com as casas decimais do indicador para MEDIA e DERIVADA; inteiro para CONTAGEM; **z-score com sinal** para ZSCORE, com a legenda "acima/abaixo da média do estado". Se o indicador tem `meta`, mostra "meta X" e se foi atingida |
| `OK_FAIXAS` (CLASSIFICACAO, ATALAH) | barra horizontal empilhada com o % de cada faixa e legenda |
| `OK_DISTRIBUICAO` | rosca (`DonutInterativo`) até 6 opções; acima disso, barras (`FunilValores`) |
| Pareado `{ antes, apos }` | os dois lado a lado ("Antes do Cartão CRIA" / "Após"), com a diferença em pontos quando os dois são `OK` |
| `SEM_DADOS` | "Sem respostas aprovadas neste recorte" |
| `INCOMPLETO` | cartão apagado: "Não calculável — <motivo>"; para ADMIN e GESTOR, link para a revisão do indicador |

Cada cartão mostra o nome, o código e, ao passar o mouse ou tocar num ícone, o objetivo do indicador.

## Estados da página

- Carregando: esqueleto dos cartões.
- Nenhum indicador ativo: "Nenhum indicador ativo ainda. Os indicadores são ativados em Indicadores (Administração)." (com link para ADMIN/GESTOR).
- Erro do cálculo (ex.: 409 `DADO_INCONSISTENTE` ou `DEPENDENCIA_CIRCULAR`): a mensagem da API, sem quebrar a página.

## Testes

- Cada tipo de resultado renderiza como na tabela (OK em %, índice, média, contagem, z-score com sinal; faixas; distribuição; pareado com diferença; sem dados; incompleto com e sem link conforme o papel).
- Filtros: mudar município/regional/sexo/período chama o cálculo com os parâmetros certos.
- Abas: indicador com Escopo e Perfil aparece nas duas; indicador sem apresentação aparece em Escopo.
- Página vazia e erro da API.

## Fora do escopo

- Exportar o painel (PDF/planilha), comparação entre municípios lado a lado, série histórica.
- Metas: o campo existe, mas nenhum indicador tem meta ainda.
