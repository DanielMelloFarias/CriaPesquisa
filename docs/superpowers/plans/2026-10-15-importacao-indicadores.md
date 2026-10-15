# Importação dos indicadores da planilha e tela de revisão — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar uma vez as 110 linhas do Cartão CRIA da planilha `Exportação Indicadores.xlsx` como indicadores `DEFINICAO_INCOMPLETA` (com definição pronta quando já decidida com o Emerson, ou sugestão de pergunta e tipo), e dar ao ADMIN/GESTOR uma tela para conferir, ajustar e ativar cada indicador.

**Architecture:** Backend: migration com os campos da planilha; um módulo puro de casamento de texto e sugestão de tipo; um mapa declarativo das definições decididas, que referencia perguntas **pelo enunciado** (os ids mudam de um banco para outro) e é resolvido na importação; e um script idempotente que lê o xlsx e grava via `indicadorModel.criar`. Frontend: hooks de API, página de lista e página de revisão, no padrão das páginas de Usuários.

**Tech Stack:** Node, Express, TypeScript ESM, Prisma, PostgreSQL, Zod, ExcelJS, Vitest, Supertest; React 18, TanStack Query, React Router 7, styled-components, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-15-importacao-indicadores-design.md`

## Global Constraints

- ESM: todo import relativo termina em `.js`, inclusive para `.ts`/`.tsx`.
- Erros de domínio via `HttpError(status, code, message, details?)`. Toda escrita de indicador passa por `registrarLog` (`entidade: "Indicador"`).
- **Nada entra como ATIVO pela importação.** Tudo nasce `DEFINICAO_INCOMPLETA` com `motivoIncompleto` dizendo o que falta conferir.
- **Dados pessoais:** as colunas `Usuario` e `DtRegistro` **não são lidas**. A planilha **não entra no repositório** (o repositório é público). Testes usam xlsx gerado no próprio teste, sem dado pessoal.
- Escopo: só linhas com `Projeto` = "Cartão CRIA (Criança)" ou "Cartão CRIA (Gestante)".
- Perguntas são referenciadas **por título da pesquisa + enunciado exato**, nunca por id fixo.
- Cadastro, edição e a tela de revisão: só ADMIN e GESTOR.
- Escreva arquivos com Write/Edit, não com heredoc (acentuação quebra o shell). Comandos não interativos (`npx vitest run`).
- Banco de desenvolvimento na porta 5433. Não suba nem derrube o banco; ECONNREFUSED/ECONNRESET → BLOCKED.
- Commits em português, no estilo do repositório, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Antes de cada commit: `npx tsc --noEmit -p .` no pacote tocado e os testes tocados; suíte inteira no fim de cada tarefa.

## Review Focus

1. **Rodar a importação duas vezes** (o dev pode repetir no deploy) não pode duplicar nem sobrescrever o que alguém já revisou — teste na Tarefa 4.
2. **Pergunta citada no mapa que não existe no banco da VM** (enunciado mudou) → aquele indicador entra `DEFINICAO_INCOMPLETA` com "pergunta não encontrada: <enunciado>", e a importação continua — teste na Tarefa 3.
3. **Ativar um indicador com config incompleta** (ex.: PROPORCAO sem opções) → a tela mostra o erro da API no campo, e o indicador continua para revisão — teste na Tarefa 6.
4. **Linhas de classificação em 4 linhas da planilha** (IDTC Crítico/Baixo/Moderado/Alto) viram **um** indicador com as 4 faixas e os 4 ids — teste na Tarefa 4.
5. **Planilha com coluna renomeada ou faltando** → o script para antes de gravar qualquer coisa — teste na Tarefa 4.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `backend/prisma/schema.prisma` + migration | `idsPlanilha String[]`, `dadosPlanilha Json?`, `apresentacao String[]`, `categoria String?`; remove `origemPlanilha` |
| `backend/src/helper/validators.ts` (mod) | aceitar `apresentacao`, `categoria` no cadastro/edição |
| `backend/src/models/indicadorModel.ts` (mod) | filtros `apresentacao`/`pesquisaId`/`q`, contadores por status |
| `backend/src/controllers/indicadorController.ts` (mod) | `listar` com filtros e contadores |
| `backend/src/helper/importacao/casamento.ts` (novo) | normalização, semelhança, sugestão de pergunta e de tipo (puro) |
| `backend/src/helper/importacao/definicoes-cartao-cria.ts` (novo) | mapa declarativo das definições decididas |
| `backend/src/helper/importacao/resolver.ts` (novo) | troca enunciados por ids e códigos por ids (puro, recebe as perguntas) |
| `backend/src/helper/importacao/planilha.ts` (novo) | lê o xlsx (ExcelJS), confere cabeçalho, devolve linhas do Cartão CRIA sem colunas pessoais |
| `backend/scripts/importar-indicadores.ts` (novo) | orquestra: lê, resolve, grava, imprime resumo |
| `frontend/src/App/api/indicadores.ts` (novo) | hooks de lista, detalhe, salvar, ativar, cálculo |
| `frontend/src/App/pages/Indicadores.tsx` (novo) | lista com filtros e contadores |
| `frontend/src/App/pages/RevisaoIndicador.tsx` (novo) | revisão em duas colunas, formulários por tipo, ativar |
| `frontend/src/App/router.tsx`, `Components/layout/Sidebar.tsx`, `Topbar.tsx` (mod) | rotas e menu |
| `README.md` (mod) | passo de deploy da importação |

---

### Task 1: Modelo e API de listagem

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `Indicador`)
- Create: migration `<timestamp>_indicador_campos_planilha`
- Modify: `backend/src/helper/validators.ts`, `backend/src/models/indicadorModel.ts`, `backend/src/controllers/indicadorController.ts`
- Test: `backend/tests/indicadores.test.ts`, `backend/tests/indicadorModel.test.ts`

**Interfaces:**
- Produces (Prisma `Indicador`): `idsPlanilha String[] @default([])`, `dadosPlanilha Json?`, `apresentacao String[] @default([])`, `categoria String?`. `origemPlanilha` deixa de existir (nenhum registro usa; conferido em 2026-10-15).
- Produces (`indicadorModel.criar` aceita): `idsPlanilha?: string[]`, `dadosPlanilha?: Record<string, string>`, `apresentacao?: string[]`, `categoria?: string`, `codigo` etc. como hoje.
- Produces (`indicadorModel.listar(filtros)`): filtros `{ status?, pesquisaId?, apresentacao?: string, q?, page?, pageSize? }`; e `indicadorModel.contarPorStatus(): Promise<Record<"ATIVO" | "DEFINICAO_INCOMPLETA" | "INATIVO", number>>`.
- Produces (`GET /api/indicadores`): `{ total, page, pageSize, itens, contadores }`, aceitando `?status=&pesquisaId=&apresentacao=&q=`.
- Produces (`indicadorModel.idsPlanilhaExistentes(): Promise<Set<string>>` e `codigosExistentes(): Promise<Set<string>>`), não apagados — para a idempotência da Tarefa 4.

Os dados vindos da planilha **não** são editáveis pela API (vêm só da importação): `idsPlanilha` e `dadosPlanilha` ficam fora dos schemas de cadastro/edição. `apresentacao` (lista de "Escopo"/"Perfil") e `categoria` entram nos dois schemas.

- [ ] **Step 1: Failing tests** — em `backend/tests/indicadores.test.ts` (mesmo padrão de mocks e `tokenDe` do arquivo):

```ts
describe("listagem com filtros e contadores", () => {
  it("repassa status, pesquisaId, apresentacao e q ao model e devolve contadores", async () => {
    vi.mocked(indicadorModel.listar).mockResolvedValue({ total: 0, itens: [] } as never);
    vi.mocked(indicadorModel.contarPorStatus).mockResolvedValue({ ATIVO: 2, DEFINICAO_INCOMPLETA: 5, INATIVO: 1 });
    const res = await request(app)
      .get("/api/indicadores?status=DEFINICAO_INCOMPLETA&pesquisaId=p1&apresentacao=Escopo&q=vac")
      .set("Authorization", authGestor);
    expect(res.status).toBe(200);
    expect(vi.mocked(indicadorModel.listar).mock.calls[0]![0]).toMatchObject({
      status: "DEFINICAO_INCOMPLETA", pesquisaId: "p1", apresentacao: "Escopo", q: "vac",
    });
    expect(res.body.contadores).toEqual({ ATIVO: 2, DEFINICAO_INCOMPLETA: 5, INATIVO: 1 });
  });

  it("apresentacao fora de Escopo/Perfil = 422", async () => {
    const res = await request(app).get("/api/indicadores?apresentacao=Outra").set("Authorization", authGestor);
    expect(res.status).toBe(422);
  });

  it("cadastro aceita apresentacao e categoria, mas não idsPlanilha/dadosPlanilha", async () => {
    // use o mesmo corpo de POST válido que o arquivo já usa (tipo MEDIA ou PROPORCAO), acrescentando:
    // apresentacao: ["Escopo", "Perfil"], categoria: "Renda", idsPlanilha: ["x"]
    // espere 201 e que indicadorModel.criar receba apresentacao/categoria e NÃO receba idsPlanilha.
  });
});
```

Escreva o terceiro teste por completo a partir do corpo válido que o arquivo já usa (leia o `beforeEach` e os POST existentes). Ajuste os nomes `authGestor`/`app` aos que o arquivo usa.

Em `backend/tests/indicadorModel.test.ts` (padrão do arquivo, prisma mockado), um teste de que `listar({ apresentacao: "Escopo" })` monta `where.apresentacao = { has: "Escopo" }` e um de que `contarPorStatus` agrupa (`groupBy` por `status`, `deletedAt: null`) e preenche zero nos status ausentes.

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && npx vitest run tests/indicadores.test.ts tests/indicadorModel.test.ts`
Expected: FAIL.

