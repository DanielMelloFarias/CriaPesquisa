import { z } from "zod";

/**
 * Catálogo fechado de tipos. Cada tipo tem sua forma de config, validada aqui.
 *
 * A expressão da DERIVADA é uma árvore, não texto: avaliar string exigiria
 * `eval` ou um parser, e nenhum dos dois é aceitável para um campo que vem do
 * banco e é editável pela tela.
 */

const id = z.string().min(1);

const noExpressao: z.ZodType<NoExpressao> = z.lazy(() =>
  z.union([
    z.object({ var: z.string().min(1) }).strict(),
    z.object({ const: z.number().finite() }).strict(),
    z.object({ op: z.enum(["+", "-", "*", "/"]), esq: noExpressao, dir: noExpressao }).strict(),
  ]),
);

export type NoExpressao =
  | { var: string }
  | { const: number }
  | { op: "+" | "-" | "*" | "/"; esq: NoExpressao; dir: NoExpressao };

const proporcao = z.object({
  tipo: z.literal("PROPORCAO"),
  perguntaId: id,
  opcoesNumerador: z.array(z.string().min(1)).min(1),
}).strict();

const condicao = z.object({
  perguntaId: id,
  opcoes: z.array(z.string().min(1)).min(1).optional(),
  operador: z.enum(["<", "<=", ">", ">=", "=="]).optional(),
  valor: z.number().finite().optional(),
})
  .strict()
  .refine(
    (c) => {
      const temOpcoes = c.opcoes !== undefined;
      const temOperador = c.operador !== undefined;
      const temValor = c.valor !== undefined;
      return temOpcoes ? !temOperador && !temValor : temOperador && temValor;
    },
    { message: "condição precisa de opcoes, ou de operador e valor juntos (não ambos)" },
  );

const cruzamento = z.object({
  tipo: z.literal("CRUZAMENTO"),
  condicoes: z.array(condicao).min(2),
}).strict();

const media = z.object({ tipo: z.literal("MEDIA"), perguntaId: id }).strict();

const derivada = z
  .object({
    tipo: z.literal("DERIVADA"),
    variaveis: z.record(z.string().min(1), id),
    expressao: noExpressao,
  })
  .strict()
  .refine(
    (c) => variaveisUsadas(c.expressao).every((v) => Object.hasOwn(c.variaveis, v)),
    { message: "expressão usa variável não declarada" },
  )
  .refine((c) => !temDivisaoPorZeroLiteral(c.expressao), {
    message: "expressão divide por zero literal",
  });

const composto = z.object({
  tipo: z.literal("COMPOSTO"),
  termos: z.array(z.object({ indicadorId: id, peso: z.number().finite() }).strict()).min(1),
  divisor: z.number().finite().refine((d) => d !== 0, { message: "divisor não pode ser zero" }),
}).strict();

const classificacao = z.object({
  tipo: z.literal("CLASSIFICACAO"),
  indicadorId: id,
  faixas: z
    .array(z.object({ rotulo: z.string().min(1), de: z.number().finite(), ate: z.number().finite() }).strict())
    .min(1)
    .refine((fs) => fs.every((f) => f.de < f.ate), { message: "faixa com início maior que o fim" })
    .refine((fs) => fs.every((f, i) => i === 0 || fs[i - 1].ate <= f.de), {
      message: "faixas devem estar em ordem crescente e sem sobreposição",
    }),
}).strict();

const contagem = z.object({ tipo: z.literal("CONTAGEM") }).strict();
const distribuicao = z.object({ tipo: z.literal("DISTRIBUICAO"), perguntaId: id }).strict();

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

const esquemas = {
  PROPORCAO: proporcao,
  CRUZAMENTO: cruzamento,
  MEDIA: media,
  DERIVADA: derivada,
  COMPOSTO: composto,
  CLASSIFICACAO: classificacao,
  CONTAGEM: contagem,
  DISTRIBUICAO: distribuicao,
  ESCALA: escala,
  META_POR_IDADE: metaPorIdade,
  ZSCORE: zscore,
  PERCENTIL_OMS: percentilOms,
  ATALAH: atalah,
} as const;

export type TipoIndicador = keyof typeof esquemas;
export type ConfigIndicador = z.infer<(typeof esquemas)[TipoIndicador]>;

function variaveisUsadas(no: NoExpressao): string[] {
  if ("var" in no) return [no.var];
  if ("const" in no) return [];
  return [...variaveisUsadas(no.esq), ...variaveisUsadas(no.dir)];
}

function temDivisaoPorZeroLiteral(no: NoExpressao): boolean {
  if ("var" in no || "const" in no) return false;
  if (no.op === "/" && "const" in no.dir && no.dir.const === 0) return true;
  return temDivisaoPorZeroLiteral(no.esq) || temDivisaoPorZeroLiteral(no.dir);
}

export function validarConfig(tipo: TipoIndicador, config: unknown): ConfigIndicador {
  // O tipo vem do registro do indicador, nunca do JSON: sobrescreve qualquer `tipo` interno.
  // Entrada que não é objeto simples (null, array, texto) vai direto ao schema, que a recusa.
  const ehObjeto = typeof config === "object" && config !== null && !Array.isArray(config);
  return esquemas[tipo].parse(ehObjeto ? { ...config, tipo } : config) as ConfigIndicador;
}

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
