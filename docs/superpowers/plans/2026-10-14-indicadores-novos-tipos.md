# Indicadores — novos tipos de cálculo: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acrescentar ao motor de indicadores os tipos `ESCALA`, `META_POR_IDADE`, `ZSCORE`, `PERCENTIL_OMS` e `ATALAH`, mover o filtro do painel para depois do cálculo individual e incluir a pergunta "Semana gestacional atual" na pesquisa Gestante publicada.

**Architecture:** Os tipos entram no catálogo Zod (`indicadorConfig.ts`) e no motor puro (`helper/motor/`). `ESCALA`, `META_POR_IDADE` e `PERCENTIL_OMS` têm valor por indivíduo (`avaliar`); `ZSCORE` precisa da distribuição da pesquisa e é calculado em `calcular`; `ATALAH` só existe na agregação, como a CLASSIFICACAO. O carregador passa a trazer todas as respostas aprovadas; uma máscara pura (`recortePainel.ts`) decide quem entra na agregação. As tabelas da OMS e de Atalah são dados versionados, gerados das fontes oficiais.

**Tech Stack:** Node, Express, TypeScript (ESM, imports relativos com `.js`), Prisma, PostgreSQL, Zod, Vitest, Supertest, ExcelJS (só no script gerador).

**Spec:** `docs/superpowers/specs/2026-10-14-indicadores-novos-tipos-design.md`

## Global Constraints

- ESM: todo import relativo termina em `.js`, inclusive para arquivos `.ts`.
- Erros de domínio via `HttpError(status, code, message, details?)` de `src/middleware/errorHandler.js`. Nunca `res.status().json()` para erro.
- O motor (`src/helper/motor/**`) não importa Prisma nem Express. Recebe dados em memória e devolve dados.
- Só respostas com `status: "APROVADA"`, `deletedAt: null` e pesquisa não apagada entram em cálculo.
- Branco (`null`/`undefined`/string vazia/array vazio) sai do numerador **e** do denominador. **Zero não é branco.**
- O motor nunca inventa número: tabela incompleta ou opção sem nota → `INCOMPLETO` com motivo; referência pequena ou desvio zero → `SEM_DADOS`; idade/semana fora da tabela → indivíduo `null`.
- Todo esquema de config é `.strict()` e todo número é `.finite()`.
- Tabelas de referência (OMS, Atalah) vêm das fontes oficiais. **Não se digita tabela de memória.** Se a fonte não puder ser obtida, pare e reporte BLOCKED.
- Testes e nomes de domínio em português, como o resto do repositório.
- Escreva arquivos com as ferramentas Write/Edit, não com heredoc no shell (o repositório tem acentuação que quebra aspas de shell).
- Banco de desenvolvimento na porta 5433 (`backend/.env`). Não suba nem derrube o banco; se der ECONNREFUSED/ECONNRESET, pare e reporte BLOCKED.
- Commits em português, no estilo do repositório, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Antes de cada commit: `cd backend && npx tsc --noEmit -p .` e os testes tocados. A suíte inteira (`npx vitest run`) roda pelo menos no fim de cada tarefa.

## Review Focus

1. **Filtro do painel movido não pode mudar número antigo.** Com qualquer filtro, PROPORCAO/MEDIA/COMPOSTO/CLASSIFICACAO/CONTAGEM/DISTRIBUICAO devem dar exatamente o que davam com o filtro no banco — teste na Tarefa 2.
2. **Resposta sem `enviadaEm` ou sem data de nascimento** (dado antigo, item em branco) → indivíduo `null`, nunca idade zero — testes nas Tarefas 3 e 6.
3. **Sexo marcado com opção fora de `opcoesSexo`** (ex.: "Intersexo", ou texto digitado diferente) → indivíduo `null`, não menino nem menina — teste na Tarefa 6.
4. **ZSCORE com o painel filtrado** usa a pesquisa inteira como referência, e a média do recorte não sai zero — teste na Tarefa 4.
5. **Pergunta que ganhou opção depois do cadastro da ESCALA** → `INCOMPLETO` "opção X sem nota", não zero — teste na Tarefa 3.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `backend/src/helper/indicadorConfig.ts` (mod) | esquemas Zod dos 5 tipos novos; referências a perguntas e indicadores |
| `backend/prisma/schema.prisma` + migration (mod/novo) | 5 valores novos em `TipoIndicador` |
| `backend/src/helper/validators.ts` (mod) | `tipo` aceita os 5 tipos novos |
| `backend/src/helper/motor/tipos.ts` (mod) | `valorData` no item; `enviadaEm`, `municipio`, `regional` na resposta |
| `backend/src/helper/motor/avaliadores.ts` (mod) | f(indivíduo) de ESCALA, META_POR_IDADE, PERCENTIL_OMS; `montarResposta` com extras |
| `backend/src/helper/motor/idade.ts` (novo) | idade em meses e dias completos (UTC) |
| `backend/src/helper/motor/padronizacao.ts` (novo) | média/desvio amostral e z-score do ZSCORE |
| `backend/src/helper/motor/referencias/oms.ts` (novo) | LMS por dia, z-score LMS, Φ(z) |
| `backend/referencias/oms-imc-idade.json` (gerado) | tabela LMS OMS, meninos e meninas, 0–1856 dias |
| `backend/src/helper/motor/referencias/atalah.ts` (novo) + `backend/referencias/atalah.json` | classificação de Atalah por semana |
| `backend/referencias/README.md` (novo) | fontes, data de obtenção, como regenerar |
| `backend/scripts/gerar-referencia-oms.ts` (novo) | gera o JSON da OMS a partir dos xlsx oficiais |
| `backend/src/helper/motor/calcular.ts` (mod) | máscara do painel; ZSCORE; ATALAH; guardas novas; substituições dos tipos novos |
| `backend/src/helper/recortePainel.ts` (novo) | máscara pura: quais respostas casam com os filtros |
| `backend/src/models/indicadorCalculoModel.ts` (mod) | carrega todas as aprovadas, com `enviadaEm`, `municipio`, `regional`, `valorData`; perguntas de sexo |
| `backend/src/controllers/indicadorController.ts` (mod) | `calculo` usa a máscara; cadastro confere perguntas dos tipos novos |
| `backend/src/helper/indicadorPerguntas.ts` (novo) | conferência pura da config contra as perguntas (tipo, opções) |
| `backend/src/models/indicadorModel.ts` (mod) | `perguntasPorId(ids)` |
| `backend/prisma/pesquisas-cartao-cria.ts`, `docs/pesquisas-cartao-cria.md` (mod) | pergunta nova na fonte da verdade |
| `backend/scripts/adicionar-semana-gestacional.ts` (novo) | inclui a pergunta na pesquisa publicada, idempotente |

---

### Task 1: Catálogo dos tipos novos

**Files:**
- Modify: `backend/src/helper/indicadorConfig.ts`
- Modify: `backend/src/helper/validators.ts` (enum `tipo` em `indicadorBaseSchema`)
- Modify: `backend/prisma/schema.prisma` (enum `TipoIndicador`)
- Create: migration `backend/prisma/migrations/<timestamp>_tipos_indicador_novos/migration.sql` (gerada pelo Prisma)
- Test: `backend/tests/indicadorConfig.test.ts`

**Interfaces:**
- Produces: `TipoIndicador` inclui `"ESCALA" | "META_POR_IDADE" | "ZSCORE" | "PERCENTIL_OMS" | "ATALAH"`; `ConfigIndicador` ganha as formas abaixo; `perguntasReferenciadas` e `indicadoresReferenciados` cobrem os campos novos.

```ts
type ConfigEscala = { tipo: "ESCALA"; perguntaId: string; notas: Record<string, number | null> };
type ConfigMetaPorIdade = { tipo: "META_POR_IDADE"; perguntaId: string; nascimentoPerguntaId: string;
  faixas: Array<{ deMeses: number; ateMeses: number | null; esperado: number }> };
type ConfigZscore = { tipo: "ZSCORE"; componentes: Array<{ indicadorId: string; peso: number }> };
type ConfigPercentilOms = { tipo: "PERCENTIL_OMS"; imcIndicadorId: string; nascimentoPerguntaId: string;
  sexoPerguntaId: string; opcoesSexo: { masculino: string; feminino: string };
  corte: { abaixoDe: number } | { acimaDe: number } };
type ConfigAtalah = { tipo: "ATALAH"; imcIndicadorId: string; semanaPerguntaId: string };
```

- [ ] **Step 1: Write the failing tests** — acrescente ao fim de `backend/tests/indicadorConfig.test.ts`:

```ts
describe("tipos novos", () => {
  it("ESCALA: aceita notas 0–100 e null; recusa nota fora da faixa ou não finita", () => {
    expect(() => validarConfig("ESCALA", { perguntaId: "p", notas: { "Antes": 100, "Após": 50, "Não soube": null } })).not.toThrow();
    expect(() => validarConfig("ESCALA", { perguntaId: "p", notas: { "A": 101 } })).toThrow();
    expect(() => validarConfig("ESCALA", { perguntaId: "p", notas: { "A": -1 } })).toThrow();
    expect(() => validarConfig("ESCALA", { perguntaId: "p", notas: { "A": Infinity } })).toThrow();
    expect(() => validarConfig("ESCALA", { perguntaId: "p", notas: {} })).toThrow();
  });

  it("META_POR_IDADE: faixas em ordem, sem sobreposição, última pode ser aberta", () => {
    const base = { perguntaId: "n", nascimentoPerguntaId: "d" };
    expect(() => validarConfig("META_POR_IDADE", { ...base, faixas: [
      { deMeses: 0, ateMeses: 12, esperado: 7 }, { deMeses: 12, ateMeses: 24, esperado: 2 }, { deMeses: 24, ateMeses: null, esperado: 1 },
    ] })).not.toThrow();
    // sobreposição
    expect(() => validarConfig("META_POR_IDADE", { ...base, faixas: [
      { deMeses: 0, ateMeses: 13, esperado: 7 }, { deMeses: 12, ateMeses: 24, esperado: 2 },
    ] })).toThrow();
    // faixa aberta no meio
    expect(() => validarConfig("META_POR_IDADE", { ...base, faixas: [
      { deMeses: 0, ateMeses: null, esperado: 7 }, { deMeses: 12, ateMeses: 24, esperado: 2 },
    ] })).toThrow();
    // esperado zero
    expect(() => validarConfig("META_POR_IDADE", { ...base, faixas: [{ deMeses: 0, ateMeses: 12, esperado: 0 }] })).toThrow();
    // de >= ate
    expect(() => validarConfig("META_POR_IDADE", { ...base, faixas: [{ deMeses: 12, ateMeses: 12, esperado: 1 }] })).toThrow();
  });

  it("ZSCORE: ao menos um componente, peso > 0", () => {
    expect(() => validarConfig("ZSCORE", { componentes: [{ indicadorId: "a", peso: 1 }] })).not.toThrow();
    expect(() => validarConfig("ZSCORE", { componentes: [] })).toThrow();
    expect(() => validarConfig("ZSCORE", { componentes: [{ indicadorId: "a", peso: 0 }] })).toThrow();
  });

  it("PERCENTIL_OMS: corte entre 1 e 99, um só lado", () => {
    const base = { imcIndicadorId: "imc", nascimentoPerguntaId: "d", sexoPerguntaId: "s", opcoesSexo: { masculino: "Masculino", feminino: "Feminino" } };
    expect(() => validarConfig("PERCENTIL_OMS", { ...base, corte: { abaixoDe: 10 } })).not.toThrow();
    expect(() => validarConfig("PERCENTIL_OMS", { ...base, corte: { acimaDe: 85 } })).not.toThrow();
    expect(() => validarConfig("PERCENTIL_OMS", { ...base, corte: { abaixoDe: 0 } })).toThrow();
    expect(() => validarConfig("PERCENTIL_OMS", { ...base, corte: { acimaDe: 100 } })).toThrow();
    expect(() => validarConfig("PERCENTIL_OMS", { ...base, corte: { abaixoDe: 10, acimaDe: 85 } })).toThrow();
    expect(() => validarConfig("PERCENTIL_OMS", { ...base, opcoesSexo: { masculino: "X", feminino: "X" }, corte: { abaixoDe: 10 } })).toThrow();
  });

  it("ATALAH: precisa do IMC e da pergunta de semana", () => {
    expect(() => validarConfig("ATALAH", { imcIndicadorId: "imc", semanaPerguntaId: "sem" })).not.toThrow();
    expect(() => validarConfig("ATALAH", { imcIndicadorId: "imc" })).toThrow();
  });

  it("referências cobrem os campos novos", () => {
    expect(perguntasReferenciadas(validarConfig("ESCALA", { perguntaId: "p", notas: { A: 1 } }))).toEqual(["p"]);
    expect(perguntasReferenciadas(validarConfig("META_POR_IDADE", { perguntaId: "n", nascimentoPerguntaId: "d",
      faixas: [{ deMeses: 0, ateMeses: null, esperado: 1 }] }))).toEqual(["n", "d"]);
    const oms = validarConfig("PERCENTIL_OMS", { imcIndicadorId: "imc", nascimentoPerguntaId: "d", sexoPerguntaId: "s",
      opcoesSexo: { masculino: "M", feminino: "F" }, corte: { abaixoDe: 10 } });
    expect(perguntasReferenciadas(oms)).toEqual(["d", "s"]);
    expect(indicadoresReferenciados(oms)).toEqual(["imc"]);
    const atalah = validarConfig("ATALAH", { imcIndicadorId: "imc", semanaPerguntaId: "sem" });
    expect(perguntasReferenciadas(atalah)).toEqual(["sem"]);
    expect(indicadoresReferenciados(atalah)).toEqual(["imc"]);
    expect(indicadoresReferenciados(validarConfig("ZSCORE", { componentes: [{ indicadorId: "a", peso: 1 }, { indicadorId: "b", peso: 1 }] })))
      .toEqual(["a", "b"]);
  });

  it("tipos novos recusam chave desconhecida (.strict)", () => {
    expect(() => validarConfig("ESCALA", { perguntaId: "p", notas: { A: 1 }, extra: 1 })).toThrow();
    expect(() => validarConfig("ATALAH", { imcIndicadorId: "imc", semanaPerguntaId: "s", extra: 1 })).toThrow();
  });
});
```

Confira que `perguntasReferenciadas` e `indicadoresReferenciados` já estão importados no topo do arquivo de teste; se não, inclua no import existente de `../src/helper/indicadorConfig.js`.

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx vitest run tests/indicadorConfig.test.ts`
Expected: FAIL — `esquemas[tipo]` indefinido para "ESCALA" etc.

- [ ] **Step 3: Implement** — em `backend/src/helper/indicadorConfig.ts`, antes de `const esquemas`:

```ts
const nota = z.number().finite().min(0).max(100);