- [ ] **Step 3: Migration** — em `schema.prisma`, no model `Indicador`, troque `origemPlanilha Int?` por:

```prisma
  // Origem na planilha "Exportação Indicadores" (importação única). Lista porque
  // linhas de classificação da mesma faixa viram um indicador só.
  idsPlanilha   String[] @default([])
  // Texto da planilha mostrado na tela de revisão (sem colunas pessoais).
  dadosPlanilha Json?
  // Agrupamento do painel: "Escopo" e/ou "Perfil".
  apresentacao  String[] @default([])
  // Coluna "Tipo de Indicador" da planilha: categoria temática, não tipo de cálculo.
  categoria     String?
```

Run: `cd backend && npx prisma migrate dev --name indicador_campos_planilha` (se pedir reset ou acusar drift: **pare, BLOCKED**).

- [ ] **Step 4: Validators** — em `indicadorBaseSchema` (`validators.ts`), troque `origemPlanilha: z.number().int().optional(),` por:

```ts
  apresentacao: z.array(z.enum(["Escopo", "Perfil"])).max(2).optional(),
  categoria: z.string().max(100).optional(),
```

e confira que o schema de edição (`atualizarIndicadorSchema`, derivado) herda os dois. Em `indicadorModel.criar`/`atualizar`, troque a gravação de `origemPlanilha` por `apresentacao`, `categoria` e, só em `criar`, `idsPlanilha`/`dadosPlanilha` (vindos de um terceiro argumento opcional `origem?: { idsPlanilha: string[]; dadosPlanilha: Record<string, string> }` que só o importador passa).

- [ ] **Step 5: Model e controller**

`indicadorModel.listar`: acrescente `apresentacao` ao tipo de filtros e `if (apresentacao) where.apresentacao = { has: apresentacao };`.

```ts
  async contarPorStatus(): Promise<Record<"ATIVO" | "DEFINICAO_INCOMPLETA" | "INATIVO", number>> {
    const grupos = await prisma.indicador.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } });
    const base = { ATIVO: 0, DEFINICAO_INCOMPLETA: 0, INATIVO: 0 };
    for (const g of grupos) base[g.status] = g._count._all;
    return base;
  },

  async idsPlanilhaExistentes(): Promise<Set<string>> {
    const linhas = await prisma.indicador.findMany({ where: { deletedAt: null }, select: { idsPlanilha: true } });
    return new Set(linhas.flatMap((l) => l.idsPlanilha));
  },

  async codigosExistentes(): Promise<Set<string>> {
    // Código é único também entre apagados (constraint do banco): considera todos.
    const linhas = await prisma.indicador.findMany({ select: { codigo: true } });
    return new Set(linhas.map((l) => l.codigo));
  },
```

`indicadorController.listar`:

```ts
const filtrosListagem = z.object({
  status: statusSchema.optional(),
  pesquisaId: z.string().uuid().optional(),
  apresentacao: z.enum(["Escopo", "Perfil"]).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export async function listar(req: Request, res: Response) {
  const filtros = filtrosListagem.parse({
    status: req.query.status, pesquisaId: req.query.pesquisaId, apresentacao: req.query.apresentacao, q: req.query.q,
  });
  const { page, pageSize } = parsePaginacao(req.query, 50);
  const [{ total, itens }, contadores] = await Promise.all([
    indicadorModel.listar({ ...filtros, page, pageSize }),
    indicadorModel.contarPorStatus(),
  ]);
  res.json({ total, page, pageSize, itens, contadores });
}
```

(`statusSchema` já existe no arquivo; ajuste se o nome for outro. `ZodError` vira 422 no errorHandler.)

- [ ] **Step 6: Run** — `cd backend && npx tsc --noEmit -p . && npx vitest run`. Expected: PASS.

- [ ] **Step 7: Commit** — `feat: indicador ganha campos da planilha e listagem com filtros e contadores`.

---

### Task 2: Casamento de texto e sugestão de tipo

**Files:**
- Create: `backend/src/helper/importacao/casamento.ts`
- Test: `backend/tests/importacaoCasamento.test.ts`

**Interfaces:**
- Produces:

```ts
export type PerguntaCandidata = { id: string; enunciado: string; tipo: "TEXTO" | "NUMERO" | "DATA" | "MULTIPLA_ESCOLHA" | "ESCOLHA_UNICA" | "CAMPO_ABERTO" };
export function normalizar(texto: string): string;
export function semelhanca(a: string, b: string): number; // 0..1
export type Sugestao =
  | { situacao: "UNICA"; perguntaId: string }
  | { situacao: "PAR"; antesId: string; aposId: string }
  | { situacao: "AMBIGUA"; candidatas: string[] }
  | { situacao: "NENHUMA" }
  | { situacao: "SEM_DESCRICAO" };
export function sugerirPergunta(descricao: string | null | undefined, perguntas: PerguntaCandidata[]): Sugestao;
export type TipoSugerido = "DISTRIBUICAO" | "PROPORCAO" | "MEDIA" | "CONTAGEM" | null;
export function sugerirTipo(formula: string, tipoPergunta: PerguntaCandidata["tipo"] | null): TipoSugerido;
```

Regras (spec):
- `normalizar`: minúsculas; sem acento (NFD + remover marcas); remove o número inicial ("4. ", "23 - "); remove o sufixo "— ANTES do Cartão CRIA" / "— APÓS o Cartão CRIA" (e as variantes "antes do"/"apos o"/"após do", com ou sem travessão); troca pontuação por espaço; colapsa espaços.
- `semelhanca`: Jaccard das palavras com 3+ letras dos dois textos normalizados.
- `sugerirPergunta`: descrição vazia → `SEM_DESCRICAO`. Ordena candidatas por semelhança. A melhor < 0,5 → `NENHUMA`. Junta as que estão a menos de 0,05 da melhor. Uma só → `UNICA`. Duas, com o mesmo `normalizar(enunciado)` e uma com "ANTES" e outra com "APÓS" no enunciado original → `PAR`. Senão → `AMBIGUA`.
- `sugerirTipo`: fórmula normalizada; sem pergunta e "total de" → `CONTAGEM`; pergunta NUMERO e ("media" ou "medio") → `MEDIA`; pergunta de escolha e ("por " seguido de palavra, ou "distribuicao") → `DISTRIBUICAO`; pergunta de escolha e ("/ total", "/total", "x 100", "× 100") → `PROPORCAO`; senão `null`.

