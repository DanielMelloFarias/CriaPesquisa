# Painel de indicadores — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página "Painel de indicadores" (`/painel-indicadores`, todos os papéis) que mostra os indicadores ATIVOS do Cartão CRIA em cartões por tipo de resultado, agrupados por Escopo/Perfil e por pesquisa, com filtros de pesquisa, município, regional, sexo e período.

**Architecture:** Backend ganha só `GET /api/regionais` (lista para o filtro). Frontend: um módulo puro que transforma `{indicador, resultado}` num modelo de exibição (`formatarResultado`), componentes de cartão que só desenham esse modelo, e a página que busca os ativos (`GET /indicadores?status=ATIVO&pageSize=200`) e o cálculo (`GET /indicadores/calculo` com os filtros) e agrupa.

**Tech Stack:** Node/Express/TS (ESM) no backend; React 18 + TS + TanStack Query + React Router 7 + styled-components + Chart.js (via `DonutInterativo`) no frontend; Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-16-painel-indicadores-design.md`

## Global Constraints

- ESM: imports relativos terminam em `.js` (também em `.tsx`).
- Só indicadores com `status: "ATIVO"` entram no painel.
- Leitura aberta a todo papel autenticado; o link "revisar" do cartão incompleto só aparece para ADMIN e GESTOR (`podeGerenciarPesquisas` de `App/auth/permissoes.ts` ou equivalente).
- Nenhum número é inventado na tela: `SEM_DADOS` e `INCOMPLETO` nunca viram 0.
- Siga os padrões visuais existentes (`Styles/ui.js`, `ChartCard`, `DonutInterativo`, `FunilValores`, tema claro/escuro via `p.theme.cores`).
- Escreva arquivos com Write/Edit (acentuação quebra heredoc). Comandos não interativos (`npx vitest run`).
- Commits em português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Antes de cada commit: `npx tsc --noEmit -p .` e testes do pacote tocado; suíte inteira e `npm run build` no fim de cada tarefa.

## Review Focus

1. **Indicador pareado em que um lado é `SEM_DADOS`** → mostra os dois lados, sem diferença calculada — teste na Tarefa 1.
2. **Z-score negativo e zero** → sinal explícito ("−0,35", "0,00") e legenda "abaixo/na média do estado" — teste na Tarefa 1.
3. **Indicador ativo sem `apresentacao`** → aparece na aba Escopo (não some) — teste na Tarefa 3.
4. **Erro 409 do cálculo** (`DADO_INCONSISTENTE`, `DEPENDENCIA_CIRCULAR`) → mensagem da API na página, sem tela branca — teste na Tarefa 3.
5. **Filtro de período com só "de" ou só "até"** → manda só o parâmetro preenchido — teste na Tarefa 3.

---

### Task 1: Regionais na API e modelo de exibição dos resultados

**Files:**
- Modify: `backend/src/helper/regionais.ts` (exportar a lista), `backend/src/routes/` (rota nova, no padrão dos outros arquivos de rota; registre no `routes/index.ts`)
- Create: `backend/src/controllers/regionaisController.ts` (ou acrescente a um controller de apoio existente, se houver um padrão para listas)
- Test: `backend/tests/regionais.test.ts`
- Create: `frontend/src/App/lib/resultadoIndicador.ts`
- Test: `frontend/src/App/lib/resultadoIndicador.test.ts`
- Modify: `frontend/src/App/api/indicadores.ts` (hooks do painel)

**Interfaces:**
- Backend: `GET /api/regionais` → `{ regionais: string[] }` (os nomes exatos das chaves de `REGIONAL_MAP`, na ordem 1ª…10ª), só autenticado. Exporte de `regionais.ts`: `export function listarRegionais(): string[]`.
- Frontend (`resultadoIndicador.ts`):

```ts
import type { Indicador } from "../api/indicadores.js";