const escala = z.object({
  tipo: z.literal("ESCALA"),
  perguntaId: id,
  // null = opção fora do cálculo (ex.: "Não soube informar").
  notas: z.record(z.string().min(1), nota.nullable()).refine((n) => Object.keys(n).length > 0, {
    message: "escala precisa de ao menos uma opção",
  }),
}).strict();

const faixaIdade = z.object({
  deMeses: z.number().int().min(0),
  // null = faixa aberta ("24 meses ou mais"); só a última pode ser aberta.
  ateMeses: z.number().int().positive().nullable(),
  esperado: z.number().finite().positive(),
}).strict();

const metaPorIdade = z.object({
  tipo: z.literal("META_POR_IDADE"),
  perguntaId: id,
  nascimentoPerguntaId: id,
  faixas: z
    .array(faixaIdade)
    .min(1)
    .refine((fs) => fs.every((f) => f.ateMeses === null || f.deMeses < f.ateMeses), { message: "faixa com início maior ou igual ao fim" })
    .refine((fs) => fs.every((f, i) => f.ateMeses !== null || i === fs.length - 1), { message: "só a última faixa pode ser aberta" })
    .refine((fs) => fs.every((f, i) => i === 0 || (fs[i - 1].ateMeses ?? Infinity) <= f.deMeses), {
      message: "faixas devem estar em ordem crescente e sem sobreposição",
    }),
}).strict();

const zscore = z.object({
  tipo: z.literal("ZSCORE"),
  componentes: z.array(z.object({ indicadorId: id, peso: z.number().finite().positive() }).strict()).min(1),
}).strict();

const percentil = z.number().finite().min(1).max(99);

const percentilOms = z.object({
  tipo: z.literal("PERCENTIL_OMS"),
  imcIndicadorId: id,
  nascimentoPerguntaId: id,
  sexoPerguntaId: id,
  opcoesSexo: z
    .object({ masculino: z.string().min(1), feminino: z.string().min(1) })
    .strict()
    .refine((o) => o.masculino !== o.feminino, { message: "opções de sexo precisam ser diferentes" }),
  corte: z.union([
    z.object({ abaixoDe: percentil }).strict(),
    z.object({ acimaDe: percentil }).strict(),
  ]),
}).strict();

const atalah = z.object({
  tipo: z.literal("ATALAH"),
  imcIndicadorId: id,
  semanaPerguntaId: id,
}).strict();
```

Acrescente ao objeto `esquemas`:

```ts
  ESCALA: escala,
  META_POR_IDADE: metaPorIdade,
  ZSCORE: zscore,
  PERCENTIL_OMS: percentilOms,
  ATALAH: atalah,
```

Substitua `perguntasReferenciadas` e `indicadoresReferenciados` por:

```ts
export function perguntasReferenciadas(config: ConfigIndicador): string[] {
  switch (config.tipo) {
    case "PROPORCAO":
    case "MEDIA":
    case "DISTRIBUICAO":
    case "ESCALA":
      return [config.perguntaId];
    case "META_POR_IDADE":
      return [config.perguntaId, config.nascimentoPerguntaId];
    case "PERCENTIL_OMS":
      return [config.nascimentoPerguntaId, config.sexoPerguntaId];
    case "ATALAH":
      return [config.semanaPerguntaId];
    case "CRUZAMENTO":
      return config.condicoes.map((c) => c.perguntaId);
    case "DERIVADA":
      return Object.values(config.variaveis);
    default:
      return [];
  }
}

export function indicadoresReferenciados(config: ConfigIndicador): string[] {
  switch (config.tipo) {
    case "COMPOSTO":
      return config.termos.map((t) => t.indicadorId);
    case "ZSCORE":
      return config.componentes.map((c) => c.indicadorId);
    case "CLASSIFICACAO":
      return [config.indicadorId];
    case "PERCENTIL_OMS":
    case "ATALAH":
      return [config.imcIndicadorId];
    default:
      return [];
  }
}
```

Em `backend/src/helper/validators.ts`, no `indicadorBaseSchema`, troque o enum de `tipo` por:

```ts
  tipo: z.enum([
    "PROPORCAO", "CRUZAMENTO", "MEDIA", "DERIVADA",
    "COMPOSTO", "CLASSIFICACAO", "CONTAGEM", "DISTRIBUICAO",
    "ESCALA", "META_POR_IDADE", "ZSCORE", "PERCENTIL_OMS", "ATALAH",
  ]),
```

Em `backend/prisma/schema.prisma`, no `enum TipoIndicador`, acrescente as cinco linhas `ESCALA`, `META_POR_IDADE`, `ZSCORE`, `PERCENTIL_OMS`, `ATALAH`.

- [ ] **Step 4: Gerar a migration e o client**

Run: `cd backend && npx prisma migrate dev --name tipos_indicador_novos`
Expected: migration criada com cinco `ALTER TYPE "TipoIndicador" ADD VALUE ...`, aplicada no banco 5433, client regenerado.

- [ ] **Step 5: Run tests**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run tests/indicadorConfig.test.ts tests/indicadorSchema.test.ts tests/validators.test.ts`
Expected: PASS. Se `tsc` acusar `switch` não exaustivo em `calcular.ts` ou `avaliadores.ts`, é esperado só se algum `switch` usar `never`; os atuais usam `default` e devem compilar.

- [ ] **Step 6: Commit**

```bash
git add backend/src/helper/indicadorConfig.ts backend/src/helper/validators.ts backend/prisma/schema.prisma backend/prisma/migrations backend/tests/indicadorConfig.test.ts
git commit -m "feat: catalogo ganha ESCALA, META_POR_IDADE, ZSCORE, PERCENTIL_OMS e ATALAH"
```

---

### Task 2: Filtro do painel depois do cálculo

**Files:**
- Modify: `backend/src/helper/motor/tipos.ts`
- Modify: `backend/src/helper/motor/avaliadores.ts` (`montarResposta`)
- Create: `backend/src/helper/recortePainel.ts`
- Modify: `backend/src/helper/motor/calcular.ts`
- Modify: `backend/src/models/indicadorCalculoModel.ts`
- Modify: `backend/src/controllers/indicadorController.ts` (`calculo`)
- Test: `backend/tests/recortePainel.test.ts` (novo), `backend/tests/motorCalcular.test.ts`, `backend/tests/indicadorCalculoModel.test.ts`, `backend/tests/indicadoresCalculo.test.ts`

**Interfaces:**
- Consumes: `FiltrosIndicador` de `src/helper/filtrosIndicador.ts` (`pesquisaId`, `municipio`, `regional`, `sexo`, `de`, `ate` — `ate` só com data já vem como fim do dia).
- Produces:
  - `ItemAvaliavel.valorData?: Date | null`
  - `RespostaAvaliavel.enviadaEm: Date | null`, `municipio?: string | null`, `regional?: string | null`
  - `montarResposta(id, itens, pesquisaId = null, extras: { enviadaEm?: Date | null; municipio?: string | null; regional?: string | null } = {})`
  - `mascaraDoRecorte(respostas: RespostaAvaliavel[], filtros: FiltrosIndicador, perguntasSexo: Set<string>): boolean[]`
  - `calcular(indicadores, respostas, perguntasExistentes, mascara?: boolean[])` — `mascara` ausente = todas as respostas no recorte.
  - `indicadorCalculoModel.carregarRespostas(): Promise<RespostaAvaliavel[]>` (sem filtros) e `indicadorCalculoModel.perguntasDeSexo(): Promise<Set<string>>`.

Nota de nome: a spec chama a máscara de `recorte`, mas `IndicadorParaCalculo.recorte` já é o ANTES/APÓS. No código ela se chama **`mascara`**.

- [ ] **Step 1: Write the failing test da máscara** — `backend/tests/recortePainel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mascaraDoRecorte } from "../src/helper/recortePainel.js";
import { montarResposta } from "../src/helper/motor/avaliadores.js";

const SEXO = "sexo";
function resp(id: string, extras: { pesquisaId?: string; municipio?: string; regional?: string; enviadaEm?: string; sexo?: string }) {
  return montarResposta(
    id,
    extras.sexo ? [{ perguntaId: SEXO, opcoesSelecionadas: [extras.sexo] }] : [],
    extras.pesquisaId ?? "p1",
    { municipio: extras.municipio ?? null, regional: extras.regional ?? null, enviadaEm: extras.enviadaEm ? new Date(extras.enviadaEm) : null },
  );
}

const R = [
  resp("a", { municipio: "Maceió", regional: "1ª", enviadaEm: "2026-03-10T12:00:00Z", sexo: "Feminino" }),
  resp("b", { municipio: "Arapiraca", regional: "7ª", enviadaEm: "2026-03-31T23:30:00Z", sexo: "Masculino" }),
  resp("c", { pesquisaId: "p2", municipio: "Maceió", regional: "1ª", enviadaEm: "2026-04-01T00:00:00Z" }),
];

describe("mascaraDoRecorte", () => {
  it("sem filtros: todas", () => {
    expect(mascaraDoRecorte(R, {}, new Set([SEXO]))).toEqual([true, true, true]);
  });
  it("pesquisa, município e regional", () => {
    expect(mascaraDoRecorte(R, { pesquisaId: "p1" }, new Set())).toEqual([true, true, false]);
    expect(mascaraDoRecorte(R, { municipio: "Maceió" }, new Set())).toEqual([true, false, true]);
    expect(mascaraDoRecorte(R, { regional: "7ª" }, new Set())).toEqual([false, true, false]);
  });
  it("período inclusivo nas duas pontas", () => {
    const de = new Date("2026-03-10T12:00:00Z");
    const ate = new Date("2026-03-31T23:59:59.999Z");
    expect(mascaraDoRecorte(R, { de, ate }, new Set())).toEqual([true, true, false]);
  });
  it("resposta sem data fica fora quando há filtro de período", () => {
    const semData = [resp("x", {})];
    expect(mascaraDoRecorte(semData, { de: new Date("2026-01-01") }, new Set())).toEqual([false]);
    expect(mascaraDoRecorte(semData, {}, new Set())).toEqual([true]);
  });
  it("sexo pela opção marcada em qualquer pergunta de sexo", () => {
    expect(mascaraDoRecorte(R, { sexo: "Feminino" }, new Set([SEXO]))).toEqual([true, false, false]);
  });
});
```

- [ ] **Step 2: Write the failing test do motor com máscara** — acrescente a `backend/tests/motorCalcular.test.ts`:

```ts
describe("máscara do painel", () => {
  const indicadores = [
    ind({ id: "vcras", tipo: "PROPORCAO", config: { perguntaId: "cras", opcoesNumerador: ["Sim"] } }),
    ind({ id: "total", tipo: "CONTAGEM", config: {} }),
    ind({ id: "mccM", tipo: "COMPOSTO", config: { termos: [{ indicadorId: "vcras", peso: 1 }], divisor: 1 } }),
  ];
  const respostas = [crianca("A", "Sim", "Sim", "Sim"), crianca("B", "Não", "Sim", "Não"), crianca("C", "Sim", "Não", "Sim")];
  let comMascara: Map<string, unknown>;
  let semMascara: Map<string, unknown>;

  beforeAll(() => {
    comMascara = calcular(indicadores, respostas, PERGUNTAS, [true, true, false]);
    semMascara = calcular(indicadores, respostas.slice(0, 2), PERGUNTAS);
  });

  it("agrega só quem está na máscara", () => {
    expect(comMascara.get("vcras")).toEqual({ status: "OK", valor: 50 });
    expect(comMascara.get("total")).toEqual({ status: "OK", valor: 2 });
    expect(comMascara.get("mccM")).toEqual({ status: "OK", valor: 50 });
  });

  it("dá o mesmo número que filtrar as respostas antes", () => {
    expect(comMascara).toEqual(semMascara);
  });

  it("sem máscara: todas", () => {
    expect(calcular(indicadores, respostas, PERGUNTAS).get("total")).toEqual({ status: "OK", valor: 3 });
  });
});
```

- [ ] **Step 3: Run to verify failures**

Run: `cd backend && npx vitest run tests/recortePainel.test.ts tests/motorCalcular.test.ts`
Expected: FAIL — `recortePainel.js` não existe; `calcular` ignora o 4º argumento.

- [ ] **Step 4: Tipos e `montarResposta`** — em `backend/src/helper/motor/tipos.ts`:

```ts
/** Uma resposta reduzida ao que o motor precisa: nada de Prisma aqui dentro. */
export interface ItemAvaliavel {
  valorTexto?: string | null;
  valorNumero?: number | null;
  valorData?: Date | null;
  opcoesSelecionadas?: string[] | null;
}

export interface RespostaAvaliavel {
  id: string;
  /** Pesquisa de origem: indicador com pesquisaId só enxerga as respostas dela. */
  pesquisaId: string | null;
  /** Data da entrevista: base da idade (META_POR_IDADE, PERCENTIL_OMS). */
  enviadaEm: Date | null;
  /** Só a máscara do painel lê estes dois; o motor não. */
  municipio?: string | null;
  regional?: string | null;
  itens: Map<string, ItemAvaliavel>;
}
```

Em `backend/src/helper/motor/avaliadores.ts`, troque `montarResposta` por:

```ts
export function montarResposta(
  id: string,
  itens: Array<ItemAvaliavel & { perguntaId: string }>,
  pesquisaId: string | null = null,
  extras: { enviadaEm?: Date | null; municipio?: string | null; regional?: string | null } = {},
): RespostaAvaliavel {
  const mapa = new Map<string, ItemAvaliavel>();
  for (const { perguntaId, ...item } of itens) {
    if (mapa.has(perguntaId)) throw new ItemDuplicado(id, perguntaId);
    mapa.set(perguntaId, item);
  }
  return {
    id,
    pesquisaId,
    enviadaEm: extras.enviadaEm ?? null,
    municipio: extras.municipio ?? null,
    regional: extras.regional ?? null,
    itens: mapa,
  };
}
```

- [ ] **Step 5: Máscara** — `backend/src/helper/recortePainel.ts`:

```ts
import type { FiltrosIndicador } from "./filtrosIndicador.js";
import type { RespostaAvaliavel } from "./motor/tipos.js";

/**
 * Quais respostas entram na agregação do painel. O motor calcula o indivíduo
 * sobre a base inteira (o ZSCORE precisa dela como referência) e só agrega
 * onde a máscara é true. Mesmas regras que o `where` do banco aplicava.
 */
export function mascaraDoRecorte(
  respostas: RespostaAvaliavel[],
  filtros: FiltrosIndicador,
  perguntasSexo: Set<string>,
): boolean[] {
  return respostas.map((r) => {
    if (filtros.pesquisaId && r.pesquisaId !== filtros.pesquisaId) return false;
    if (filtros.municipio && r.municipio !== filtros.municipio) return false;
    if (filtros.regional && r.regional !== filtros.regional) return false;
    if (filtros.de || filtros.ate) {
      if (!r.enviadaEm) return false;
      const t = r.enviadaEm.getTime();
      if (filtros.de && t < filtros.de.getTime()) return false;
      if (filtros.ate && t > filtros.ate.getTime()) return false;
    }
    if (filtros.sexo) {
      const marcou = [...perguntasSexo].some((p) => r.itens.get(p)?.opcoesSelecionadas?.includes(filtros.sexo!) ?? false);
      if (!marcou) return false;
    }
    return true;
  });
}
```

- [ ] **Step 6: `calcular` com máscara** — em `backend/src/helper/motor/calcular.ts`:

1. Assinatura:
```ts
export function calcular(
  indicadores: IndicadorParaCalculo[],
  respostas: RespostaAvaliavel[],
  perguntasExistentes: Set<string>,
  mascara: boolean[] = respostas.map(() => true),
): Map<string, ResultadoComRecorte> {
```
2. Troque o bloco `const noEscopo = ...` por:
```ts
    // Fora da pesquisa do indicador vale como branco. A avaliação usa `daPesquisa`
    // (a referência do ZSCORE é a pesquisa inteira); a agregação usa `noEscopo`,
    // que também respeita a máscara do painel.
    const daPesquisa = respostas.map((r) => indicador.pesquisaId == null || r.pesquisaId === indicador.pesquisaId);
    const noEscopo = daPesquisa.map((dentro, i) => dentro && mascara[i] === true);
```
3. Em `calcularCenario`, a avaliação passa a usar `daPesquisa`, e a agregação recebe os valores mascarados:
```ts
    const calcularCenario = (cfg: ConfigIndicador, lerValores: LerValores) => {
      const valores = respostas.map((resposta, indice) => {
        if (!daPesquisa[indice]) return null;
        const deps = new Map<string, ValorIndividual>();
        for (const depId of dependencias) {
          // Posição, não busca: o valor do MCC da criança i está em valores[i].
          deps.set(depId, lerValores(depId)?.[indice] ?? null);
        }
        return avaliar(cfg, resposta, deps);
      });
      const naAgregacao = valores.map((v, i) => (noEscopo[i] ? v : null));
      return { valores, resultado: agregarPorTipo(cfg, naAgregacao, respostas, noEscopo, indicador.casasDecimais, lerValores) };
    };
```
(`valoresAntes`/`valoresApos` continuam guardando `valores` — sem máscara — porque quem depende deste indicador precisa da pesquisa inteira.)

- [ ] **Step 7: Carregador** — `backend/src/models/indicadorCalculoModel.ts`:

```ts
import { prisma } from "../config/prisma.js";
import { montarResposta, type RespostaAvaliavel } from "../helper/motor/avaliadores.js";

export const indicadorCalculoModel = {
  /**
   * Todas as respostas aprovadas, não excluídas e de pesquisa não excluída.
   * Os filtros do painel não vão para o banco: o ZSCORE precisa da pesquisa
   * inteira como referência, e a máscara (recortePainel.ts) decide quem agrega.
   */
  async carregarRespostas(): Promise<RespostaAvaliavel[]> {
    const respostas = await prisma.resposta.findMany({
      where: { deletedAt: null, status: "APROVADA", pesquisa: { deletedAt: null } },
      select: {
        id: true,
        pesquisaId: true,
        enviadaEm: true,
        municipio: true,
        regional: true,
        itens: {
          select: { perguntaId: true, valorTexto: true, valorNumero: true, valorData: true, opcoesSelecionadas: true },
        },
      },
    });

    return respostas.map((r) =>
      montarResposta(r.id, r.itens, r.pesquisaId, { enviadaEm: r.enviadaEm, municipio: r.municipio, regional: r.regional }),
    );
  },

  /** Sexo é resposta a pergunta: mesma regra do filtro antigo (enunciado contém "Sexo biológico"). */
  async perguntasDeSexo(): Promise<Set<string>> {
    const perguntas = await prisma.pergunta.findMany({
      where: { enunciado: { contains: "Sexo biológico", mode: "insensitive" } },
      select: { id: true },
    });
    return new Set(perguntas.map((p) => p.id));
  },

  async perguntasExistentes(): Promise<Set<string>> {
    const perguntas = await prisma.pergunta.findMany({ select: { id: true } });
    return new Set(perguntas.map((p) => p.id));
  },
};
```

- [ ] **Step 8: Endpoint** — em `indicadorController.calculo`, troque o `Promise.all` e a chamada de `calcular`:

```ts
  const [indicadores, respostas, perguntas, perguntasSexo] = await Promise.all([
    indicadorModel.listarAtivos(),
    indicadorCalculoModel.carregarRespostas(),
    indicadorCalculoModel.perguntasExistentes(),
    indicadorCalculoModel.perguntasDeSexo(),
  ]).catch((erro: unknown) => {
```
(mantenha o `catch` de `ItemDuplicado` como está) e
```ts
    calculados = calcular(paraCalculo, respostas, perguntas, mascaraDoRecorte(respostas, filtros, perguntasSexo));
```
Importe `mascaraDoRecorte` de `../helper/recortePainel.js`.

- [ ] **Step 9: Ajustar os testes do carregador e do endpoint**

Em `backend/tests/indicadorCalculoModel.test.ts`:
- o mock de prisma ganha `pergunta.findMany` (já existe);
- testes que passavam filtros a `carregarRespostas(...)` e conferiam o `where` com `municipio`/`regional`/`enviadaEm`/`itens.some` são **removidos** — essa regra agora está em `recortePainel.test.ts`;
- fica o teste do `where` base (`{ deletedAt: null, status: "APROVADA", pesquisa: { deletedAt: null } }`), chamado sem argumentos;
- acrescente: o `select` pede `enviadaEm`, `municipio`, `regional` e `itens.select.valorData`, e a resposta montada carrega `enviadaEm`:

```ts
  it("carrega enviadaEm, município, regional e valorData", async () => {
    const enviada = new Date("2026-03-01T10:00:00Z");
    vi.mocked(prisma.resposta.findMany).mockResolvedValue([
      { id: "r1", pesquisaId: "ps1", enviadaEm: enviada, municipio: "Maceió", regional: "1ª",
        itens: [{ perguntaId: "nasc", valorTexto: null, valorNumero: null, valorData: new Date("2025-01-01"), opcoesSelecionadas: [] }] },
    ] as never);
    const [r] = await indicadorCalculoModel.carregarRespostas();
    expect(r.enviadaEm).toEqual(enviada);
    expect(r.municipio).toBe("Maceió");
    expect(r.itens.get("nasc")?.valorData).toEqual(new Date("2025-01-01"));
  });

  it("perguntasDeSexo procura pelo enunciado", async () => {
    vi.mocked(prisma.pergunta.findMany).mockResolvedValue([{ id: "s1" }, { id: "s2" }] as never);
    expect(await indicadorCalculoModel.perguntasDeSexo()).toEqual(new Set(["s1", "s2"]));
    expect(vi.mocked(prisma.pergunta.findMany).mock.calls[0]![0]).toEqual({
      where: { enunciado: { contains: "Sexo biológico", mode: "insensitive" } },
      select: { id: true },
    });
  });
```

Em `backend/tests/indicadoresCalculo.test.ts` (que mocka `indicadorCalculoModel`): todo `beforeEach` que configura `carregarRespostas` precisa também de `vi.mocked(indicadorCalculoModel.perguntasDeSexo).mockResolvedValue(new Set())`; qualquer `toHaveBeenCalledWith(filtros)` em `carregarRespostas` vira `toHaveBeenCalledWith()`. Acrescente um teste de que o filtro chega à agregação:

```ts
  it("filtro de município agrega só as respostas do município", async () => {
    vi.mocked(indicadorCalculoModel.carregarRespostas).mockResolvedValue([
      montarResposta("r1", [{ perguntaId: "p1", opcoesSelecionadas: ["Sim"] }], "ps1", { municipio: "Maceió" }),
      montarResposta("r2", [{ perguntaId: "p1", opcoesSelecionadas: ["Não"] }], "ps1", { municipio: "Arapiraca" }),
    ]);
    // use aqui o mesmo indicador PROPORCAO sobre "p1" com numerador ["Sim"] que o arquivo já monta no beforeEach;
    // ajuste o código abaixo para o código desse indicador.
    const res = await request(app).get("/api/indicadores/calculo?municipio=Maceió").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(Object.values(res.body.resultados)).toContainEqual({ status: "OK", valor: 100 });
  });
```

Leia o `beforeEach` do arquivo antes: ele já monta indicadores e respostas; adapte nomes e o código do indicador ao que existir lá, sem mudar o que os testes atuais afirmam.

Procure outros usos: `grep -rn "carregarRespostas" backend/src backend/tests` — todo chamador passa a chamar sem argumento.

- [ ] **Step 10: Run**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run`
Expected: PASS na suíte inteira. Nenhuma expectativa numérica dos testes antigos do motor pode ter mudado.

- [ ] **Step 11: Commit**

```bash
git add backend/src backend/tests
git commit -m "refactor: filtro do painel passa a atuar depois do calculo individual"
```

---

### Task 3: ESCALA e META_POR_IDADE

**Files:**
- Create: `backend/src/helper/motor/idade.ts`
- Modify: `backend/src/helper/motor/avaliadores.ts`
- Modify: `backend/src/helper/motor/calcular.ts` (guarda de opção sem nota; substituições)
- Test: `backend/tests/motorIdade.test.ts` (novo), `backend/tests/motorAvaliadores.test.ts`, `backend/tests/motorCalcular.test.ts`

**Interfaces:**
- Produces: `mesesCompletos(nascimento: Date, referencia: Date): number`, `diasCompletos(nascimento: Date, referencia: Date): number` (ambos em UTC; negativo se `referencia` < `nascimento`).
- Produces: `avaliar` trata `ESCALA` e `META_POR_IDADE`; `opcaoSemNota(config: ConfigEscala, respostas: RespostaAvaliavel[]): string | null` exportada de `avaliadores.ts`.

- [ ] **Step 1: Failing tests de idade** — `backend/tests/motorIdade.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mesesCompletos, diasCompletos } from "../src/helper/motor/idade.js";

const d = (s: string) => new Date(s);

describe("idade", () => {
  it("meses completos", () => {
    expect(mesesCompletos(d("2025-07-01"), d("2026-01-01T15:00:00Z"))).toBe(6);
    expect(mesesCompletos(d("2025-07-15"), d("2026-01-14T15:00:00Z"))).toBe(5);
    expect(mesesCompletos(d("2025-07-15"), d("2026-01-15T00:00:00Z"))).toBe(6);
    expect(mesesCompletos(d("2024-07-01"), d("2026-01-01"))).toBe(18);
    expect(mesesCompletos(d("2026-02-01"), d("2026-01-01"))).toBe(-1);
  });
  it("dias completos", () => {
    expect(diasCompletos(d("2025-01-01"), d("2026-01-01T10:00:00Z"))).toBe(365);
    expect(diasCompletos(d("2024-01-02"), d("2026-01-01"))).toBe(730);
    expect(diasCompletos(d("2026-01-02"), d("2026-01-01"))).toBe(-1);
  });
});
```

- [ ] **Step 2: Failing tests dos avaliadores** — acrescente a `backend/tests/motorAvaliadores.test.ts` (use o import já existente de `avaliar`, `montarResposta` e `validarConfig`; se `validarConfig` não estiver importado, importe de `../src/helper/indicadorConfig.js`):

```ts
describe("ESCALA", () => {
  const cfg = validarConfig("ESCALA", {
    perguntaId: "pn",
    notas: { "Antes de 12": 100, "Após 12": 50, "Sem pré-natal": 0, "Não soube": null },
  });
  const r = (op?: string[]) => montarResposta("r", op ? [{ perguntaId: "pn", opcoesSelecionadas: op }] : []);
  it("nota da opção", () => {
    expect(avaliar(cfg, r(["Antes de 12"]), new Map())).toBe(100);
    expect(avaliar(cfg, r(["Após 12"]), new Map())).toBe(50);
    expect(avaliar(cfg, r(["Sem pré-natal"]), new Map())).toBe(0);
  });
  it("opção com nota null, branco ou marcação múltipla = fora", () => {
    expect(avaliar(cfg, r(["Não soube"]), new Map())).toBeNull();
    expect(avaliar(cfg, r(), new Map())).toBeNull();
    expect(avaliar(cfg, r([]), new Map())).toBeNull();
    expect(avaliar(cfg, r(["Antes de 12", "Após 12"]), new Map())).toBeNull();
  });
  it("opção desconhecida não vira número (o calcular marca INCOMPLETO)", () => {
    expect(avaliar(cfg, r(["Opção nova"]), new Map())).toBeNull();
    expect(opcaoSemNota(cfg as never, [r(["Antes de 12"]), r(["Opção nova"])])).toBe("Opção nova");
    expect(opcaoSemNota(cfg as never, [r(["Antes de 12"]), r(["Não soube"])])).toBeNull();
  });
});