- [ ] **Step 1: Failing tests** — `backend/tests/importacaoCasamento.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizar, semelhanca, sugerirPergunta, sugerirTipo, type PerguntaCandidata } from "../src/helper/importacao/casamento.js";

const P: PerguntaCandidata[] = [
  { id: "zona", enunciado: "Zona", tipo: "ESCOLHA_UNICA" },
  { id: "mun", enunciado: "Município", tipo: "ESCOLHA_UNICA" },
  { id: "crasA", enunciado: "A criança e a família participam de atividades propostas pelo CRAS? — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA" },
  { id: "crasD", enunciado: "A criança e a família participam de atividades propostas pelo CRAS? — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA" },
  { id: "ali1", enunciado: "Nos últimos três meses, os alimentos acabaram antes que você tivesse dinheiro para comprar mais comida?", tipo: "ESCOLHA_UNICA" },
  { id: "ali2", enunciado: "Nos últimos três meses, você comeu apenas alguns alimentos que ainda tinha porque o dinheiro acabou?", tipo: "ESCOLHA_UNICA" },
  { id: "renda", enunciado: "Renda mensal total da família (R$)", tipo: "NUMERO" },
];

describe("normalizar", () => {
  it("tira acento, número inicial, sufixo ANTES/APÓS e pontuação", () => {
    expect(normalizar("4. Zona:")).toBe("zona");
    expect(normalizar("A criança participa? — APÓS o Cartão CRIA")).toBe("a crianca participa");
    expect(normalizar("23 - Município")).toBe("municipio");
  });
});

describe("semelhanca", () => {
  it("1 para textos iguais após normalizar, 0 sem palavra comum", () => {
    expect(semelhanca("Município:", "município")).toBe(1);
    expect(semelhanca("Zona", "Renda")).toBe(0);
  });
});

describe("sugerirPergunta", () => {
  it("única", () => expect(sugerirPergunta("4. Zona", P)).toEqual({ situacao: "UNICA", perguntaId: "zona" }));
  it("par ANTES/APÓS", () =>
    expect(sugerirPergunta("A criança e a família participam de atividades propostas pelo CRAS?", P))
      .toEqual({ situacao: "PAR", antesId: "crasA", aposId: "crasD" }));
  it("ambígua quando cita duas perguntas parecidas", () =>
    expect(sugerirPergunta("Nos últimos três meses os alimentos acabaram / comeu apenas alguns alimentos", P).situacao).toBe("AMBIGUA"));
  it("nenhuma abaixo de 0,5", () => expect(sugerirPergunta("Benefícios federais recebidos", P)).toEqual({ situacao: "NENHUMA" }));
  it("sem descrição", () => {
    expect(sugerirPergunta("", P)).toEqual({ situacao: "SEM_DESCRICAO" });
    expect(sugerirPergunta(null, P)).toEqual({ situacao: "SEM_DESCRICAO" });
  });
});

describe("sugerirTipo", () => {
  it("proporção, distribuição, média, contagem e nada", () => {
    expect(sugerirTipo("(CRAS / Total) × 100", "ESCOLHA_UNICA")).toBe("PROPORCAO");
    expect(sugerirTipo("Nº de usuárias por município / Nº total x 100", "ESCOLHA_UNICA")).toBe("DISTRIBUICAO");
    expect(sugerirTipo("Média Renda", "NUMERO")).toBe("MEDIA");
    expect(sugerirTipo("Total de famílias entrevistadas", null)).toBe("CONTAGEM");
    expect(sugerirTipo("Índice de gravidade", "ESCOLHA_UNICA")).toBeNull();
  });
});
```

Se o caso "ambígua" der `NENHUMA` com a semelhança real, troque a descrição do teste por um texto que de fato empate as duas perguntas (ex.: a interseção de palavras das duas) e explique no relatório — o que importa é provar o ramo `AMBIGUA`.

- [ ] **Step 2: Run to verify failure** — `cd backend && npx vitest run tests/importacaoCasamento.test.ts`.

- [ ] **Step 3: Implement** — `backend/src/helper/importacao/casamento.ts`:

```ts
export type PerguntaCandidata = {
  id: string;
  enunciado: string;
  tipo: "TEXTO" | "NUMERO" | "DATA" | "MULTIPLA_ESCOLHA" | "ESCOLHA_UNICA" | "CAMPO_ABERTO";
};

export type Sugestao =
  | { situacao: "UNICA"; perguntaId: string }
  | { situacao: "PAR"; antesId: string; aposId: string }
  | { situacao: "AMBIGUA"; candidatas: string[] }
  | { situacao: "NENHUMA" }
  | { situacao: "SEM_DESCRICAO" };

export type TipoSugerido = "DISTRIBUICAO" | "PROPORCAO" | "MEDIA" | "CONTAGEM" | null;

const LIMIAR = 0.5;
const EMPATE = 0.05;

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^\s*\d+\s*[.\-–)]\s*/, "")
    .replace(/[—–-]?\s*(antes|apos)\s+(do|o)\s+cartao\s+cria\s*$/, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palavras(texto: string): Set<string> {
  return new Set(normalizar(texto).split(" ").filter((p) => p.length >= 3));
}

export function semelhanca(a: string, b: string): number {
  const A = palavras(a);
  const B = palavras(b);
  if (A.size === 0 || B.size === 0) return 0;
  let comuns = 0;
  for (const p of A) if (B.has(p)) comuns++;
  return comuns / (A.size + B.size - comuns);
}

export function sugerirPergunta(descricao: string | null | undefined, perguntas: PerguntaCandidata[]): Sugestao {
  if (!descricao || !descricao.trim()) return { situacao: "SEM_DESCRICAO" };
  const ordenadas = perguntas
    .map((p) => ({ p, s: semelhanca(descricao, p.enunciado) }))
    .sort((x, y) => y.s - x.s);
  const melhor = ordenadas[0];
  if (!melhor || melhor.s < LIMIAR) return { situacao: "NENHUMA" };
  const topo = ordenadas.filter((c) => c.s >= melhor.s - EMPATE).map((c) => c.p);
  if (topo.length === 1) return { situacao: "UNICA", perguntaId: topo[0].id };
  if (topo.length === 2 && normalizar(topo[0].enunciado) === normalizar(topo[1].enunciado)) {
    const antes = topo.find((p) => /ANTES/i.test(p.enunciado));
    const apos = topo.find((p) => /AP[ÓO]S/i.test(p.enunciado));
    if (antes && apos) return { situacao: "PAR", antesId: antes.id, aposId: apos.id };
  }
  return { situacao: "AMBIGUA", candidatas: topo.map((p) => p.id) };
}

export function sugerirTipo(formula: string, tipoPergunta: PerguntaCandidata["tipo"] | null): TipoSugerido {
  const f = ` ${formula.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()} `;
  const escolha = tipoPergunta === "ESCOLHA_UNICA" || tipoPergunta === "MULTIPLA_ESCOLHA";
  if (!tipoPergunta && /total de/.test(f)) return "CONTAGEM";
  if (tipoPergunta === "NUMERO" && /medi[ao]/.test(f)) return "MEDIA";
  if (escolha && (/ por [a-z]/.test(f) || /distribuicao/.test(f))) return "DISTRIBUICAO";
  if (escolha && (/\/\s*total/.test(f) || /[x×]\s*100/.test(f))) return "PROPORCAO";
  return null;
}
```

- [ ] **Step 4: Run** — `npx vitest run tests/importacaoCasamento.test.ts` PASS; mutação: remover a regra do sufixo ANTES/APÓS → o teste "par" fica vermelho; limiar 0.3 → o teste "nenhuma" fica vermelho.

- [ ] **Step 5: Commit** — `feat: casamento de texto e sugestao de tipo para a importacao de indicadores`.

---

### Task 3: Mapa das definições decididas e resolvedor

**Files:**
- Create: `backend/src/helper/importacao/definicoes-cartao-cria.ts`
- Create: `backend/src/helper/importacao/resolver.ts`
- Test: `backend/tests/importacaoResolver.test.ts` (puro), `backend/tests/importacaoDefinicoes.test.ts` (banco real)

**Interfaces:**
- Produces (`definicoes-cartao-cria.ts`):

```ts
export type RefPergunta = { pergunta: string };   // enunciado exato, na pesquisa da definição
export type RefIndicador = { indicador: string }; // código de outra definição do mapa
export interface DefinicaoConhecida {
  codigo: string;
  nome: string;
  pesquisa: "Cartão CRIA — Criança" | "Cartão CRIA — Gestante";
  idsPlanilha: string[];          // [] = indicador auxiliar, não vem de linha da planilha
  tipo: import("../indicadorConfig.js").TipoIndicador;
  config: unknown;                // usa RefPergunta / RefIndicador no lugar de ids
  recorte?: { antes: string; apos: string }; // enunciados do par ANTES/APÓS
  apresentacao?: Array<"Escopo" | "Perfil">;
  motivo: string;                 // motivoIncompleto gravado
}
export const DEFINICOES: DefinicaoConhecida[]; // em ordem de dependência
```

- Produces (`resolver.ts`):