export type Resultado =
  | { status: "OK"; valor: number }
  | { status: "OK_FAIXAS"; faixas: Array<{ rotulo: string; percentual: number }> }
  | { status: "OK_DISTRIBUICAO"; itens: Array<{ opcao: string; contagem: number; percentual: number }> }
  | { status: "SEM_DADOS" }
  | { status: "INCOMPLETO"; motivo: string; dependencia?: string };
export type ResultadoComRecorte = Resultado | { antes: Resultado; apos: Resultado };

export type Exibicao =
  | { forma: "NUMERO"; texto: string; legenda?: string; meta?: { texto: string; atingida: boolean } }
  | { forma: "FAIXAS"; faixas: Array<{ rotulo: string; percentual: number }> }
  | { forma: "DISTRIBUICAO"; itens: Array<{ opcao: string; percentual: number }>; grafico: "ROSCA" | "BARRAS" }
  | { forma: "SEM_DADOS" }
  | { forma: "INCOMPLETO"; motivo: string };
export type ExibicaoIndicador =
  | { pareado: false; exibicao: Exibicao }
  | { pareado: true; antes: Exibicao; apos: Exibicao; diferenca?: string };

export function formatarResultado(indicador: Pick<Indicador, "tipo" | "casasDecimais" | "meta">, resultado: ResultadoComRecorte | undefined): ExibicaoIndicador;
```

- Frontend (`api/indicadores.ts`): `useIndicadoresAtivos()` → `GET /indicadores?status=ATIVO&pageSize=200` (todos os itens); `useCalculoPainel(filtros: FiltrosPainel)` → `GET /indicadores/calculo` com os filtros, devolve `Record<string /*codigo*/, ResultadoComRecorte>`; `useRegionais()` → `GET /regionais`. `FiltrosPainel = { pesquisaId?: string; municipio?: string; regional?: string; sexo?: string; de?: string; ate?: string }` — só envia chaves preenchidas. Confira se `Indicador` (T5 da importação) já tem `casasDecimais`; se não, acrescente ao tipo (o backend devolve).

Regras de `formatarResultado` (números no formato pt-BR, vírgula decimal, `toLocaleString("pt-BR", { minimumFractionDigits: n, maximumFractionDigits: n })`):
- `undefined` (o cálculo não trouxe o código) → `INCOMPLETO` "sem resultado do cálculo".
- `OK` por tipo:
  - PROPORCAO, CRUZAMENTO, PERCENTIL_OMS → `"62,5%"` (casas do indicador);
  - COMPOSTO, ESCALA, META_POR_IDADE → `"71,4"` com legenda `"índice de 0 a 100"`;
  - MEDIA, DERIVADA → número com as casas do indicador;
  - CONTAGEM → inteiro com separador de milhar (`"1.234"`);
  - ZSCORE → sinal explícito (`"+0,42"`, `"−0,35"` com o sinal de menos tipográfico U+2212, `"0,00"`) com 2 casas e legenda `"acima da média do estado"` / `"abaixo da média do estado"` / `"na média do estado"`;
  - `meta` presente → `meta: { texto: "meta " + mesmo formato, atingida: valor >= meta }` (para ZSCORE e CONTAGEM também `>=`).
- `OK_FAIXAS` → `FAIXAS` com as faixas como vieram.
- `OK_DISTRIBUICAO` → `DISTRIBUICAO`, `grafico: itens.length <= 6 ? "ROSCA" : "BARRAS"`.
- `SEM_DADOS` → `SEM_DADOS`; `INCOMPLETO` → `INCOMPLETO` com o motivo.
- Pareado `{antes, apos}` → `pareado: true`; `diferenca` só quando os dois lados são `OK`: `apos − antes` formatado como o tipo, com sinal explícito e sufixo `" p.p."` para os tipos em %, sem sufixo para os demais (ex.: `"+12,5 p.p."`, `"−3,1"`).

- [ ] **Step 1: Failing tests** — `backend/tests/regionais.test.ts` (padrão de `tokenDe`/`moduloSessaoFalso` de `tests/helpers/sessao.ts`): autenticado → 200 com 10 nomes, o primeiro `"1ª Regional – Maceió"`; sem token → 401. `frontend/src/App/lib/resultadoIndicador.test.ts`: um caso por regra acima, incluindo os do Review Focus 1 e 2:

```ts
import { describe, it, expect } from "vitest";
import { formatarResultado } from "./resultadoIndicador.js";