describe("META_POR_IDADE", () => {
  const cfg = validarConfig("META_POR_IDADE", {
    perguntaId: "consultas",
    nascimentoPerguntaId: "nasc",
    faixas: [
      { deMeses: 0, ateMeses: 12, esperado: 7 },
      { deMeses: 12, ateMeses: 24, esperado: 2 },
      { deMeses: 24, ateMeses: null, esperado: 1 },
    ],
  });
  const entrevista = new Date("2026-01-01T12:00:00Z");
  const r = (nasc: string | null, consultas: number | null, enviadaEm: Date | null = entrevista) =>
    montarResposta(
      "r",
      [
        ...(nasc ? [{ perguntaId: "nasc", valorData: new Date(nasc) }] : []),
        ...(consultas !== null ? [{ perguntaId: "consultas", valorNumero: consultas }] : []),
      ],
      null,
      { enviadaEm },
    );
  it("proporcional ao esperado da faixa, teto 100", () => {
    expect(avaliar(cfg, r("2025-07-01", 4), new Map())).toBeCloseTo(400 / 7, 10); // 6 meses: 4 de 7
    expect(avaliar(cfg, r("2024-07-01", 2), new Map())).toBe(100); // 18 meses: 2 de 2
    expect(avaliar(cfg, r("2023-07-01", 3), new Map())).toBe(100); // 30 meses: teto
  });
  it("zero consultas é zero, não branco", () => {
    expect(avaliar(cfg, r("2023-07-01", 0), new Map())).toBe(0);
  });
  it("sem nascimento, sem consultas, sem data da entrevista ou idade negativa = null", () => {
    expect(avaliar(cfg, r(null, 3), new Map())).toBeNull();
    expect(avaliar(cfg, r("2025-07-01", null), new Map())).toBeNull();
    expect(avaliar(cfg, r("2025-07-01", 3, null), new Map())).toBeNull();
    expect(avaliar(cfg, r("2026-06-01", 3), new Map())).toBeNull();
  });
  it("idade fora de todas as faixas = null", () => {
    const fechada = validarConfig("META_POR_IDADE", {
      perguntaId: "consultas", nascimentoPerguntaId: "nasc", faixas: [{ deMeses: 0, ateMeses: 12, esperado: 7 }],
    });
    expect(avaliar(fechada, r("2024-07-01", 2), new Map())).toBeNull();
  });
});
```

Importe `opcaoSemNota` junto com `avaliar` de `../src/helper/motor/avaliadores.js`.

- [ ] **Step 3: Failing test no calcular** — acrescente a `backend/tests/motorCalcular.test.ts`:

```ts
describe("ESCALA no calcular", () => {
  it("opção marcada sem nota vira INCOMPLETO, não zero", () => {
    const cpre = ind({ id: "cpre", tipo: "ESCALA", config: { perguntaId: "cras", notas: { Sim: 100, "Não": 0 } } });
    const respostas = [
      montarResposta("a", [{ perguntaId: "cras", opcoesSelecionadas: ["Sim"] }]),
      montarResposta("b", [{ perguntaId: "cras", opcoesSelecionadas: ["Talvez"] }]),
    ];
    expect(calcular([cpre], respostas, PERGUNTAS).get("cpre")).toEqual({
      status: "INCOMPLETO",
      motivo: 'opção "Talvez" sem nota na escala',
    });
  });
  it("média das notas", () => {
    const cpre = ind({ id: "cpre", tipo: "ESCALA", config: { perguntaId: "cras", notas: { Sim: 100, "Não": 50, Talvez: null } } });
    const respostas = ["Sim", "Não", "Talvez"].map((o, i) => montarResposta(String(i), [{ perguntaId: "cras", opcoesSelecionadas: [o] }]));
    expect(calcular([cpre], respostas, PERGUNTAS).get("cpre")).toEqual({ status: "OK", valor: 75 });
  });
});
```

- [ ] **Step 4: Run to verify failures**

Run: `cd backend && npx vitest run tests/motorIdade.test.ts tests/motorAvaliadores.test.ts tests/motorCalcular.test.ts`
Expected: FAIL — `idade.js` e `opcaoSemNota` não existem; ESCALA/META devolvem null.

- [ ] **Step 5: Implement idade** — `backend/src/helper/motor/idade.ts`:

```ts
/**
 * Idade na data da entrevista, em UTC. `valorData` é gravado como data pura
 * (meia-noite UTC), então UTC evita perder um dia no fuso de Alagoas.
 */
export function mesesCompletos(nascimento: Date, referencia: Date): number {
  let meses =
    (referencia.getUTCFullYear() - nascimento.getUTCFullYear()) * 12 + (referencia.getUTCMonth() - nascimento.getUTCMonth());
  if (referencia.getUTCDate() < nascimento.getUTCDate()) meses -= 1;
  return meses;
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export function diasCompletos(nascimento: Date, referencia: Date): number {
  const inicio = Date.UTC(nascimento.getUTCFullYear(), nascimento.getUTCMonth(), nascimento.getUTCDate());
  const fim = Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), referencia.getUTCDate());
  return Math.round((fim - inicio) / UM_DIA_MS);
}
```

- [ ] **Step 6: Implement avaliadores** — em `backend/src/helper/motor/avaliadores.ts`, importe `mesesCompletos` de `./idade.js` e acrescente, antes do `default` do `switch` de `avaliar`:

```ts
    case "ESCALA": {
      const selecionadas = opcoes(resposta.itens.get(config.perguntaId));
      if (selecionadas.length !== 1) return null;
      const nota = config.notas[selecionadas[0]];
      // undefined = opção sem nota: o calcular marca o indicador INCOMPLETO antes de agregar.
      return nota === undefined ? null : nota;
    }

    case "META_POR_IDADE": {
      const consultas = resposta.itens.get(config.perguntaId);
      const nascimento = resposta.itens.get(config.nascimentoPerguntaId)?.valorData;
      if (!temNumero(consultas) || !nascimento || !resposta.enviadaEm) return null;
      const meses = mesesCompletos(nascimento, resposta.enviadaEm);
      if (meses < 0) return null;
      const faixa = config.faixas.find((f) => meses >= f.deMeses && (f.ateMeses === null || meses < f.ateMeses));
      if (!faixa) return null;
      return Math.min(100, (consultas.valorNumero / faixa.esperado) * 100);
    }
```

E exporte, no mesmo arquivo:

```ts
/** Primeira opção marcada que a escala não conhece; null se todas têm nota (ou são "fora"). */
export function opcaoSemNota(
  config: Extract<ConfigIndicador, { tipo: "ESCALA" }>,
  respostas: RespostaAvaliavel[],
): string | null {
  for (const resposta of respostas) {
    for (const opcao of opcoes(resposta.itens.get(config.perguntaId))) {
      if (!Object.hasOwn(config.notas, opcao)) return opcao;
    }
  }
  return null;
}
```

- [ ] **Step 7: Guarda no calcular e substituições** — em `backend/src/helper/motor/calcular.ts`:

1. Importe `opcaoSemNota` de `./avaliadores.js`.
2. Logo depois do passo 3 (pergunta que não existe mais), acrescente:
```ts
    // 3b. Escala que não conhece uma opção marcada: a pergunta ganhou opção depois
    //     do cadastro. Tratar como branco tiraria gente do denominador em silêncio.
    if (config.tipo === "ESCALA") {
      const daPesquisaAqui = respostas.filter((r) => indicador.pesquisaId == null || r.pesquisaId === indicador.pesquisaId);
      const semNota = opcaoSemNota(config, daPesquisaAqui);
      if (semNota) {
        marcarIncompleto(id, `opção "${semNota}" sem nota na escala`, id);
        continue;
      }
    }
```
3. Em `aplicarSubstituicoes`, acrescente os casos (antes do `default`):
```ts
    case "ESCALA":
      return { ...config, perguntaId: trocar(config.perguntaId) };
    case "META_POR_IDADE":
      return { ...config, perguntaId: trocar(config.perguntaId), nascimentoPerguntaId: trocar(config.nascimentoPerguntaId) };
```

- [ ] **Step 8: Run**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run tests/motorIdade.test.ts tests/motorAvaliadores.test.ts tests/motorCalcular.test.ts`
Expected: PASS.

Verificação por mutação (reporte a tabela guarda → teste): remova, uma de cada vez, (a) `selecionadas.length !== 1`, (b) `nota === undefined ? null`, (c) `meses < 0`, (d) `Math.min(100, ...)`, (e) a guarda 3b — confirme que exatamente o teste correspondente fica vermelho e restaure.

- [ ] **Step 9: Commit**

```bash
git add backend/src/helper/motor backend/tests
git commit -m "feat: indicadores ESCALA e META_POR_IDADE"
```

---

### Task 4: ZSCORE

**Files:**
- Create: `backend/src/helper/motor/padronizacao.ts`
- Modify: `backend/src/helper/motor/calcular.ts`
- Test: `backend/tests/motorPadronizacao.test.ts` (novo), `backend/tests/motorCalcular.test.ts`

**Interfaces:**
- Produces: `estatisticas(valores: number[]): { media: number; desvio: number } | null` (null se < 2 valores ou desvio 0; desvio amostral, n − 1).
- Produces: em `calcular`, ZSCORE calculado contra `daPesquisa` (não contra a máscara); consumidor COMPOSTO/CLASSIFICACAO de um ZSCORE → INCOMPLETO.

- [ ] **Step 1: Failing tests**

`backend/tests/motorPadronizacao.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { estatisticas } from "../src/helper/motor/padronizacao.js";

describe("estatisticas", () => {
  it("média e desvio amostral", () => {
    expect(estatisticas([10, 20, 30])).toEqual({ media: 20, desvio: 10 });
    const e = estatisticas([5, 5, 20])!;
    expect(e.media).toBe(10);
    expect(e.desvio).toBeCloseTo(Math.sqrt(75), 12);
  });
  it("menos de 2 valores ou desvio zero = null", () => {
    expect(estatisticas([])).toBeNull();
    expect(estatisticas([7])).toBeNull();
    expect(estatisticas([4, 4, 4])).toBeNull();
  });
});
```

Acrescente a `backend/tests/motorCalcular.test.ts` (o cálculo feito à mão está no comentário):

```ts
/**
 * ZSCORE à mão. X = [10, 20, 30] (média 20, desvio 10) -> z = [-1, 0, 1].
 * Y = [5, 5, 20] (média 10, desvio √75 = 8.660254) -> z = [-0.577350, -0.577350, 1.154701].
 * Índice (pesos iguais) = média dos z = [-0.788675, -0.288675, 1.077350]; média geral = 0.
 * Com a máscara só na 3ª resposta, o recorte vale 1.08 — a referência continua sendo as três.
 */
describe("ZSCORE", () => {
  const P = new Set(["x", "y"]);
  const base = [
    ind({ id: "x", tipo: "MEDIA", config: { perguntaId: "x" } }),
    ind({ id: "y", tipo: "MEDIA", config: { perguntaId: "y" } }),
    ind({ id: "ise", tipo: "ZSCORE", config: { componentes: [{ indicadorId: "x", peso: 1 }, { indicadorId: "y", peso: 1 }] } }),
  ];
  const r = (id: string, x: number | null, y: number) =>
    montarResposta(id, [...(x === null ? [] : [{ perguntaId: "x", valorNumero: x }]), { perguntaId: "y", valorNumero: y }]);
  const tres = [r("a", 10, 5), r("b", 20, 5), r("c", 30, 20)];

  it("média geral da referência é zero", () => {
    // Soma de ponto flutuante pode dar -0 ou 1e-17: confere o valor com tolerância, não com toEqual.
    const r = calcular(base, tres, P).get("ise") as { status: string; valor: number };
    expect(r.status).toBe("OK");
    expect(Math.abs(r.valor)).toBeLessThan(0.005);
  });

  it("recorte filtrado compara com a pesquisa inteira", () => {
    expect(calcular(base, tres, P, [false, false, true]).get("ise")).toEqual({ status: "OK", valor: 1.08 });
  });

  it("indivíduo sem um componente fica fora, e sai da referência daquele componente", () => {
    // X só tem a e c: [10, 30] -> média 20, desvio √200; z_a = -0.707107, z_c = 0.707107.
    // Y das três: z como acima. b não tem X -> null. Índice: a = (-0.707107 - 0.577350)/2, c = (0.707107 + 1.154701)/2.
    const res = calcular(base, [r("a", 10, 5), r("b", null, 5), r("c", 30, 20)], P).get("ise");
    const esperado = ((-0.707107 - 0.57735) / 2 + (0.707107 + 1.154701) / 2) / 2;
    expect(res).toEqual({ status: "OK", valor: Math.round(esperado * 100) / 100 });
  });

  it("referência pequena = SEM_DADOS", () => {
    expect(calcular(base, [r("a", 10, 5)], P).get("ise")).toEqual({ status: "SEM_DADOS" });
  });

  it("ZSCORE como termo de COMPOSTO ou fonte de CLASSIFICACAO = INCOMPLETO", () => {
    const comp = ind({ id: "c", tipo: "COMPOSTO", config: { termos: [{ indicadorId: "ise", peso: 1 }], divisor: 1 } });
    const cls = ind({ id: "k", tipo: "CLASSIFICACAO", config: { indicadorId: "ise", faixas: [{ rotulo: "a", de: -5, ate: 5 }] } });
    const res = calcular([...base, comp, cls], tres, P);
    expect(res.get("c")).toEqual({ status: "INCOMPLETO", motivo: "depende de ise, que não está em 0–100", dependencia: "ise" });
    expect(res.get("k")).toEqual({ status: "INCOMPLETO", motivo: "depende de ise, que não está em 0–100", dependencia: "ise" });
  });
});
```

Se o terceiro teste divergir na 2ª casa por arredondamento intermediário, recalcule o esperado no próprio teste a partir de `estatisticas` em vez de constantes — mas **não** troque `toEqual` por tolerância no valor final.

- [ ] **Step 2: Run to verify failures**

Run: `cd backend && npx vitest run tests/motorPadronizacao.test.ts tests/motorCalcular.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — `backend/src/helper/motor/padronizacao.ts`:

```ts
/** Média e desvio-padrão amostral (n − 1). Sem base para padronizar: null. */
export function estatisticas(valores: number[]): { media: number; desvio: number } | null {
  if (valores.length < 2) return null;
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const variancia = valores.reduce((s, v) => s + (v - media) ** 2, 0) / (valores.length - 1);
  const desvio = Math.sqrt(variancia);
  return desvio > 0 && Number.isFinite(desvio) ? { media, desvio } : null;
}
```

Em `backend/src/helper/motor/calcular.ts`:

1. Importe `estatisticas` de `./padronizacao.js`.
2. Depois da guarda 5b, acrescente:
```ts
    // 5c. ZSCORE não está em 0–100: somá-lo num COMPOSTO ou classificá-lo em faixas
    //     de 0–100 daria número plausível e errado.
    if (config.tipo === "COMPOSTO" || config.tipo === "CLASSIFICACAO") {
      const zDep = dependencias.find((dep) => porId.get(dep)!.tipo === "ZSCORE");
      if (zDep) {
        marcarIncompleto(id, `depende de ${zDep}, que não está em 0–100`, id, zDep);
        continue;
      }
    }
```
3. Em `calcularCenario`, antes de `const valores = respostas.map(...)`, prepare a padronização e use-a no lugar de `avaliar` quando o tipo for ZSCORE:
```ts
      // ZSCORE: a referência de cada componente é a pesquisa inteira do indicador
      // (daPesquisa), nunca a máscara do painel — senão a média do recorte seria zero.
      const referencias =
        cfg.tipo === "ZSCORE"
          ? cfg.componentes.map((c) => {
              const vetor = lerValores(c.indicadorId) ?? [];
              const base = vetor.filter((v, i): v is number => daPesquisa[i] && v !== null && Number.isFinite(v));
              return { ...c, vetor, est: estatisticas(base) };
            })
          : null;