```ts
export type PerguntaDoBanco = { id: string; enunciado: string; pesquisa: string };
export type Resolvido = { config: unknown; recorteConfig?: { substituicoes: Array<{ de: string; para: string }> }; faltando: string[] };
export function resolverDefinicao(
  def: DefinicaoConhecida,
  perguntas: PerguntaDoBanco[],
  idsPorCodigo: Map<string, string>,
): Resolvido;
```

`resolverDefinicao` percorre a config recursivamente: todo objeto `{ pergunta: "..." }` vira o id da pergunta com aquele enunciado **exato** na pesquisa da definição; todo `{ indicador: "C-MCC" }` vira o id do indicador já gravado (de `idsPorCodigo`). Referência que não resolve entra em `faltando` (texto "pergunta não encontrada: <enunciado>" ou "indicador não encontrado: <código>") e fica como string vazia na config. O `recorte`, se houver, vira `{ substituicoes: [{ de: idAntes, para: idApos }] }`.

**O mapa** — transcreva exatamente esta tabela para `DEFINICOES`, na ordem (dependências antes de quem depende). Enunciados copiados de `backend/prisma/pesquisas-cartao-cria.ts`. `motivo` padrão: `"definição pronta — conferir e ativar"`, salvo indicação.

Pesquisa **Criança** (`"Cartão CRIA — Criança"`):

| código | nome | ids planilha | tipo | config | recorte / apresentação / motivo |
|---|---|---|---|---|---|
| C-VCRAS | % Participação no CRAS | 165 | PROPORCAO | `{ perguntaId: {pergunta:"A criança e a família participam de atividades propostas pelo CRAS? — ANTES do Cartão CRIA"}, opcoesNumerador: ["Sim"] }` | recorte ANTES→"…— APÓS o Cartão CRIA"; Escopo |
| C-CVAC | % Vacinação em dia | 177 | PROPORCAO | `{ perguntaId: {pergunta:"Carteira de vacinação da criança atualizada — ANTES do Cartão CRIA"}, opcoesNumerador: ["Sim"] }` ("Não soube informar" fica no denominador: resposta 6-b) | recorte ANTES→APÓS; Escopo |
| C-CPUER | CPUER — consultas de puericultura pela Caderneta | — | META_POR_IDADE | `{ perguntaId:{pergunta:"Número de consultas de puericultura no último ano"}, nascimentoPerguntaId:{pergunta:"Data de nascimento da criança"}, faixas:[{deMeses:0,ateMeses:12,esperado:7},{deMeses:12,ateMeses:24,esperado:2},{deMeses:24,ateMeses:null,esperado:1}] }` | — |
| C-MCC | MCC — Média de Condicionalidades da Criança | 191 | COMPOSTO | `{ termos:[{indicadorId:{indicador:"C-VCRAS"},peso:3},{indicadorId:{indicador:"C-CVAC"},peso:5},{indicadorId:{indicador:"C-CPUER"},peso:5}], divisor:13 }` | Escopo |
| C-SEG-ALIM | Segurança alimentar (criança) | — | CRUZAMENTO | `{ condicoes:[{perguntaId:{pergunta:"Nos últimos três meses, os alimentos acabaram antes que você tivesse dinheiro para comprar mais comida?"},opcoes:["Não"]},{perguntaId:{pergunta:"Nos últimos três meses, você comeu apenas alguns alimentos que ainda tinha porque o dinheiro acabou?"},opcoes:["Não"]}] }` (= 100 − TRIA risco, respostas 1-a e 2-a) | — |
| C-TRIA-Q1 | TRIA — alimentos acabaram (criança) | — | ESCALA | `{ perguntaId:{pergunta:"Nos últimos três meses, os alimentos acabaram antes que você tivesse dinheiro para comprar mais comida?"}, notas:{"Sim":100,"Não":0} }` | — |
| C-TRIA-Q2 | TRIA — comeu apenas alguns alimentos (criança) | — | ESCALA | idem com "…você comeu apenas alguns alimentos que ainda tinha porque o dinheiro acabou?" | — |
| C-TRIA-SIM | TRIA — número de "sim" (criança) | — | COMPOSTO | `{ termos:[{indicadorId:{indicador:"C-TRIA-Q1"},peso:1},{indicadorId:{indicador:"C-TRIA-Q2"},peso:1}], divisor:100 }` (0, 1 ou 2 por criança) | — |
| C-TRIA | Índice TRIA (criança) | 200 | CLASSIFICACAO | `{ indicadorId:{indicador:"C-TRIA-SIM"}, faixas:[{rotulo:"Sem risco",de:0,ate:0.5},{rotulo:"Risco leve",de:0.5,ate:1.5},{rotulo:"Risco moderado/alto",de:1.5,ate:2}] }` | Escopo, Perfil |
| C-IDTC | IDTC — Índice de Desenvolvimento Tridimensional das Crianças | vsdvsd1, 199 | COMPOSTO | `{ termos:[{indicadorId:{indicador:"C-SEG-ALIM"},peso:1},{indicadorId:{indicador:"C-MCC"},peso:1}], divisor:2 }` (IDTC e IDMCC são o mesmo índice: resposta 12) | Escopo |
| C-IDTC-FAIXAS | Classificação do IDTC | sd51sd, sd5v4sd45v, sd5v4sv87, sdv67vd7v | CLASSIFICACAO | `{ indicadorId:{indicador:"C-IDTC"}, faixas:[{rotulo:"Desenvolvimento Crítico",de:0,ate:25},{rotulo:"Desenvolvimento Baixo",de:25,ate:50},{rotulo:"Desenvolvimento Moderado",de:50,ate:75},{rotulo:"Alto Desenvolvimento",de:75,ate:100}] }` | Perfil |
| C-IMC | IMC médio infantil | 188 | DERIVADA | `{ variaveis:{ peso:{pergunta:"Peso da criança em kg (atual)"}, altura:{pergunta:"Altura da criança em metros (atual)"} }, expressao:{op:"/",esq:{var:"peso"},dir:{op:"*",esq:{var:"altura"},dir:{var:"altura"}}} }` | Perfil |
| C-DESNUT | % Desnutrição infantil | 193 | PERCENTIL_OMS | `{ imcIndicadorId:{indicador:"C-IMC"}, nascimentoPerguntaId:{pergunta:"Data de nascimento da criança"}, sexoPerguntaId:{pergunta:"Sexo biológico da criança"}, opcoesSexo:{masculino:"Masculino",feminino:"Feminino"}, corte:{abaixoDe:10} }` | Escopo |
| C-OBES | % Obesidade infantil | 194 | PERCENTIL_OMS | idem com `corte:{acimaDe:85}` | Perfil |
| C-RENDA | Renda média familiar | 159 | MEDIA | `{ perguntaId:{pergunta:"Renda mensal total da família (R$)"} }` | Escopo |
| C-ESCOL-NOTA | Escolaridade (nota, criança) | — | ESCALA | `{ perguntaId:{pergunta:"Escolaridade"}, notas:{"Não estudou":0,"Fundamental incompleto":16.67,"Fundamental completo":33.33,"Médio incompleto":50,"Médio completo":66.67,"Superior incompleto":83.33,"Superior completo":100} }` | — |
| C-MORADIA-NOTA | Moradia (nota, criança) | — | ESCALA | `{ perguntaId:{pergunta:"Tipo de moradia"}, notas:{"Cedida/Ocupação":0,"Alugada":50,"Própria":100,"Outro":null} }` | motivo: `"conferir a ordem das notas de moradia (proposta: cedida 0 · alugada 50 · própria 100 · outro fora)"` |
| C-ISF | Índice Socioeconômico Familiar (criança) | 187 | ZSCORE | `{ componentes:[{indicadorId:{indicador:"C-RENDA"},peso:1},{indicadorId:{indicador:"C-ESCOL-NOTA"},peso:1},{indicadorId:{indicador:"C-MORADIA-NOTA"},peso:1}] }` | Escopo; motivo igual ao de C-MORADIA-NOTA |
| MCB | MCB — Média de Condicionalidades dos Beneficiários | 192, 241 | COMPOSTO | `{ termos:[{indicadorId:{indicador:"C-MCC"},peso:1}], divisor:1 }` (placeholder de forma válida; não calcula por estar incompleto) | Escopo; motivo: `"MCB é média entre crianças e gestantes; o motor calcula por indivíduo e ainda não tem agregação entre pesquisas"`; pesquisa Criança, `pesquisaId` = null na gravação |

Pesquisa **Gestante** (`"Cartão CRIA — Gestante"`):