const ind = (tipo: string, casasDecimais = 1, meta: number | null = null) => ({ tipo, casasDecimais, meta }) as never;

describe("formatarResultado", () => {
  it("proporção em %", () =>
    expect(formatarResultado(ind("PROPORCAO"), { status: "OK", valor: 62.5 })).toEqual({ pareado: false, exibicao: { forma: "NUMERO", texto: "62,5%" } }));
  it("índice 0–100", () =>
    expect(formatarResultado(ind("COMPOSTO"), { status: "OK", valor: 71.43 })).toEqual({
      pareado: false, exibicao: { forma: "NUMERO", texto: "71,4", legenda: "índice de 0 a 100" } }));
  it("contagem com milhar", () =>
    expect(formatarResultado(ind("CONTAGEM", 0), { status: "OK", valor: 1234 })).toEqual({ pareado: false, exibicao: { forma: "NUMERO", texto: "1.234" } }));
  it("z-score com sinal e legenda", () => {
    expect(formatarResultado(ind("ZSCORE", 2), { status: "OK", valor: -0.35 })).toEqual({
      pareado: false, exibicao: { forma: "NUMERO", texto: "−0,35", legenda: "abaixo da média do estado" } });
    expect(formatarResultado(ind("ZSCORE", 2), { status: "OK", valor: 0.42 })).toMatchObject({ exibicao: { texto: "+0,42", legenda: "acima da média do estado" } });
    expect(formatarResultado(ind("ZSCORE", 2), { status: "OK", valor: 0 })).toMatchObject({ exibicao: { texto: "0,00", legenda: "na média do estado" } });
  });
  it("meta atingida ou não", () =>
    expect(formatarResultado(ind("PROPORCAO", 1, 70), { status: "OK", valor: 62.5 })).toMatchObject({
      exibicao: { meta: { texto: "meta 70,0%", atingida: false } } }));
  it("distribuição escolhe rosca até 6 opções", () => {
    const itens = (n: number) => Array.from({ length: n }, (_, i) => ({ opcao: `o${i}`, contagem: 1, percentual: 100 / n }));
    expect(formatarResultado(ind("DISTRIBUICAO"), { status: "OK_DISTRIBUICAO", itens: itens(6) })).toMatchObject({ exibicao: { grafico: "ROSCA" } });
    expect(formatarResultado(ind("DISTRIBUICAO"), { status: "OK_DISTRIBUICAO", itens: itens(7) })).toMatchObject({ exibicao: { grafico: "BARRAS" } });
  });
  it("pareado com diferença em p.p.", () =>
    expect(formatarResultado(ind("PROPORCAO"), { antes: { status: "OK", valor: 40 }, apos: { status: "OK", valor: 52.5 } })).toMatchObject({
      pareado: true, diferenca: "+12,5 p.p." }));
  it("pareado com um lado sem dados não calcula diferença", () => {
    const r = formatarResultado(ind("PROPORCAO"), { antes: { status: "SEM_DADOS" }, apos: { status: "OK", valor: 52.5 } });
    expect(r).toMatchObject({ pareado: true, antes: { forma: "SEM_DADOS" } });
    expect((r as { diferenca?: string }).diferenca).toBeUndefined();
  });
  it("sem dados, incompleto e ausente nunca viram número", () => {
    expect(formatarResultado(ind("PROPORCAO"), { status: "SEM_DADOS" })).toEqual({ pareado: false, exibicao: { forma: "SEM_DADOS" } });
    expect(formatarResultado(ind("PROPORCAO"), { status: "INCOMPLETO", motivo: "definição pendente" })).toEqual({
      pareado: false, exibicao: { forma: "INCOMPLETO", motivo: "definição pendente" } });
    expect(formatarResultado(ind("PROPORCAO"), undefined)).toEqual({ pareado: false, exibicao: { forma: "INCOMPLETO", motivo: "sem resultado do cálculo" } });
  });
});
```

Se o `toLocaleString("pt-BR")` do Node do ambiente não tiver ICU completo (separadores errados), use um formatador próprio pequeno (milhar com ".", decimal com ",") e diga no relatório.

- [ ] **Step 2–4:** rodar (vermelho), implementar, rodar: `cd backend && npx tsc --noEmit -p . && npx vitest run tests/regionais.test.ts`; `cd frontend && npx tsc --noEmit -p . && npx vitest run src/App/lib/resultadoIndicador.test.ts`.
- [ ] **Step 5: Commit** — `feat: regionais na API e formatacao dos resultados para o painel`.

---

### Task 2: Cartões do painel

**Files:**
- Create: `frontend/src/Components/indicadores/CartaoIndicador.tsx` (+ subcomponentes no mesmo diretório se passar de ~250 linhas: `BarraFaixas.tsx`, `ValorNumero.tsx`)
- Test: `frontend/src/Components/indicadores/CartaoIndicador.test.tsx`

**Interfaces:**
- Consumes: `formatarResultado`, `ExibicaoIndicador`, `Exibicao` (T1); `DonutInterativo`, `FunilValores`, `Card`/`SectionTitle` de `Styles/ui.js`.
- Produces: `export function CartaoIndicador(props: { indicador: Indicador; resultado: ResultadoComRecorte | undefined; podeRevisar: boolean }): JSX.Element`.

Desenho (siga o estilo dos cartões do Dashboard/ResultadosPesquisa):
- Cabeçalho: nome do indicador, código em texto pequeno, ícone de informação (`Info` do lucide-react) com `title`/tooltip = `indicador.objetivo` quando houver.
- `NUMERO`: o texto grande; a legenda embaixo; meta como selo ("meta 70,0% — atingida"/"não atingida").
- `FAIXAS`: barra horizontal empilhada (divs com `width: X%`, cores do tema em sequência, `aria-label` com "rótulo X%") + legenda com rótulo e percentual formatado (pt-BR, 1 casa).
- `DISTRIBUICAO`: `ROSCA` → `DonutInterativo` com labels/data dos itens e unidade "%"; `BARRAS` → `FunilValores` com `valores` mapeados (`{ rotulo: opcao, valor: percentual }` — leia o tipo `ValorGrafico` em `FunilValores.tsx` e adapte os nomes).
- `SEM_DADOS`: texto apagado "Sem respostas aprovadas neste recorte".
- `INCOMPLETO`: cartão apagado, "Não calculável — {motivo}"; se `podeRevisar`, link (`Link` do react-router) "Revisar indicador" para `/indicadores/{id}`.
- Pareado: duas colunas "Antes do Cartão CRIA" / "Após o Cartão CRIA", cada uma desenhando sua `Exibicao`; a `diferenca` (quando houver) num selo entre elas.

- [ ] **Step 1: Failing tests** — `CartaoIndicador.test.tsx` (providers de tema/router como nos testes existentes, ex. `Indicadores.test.tsx`): um teste por forma — número com legenda e meta; faixas mostram cada rótulo e "%"; distribuição com 3 itens renderiza a rosca (procure o título/legendas que o `DonutInterativo` desenha, ou mocke-o se o canvas atrapalhar — o setup já usa `vitest-canvas-mock`); sem dados mostra o texto; incompleto mostra o motivo e o link só com `podeRevisar`; pareado mostra "Antes", "Após" e a diferença.
- [ ] **Step 2–4:** rodar (vermelho), implementar, rodar `npx vitest run src/Components/indicadores && npx tsc --noEmit -p .`.
- [ ] **Step 5: Commit** — `feat(frontend): cartoes do painel de indicadores`.

---

### Task 3: Página do painel, rota e menu

**Files:**
- Create: `frontend/src/App/pages/PainelIndicadores.tsx`
- Test: `frontend/src/App/pages/PainelIndicadores.test.tsx`
- Modify: `frontend/src/App/router.tsx` (rota `/painel-indicadores` no bloco de rotas autenticadas para todos os papéis, `lazy`), `frontend/src/Components/layout/Sidebar.tsx` (item "Painel de indicadores" no grupo Principal, ícone `BarChart3`, sem restrição de papel), `frontend/src/Components/layout/Topbar.tsx` (título)

**Interfaces:**
- Consumes: `useIndicadoresAtivos`, `useCalculoPainel`, `useRegionais` (T1); `usePesquisas` (existente); `MUNICIPIOS` de `App/data/cria.ts` (nomes); `CartaoIndicador` (T2); `useAuth` + permissão de ADMIN/GESTOR.

Página:
- Título "Painel de indicadores" e subtítulo "Cartão CRIA — indicadores ativos".
- Filtros numa barra: Pesquisa (Todas / cada pesquisa), Município (Todos / lista), Regional (Todas / `useRegionais`), Sexo (Todos / Masculino / Feminino), De e Até (`input type="date"`). Botão "Limpar filtros". Cada mudança refaz só o cálculo (a lista de ativos não depende de filtro).
- Abas "Escopo" e "Perfil": indicador entra na aba de cada valor de `apresentacao`; **sem `apresentacao` → Escopo** (Review Focus 3). Dentro da aba, seções por pesquisa na ordem: "Criança", "Gestante", "Ambas as pesquisas" (`pesquisaId` nulo) — o nome da seção vem do título da pesquisa (`usePesquisas`), seção vazia não aparece. Cartões em grade responsiva (2–3 colunas no desktop, 1 no celular), ordenados por `codigo`.
- Resultado do cartão = `calculo[indicador.codigo]`.
- Estados: carregando (esqueleto ou "Carregando…"); nenhum ativo → mensagem da spec, com link para `/indicadores` só para ADMIN/GESTOR; erro do cálculo → mostra `error.response.data.error.message` (ou a mensagem genérica) num aviso, mantendo filtros e abas na tela (Review Focus 4).

- [ ] **Step 1: Failing tests** — `PainelIndicadores.test.tsx` (mock de `api.get` por URL, no padrão de `Indicadores.test.tsx`):
  1. dois ativos (um com `apresentacao: ["Escopo","Perfil"]`, outro sem apresentação) → os dois aparecem na aba Escopo; trocar para Perfil mostra só o primeiro;
  2. mudar o município chama `/indicadores/calculo` com `params.municipio`; preencher só "De" manda `de` e não manda `ate` (Review Focus 5);
  3. cálculo rejeitando com 409 `{ error: { code: "DEPENDENCIA_CIRCULAR", message: "dependência circular entre indicadores: a → b → a" } }` → a mensagem aparece e as abas continuam na tela;
  4. lista de ativos vazia → mensagem "Nenhum indicador ativo ainda".
- [ ] **Step 2–4:** rodar (vermelho), implementar, rodar `npx vitest run src/App/pages/PainelIndicadores.test.tsx && npx tsc --noEmit -p .`, depois a suíte inteira do frontend e `npm run build`.
- [ ] **Step 5: Commit** — `feat(frontend): painel de indicadores com filtros e abas`.

---

## Ao fim deste plano

Qualquer usuário autenticado abre "Painel de indicadores" e vê os indicadores ativos do Cartão CRIA, por Escopo/Perfil e por pesquisa, filtrando por município, regional, sexo e período, cada um no formato do seu tipo, com antes/depois lado a lado e sem nenhum número inventado para o que não tem dado ou definição.