```
   e dentro do `respostas.map`, logo após `if (!daPesquisa[indice]) return null;`:
```ts
        if (referencias) {
          let soma = 0;
          let pesos = 0;
          for (const c of referencias) {
            const v = c.vetor[indice];
            if (!c.est || v === null || v === undefined) return null;
            soma += ((v - c.est.media) / c.est.desvio) * c.peso;
            pesos += c.peso;
          }
          return soma / pesos;
        }
```
4. Em `agregarPorTipo` nada muda (ZSCORE cai no `default`, média).

- [ ] **Step 4: Run**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run tests/motorPadronizacao.test.ts tests/motorCalcular.test.ts`
Expected: PASS. Mutação: (a) trocar `daPesquisa[i]` pela máscara na referência → o teste "recorte filtrado" fica vermelho; (b) remover a guarda 5c → o teste de COMPOSTO/CLASSIFICACAO fica vermelho; (c) desvio populacional (`/ length`) → o teste de `estatisticas` fica vermelho.

- [ ] **Step 5: Commit**

```bash
git add backend/src/helper/motor backend/tests
git commit -m "feat: indicador ZSCORE padronizado contra a propria pesquisa"
```

---

### Task 5: Tabelas de referência (OMS e Atalah)

**Files:**
- Create: `backend/scripts/gerar-referencia-oms.ts`
- Create: `backend/referencias/oms-imc-idade.json` (gerado pelo script)
- Create: `backend/src/helper/motor/referencias/oms.ts`
- Create: `backend/referencias/atalah.json`
- Create: `backend/src/helper/motor/referencias/atalah.ts`
- Create: `backend/referencias/README.md`
- Create: `backend/src/helper/motor/referencias/ler.ts`
- Modify: `backend/Dockerfile` (copiar `referencias/` para a imagem)
- Test: `backend/tests/referencias.test.ts` (novo)

**Interfaces:**
- Produces (`oms.ts`):
  - `type Sexo = "masculino" | "feminino"`
  - `lmsImcParaIdade(sexo: Sexo, dias: number): { L: number; M: number; S: number } | null` (null fora de 0–1856)
  - `zscoreLms(x: number, lms: { L: number; M: number; S: number }): number`
  - `percentilDeZ(z: number): number` (0–100)
- Produces (`atalah.ts`):
  - `type FaixaAtalah = "Baixo peso" | "Adequado" | "Sobrepeso" | "Obesidade"`
  - `FAIXAS_ATALAH: readonly FaixaAtalah[]` (nessa ordem)
  - `classificarAtalah(imc: number, semana: number): FaixaAtalah | null` (null fora de 6–42 ou semana não inteira)

**Fontes oficiais (use exatamente estas):**
- OMS, Child Growth Standards, BMI-for-age, expanded tables (z-scores, por dia):
  - meninos: `https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/body-mass-index-for-age/expanded-tables/bfa-boys-zscore-expanded-tables.xlsx?sfvrsn=f8e1fbe2_10`
  - meninas: `https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/body-mass-index-for-age/expanded-tables/bfa-girls-zscore-expanded-tables.xlsx?sfvrsn=ae4cb8d1_12`
  - página de origem: `https://www.who.int/TOOLKITS/CHILD-GROWTH-STANDARDS/STANDARDS/BODY-MASS-INDEX-FOR-AGE-BMI-FOR-AGE`
  - formato conferido: aba única, cabeçalho `Day, L, M, S, SD4neg, SD3neg, SD2neg, SD1neg, SD0, SD1, SD2, SD3, SD4`, dias 0 a 1856 (1857 linhas de dados).
- Atalah: Ministério da Saúde, *Orientações para a coleta e análise de dados antropométricos em serviços de saúde — Norma Técnica do SISVAN* (2011), Quadro 19, p. 25: `https://bvsms.saude.gov.br/bvs/publicacoes/orientacoes_coleta_analise_dados_antropometricos.pdf`. Regras do quadro: baixo peso se IMC ≤ coluna BP; adequado na faixa A; sobrepeso na faixa S; obesidade se IMC ≥ coluna O.

- [ ] **Step 1: Baixar os xlsx da OMS** (fora do repositório, numa pasta temporária)

Run: `curl -sL -o /tmp/bfa-boys.xlsx "<URL meninos>" && curl -sL -o /tmp/bfa-girls.xlsx "<URL meninas>"` (no Windows use a pasta de scratch da sessão). Confira que os dois arquivos começam com `PK` e têm ~180 KB. Se o download falhar, **pare: BLOCKED** — não reconstrua a tabela de outra fonte.

- [ ] **Step 2: Script gerador** — `backend/scripts/gerar-referencia-oms.ts`:

```ts
// Gera referencias/oms-imc-idade.json a partir das tabelas
// oficiais da OMS (BMI-for-age, expanded tables, z-scores por dia).
// Uso: npx tsx scripts/gerar-referencia-oms.ts <meninos.xlsx> <meninas.xlsx>
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const [meninos, meninas] = process.argv.slice(2);
if (!meninos || !meninas) throw new Error("Uso: gerar-referencia-oms.ts <meninos.xlsx> <meninas.xlsx>");

async function ler(caminho: string): Promise<Array<[number, number, number]>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const ws = wb.worksheets[0];
  const cabecalho = (ws.getRow(1).values as unknown[]).slice(1, 5);
  if (JSON.stringify(cabecalho) !== JSON.stringify(["Day", "L", "M", "S"])) {
    throw new Error(`cabeçalho inesperado em ${caminho}: ${JSON.stringify(cabecalho)}`);
  }
  const linhas: Array<[number, number, number]> = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const [dia, L, M, S] = (ws.getRow(r).values as unknown[]).slice(1, 5).map(Number);
    if (dia !== r - 2) throw new Error(`dia fora de sequência na linha ${r} de ${caminho}`);
    if (![L, M, S].every(Number.isFinite)) throw new Error(`valor não numérico na linha ${r} de ${caminho}`);
    linhas.push([L, M, S]);
  }
  if (linhas.length !== 1857) throw new Error(`${caminho}: esperava 1857 dias, li ${linhas.length}`);
  return linhas;
}

const saida = {
  fonte: "OMS, Child Growth Standards (2006), BMI-for-age, expanded tables (z-scores), 0–1856 dias",
  colunas: ["L", "M", "S"],
  masculino: await ler(meninos),
  feminino: await ler(meninas),
};
const destino = fileURLToPath(new URL("../referencias/oms-imc-idade.json", import.meta.url));
writeFileSync(destino, JSON.stringify(saida));
console.log(`gravado ${destino}`);
```

Run: `cd backend && npx tsx scripts/gerar-referencia-oms.ts <caminho>/bfa-boys.xlsx <caminho>/bfa-girls.xlsx`
Expected: `gravado .../oms-imc-idade.json` (~120 KB).

- [ ] **Step 3: `atalah.json`** — crie `backend/referencias/atalah.json` com exatamente este conteúdo (transcrito do Quadro 19 via `pdftotext`; o teste do Step 5 confere pontos contra o PDF):

```json
[
  {"semana":6,"baixoPesoAte":19.9,"sobrepesoDe":25,"obesidadeDe":30.1},
  {"semana":7,"baixoPesoAte":20,"sobrepesoDe":25.1,"obesidadeDe":30.2},
  {"semana":8,"baixoPesoAte":20.1,"sobrepesoDe":25.1,"obesidadeDe":30.2},
  {"semana":9,"baixoPesoAte":20.2,"sobrepesoDe":25.2,"obesidadeDe":30.3},
  {"semana":10,"baixoPesoAte":20.2,"sobrepesoDe":25.3,"obesidadeDe":30.3},
  {"semana":11,"baixoPesoAte":20.3,"sobrepesoDe":25.4,"obesidadeDe":30.4},
  {"semana":12,"baixoPesoAte":20.4,"sobrepesoDe":25.5,"obesidadeDe":30.4},
  {"semana":13,"baixoPesoAte":20.6,"sobrepesoDe":25.7,"obesidadeDe":30.5},
  {"semana":14,"baixoPesoAte":20.7,"sobrepesoDe":25.8,"obesidadeDe":30.6},
  {"semana":15,"baixoPesoAte":20.8,"sobrepesoDe":25.9,"obesidadeDe":30.7},
  {"semana":16,"baixoPesoAte":21,"sobrepesoDe":26,"obesidadeDe":30.8},
  {"semana":17,"baixoPesoAte":21.1,"sobrepesoDe":26.1,"obesidadeDe":30.9},
  {"semana":18,"baixoPesoAte":21.2,"sobrepesoDe":26.2,"obesidadeDe":31},
  {"semana":19,"baixoPesoAte":21.4,"sobrepesoDe":26.3,"obesidadeDe":31},
  {"semana":20,"baixoPesoAte":21.5,"sobrepesoDe":26.4,"obesidadeDe":31.1},
  {"semana":21,"baixoPesoAte":21.7,"sobrepesoDe":26.5,"obesidadeDe":31.2},
  {"semana":22,"baixoPesoAte":21.8,"sobrepesoDe":26.7,"obesidadeDe":31.3},
  {"semana":23,"baixoPesoAte":22,"sobrepesoDe":26.9,"obesidadeDe":31.4},
  {"semana":24,"baixoPesoAte":22.2,"sobrepesoDe":27,"obesidadeDe":31.6},
  {"semana":25,"baixoPesoAte":22.4,"sobrepesoDe":27.1,"obesidadeDe":31.7},
  {"semana":26,"baixoPesoAte":22.6,"sobrepesoDe":27.3,"obesidadeDe":31.8},
  {"semana":27,"baixoPesoAte":22.7,"sobrepesoDe":27.4,"obesidadeDe":31.9},
  {"semana":28,"baixoPesoAte":22.9,"sobrepesoDe":27.6,"obesidadeDe":32},
  {"semana":29,"baixoPesoAte":23.1,"sobrepesoDe":27.7,"obesidadeDe":32.1},
  {"semana":30,"baixoPesoAte":23.3,"sobrepesoDe":27.9,"obesidadeDe":32.2},
  {"semana":31,"baixoPesoAte":23.4,"sobrepesoDe":28,"obesidadeDe":32.3},
  {"semana":32,"baixoPesoAte":23.6,"sobrepesoDe":28.1,"obesidadeDe":32.4},
  {"semana":33,"baixoPesoAte":23.8,"sobrepesoDe":28.2,"obesidadeDe":32.5},
  {"semana":34,"baixoPesoAte":23.9,"sobrepesoDe":28.4,"obesidadeDe":32.6},
  {"semana":35,"baixoPesoAte":24.1,"sobrepesoDe":28.5,"obesidadeDe":32.7},
  {"semana":36,"baixoPesoAte":24.2,"sobrepesoDe":28.6,"obesidadeDe":32.8},
  {"semana":37,"baixoPesoAte":24.3,"sobrepesoDe":28.8,"obesidadeDe":32.9},
  {"semana":38,"baixoPesoAte":24.5,"sobrepesoDe":28.9,"obesidadeDe":33},
  {"semana":39,"baixoPesoAte":24.7,"sobrepesoDe":29,"obesidadeDe":33.1},
  {"semana":40,"baixoPesoAte":24.9,"sobrepesoDe":29.2,"obesidadeDe":33.2},
  {"semana":41,"baixoPesoAte":25,"sobrepesoDe":29.3,"obesidadeDe":33.3},
  {"semana":42,"baixoPesoAte":25,"sobrepesoDe":29.3,"obesidadeDe":33.3}
]
```

Confirme pelo menos as semanas 6, 20, 37 e 42 contra o PDF (`pdftotext -layout` + `grep` por "Quadro 19"). Se algum ponto divergir, **pare: BLOCKED**.

- [ ] **Step 4: Failing tests** — `backend/tests/referencias.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { lmsImcParaIdade, zscoreLms, percentilDeZ } from "../src/helper/motor/referencias/oms.js";
import { classificarAtalah, FAIXAS_ATALAH } from "../src/helper/motor/referencias/atalah.js";

describe("OMS IMC-para-idade (valores da tabela oficial)", () => {
  it("LMS de dias conhecidos", () => {
    expect(lmsImcParaIdade("masculino", 0)).toEqual({ L: -0.3053, M: 13.4069, S: 0.0956 });
    expect(lmsImcParaIdade("masculino", 365)).toEqual({ L: -0.4113, M: 16.7992, S: 0.08009 });
    expect(lmsImcParaIdade("feminino", 730)).toEqual({ L: -0.5989, M: 15.4052, S: 0.08545 });
    expect(lmsImcParaIdade("feminino", 1856)).toEqual({ L: -0.5684, M: 15.2798, S: 0.09825 });
  });
  it("fora de 0–1856 dias = null", () => {
    expect(lmsImcParaIdade("masculino", -1)).toBeNull();
    expect(lmsImcParaIdade("masculino", 1857)).toBeNull();
    expect(lmsImcParaIdade("masculino", 10.5)).toBeNull();
  });
  it("z-score LMS reproduz as colunas SD da tabela", () => {
    // Colunas SD1 (menino, 365 dias) = 18.225 e SD2neg (menina, 730 dias) = 13.092.
    expect(zscoreLms(18.225, lmsImcParaIdade("masculino", 365)!)).toBeCloseTo(1, 2);
    expect(zscoreLms(13.092, lmsImcParaIdade("feminino", 730)!)).toBeCloseTo(-2, 2);
    expect(zscoreLms(16.7992, lmsImcParaIdade("masculino", 365)!)).toBeCloseTo(0, 6);
  });
  it("percentil da normal padrão", () => {
    expect(percentilDeZ(0)).toBeCloseTo(50, 5);
    expect(percentilDeZ(1)).toBeCloseTo(84.1345, 3);
    expect(percentilDeZ(-2)).toBeCloseTo(2.275, 3);
    expect(percentilDeZ(-1.2816)).toBeCloseTo(10, 2);
  });
});

describe("Atalah (Quadro 19, SISVAN 2011)", () => {
  it("ordem das faixas", () => {
    expect(FAIXAS_ATALAH).toEqual(["Baixo peso", "Adequado", "Sobrepeso", "Obesidade"]);
  });
  it("semana 20: BP ≤ 21,5 · A 21,6–26,3 · S 26,4–31,0 · O ≥ 31,1", () => {
    expect(classificarAtalah(21.5, 20)).toBe("Baixo peso");
    expect(classificarAtalah(22.0, 20)).toBe("Adequado");
    expect(classificarAtalah(26.3, 20)).toBe("Adequado");
    expect(classificarAtalah(26.4, 20)).toBe("Sobrepeso");
    expect(classificarAtalah(31.0, 20)).toBe("Sobrepeso");
    expect(classificarAtalah(31.1, 20)).toBe("Obesidade");
  });
  it("IMC é arredondado a uma casa antes de comparar (a tabela tem uma casa)", () => {
    expect(classificarAtalah(21.54, 20)).toBe("Baixo peso");
    expect(classificarAtalah(21.56, 20)).toBe("Adequado");
  });
  it("semana 37 tem vão entre BP (24,3) e A (24,5): 24,4 é adequado", () => {
    expect(classificarAtalah(24.4, 37)).toBe("Adequado");
  });
  it("semana fora de 6–42 ou não inteira = null", () => {
    expect(classificarAtalah(22, 5)).toBeNull();
    expect(classificarAtalah(22, 43)).toBeNull();
    expect(classificarAtalah(22, 20.5)).toBeNull();
  });
});
```