| código | nome | ids planilha | tipo | config | recorte / apresentação / motivo |
|---|---|---|---|---|---|
| G-VCRAS | % Participação em atividades do CRAS | 210 | PROPORCAO | `{ perguntaId:{pergunta:"A gestante e a família participam de atividades propostas pelo CRAS? — ANTES do Cartão CRIA"}, opcoesNumerador:["Sim"] }` | recorte ANTES→APÓS; Escopo |
| G-CVAC | Vacinação da gestante em dia | — | PROPORCAO | `{ perguntaId:{pergunta:"A caderneta/carteira de vacinação da gestante está atualizada conforme orientação da unidade de saúde?"}, opcoesNumerador:["Sim, está atualizada"] }` | — |
| G-VAC-ATRASO | % Vacinação desatualizada | 234 | PROPORCAO | mesma pergunta, `opcoesNumerador:["Não, está atrasada"]` | Escopo |
| G-CPRE | CPRE — início do pré-natal | — | ESCALA | `{ perguntaId:{pergunta:"Quando iniciou o pré-natal?"}, notas:{"Iniciou antes de 12 semanas (3 meses)":100,"Iniciou após 12 semanas (3 meses)":50,"Sem pré-natal":0,"Não soube informar":null} }` (resposta 5-a) | — |
| G-MCG | MCG — Média de Condicionalidades da Gestante | 240 | COMPOSTO | `{ termos:[{indicadorId:{indicador:"G-VCRAS"},peso:3},{indicadorId:{indicador:"G-CVAC"},peso:5},{indicadorId:{indicador:"G-CPRE"},peso:5}], divisor:13 }` | Escopo |
| G-SEG-ALIM | Segurança alimentar (gestante) | — | CRUZAMENTO | as duas perguntas de TRIA da Gestante com `opcoes:["Não"]` | — |
| G-TRIA-Q1, G-TRIA-Q2, G-TRIA-SIM | (como na Criança, perguntas da Gestante) | — | ESCALA, ESCALA, COMPOSTO | idem | — |
| G-TRIA | Índice TRIA (gestante) | 250 | CLASSIFICACAO | sobre G-TRIA-SIM, faixas Sem risco / Risco leve / Risco moderado/alto (como C-TRIA) | Escopo, Perfil |
| G-INSEG | % Insegurança alimentar | 243 | CLASSIFICACAO | `{ indicadorId:{indicador:"G-TRIA-SIM"}, faixas:[{rotulo:"Sem insegurança",de:0,ate:0.5},{rotulo:"Com insegurança",de:0.5,ate:2}] }` | Escopo, Perfil |
| G-ESCALA-INSEG | Escala de insegurança alimentar | 244 | CLASSIFICACAO | `{ indicadorId:{indicador:"G-TRIA-SIM"}, faixas:[{rotulo:"Sem insegurança",de:0,ate:0.5},{rotulo:"Média",de:0.5,ate:1.5},{rotulo:"Grave",de:1.5,ate:2}] }` (resposta 3-a) | Escopo, Perfil |
| G-IMC | IMC médio gestante (atual) | 245 | DERIVADA | `peso:{pergunta:"Qual é o peso atual da gestante?"}, altura:{pergunta:"Qual a altura da gestante em metros (atual)?"}`, mesma expressão de C-IMC | — |
| G-IMC-PRE | IMC pré-gestacional | — | DERIVADA | `peso:{pergunta:"Qual era o peso da gestante antes de engravidar (aproximadamente)?"}`, mesma altura | — |
| G-IMC-PRE-CLASSE | Classificação do IMC pré-gestacional | — | CLASSIFICACAO | `{ indicadorId:{indicador:"G-IMC-PRE"}, faixas:[{rotulo:"Baixo peso",de:0,ate:18.5},{rotulo:"Eutrofia",de:18.5,ate:25},{rotulo:"Sobrepeso",de:25,ate:30},{rotulo:"Obesidade",de:30,ate:100}] }` (resposta 11) | Perfil |
| G-ATALAH | Estado nutricional da gestante (Atalah) | — | ATALAH | `{ imcIndicadorId:{indicador:"G-IMC"}, semanaPerguntaId:{pergunta:"Semana gestacional atual"} }` | Perfil |
| G-RENDA | Renda média familiar (gestante) | 221 | MEDIA | `{ perguntaId:{pergunta:"Renda mensal total da família (R$)"} }` | Escopo |
| G-ESCOL-NOTA, G-MORADIA-NOTA | (como na Criança, perguntas da Gestante) | — | ESCALA | idem | G-MORADIA-NOTA com o motivo de moradia |
| G-ISF | Índice Socioeconômico Familiar (gestante) | 247 | ZSCORE | componentes G-RENDA, G-ESCOL-NOTA, G-MORADIA-NOTA, peso 1 | Escopo; motivo de moradia |
| G-IDMG | Índice de Desenvolvimento Multidimensional das Gestantes | 249 | COMPOSTO | `{ termos:[{indicadorId:{indicador:"G-SEG-ALIM"},peso:1},{indicadorId:{indicador:"G-MCG"},peso:1}], divisor:2 }` | Escopo; motivo: `"a planilha repete a fórmula do MCG; proposta por analogia ao IDTC: (Segurança Alimentar + MCG) ÷ 2 — confirmar"` |
| G-IDMG-FAIXAS | Classificação do IDMG | 6sdv4, s5v6sv9, 6sdv67, sdv6v444v | CLASSIFICACAO | sobre G-IDMG, faixas iguais às do C-IDTC-FAIXAS | Perfil; motivo: `"depende da confirmação do IDMG"` |

Notas de execução (não mudam a tabela):
- Antes de transcrever, confira com `grep` em `pesquisas-cartao-cria.ts` cada enunciado e cada texto de opção. Texto que não bate **não** se corrige no mapa: reporte (é a prova de que o teste da Step 3 funciona).
- `MCB` usa uma forma válida só para gravar; o status `DEFINICAO_INCOMPLETA` impede o cálculo. Grave-o com `pesquisaId: null`.
- A ordem do array é a ordem da tabela (cada `{indicador}` aponta para código que vem antes).

- [ ] **Step 1: Failing tests (puro)** — `backend/tests/importacaoResolver.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolverDefinicao, type PerguntaDoBanco } from "../src/helper/importacao/resolver.js";
import { DEFINICOES } from "../src/helper/importacao/definicoes-cartao-cria.js";

const PERG: PerguntaDoBanco[] = [
  { id: "p1", enunciado: "Data de nascimento da criança", pesquisa: "Cartão CRIA — Criança" },
  { id: "p2", enunciado: "Número de consultas de puericultura no último ano", pesquisa: "Cartão CRIA — Criança" },
  { id: "p9", enunciado: "Número de consultas de puericultura no último ano", pesquisa: "Cartão CRIA — Gestante" },
];

describe("resolverDefinicao", () => {
  it("troca enunciado e código por id, só na pesquisa da definição", () => {
    const def = DEFINICOES.find((d) => d.codigo === "C-CPUER")!;
    const r = resolverDefinicao(def, PERG, new Map());
    expect(r.faltando).toEqual([]);
    expect(r.config).toMatchObject({ perguntaId: "p2", nascimentoPerguntaId: "p1" });
  });

  it("referência que não resolve vai para faltando e não lança", () => {
    const def = DEFINICOES.find((d) => d.codigo === "C-MCC")!;
    const r = resolverDefinicao(def, PERG, new Map([["C-VCRAS", "i1"]]));
    expect(r.faltando).toEqual(["indicador não encontrado: C-CVAC", "indicador não encontrado: C-CPUER"]);
  });

  it("recorte vira substituição", () => {
    const def = DEFINICOES.find((d) => d.codigo === "C-VCRAS")!;
    const perg = [
      { id: "a", enunciado: "A criança e a família participam de atividades propostas pelo CRAS? — ANTES do Cartão CRIA", pesquisa: "Cartão CRIA — Criança" },
      { id: "b", enunciado: "A criança e a família participam de atividades propostas pelo CRAS? — APÓS o Cartão CRIA", pesquisa: "Cartão CRIA — Criança" },
    ];
    expect(resolverDefinicao(def, perg, new Map()).recorteConfig).toEqual({ substituicoes: [{ de: "a", para: "b" }] });
  });

  it("o mapa está em ordem de dependência e sem código repetido", () => {
    const vistos = new Set<string>();
    for (const d of DEFINICOES) {
      expect(vistos.has(d.codigo)).toBe(false);
      for (const ref of JSON.stringify(d.config).matchAll(/"indicador":"([^"]+)"/g)) expect(vistos.has(ref[1])).toBe(true);
      vistos.add(d.codigo);
    }
  });

  it("nenhum id de planilha aparece em duas definições", () => {
    const ids = DEFINICOES.flatMap((d) => d.idsPlanilha);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Failing test (banco real)** — `backend/tests/importacaoDefinicoes.test.ts`: carrega as perguntas das duas pesquisas do banco de dev (`prisma.pergunta.findMany` com `pesquisa.titulo` e `deletedAt` da pesquisa nulo), resolve **todas** as definições em ordem (usando ids fictícios `"id-"+codigo` para `idsPorCodigo`), e para cada uma afirma:
  - `faltando` vazio (prova de que todo enunciado do mapa existe no seed);
  - `validarConfig(def.tipo, resolvido.config)` não lança;
  - `problemasDasPerguntas(config, perguntasComOpcoes)` vazio (mesma conferência do cadastro; carregue as opções com `indicadorModel.perguntasPorId`).

Não grava nada.

- [ ] **Step 3: Run to verify failure** — `cd backend && npx vitest run tests/importacaoResolver.test.ts tests/importacaoDefinicoes.test.ts`.

- [ ] **Step 4: Implement** — `definicoes-cartao-cria.ts` (o mapa acima, com o tipo `DefinicaoConhecida`) e `resolver.ts`:

```ts
import type { DefinicaoConhecida } from "./definicoes-cartao-cria.js";