- [ ] **Step 5: Run to verify failures**

Run: `cd backend && npx vitest run tests/referencias.test.ts`
Expected: FAIL — módulos não existem.

- [ ] **Step 6: Implement**

Por que não `import x from "./tabela.json"`: o `tsconfig` usa `module: ES2022`, que não aceita o atributo `with { type: "json" }`, e sem o atributo o Node de produção recusa o import do JSON (`ERR_IMPORT_ATTRIBUTE_MISSING`) — funcionaria no vitest e quebraria só na imagem. Os dados ficam em `backend/referencias/` e são lidos do disco. `src/helper/motor/referencias/x.ts` e `dist/helper/motor/referencias/x.js` estão na mesma profundidade, então o mesmo caminho relativo vale nos dois.

`backend/src/helper/motor/referencias/ler.ts`:

```ts
import { readFileSync } from "node:fs";

/** Lê um JSON de backend/referencias/ (mesma profundidade em src/ e em dist/). */
export function lerReferencia<T>(arquivo: string): T {
  return JSON.parse(readFileSync(new URL(`../../../../referencias/${arquivo}`, import.meta.url), "utf8")) as T;
}
```

`backend/src/helper/motor/referencias/oms.ts`:

```ts
import { lerReferencia } from "./ler.js";

export type Sexo = "masculino" | "feminino";
type Lms = { L: number; M: number; S: number };

const linhas = lerReferencia<Record<Sexo, Array<[number, number, number]>>>("oms-imc-idade.json");

/** LMS da OMS para o dia de vida; null fora da tabela (0–1856 dias). */
export function lmsImcParaIdade(sexo: Sexo, dias: number): Lms | null {
  if (!Number.isInteger(dias) || dias < 0) return null;
  const linha = linhas[sexo][dias];
  if (!linha) return null;
  const [L, M, S] = linha;
  return { L, M, S };
}

/** Escore-z pelo método LMS (Cole). */
export function zscoreLms(x: number, { L, M, S }: Lms): number {
  return L === 0 ? Math.log(x / M) / S : ((x / M) ** L - 1) / (L * S);
}

/** Φ(z) × 100, aproximação de Abramowitz & Stegun 26.2.17 (erro < 7,5e-8). */
export function percentilDeZ(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const cauda = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return (z > 0 ? 1 - cauda : cauda) * 100;
}
```

`backend/src/helper/motor/referencias/atalah.ts`:

```ts
import { lerReferencia } from "./ler.js";

export type FaixaAtalah = "Baixo peso" | "Adequado" | "Sobrepeso" | "Obesidade";
export const FAIXAS_ATALAH: readonly FaixaAtalah[] = ["Baixo peso", "Adequado", "Sobrepeso", "Obesidade"];

type LinhaAtalah = { semana: number; baixoPesoAte: number; sobrepesoDe: number; obesidadeDe: number };
const porSemana = new Map(lerReferencia<LinhaAtalah[]>("atalah.json").map((l) => [l.semana, l]));

/**
 * Quadro 19 (SISVAN 2011, Atalah 1997). A tabela tem uma casa decimal, então o
 * IMC é arredondado a uma casa antes da comparação. Faixa adequada = tudo entre
 * o fim do baixo peso e o início do sobrepeso (cobre o vão da semana 37).
 */
export function classificarAtalah(imc: number, semana: number): FaixaAtalah | null {
  if (!Number.isInteger(semana)) return null;
  const linha = porSemana.get(semana);
  if (!linha || !Number.isFinite(imc)) return null;
  const v = Math.round(imc * 10) / 10;
  if (v <= linha.baixoPesoAte) return "Baixo peso";
  if (v < linha.sobrepesoDe) return "Adequado";
  if (v < linha.obesidadeDe) return "Sobrepeso";
  return "Obesidade";
}
```

`backend/referencias/README.md`:

```markdown
# Tabelas de referência do motor de indicadores

Dados oficiais, não digitados à mão. Se for preciso atualizar, regenere — não edite.

## oms-imc-idade.json

- Fonte: OMS, Child Growth Standards (2006), BMI-for-age, *expanded tables* (z-scores), por dia, 0–1856 dias.
- Página: https://www.who.int/TOOLKITS/CHILD-GROWTH-STANDARDS/STANDARDS/BODY-MASS-INDEX-FOR-AGE-BMI-FOR-AGE
- Arquivos: `bfa-boys-zscore-expanded-tables.xlsx` e `bfa-girls-zscore-expanded-tables.xlsx` (links na página).
- Obtido em: <data do download>.
- Regenerar: `npx tsx scripts/gerar-referencia-oms.ts <meninos.xlsx> <meninas.xlsx>`.
- Formato: `{ masculino: [[L, M, S], ...], feminino: [...] }`, índice = dia de vida.

## atalah.json

- Fonte: Ministério da Saúde, *Orientações para a coleta e análise de dados antropométricos em serviços de saúde — Norma Técnica do SISVAN* (2011), Quadro 19, p. 25 (Atalah Samur et al., 1997).
- PDF: https://bvsms.saude.gov.br/bvs/publicacoes/orientacoes_coleta_analise_dados_antropometricos.pdf
- Transcrito com `pdftotext -layout`; `tests/referencias.test.ts` confere pontos contra o quadro.
- Campos: `baixoPesoAte` (BP ≤), `sobrepesoDe` (início de S), `obesidadeDe` (O ≥), semanas 6–42.
```

Preencha a data do download no README.

No `backend/Dockerfile`, a imagem final precisa dos dados: no estágio `build`, depois de `COPY src ./src`, acrescente `COPY referencias ./referencias`; no estágio `runtime`, depois de `COPY --from=build /app/dist ./dist`, acrescente `COPY --from=build /app/referencias ./referencias`.

- [ ] **Step 7: Run**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run tests/referencias.test.ts && npm run build && node -e "import('./dist/helper/motor/referencias/oms.js').then(m => console.log(m.lmsImcParaIdade('masculino', 0)))" && node -e "import('./dist/helper/motor/referencias/atalah.js').then(m => console.log(m.classificarAtalah(22, 20)))"`
Expected: PASS; os dois `node -e` imprimem `{ L: -0.3053, M: 13.4069, S: 0.0956 }` e `Adequado` — prova de que o código compilado acha os dados.

Confira também na imagem: `docker compose -f docker-compose.prod.yml --env-file .env.prod build api` (na raiz do repositório) termina sem erro. Se o Docker não estiver disponível, registre no relatório que essa conferência ficou para a CI.

- [ ] **Step 8: Commit**

```bash
git add backend/scripts/gerar-referencia-oms.ts backend/referencias backend/src/helper/motor/referencias backend/Dockerfile backend/tests/referencias.test.ts
git commit -m "feat: tabelas de referencia OMS (IMC-para-idade) e Atalah, das fontes oficiais"
```
(inclua `backend/tsconfig.json`/`backend/Dockerfile` se precisou mexer.)

---

### Task 6: PERCENTIL_OMS e ATALAH no motor

**Files:**
- Modify: `backend/src/helper/motor/avaliadores.ts`
- Modify: `backend/src/helper/motor/calcular.ts`
- Test: `backend/tests/motorAvaliadores.test.ts`, `backend/tests/motorCalcular.test.ts`

**Interfaces:**
- Consumes: `lmsImcParaIdade`, `zscoreLms`, `percentilDeZ` (Task 5); `classificarAtalah`, `FAIXAS_ATALAH` (Task 5); `diasCompletos` (Task 3).
- Produces: `avaliar` trata `PERCENTIL_OMS` (0/100 por indivíduo); `agregarPorTipo` trata `ATALAH` (`OK_FAIXAS` com as quatro faixas); `TIPOS_SEM_VALOR_INDIVIDUAL` inclui `ATALAH`.

- [ ] **Step 1: Failing tests dos avaliadores** — em `backend/tests/motorAvaliadores.test.ts`:

```ts
describe("PERCENTIL_OMS", () => {
  const cfg = (corte: object) =>
    validarConfig("PERCENTIL_OMS", {
      imcIndicadorId: "imc", nascimentoPerguntaId: "nasc", sexoPerguntaId: "sexo",
      opcoesSexo: { masculino: "Masculino", feminino: "Feminino" }, corte,
    });
  const entrevista = new Date("2026-01-01T12:00:00Z");
  const r = (sexo: string | null, nasc: string | null, enviadaEm: Date | null = entrevista) =>
    montarResposta(
      "r",
      [...(sexo ? [{ perguntaId: "sexo", opcoesSelecionadas: [sexo] }] : []), ...(nasc ? [{ perguntaId: "nasc", valorData: new Date(nasc) }] : [])],
      null,
      { enviadaEm },
    );
  const imc = (v: number | null) => new Map([["imc", v]]);

  it("menina de 730 dias com IMC no −2 DP (P2,3) está abaixo do P10", () => {
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Feminino", "2024-01-02"), imc(13.092))).toBe(100);
  });
  it("menino de 365 dias com IMC na mediana não está abaixo do P10 nem acima do P85", () => {
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Masculino", "2025-01-01"), imc(16.7992))).toBe(0);
    expect(avaliar(cfg({ acimaDe: 85 }), r("Masculino", "2025-01-01"), imc(16.7992))).toBe(0);
  });
  it("menino de 365 dias no +1 DP (P84,1) não passa do P85; no +2 DP passa", () => {
    expect(avaliar(cfg({ acimaDe: 85 }), r("Masculino", "2025-01-01"), imc(18.225))).toBe(0);
    expect(avaliar(cfg({ acimaDe: 85 }), r("Masculino", "2025-01-01"), imc(19.9))).toBe(100);
  });
  it("sexo fora das opções configuradas, ausente, sem nascimento, sem IMC ou acima de 5 anos = null", () => {
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Intersexo", "2025-01-01"), imc(16))).toBeNull();
    expect(avaliar(cfg({ abaixoDe: 10 }), r(null, "2025-01-01"), imc(16))).toBeNull();
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Masculino", null), imc(16))).toBeNull();
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Masculino", "2025-01-01"), imc(null))).toBeNull();
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Masculino", "2020-06-01"), imc(16))).toBeNull();
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Masculino", "2025-01-01", null), imc(16))).toBeNull();
  });
});
```

(19,9 está acima do SD2 = 19,351 do menino aos 60 dias e acima do SD2 aos 365 dias; confira na tabela o SD2 do dia 365 — se for maior que 19,9, troque por um valor acima dele lido da coluna SD2 do JSON e comente a origem.)

- [ ] **Step 2: Failing tests do calcular (ATALAH)** — em `backend/tests/motorCalcular.test.ts`:

```ts
describe("ATALAH", () => {
  const P = new Set(["imcAtual", "semana"]);
  const inds = [
    ind({ id: "imc", tipo: "MEDIA", config: { perguntaId: "imcAtual" } }),
    ind({ id: "atalah", tipo: "ATALAH", config: { imcIndicadorId: "imc", semanaPerguntaId: "semana" } }),
  ];
  const g = (id: string, imc: number, semana?: number) =>
    montarResposta(id, [{ perguntaId: "imcAtual", valorNumero: imc }, ...(semana === undefined ? [] : [{ perguntaId: "semana", valorNumero: semana }])]);

  it("% por faixa, sem semana fora da conta", () => {
    const res = calcular(inds, [g("a", 21.0, 20), g("b", 22.0, 20), g("c", 27.0, 20), g("d", 32.0, 20), g("e", 22.0)], P);
    expect(res.get("atalah")).toEqual({
      status: "OK_FAIXAS",
      faixas: [
        { rotulo: "Baixo peso", percentual: 25 },
        { rotulo: "Adequado", percentual: 25 },
        { rotulo: "Sobrepeso", percentual: 25 },
        { rotulo: "Obesidade", percentual: 25 },
      ],
    });
  });

  it("ninguém com semana = SEM_DADOS", () => {
    expect(calcular(inds, [g("a", 22)], P).get("atalah")).toEqual({ status: "SEM_DADOS" });
  });

  it("ATALAH não serve de termo de COMPOSTO (sem valor individual)", () => {
    const comp = ind({ id: "c", tipo: "COMPOSTO", config: { termos: [{ indicadorId: "atalah", peso: 1 }], divisor: 1 } });
    expect(calcular([...inds, comp], [g("a", 22, 20)], P).get("c")).toMatchObject({ status: "INCOMPLETO", dependencia: "atalah" });
  });
});
```

Confira antes o formato que `classificar` devolve quando nenhum valor cai em faixa (o teste "SEM_DADOS" assume que `classificar` com todos `null` devolve `{ status: "SEM_DADOS" }`; leia `agregacao.ts` e ajuste a expectativa ao comportamento existente, sem mudar `classificar`).

- [ ] **Step 3: Run to verify failures**

Run: `cd backend && npx vitest run tests/motorAvaliadores.test.ts tests/motorCalcular.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement PERCENTIL_OMS** — em `avaliadores.ts`, importe `diasCompletos` de `./idade.js` e `lmsImcParaIdade`, `zscoreLms`, `percentilDeZ`, `type Sexo` de `./referencias/oms.js`; acrescente ao `switch`:

```ts
    case "PERCENTIL_OMS": {
      const imc = valoresDependencias.get(config.imcIndicadorId);
      const nascimento = resposta.itens.get(config.nascimentoPerguntaId)?.valorData;
      const marcadas = opcoes(resposta.itens.get(config.sexoPerguntaId));
      if (imc === null || imc === undefined || !nascimento || !resposta.enviadaEm || marcadas.length !== 1) return null;
      const sexo: Sexo | null =
        marcadas[0] === config.opcoesSexo.masculino ? "masculino" :
        marcadas[0] === config.opcoesSexo.feminino ? "feminino" : null;
      if (!sexo) return null;
      const lms = lmsImcParaIdade(sexo, diasCompletos(nascimento, resposta.enviadaEm));
      if (!lms || imc <= 0) return null;
      const p = percentilDeZ(zscoreLms(imc, lms));
      return "abaixoDe" in config.corte ? (p < config.corte.abaixoDe ? 100 : 0) : (p > config.corte.acimaDe ? 100 : 0);
    }
```

- [ ] **Step 5: Implement ATALAH** — em `calcular.ts`:

1. `TIPOS_SEM_VALOR_INDIVIDUAL` passa a ser `new Set(["CLASSIFICACAO", "CONTAGEM", "DISTRIBUICAO", "ATALAH"])`.
2. Importe `classificarAtalah` e `FAIXAS_ATALAH` de `./referencias/atalah.js`.
3. Em `agregarPorTipo`, acrescente antes do `default`:
```ts
    case "ATALAH": {
      // Cada gestante cai numa das quatro faixas da semana dela. Reaproveita o
      // `classificar` (maior resto) com a posição da faixa como valor: 0.5, 1.5, ...
      const imcs = lerValores(config.imcIndicadorId) ?? [];
      const posicoes = respostas.map((r, i) => {
        if (!noEscopo[i]) return null;
        const imc = imcs[i];
        const semana = r.itens.get(config.semanaPerguntaId)?.valorNumero;
        if (imc === null || imc === undefined || typeof semana !== "number") return null;
        const faixa = classificarAtalah(imc, semana);
        return faixa === null ? null : FAIXAS_ATALAH.indexOf(faixa) + 0.5;
      });
      return classificar(
        posicoes,
        FAIXAS_ATALAH.map((rotulo, i) => ({ rotulo, de: i, ate: i + 1 })),
        casasDecimais,
      );
    }
```
4. Em `aplicarSubstituicoes`, acrescente:
```ts
    case "PERCENTIL_OMS":
      return { ...config, nascimentoPerguntaId: trocar(config.nascimentoPerguntaId), sexoPerguntaId: trocar(config.sexoPerguntaId) };
    case "ATALAH":
      return { ...config, semanaPerguntaId: trocar(config.semanaPerguntaId) };
```

- [ ] **Step 6: Run**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run`
Expected: PASS na suíte inteira. Mutação: (a) trocar `p < corte` por `p <= corte` não deve quebrar nada (aceitável) — **mas** remover a checagem de sexo fora das opções deve deixar vermelho o teste "Intersexo"; (b) remover `marcadas.length !== 1`; (c) usar `meses` em vez de `dias`; (d) remover `ATALAH` de `TIPOS_SEM_VALOR_INDIVIDUAL` → o teste do COMPOSTO fica vermelho.

- [ ] **Step 7: Commit**

```bash
git add backend/src/helper/motor backend/tests
git commit -m "feat: indicadores PERCENTIL_OMS e ATALAH"
```

---

### Task 7: Cadastro confere as perguntas dos tipos novos

**Files:**
- Create: `backend/src/helper/indicadorPerguntas.ts`
- Modify: `backend/src/models/indicadorModel.ts` (`perguntasPorId`)
- Modify: `backend/src/controllers/indicadorController.ts` (criar e atualizar)
- Test: `backend/tests/indicadorPerguntas.test.ts` (novo), `backend/tests/indicadores.test.ts`

**Interfaces:**
- Produces: `type PerguntaParaConferir = { id: string; tipo: "TEXTO" | "NUMERO" | "DATA" | "MULTIPLA_ESCOLHA" | "ESCOLHA_UNICA" | "CAMPO_ABERTO"; opcoes: string[] }`
- Produces: `problemasDasPerguntas(config: ConfigIndicador, perguntas: Map<string, PerguntaParaConferir>): string[]` (vazio = ok)
- Produces: `indicadorModel.perguntasPorId(ids: string[]): Promise<PerguntaParaConferir[]>`
- Controller: lista não vazia → `HttpError(422, "PERGUNTA_INCOMPATIVEL", "Configuração não confere com as perguntas", { problemas })`.

Regras (só para os tipos novos; os antigos ficam como estão):
- ESCALA: pergunta existe e é `ESCOLHA_UNICA`; toda opção da pergunta está em `notas`; nenhuma chave de `notas` fora das opções.
- META_POR_IDADE: `perguntaId` é `NUMERO`; `nascimentoPerguntaId` é `DATA`.
- PERCENTIL_OMS: `nascimentoPerguntaId` é `DATA`; `sexoPerguntaId` é `ESCOLHA_UNICA` e tem as duas opções de `opcoesSexo`.
- ATALAH: `semanaPerguntaId` é `NUMERO`.
- Pergunta referenciada que não existe → problema "pergunta X não existe".

- [ ] **Step 1: Failing tests** — `backend/tests/indicadorPerguntas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { problemasDasPerguntas, type PerguntaParaConferir } from "../src/helper/indicadorPerguntas.js";
import { validarConfig } from "../src/helper/indicadorConfig.js";

const P = (id: string, tipo: PerguntaParaConferir["tipo"], opcoes: string[] = []) => [id, { id, tipo, opcoes }] as const;
const perguntas = new Map<string, PerguntaParaConferir>([
  P("pn", "ESCOLHA_UNICA", ["Antes", "Após", "Não soube"]),
  P("consultas", "NUMERO"),
  P("nasc", "DATA"),
  P("sexo", "ESCOLHA_UNICA", ["Masculino", "Feminino"]),
  P("semana", "NUMERO"),
  P("texto", "TEXTO"),
]);

describe("problemasDasPerguntas", () => {
  it("ESCALA completa: ok", () => {
    expect(problemasDasPerguntas(validarConfig("ESCALA", { perguntaId: "pn", notas: { Antes: 100, "Após": 50, "Não soube": null } }), perguntas)).toEqual([]);
  });
  it("ESCALA: opção faltando, opção sobrando, tipo errado, pergunta inexistente", () => {
    expect(problemasDasPerguntas(validarConfig("ESCALA", { perguntaId: "pn", notas: { Antes: 100, "Após": 50 } }), perguntas))
      .toEqual(['opção "Não soube" sem nota']);
    expect(problemasDasPerguntas(validarConfig("ESCALA", { perguntaId: "pn", notas: { Antes: 100, "Após": 50, "Não soube": null, Outra: 1 } }), perguntas))
      .toEqual(['opção "Outra" não existe na pergunta']);
    expect(problemasDasPerguntas(validarConfig("ESCALA", { perguntaId: "texto", notas: { A: 1 } }), perguntas))
      .toEqual(["pergunta texto precisa ser ESCOLHA_UNICA"]);
    expect(problemasDasPerguntas(validarConfig("ESCALA", { perguntaId: "nada", notas: { A: 1 } }), perguntas))
      .toEqual(["pergunta nada não existe"]);
  });
  it("META_POR_IDADE: tipos das perguntas", () => {
    const ok = validarConfig("META_POR_IDADE", { perguntaId: "consultas", nascimentoPerguntaId: "nasc", faixas: [{ deMeses: 0, ateMeses: null, esperado: 1 }] });
    expect(problemasDasPerguntas(ok, perguntas)).toEqual([]);
    const errado = validarConfig("META_POR_IDADE", { perguntaId: "nasc", nascimentoPerguntaId: "consultas", faixas: [{ deMeses: 0, ateMeses: null, esperado: 1 }] });
    expect(problemasDasPerguntas(errado, perguntas)).toEqual(["pergunta nasc precisa ser NUMERO", "pergunta consultas precisa ser DATA"]);
  });
  it("PERCENTIL_OMS: opção de sexo inexistente", () => {
    const cfg = validarConfig("PERCENTIL_OMS", { imcIndicadorId: "imc", nascimentoPerguntaId: "nasc", sexoPerguntaId: "sexo",
      opcoesSexo: { masculino: "Menino", feminino: "Feminino" }, corte: { abaixoDe: 10 } });
    expect(problemasDasPerguntas(cfg, perguntas)).toEqual(['opção "Menino" não existe na pergunta sexo']);
  });
  it("ATALAH: semana precisa ser número", () => {
    expect(problemasDasPerguntas(validarConfig("ATALAH", { imcIndicadorId: "imc", semanaPerguntaId: "texto" }), perguntas))
      .toEqual(["pergunta texto precisa ser NUMERO"]);
  });
  it("tipos antigos não são conferidos aqui", () => {
    expect(problemasDasPerguntas(validarConfig("MEDIA", { perguntaId: "nada" }), perguntas)).toEqual([]);
  });
});
```

E em `backend/tests/indicadores.test.ts`, no estilo dos testes de POST existentes (model mockado), dois testes: POST de ESCALA com `perguntasPorId` devolvendo a pergunta sem uma das opções → 422 `PERGUNTA_INCOMPATIVEL` e `criar` não chamado; POST de ESCALA completa → 201. Mocke `indicadorModel.perguntasPorId` no `beforeEach` com `mockResolvedValue([])` para os testes antigos (que usam tipos antigos e não chamam a conferência).

- [ ] **Step 2: Run to verify failures**

Run: `cd backend && npx vitest run tests/indicadorPerguntas.test.ts tests/indicadores.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — `backend/src/helper/indicadorPerguntas.ts`:

```ts
import type { ConfigIndicador } from "./indicadorConfig.js";

export type PerguntaParaConferir = {
  id: string;
  tipo: "TEXTO" | "NUMERO" | "DATA" | "MULTIPLA_ESCOLHA" | "ESCOLHA_UNICA" | "CAMPO_ABERTO";
  opcoes: string[];
};

/**
 * Confere a config dos tipos novos contra as perguntas reais. Os tipos antigos
 * continuam sendo conferidos só pelo motor (pergunta inexistente → INCOMPLETO).
 */
export function problemasDasPerguntas(config: ConfigIndicador, perguntas: Map<string, PerguntaParaConferir>): string[] {
  const problemas: string[] = [];
  const exigir = (id: string, tipo: PerguntaParaConferir["tipo"]): PerguntaParaConferir | null => {
    const p = perguntas.get(id);
    if (!p) {
      problemas.push(`pergunta ${id} não existe`);
      return null;
    }
    if (p.tipo !== tipo) {
      problemas.push(`pergunta ${id} precisa ser ${tipo}`);
      return null;
    }
    return p;
  };

  switch (config.tipo) {
    case "ESCALA": {
      const p = exigir(config.perguntaId, "ESCOLHA_UNICA");
      if (!p) break;
      for (const opcao of p.opcoes) if (!Object.hasOwn(config.notas, opcao)) problemas.push(`opção "${opcao}" sem nota`);
      for (const chave of Object.keys(config.notas)) if (!p.opcoes.includes(chave)) problemas.push(`opção "${chave}" não existe na pergunta`);
      break;
    }
    case "META_POR_IDADE":
      exigir(config.perguntaId, "NUMERO");
      exigir(config.nascimentoPerguntaId, "DATA");
      break;
    case "PERCENTIL_OMS": {
      exigir(config.nascimentoPerguntaId, "DATA");
      const p = exigir(config.sexoPerguntaId, "ESCOLHA_UNICA");
      if (p) {
        for (const opcao of [config.opcoesSexo.masculino, config.opcoesSexo.feminino]) {
          if (!p.opcoes.includes(opcao)) problemas.push(`opção "${opcao}" não existe na pergunta ${p.id}`);
        }
      }
      break;
    }
    case "ATALAH":
      exigir(config.semanaPerguntaId, "NUMERO");
      break;
    default:
      break;
  }
  return problemas;
}
```

Em `backend/src/models/indicadorModel.ts`, acrescente ao objeto do model:

```ts
  async perguntasPorId(ids: string[]): Promise<PerguntaParaConferir[]> {
    if (ids.length === 0) return [];
    const linhas = await prisma.pergunta.findMany({
      where: { id: { in: ids } },
      select: { id: true, tipo: true, opcoes: { select: { texto: true }, orderBy: { ordem: "asc" } } },
    });
    return linhas.map((l) => ({ id: l.id, tipo: l.tipo, opcoes: l.opcoes.map((o) => o.texto) }));
  },
```
(importe `type PerguntaParaConferir` de `../helper/indicadorPerguntas.js`).

Em `backend/src/controllers/indicadorController.ts`, acrescente:

```ts
const TIPOS_CONFERIDOS = new Set(["ESCALA", "META_POR_IDADE", "PERCENTIL_OMS", "ATALAH"]);

async function conferirPerguntas(tipo: CriarIndicadorInput["tipo"], config: unknown): Promise<void> {
  if (!TIPOS_CONFERIDOS.has(tipo)) return;
  const cfg = validarConfig(tipo, config);
  const ids = perguntasReferenciadas(cfg);
  const perguntas = new Map((await indicadorModel.perguntasPorId(ids)).map((p) => [p.id, p]));
  const problemas = problemasDasPerguntas(cfg, perguntas);
  if (problemas.length > 0) {
    throw new HttpError(422, "PERGUNTA_INCOMPATIVEL", "Configuração não confere com as perguntas", { problemas });
  }
}
```
e chame `await conferirPerguntas(dados.tipo, dados.config);` em `criar` logo após `conferirReferencias`, e em `atualizar` `await conferirPerguntas(tipo, dados.config ?? atual.config);` logo após `conferirReferencias`. Importe `validarConfig` e `perguntasReferenciadas` de `../helper/indicadorConfig.js` (se ainda não importados) e `problemasDasPerguntas` de `../helper/indicadorPerguntas.js`.

- [ ] **Step 4: Run**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run`
Expected: PASS. Mutação: remover cada `problemas.push` → exatamente o teste correspondente fica vermelho.

- [ ] **Step 5: Commit**

```bash
git add backend/src backend/tests
git commit -m "feat: cadastro confere perguntas e opcoes dos tipos novos de indicador"
```

---

### Task 8: Pergunta "Semana gestacional atual"

**Files:**
- Modify: `backend/prisma/pesquisas-cartao-cria.ts` (seção da Gestante com as perguntas de antropometria)
- Modify: `docs/pesquisas-cartao-cria.md` (tabela da Gestante)
- Create: `backend/scripts/adicionar-semana-gestacional.ts`
- Test: `backend/tests/semanaGestacional.test.ts` (novo, contra o banco real)

**Interfaces:**
- Produces: `adicionarSemanaGestacional(usuarioId: string): Promise<{ criada: boolean; perguntaId: string }>` exportada do script (para o teste), e execução direta via `npx tsx scripts/adicionar-semana-gestacional.ts`.

- [ ] **Step 1: Fonte da verdade** — em `backend/prisma/pesquisas-cartao-cria.ts`, logo depois de
`{ enunciado: "Qual é o peso atual da gestante?", tipo: "NUMERO", ajuda: "em kg" },` acrescente:

```ts
      { enunciado: "Semana gestacional atual", tipo: "NUMERO", ajuda: "Semanas completas de gestação (número inteiro de 1 a 42)" },