export type PerguntaDoBanco = { id: string; enunciado: string; pesquisa: string };
export type Resolvido = {
  config: unknown;
  recorteConfig?: { substituicoes: Array<{ de: string; para: string }> };
  faltando: string[];
};

export function resolverDefinicao(
  def: DefinicaoConhecida,
  perguntas: PerguntaDoBanco[],
  idsPorCodigo: Map<string, string>,
): Resolvido {
  const faltando: string[] = [];
  const daPesquisa = new Map(perguntas.filter((p) => p.pesquisa === def.pesquisa).map((p) => [p.enunciado, p.id]));
  const pergunta = (enunciado: string) => {
    const id = daPesquisa.get(enunciado);
    if (!id) faltando.push(`pergunta não encontrada: ${enunciado}`);
    return id ?? "";
  };
  const trocar = (valor: unknown): unknown => {
    if (Array.isArray(valor)) return valor.map(trocar);
    if (valor && typeof valor === "object") {
      const obj = valor as Record<string, unknown>;
      const chaves = Object.keys(obj);
      if (chaves.length === 1 && typeof obj.pergunta === "string") return pergunta(obj.pergunta);
      if (chaves.length === 1 && typeof obj.indicador === "string") {
        const id = idsPorCodigo.get(obj.indicador);
        if (!id) faltando.push(`indicador não encontrado: ${obj.indicador}`);
        return id ?? "";
      }
      return Object.fromEntries(chaves.map((k) => [k, trocar(obj[k])]));
    }
    return valor;
  };
  const config = trocar(def.config);
  const recorteConfig = def.recorte
    ? { substituicoes: [{ de: pergunta(def.recorte.antes), para: pergunta(def.recorte.apos) }] }
    : undefined;
  return { config, recorteConfig, faltando };
}
```

- [ ] **Step 5: Run** — os dois arquivos PASS; `tsc` limpo. Se o teste de banco acusar enunciado/opção que não bate, **não** ajuste o seed: corrija o mapa só se o erro for de transcrição sua (compare com `pesquisas-cartao-cria.ts`); se o seed e a planilha divergem de verdade, pare e reporte.

- [ ] **Step 6: Commit** — `feat: mapa das definicoes decididas do Cartao CRIA e resolvedor por enunciado`.

---

### Task 4: Importador

**Files:**
- Create: `backend/src/helper/importacao/planilha.ts`
- Create: `backend/scripts/importar-indicadores.ts`
- Modify: `backend/package.json` (script `importar-indicadores`)
- Test: `backend/tests/importacaoPlanilha.test.ts` (puro, xlsx gerado), `backend/tests/importarIndicadores.test.ts` (banco real)

**Interfaces:**
- Consumes: `sugerirPergunta`, `sugerirTipo` (T2); `DEFINICOES`, `resolverDefinicao` (T3); `indicadorModel.criar(dados, usuarioId, dependencias, origem?)`, `idsPlanilhaExistentes`, `codigosExistentes` (T1); `indicadoresReferenciados`, `validarConfig` de `indicadorConfig.js`.
- Produces:

```ts
// planilha.ts
export const COLUNAS = ["ID", "Setor", "Projeto", "Nome do Indicador", "Formula Descritiva", "Fórmula de Cálculo",
  "Tipo de Indicador", "Objetivo do Indicador / O que mede", "Meta", "Nº Pergunta", "Pergunta (Descrição)",
  "Observações", "Táticos relacionados", "Operacionais relacionados", "Apresentação", "DtRegistro", "Usuario"] as const;
export type LinhaPlanilha = {
  id: string; projeto: "Cartão CRIA (Criança)" | "Cartão CRIA (Gestante)"; nome: string;
  formulaDescritiva: string; formulaCalculo: string; categoria: string; objetivo: string;
  perguntaDescricao: string; observacoes: string; apresentacao: Array<"Escopo" | "Perfil">;
};
export async function lerPlanilha(caminho: string): Promise<LinhaPlanilha[]>; // lança se cabeçalho diverge
// script
export async function importarIndicadores(caminho: string, usuarioId: string): Promise<ResumoImportacao>;
export type ResumoImportacao = {
  lidas: number; importadas: number; jaExistiam: number;
  porSituacao: Record<"DEFINICAO_PRONTA" | "PERGUNTA_SUGERIDA" | "AMBIGUA" | "SEM_CANDIDATA" | "SEM_DESCRICAO", string[]>;
  auxiliares: number;
};
```

Regras:
- `lerPlanilha` lê `worksheets[0]`; o cabeçalho tem de ser **exatamente** `COLUNAS` (mesma ordem); senão lança `Error("cabeçalho da planilha mudou: ...")`. Lê só as colunas 1–15 (para em "Apresentação"; **nunca** lê `DtRegistro` e `Usuario`). Filtra os dois projetos do Cartão CRIA. `apresentacao` = split por vírgula, trim, mantendo só "Escopo"/"Perfil". `id` = `String(valor).trim()`.
- `importarIndicadores`:
  1. lê a planilha (se lançar, nada é gravado);
  2. carrega perguntas das duas pesquisas (`id`, `enunciado`, `tipo`, título da pesquisa), `idsPlanilhaExistentes`, `codigosExistentes`;
  3. **definições** em ordem: se o `codigo` já existe ou algum `idsPlanilha` já existe → pula (conta em `jaExistiam`) e registra o id existente em `idsPorCodigo` (busque por código); senão resolve, grava com `status: "DEFINICAO_INCOMPLETA"`, `motivoIncompleto` = `def.motivo` + (se houver) `"; " + faltando.join("; ")`, `pesquisaId` da pesquisa (null para `MCB`), `apresentacao`, `categoria` e `dadosPlanilha` da **primeira** linha de `idsPlanilha` (vazio para auxiliares), e guarda o id em `idsPorCodigo`. Dependências = `indicadoresReferenciados(config)` quando a config valida; senão `[]`;
  4. **linhas restantes** (id não consumido pelo mapa e não existente): `sugerirPergunta` contra as perguntas da pesquisa da linha; `sugerirTipo(formulaCalculo, tipo da pergunta sugerida)`; monta config parcial: PROPORCAO `{ perguntaId, opcoesNumerador: [] }`, DISTRIBUICAO/MEDIA `{ perguntaId }`, CONTAGEM `{}`; PAR → mesma config na pergunta ANTES + `recorteConfig`; sem tipo → `tipo: "CONTAGEM"`, `config: {}` só como forma gravável, com motivo "definir tipo e pergunta". Código `CRIA-C-<id>`/`CRIA-G-<id>`. `motivoIncompleto` por situação:
     - UNICA/PAR com tipo: `"pergunta sugerida: <enunciado> — conferir tipo e opções"`;
     - AMBIGUA: `"a linha cita mais de uma pergunta — escolher na revisão"`;
     - NENHUMA: `"nenhuma pergunta parecida — escolher na revisão"`;
     - SEM_DESCRICAO: `"planilha sem a pergunta — escolher na revisão"`;
  5. `dadosPlanilha` = `{ nome, formulaCalculo, formulaDescritiva, perguntaDescricao, objetivo, observacoes, categoria }` (só strings);
  6. toda gravação usa `indicadorModel.criar(..., usuarioId, dependencias, { idsPlanilha, dadosPlanilha })` e `registrarLog` (se `criar` já registra, não duplique — confira).
- Execução direta: `npx tsx scripts/importar-indicadores.ts <arquivo.xlsx>` — atribui ao primeiro ADMIN ativo, imprime o resumo (linhas abaixo) e `await prisma.$disconnect()` num `finally`. Mesmo padrão de detecção de execução direta de `scripts/adicionar-semana-gestacional.ts`.

```
110 lidas · <n> importadas pelo mapa · <n> por sugestão · <n> já existiam · <n> auxiliares
definição pronta: 165, 177, ...
pergunta sugerida: ...
ambígua: ...
sem candidata: ...
sem descrição: ...
```

- [ ] **Step 1: Failing test puro** — `backend/tests/importacaoPlanilha.test.ts`: gera um xlsx no `os.tmpdir()` com ExcelJS (cabeçalho = `COLUNAS`; 4 linhas: uma Criança, uma Gestante, uma de outro projeto, uma com "Escopo, Perfil"; colunas `DtRegistro`/`Usuario` preenchidas com `"2026-04-25"`/`"alguem@exemplo.com"`), e afirma: `lerPlanilha` devolve 3 linhas (Criança, Gestante e a de "Escopo, Perfil", todas do Cartão CRIA; a de outro projeto some), `apresentacao` dividida, e que `JSON.stringify(linhas)` **não contém** `"alguem@exemplo.com"`. Segundo teste: cabeçalho com "Pergunta (Descrição)" renomeada → `lerPlanilha` rejeita com "cabeçalho da planilha mudou".

- [ ] **Step 2: Failing test de banco** — `backend/tests/importarIndicadores.test.ts`: gera um xlsx com estas linhas do Cartão CRIA: `165` (VCRAS), `sd51sd` e `sd5v4sd45v` (faixas do IDTC), `150` com descrição "4. Zona" e fórmula "(Zona urbana / Total) × 100", `900` sem descrição; roda `importarIndicadores(caminho, adminId)` e afirma:
  - `C-VCRAS` existe com `idsPlanilha` contendo `"165"`, `status: "DEFINICAO_INCOMPLETA"`, `motivoIncompleto` começando com "definição pronta", e `recorteConfig` com uma substituição;
  - existe **um** indicador `C-IDTC-FAIXAS` e seus `idsPlanilha` incluem os 4 ids do mapa (o arquivo só tinha 2; o indicador do mapa é criado inteiro);
  - `CRIA-C-150` é PROPORCAO sobre a pergunta "Zona" com `opcoesNumerador: []` e motivo "pergunta sugerida: Zona — conferir tipo e opções";
  - `CRIA-C-900` tem motivo "planilha sem a pergunta — escolher na revisão";
  - nenhum indicador importado está `ATIVO`;
  - nenhum `dadosPlanilha` contém o e-mail da coluna `Usuario`;
  - **rodar de novo**: `importadas` = 0 e a contagem de indicadores não muda;
  - **revisão preservada**: antes da segunda rodada, mude o `nome` de `CRIA-C-150`; depois dela, o nome continua o mudado.
  Limpe no `afterAll` tudo o que o teste criou (indicadores com `idsPlanilha` não vazio ou código do mapa/`CRIA-`, suas dependências e logs; e o arquivo temporário). Leia `tests/indicadoresIntegracao.test.ts` para o padrão de limpeza e de usuário de teste.

- [ ] **Step 3: Run to verify failure.**

- [ ] **Step 4: Implement** `planilha.ts` e `scripts/importar-indicadores.ts` conforme as regras. Acrescente ao `package.json`: `"importar-indicadores": "tsx scripts/importar-indicadores.ts"`.

- [ ] **Step 5: Run** — os dois arquivos PASS, `tsc` limpo, suíte inteira PASS. Mutação: (a) tirar o filtro de projeto → teste de 2 linhas vermelho; (b) ler a coluna 17 → teste do e-mail vermelho; (c) tirar a checagem de existentes → teste de rodar de novo vermelho.

- [ ] **Step 6: Rodar na planilha real, no banco de dev**

Run: `cd backend && npx tsx scripts/importar-indicadores.ts "C:/Users/User/Downloads/Exportação Indicadores.xlsx"` e de novo.
Expected: primeira vez, 110 lidas e o resumo por situação; segunda vez, 0 importadas. Cole os dois resumos no relatório. **Não** copie a planilha para o repositório.

- [ ] **Step 7: Commit** — `feat: importador dos indicadores do Cartao CRIA a partir da planilha`.

---

### Task 5: Frontend — API e lista de indicadores

**Files:**
- Create: `frontend/src/App/api/indicadores.ts`
- Create: `frontend/src/App/pages/Indicadores.tsx`
- Modify: `frontend/src/App/router.tsx`, `frontend/src/Components/layout/Sidebar.tsx`, `frontend/src/Components/layout/Topbar.tsx`
- Test: `frontend/src/App/pages/Indicadores.test.tsx`

**Interfaces:**
- Produces (`api/indicadores.ts`):

```ts
export type StatusIndicador = "ATIVO" | "DEFINICAO_INCOMPLETA" | "INATIVO";
export interface Indicador {
  id: string; codigo: string; nome: string; tipo: string; status: StatusIndicador; motivoIncompleto: string | null;
  pesquisaId: string | null; config: unknown; recorte: "ANTES_APOS" | null;
  recorteConfig: { substituicoes: Array<{ de: string; para: string }> } | null;
  apresentacao: string[]; categoria: string | null; meta: number | null;
  idsPlanilha: string[]; dadosPlanilha: Record<string, string> | null;
}
export interface FiltrosIndicadores { status?: StatusIndicador; pesquisaId?: string; apresentacao?: "Escopo" | "Perfil"; q?: string }
export function useIndicadores(filtros: FiltrosIndicadores): UseQueryResult<{ itens: Indicador[]; total: number; contadores: Record<StatusIndicador, number> }>;
export function useIndicador(id: string | undefined): UseQueryResult<Indicador | null>;
export function useSalvarIndicador(id: string): UseMutationResult<Indicador, AxiosError, Partial<Indicador>>; // PUT /indicadores/:id
export function useCalculoIndicador(codigo: string | undefined, pesquisaId: string | undefined): UseQueryResult<unknown>; // GET /indicadores/calculo?pesquisaId=, devolve resultados[codigo]
```

Siga o padrão de `api/usuarios.ts` (TanStack Query, `api` de `../lib/axios.js`, `queryKey` `["indicadores", filtros]` / `["indicador", id]`, `invalidateQueries` de `["indicadores"]` e `["indicador", id]` no sucesso do PUT).

**Página `Indicadores.tsx`** (siga a estrutura visual de `pages/Usuarios.tsx`: título, cartão, tabela, estados de carregando/erro/vazio):
- contadores no topo: "N para revisar · N ativos · N inativos" a partir de `contadores`;
- filtros: status (Para revisar = `DEFINICAO_INCOMPLETA` como padrão / Ativos / Inativos / Todos), pesquisa (select com `usePesquisas` existente em `api/pesquisas.ts`), apresentação (Todas/Escopo/Perfil), busca por nome;
- tabela: código, nome, tipo, apresentação (chips), status, motivo (texto curto, se incompleto); cada linha leva a `/indicadores/:id`.
- Rota `/indicadores` e `/indicadores/:id` no bloco `ProtectedRoute papeis={["ADMIN", "GESTOR"]}` do `router.tsx`, com `lazy` como as demais páginas; item "Indicadores" na seção Administração do `Sidebar.tsx` com `papeis: ["ADMIN", "GESTOR"]` (ícone `Gauge` ou `BarChart3` do mesmo pacote de ícones já usado); título "Indicadores" no `Topbar.tsx`.

- [ ] **Step 1: Failing test** — `Indicadores.test.tsx` no padrão de `TrocarSenha.test.tsx` (providers, `vi.spyOn(api, "get")`):
  - com `api.get` devolvendo 2 itens e contadores `{ DEFINICAO_INCOMPLETA: 5, ATIVO: 2, INATIVO: 1 }`, a tela mostra "5 para revisar" e os dois nomes;
  - a primeira chamada a `api.get` usa `params` com `status: "DEFINICAO_INCOMPLETA"`;
  - trocar o filtro de apresentação para "Perfil" refaz a chamada com `apresentacao: "Perfil"`.

- [ ] **Step 2–4:** rodar (vermelho), implementar, rodar (`cd frontend && npx vitest run src/App/pages/Indicadores.test.tsx && npx tsc --noEmit -p .`).

- [ ] **Step 5: Commit** — `feat(frontend): lista de indicadores com filtros e contadores`.

---

### Task 6: Frontend — revisão de um indicador

**Files:**
- Create: `frontend/src/App/pages/RevisaoIndicador.tsx`
- Test: `frontend/src/App/pages/RevisaoIndicador.test.tsx`

**Interfaces:**
- Consumes: `useIndicador`, `useSalvarIndicador`, `useCalculoIndicador` (T5); o hook existente de detalhe da pesquisa em `api/pesquisas.ts` que traz perguntas com opções (leia o arquivo e use o que `DetalhePesquisa.tsx` usa).

Layout (padrão visual das páginas existentes, duas colunas em telas largas, uma em telas estreitas):
- **Coluna "Da planilha"** (só leitura): `dadosPlanilha.nome`, `formulaCalculo`, `formulaDescritiva`, `perguntaDescricao`, `objetivo`, `observacoes`, `categoria`; `idsPlanilha` em texto pequeno. Indicador auxiliar (sem `dadosPlanilha`): "Indicador auxiliar, criado pela importação a partir das definições decididas".
- **Coluna "Cadastro"**:
  - aviso no topo com `motivoIncompleto` quando o status é `DEFINICAO_INCOMPLETA`;
  - nome (texto), apresentação (duas caixas: Escopo, Perfil), meta (número opcional);
  - tipo (select com os 13 tipos);
  - **PROPORCAO**: select de pergunta (perguntas de escolha da pesquisa do indicador) + caixas de marcar com as opções da pergunta → `opcoesNumerador`;
  - **DISTRIBUICAO / MEDIA**: select de pergunta (de escolha / numéricas, respectivamente);
  - **CONTAGEM**: sem campos;
  - **ESCALA**: select de pergunta de escolha única + para cada opção um campo numérico 0–100 e uma caixa "fora do cálculo" (→ `null`);
  - **demais tipos**: `textarea` com `JSON.stringify(config, null, 2)`; JSON inválido → mensagem local "JSON inválido" e o Salvar fica desabilitado;
  - **Recorte ANTES/APÓS** (tipos que leem pergunta): caixa "Comparar antes e depois" + select da pergunta do APÓS → `recorte: "ANTES_APOS"`, `recorteConfig: { substituicoes: [{ de: <pergunta do ANTES>, para: <escolhida> }] }`; desligar envia `recorte` e `recorteConfig` ausentes de um jeito que a API aceite (confira o schema de edição; se não houver como limpar, mostre o recorte só como leitura e registre no relatório).
- **Botões**: "Salvar" (PUT com os campos editados, status inalterado); "Ativar" (PUT com os mesmos campos + `status: "ATIVO"`); "Inativar" (PUT `status: "INATIVO"`). Erro 422 da API: mostre `error.message` no topo e, quando `details.problemas` (lista) ou `details.fieldErrors` existirem, liste-os embaixo do botão. Sucesso: mensagem "Salvo" / "Ativado".
- **Depois de ativar** (status `ATIVO`): bloco "Resultado atual" com `useCalculoIndicador(codigo, pesquisaId)`: `OK` → valor (com `%` para PROPORCAO/CRUZAMENTO/PERCENTIL_OMS); `OK_FAIXAS` → lista rótulo + %; `OK_DISTRIBUICAO` → lista opção + %; `SEM_DADOS` → "Sem respostas aprovadas ainda"; `INCOMPLETO` → o motivo; par antes/depois → os dois lado a lado.

- [ ] **Step 1: Failing tests** — `RevisaoIndicador.test.tsx` (padrão de providers do `TrocarSenha.test.tsx`; mocke `api.get` por URL e `api.put`):
  1. mostra o texto da planilha e o motivo;
  2. PROPORCAO: marcar a opção "Sim" e clicar "Ativar" chama `api.put("/indicadores/<id>", …)` com `config.opcoesNumerador` = `["Sim"]` e `status: "ATIVO"`;
  3. **Review Focus 3**: `api.put` rejeitando com 422 `{ error: { code: "PERGUNTA_INCOMPATIVEL", message: "Configuração não confere com as perguntas", details: { problemas: ['opção "Não" sem nota'] } } }` → a tela mostra a mensagem e o problema, e o status exibido continua "Para revisar";
  4. JSON inválido no editor de config desabilita "Salvar";
  5. indicador ATIVO com cálculo `{ status: "OK", valor: 62.5 }` mostra "62,5%" (ou "62.5%" — siga o formato numérico já usado nas telas de resultado).

- [ ] **Step 2–4:** rodar (vermelho), implementar, rodar (`npx vitest run src/App/pages/RevisaoIndicador.test.tsx && npx tsc --noEmit -p . && npm run build`).

- [ ] **Step 5: Commit** — `feat(frontend): tela de revisao e ativacao de indicadores`.

---

### Task 7: Deploy, README e conferência ponta a ponta

**Files:**
- Modify: `README.md` (seção Deploy)
- Modify: `backend/Dockerfile` só se o script não estiver na imagem (deve estar: `COPY scripts ./scripts` já existe)

- [ ] **Step 1: README** — na seção Deploy, depois do passo da semana gestacional, acrescente para o dev da SECRIA:

```markdown
#### Importar os indicadores da planilha (uma vez)