```

Em `docs/pesquisas-cartao-cria.md`, na tabela da Gestante, insira a linha correspondente logo após "Qual é o peso atual da gestante?" e renumere as linhas seguintes da tabela (a coluna `#` é a ordem). Confira com `grep -n "peso atual da gestante" docs/pesquisas-cartao-cria.md`.

- [ ] **Step 2: Failing test (banco real)** — `backend/tests/semanaGestacional.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { adicionarSemanaGestacional, ENUNCIADO_SEMANA } from "../scripts/adicionar-semana-gestacional.js";

let pesquisaId: string;
let usuarioId: string;

beforeAll(async () => {
  const usuario = await prisma.usuario.create({
    data: { nome: "Teste semana", email: `semana-${Date.now()}@teste.local`, senhaHash: "x", papel: "ADMIN" },
  });
  usuarioId = usuario.id;
  const pesquisa = await prisma.pesquisa.create({
    data: {
      titulo: `Cartão CRIA — Gestante (teste ${Date.now()})`,
      status: "PUBLICADA",
      responsavelId: usuario.id,
      createdById: usuario.id,
      perguntas: {
        create: [
          { enunciado: "Qual a altura da gestante em metros (atual)?", tipo: "NUMERO", ordem: 0 },
          { enunciado: "Qual é o peso atual da gestante?", tipo: "NUMERO", ordem: 1 },
          { enunciado: "Nos últimos três meses, os alimentos acabaram?", tipo: "ESCOLHA_UNICA", ordem: 2 },
        ],
      },
    },
  });
  pesquisaId = pesquisa.id;
});

afterAll(async () => {
  await prisma.logAlteracao.deleteMany({ where: { usuarioId } });
  await prisma.pesquisa.delete({ where: { id: pesquisaId } });
  await prisma.usuario.delete({ where: { id: usuarioId } });
});

describe("adicionarSemanaGestacional", () => {
  it("insere depois do peso atual e empurra as seguintes", async () => {
    const r = await adicionarSemanaGestacional(usuarioId, pesquisaId);
    expect(r.criada).toBe(true);
    const ordem = await prisma.pergunta.findMany({ where: { pesquisaId }, orderBy: { ordem: "asc" }, select: { enunciado: true, tipo: true } });
    expect(ordem.map((p) => p.enunciado)).toEqual([
      "Qual a altura da gestante em metros (atual)?",
      "Qual é o peso atual da gestante?",
      ENUNCIADO_SEMANA,
      "Nos últimos três meses, os alimentos acabaram?",
    ]);
    expect(ordem[2].tipo).toBe("NUMERO");
  });

  it("rodar de novo não duplica", async () => {
    const r = await adicionarSemanaGestacional(usuarioId, pesquisaId);
    expect(r.criada).toBe(false);
    expect(await prisma.pergunta.count({ where: { pesquisaId, enunciado: ENUNCIADO_SEMANA } })).toBe(1);
  });
});
```

Antes de rodar, confira em `prisma/schema.prisma` os nomes reais dos campos obrigatórios de `Usuario`, `Pesquisa` e do model de log (o teste assume `nome`, `email`, `senhaHash`, `papel`; `titulo`, `status`, `responsavelId`; e `logAlteracao` com `usuarioId`). Ajuste o **teste** aos nomes reais; não mude o schema.

- [ ] **Step 3: Run to verify failure**

Run: `cd backend && npx vitest run tests/semanaGestacional.test.ts`
Expected: FAIL — o script não existe.

- [ ] **Step 4: Implement** — `backend/scripts/adicionar-semana-gestacional.ts`:

```ts
// Acrescenta "Semana gestacional atual" à pesquisa Gestante já publicada
// (o sistema recusa editar pesquisa publicada pela API). Idempotente.
// Uso: npx tsx scripts/adicionar-semana-gestacional.ts
// Depois de rodar, reinicie a API ou edite qualquer indicador: o cache dos
// indicadores vive no processo da API e não enxerga escrita de outro processo.
import { fileURLToPath } from "node:url";
import { prisma } from "../src/config/prisma.js";
import { registrarLog } from "../src/helper/auditoria.js";

export const ENUNCIADO_SEMANA = "Semana gestacional atual";
const AJUDA = "Semanas completas de gestação (número inteiro de 1 a 42)";
const DEPOIS_DE = "Qual é o peso atual da gestante?";
const TITULO_GESTANTE = "Cartão CRIA — Gestante";

export async function adicionarSemanaGestacional(
  usuarioId: string,
  pesquisaId?: string,
): Promise<{ criada: boolean; perguntaId: string }> {
  const pesquisa = pesquisaId
    ? await prisma.pesquisa.findUniqueOrThrow({ where: { id: pesquisaId } })
    : await prisma.pesquisa.findFirstOrThrow({ where: { titulo: TITULO_GESTANTE, deletedAt: null } });

  const existente = await prisma.pergunta.findFirst({ where: { pesquisaId: pesquisa.id, enunciado: ENUNCIADO_SEMANA } });
  if (existente) return { criada: false, perguntaId: existente.id };

  const ancora = await prisma.pergunta.findFirstOrThrow({ where: { pesquisaId: pesquisa.id, enunciado: DEPOIS_DE } });

  const criada = await prisma.$transaction(async (tx) => {
    await tx.pergunta.updateMany({
      where: { pesquisaId: pesquisa.id, ordem: { gt: ancora.ordem } },
      data: { ordem: { increment: 1 } },
    });
    return tx.pergunta.create({
      data: {
        pesquisaId: pesquisa.id,
        secaoId: ancora.secaoId,
        enunciado: ENUNCIADO_SEMANA,
        tipo: "NUMERO",
        ajuda: AJUDA,
        ordem: ancora.ordem + 1,
      },
    });
  });

  await registrarLog({
    entidade: "Pergunta",
    entidadeId: criada.id,
    acao: "CREATE",
    usuarioId,
    dadosDepois: { pesquisaId: pesquisa.id, enunciado: ENUNCIADO_SEMANA, ordem: criada.ordem, origem: "script adicionar-semana-gestacional" },
  });
  return { criada: true, perguntaId: criada.id };
}

// Execução direta: atribui a alteração ao primeiro ADMIN ativo.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const admin = await prisma.usuario.findFirstOrThrow({ where: { papel: "ADMIN", ativo: true }, orderBy: { createdAt: "asc" } });
  const r = await adicionarSemanaGestacional(admin.id);
  console.log(r.criada ? `pergunta criada: ${r.perguntaId}` : `já existia: ${r.perguntaId}`);
  await prisma.$disconnect();
}
```

Confira a assinatura real de `registrarLog` em `src/helper/auditoria.ts` (campos opcionais como `dadosAntes`, `ip`) e ajuste a chamada se algum nome diferir. Confira também se o `tsconfig.json`/vitest inclui `scripts/` (o teste importa de `../scripts/`); se o `tsc -p .` não cobrir `scripts/`, o import do teste ainda funciona pelo vitest.

- [ ] **Step 5: Run**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run tests/semanaGestacional.test.ts`
Expected: PASS.

- [ ] **Step 6: Rodar no banco de desenvolvimento e conferir**

Run: `cd backend && npx tsx scripts/adicionar-semana-gestacional.ts && npx tsx scripts/adicionar-semana-gestacional.ts`
Expected: `pergunta criada: <id>` na primeira vez e `já existia: <id>` na segunda.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/pesquisas-cartao-cria.ts docs/pesquisas-cartao-cria.md backend/scripts/adicionar-semana-gestacional.ts backend/tests/semanaGestacional.test.ts
git commit -m "feat: pergunta Semana gestacional atual na pesquisa Gestante"
```

---

### Task 9: Teste dourado e integração

**Files:**
- Test: `backend/tests/motorDouradoNovosTipos.test.ts` (novo)
- Test: `backend/tests/indicadoresIntegracao.test.ts` (acrescentar casos)
- Modify: `README.md` (seção de deploy: rodar o script da pergunta nova uma vez em produção)

**Interfaces:**
- Consumes: tudo das Tasks 1–8.

- [ ] **Step 1: Teste dourado** — `backend/tests/motorDouradoNovosTipos.test.ts`. Oito respostas sintéticas, valores calculados à mão no comentário. Use as funções reais (`calcular`, `montarResposta`) e indicadores com os tipos novos:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { calcular, type IndicadorParaCalculo } from "../src/helper/motor/calcular.js";
import { montarResposta } from "../src/helper/motor/avaliadores.js";

/**
 * Oito crianças, entrevista em 2026-01-01.
 *
 * CPRE (ESCALA: Antes=100, Após=50, Sem=0, Não soube=fora):
 *   respostas: Antes, Antes, Após, Sem, Não soube, Antes, Após, Antes
 *   notas válidas: 100,100,50,0,100,50,100 (7) -> 500/7 = 71.43
 *
 * CPUER (META_POR_IDADE 0–11:7, 12–23:2, 24+:1):
 *   idades (meses): 6, 6, 18, 18, 30, 30, 9, 40
 *   consultas:      7, 3,  2,  1,  0,  2, null, 1
 *   valores: 100, 42.857143, 100, 50, 0, 100, (fora), 100 -> 492.857143/7 = 70.41
 */
const ENTREVISTA = new Date("2026-01-01T12:00:00Z");
const NASC: Record<number, string> = { 6: "2025-07-01", 9: "2025-04-01", 18: "2024-07-01", 30: "2023-07-01", 40: "2022-09-01" };
const P = new Set(["pn", "consultas", "nasc"]);

function ind(p: Partial<IndicadorParaCalculo> & Pick<IndicadorParaCalculo, "id" | "tipo" | "config">): IndicadorParaCalculo {
  return { codigo: p.id, casasDecimais: 2, status: "ATIVO", pesquisaId: null, ...p };
}

const dados: Array<[string, number, number | null]> = [
  ["Antes", 6, 7], ["Antes", 6, 3], ["Após", 18, 2], ["Sem", 18, 1],
  ["Não soube", 30, 0], ["Antes", 30, 2], ["Após", 9, null], ["Antes", 40, 1],
];
const respostas = dados.map(([pn, meses, consultas], i) =>
  montarResposta(
    `c${i}`,
    [
      { perguntaId: "pn", opcoesSelecionadas: [pn] },
      { perguntaId: "nasc", valorData: new Date(NASC[meses]) },
      ...(consultas === null ? [] : [{ perguntaId: "consultas", valorNumero: consultas }]),
    ],
    null,
    { enviadaEm: ENTREVISTA },
  ),
);

let res: ReturnType<typeof calcular>;
beforeAll(() => {
  res = calcular(
    [
      ind({ id: "cpre", tipo: "ESCALA", config: { perguntaId: "pn", notas: { Antes: 100, "Após": 50, Sem: 0, "Não soube": null } } }),
      ind({ id: "cpuer", tipo: "META_POR_IDADE", config: { perguntaId: "consultas", nascimentoPerguntaId: "nasc",
        faixas: [{ deMeses: 0, ateMeses: 12, esperado: 7 }, { deMeses: 12, ateMeses: 24, esperado: 2 }, { deMeses: 24, ateMeses: null, esperado: 1 }] } }),
    ],
    respostas,
    P,
  );
});

describe("teste dourado — tipos novos", () => {
  it("CPRE", () => expect(res.get("cpre")).toEqual({ status: "OK", valor: 71.43 }));
  it("CPUER", () => expect(res.get("cpuer")).toEqual({ status: "OK", valor: 70.41 }));
});
```

Confira as contas do comentário antes de rodar (a de 2025-04-01 → 2026-01-01 dá 9 meses; a de 2022-09-01 dá 40). O ZSCORE, o PERCENTIL_OMS e o ATALAH já têm valores à mão nas Tasks 4–6; não os repita aqui.

- [ ] **Step 2: Integração** — em `backend/tests/indicadoresIntegracao.test.ts`, acrescente um caso no padrão do arquivo (cria pesquisa, perguntas e respostas reais, aprova, chama `GET /api/indicadores/calculo`, limpa no `afterAll`): uma `ESCALA` sobre uma pergunta de escolha única com três respostas aprovadas em dois municípios, e confira o valor sem filtro e com `?municipio=<um deles>`. Leia o arquivo inteiro antes e reaproveite os helpers dele.

- [ ] **Step 3: Dockerfile** — o serviço `seed` usa o estágio `build`, que hoje não tem a pasta `scripts/`. No `backend/Dockerfile`, estágio `build`, depois de `COPY data ./data`, acrescente `COPY scripts ./scripts`. Confira que o `.dockerignore` só exclui `scripts/*.mjs` (o `.ts` precisa entrar).

- [ ] **Step 4: README** — na seção "Deploy" do `README.md`, depois do bloco do seed, acrescente:

```markdown
Uma vez, depois do deploy que trouxe os indicadores novos: inclua a pergunta
"Semana gestacional atual" na pesquisa Gestante publicada (idempotente) e reinicie a API:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod --profile seed run --rm seed npx tsx scripts/adicionar-semana-gestacional.ts
docker compose -f docker-compose.prod.yml --env-file .env.prod restart api
```
```

- [ ] **Step 5: Run tudo**

Run: `cd backend && npx tsc --noEmit -p . && npx vitest run && npm run build`
Expected: PASS na suíte inteira e build ok.

- [ ] **Step 6: Commit**

```bash
git add backend/tests backend/Dockerfile README.md
git commit -m "test: teste dourado e integracao dos tipos novos de indicador"
```

---

## Ao fim deste plano

O cadastro aceita e confere os cinco tipos novos; o motor calcula CPRE, CPUER, Índice Socioeconômico (z-score contra a pesquisa), desnutrição/obesidade pelas curvas da OMS e IMC da gestante por Atalah; o filtro do painel atua na agregação sem mudar nenhum número antigo; e a pesquisa Gestante ganhou "Semana gestacional atual". Ficam para os planos seguintes: importação dos 110 indicadores do Cartão CRIA da planilha (fase 3) e painel (fase 4).