1. Exporte a planilha "Exportação Indicadores" do Google Sheets como `.xlsx` e copie para a VM
   (ex.: `/tmp/indicadores.xlsx`). **Não** coloque o arquivo dentro do repositório: ele tem
   e-mails pessoais na coluna "Usuario" (o importador não lê essa coluna).
2. Rode, passando o arquivo para dentro do contêiner:

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.prod --profile seed run --rm \
     -v /tmp/indicadores.xlsx:/tmp/indicadores.xlsx:ro seed npx tsx scripts/importar-indicadores.ts /tmp/indicadores.xlsx
   ```

3. Confira a saída: a primeira linha deve ser "110 lidas · …". Saída vazia = o script não rodou.
   Rodar de novo é seguro: indicadores já importados (e já revisados) não são tocados.
4. Reinicie a API: `docker compose -f docker-compose.prod.yml --env-file .env.prod restart api`.
5. Os indicadores aparecem em **Indicadores** (menu Administração) como "Para revisar".
   Nenhum número aparece no sistema até alguém ativar o indicador.
6. Apague o arquivo da VM: `rm /tmp/indicadores.xlsx`.
```

- [ ] **Step 2: Conferência ponta a ponta no dev** — com o banco de dev já importado (Tarefa 4, Step 6) e a API e o frontend de dev no ar (se não estiverem, peça ao controller — não suba processos que fiquem rodando), confira pela API (`curl` com o token do admin de dev):
  - `GET /api/indicadores?status=DEFINICAO_INCOMPLETA` → contadores somam o total importado;
  - `PUT /api/indicadores/<id de C-VCRAS>` com `{ "status": "ATIVO" }` → 200; `GET /api/indicadores/calculo?pesquisaId=<Criança>` → `C-VCRAS` presente (`SEM_DADOS` é esperado se não houver respostas aprovadas);
  - devolva C-VCRAS para `DEFINICAO_INCOMPLETA` no fim (`{ "status": "DEFINICAO_INCOMPLETA", "motivoIncompleto": "definição pronta — conferir e ativar" }`), para deixar a revisão para a Maryana.
  Cole as respostas no relatório.

- [ ] **Step 3: Run tudo** — `cd backend && npx tsc --noEmit -p . && npx vitest run && npm run build`; `cd frontend && npx tsc --noEmit -p . && npx vitest run && npm run build`.

- [ ] **Step 4: Commit** — `docs: passo de deploy da importacao dos indicadores`.

---

## Ao fim deste plano

As 110 linhas do Cartão CRIA estão no sistema como indicadores para revisar: 31 linhas viram 23 indicadores do mapa de definições decididas (as faixas de classificação e os índices repetidos se juntam), mais 18 indicadores auxiliares que os compostos precisam, e as outras 79 linhas entram com pergunta e tipo sugeridos. ADMIN e GESTOR têm a tela "Indicadores" para conferir, ajustar, ativar e ver o número. O dev da SECRIA tem o passo a passo para importar na VM. Fica para o plano seguinte: o painel de indicadores (fase 4).
