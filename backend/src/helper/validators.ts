import { z } from "zod";
import { senhaForte } from "./politicaSenha.js";

export const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ---------- Pesquisa ----------

export const criarPesquisaSchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  responsavelId: z.string().uuid(),
  periodoInicio: z.coerce.date().optional(),
  periodoFim: z.coerce.date().optional(),
});
export type CriarPesquisaInput = z.infer<typeof criarPesquisaSchema>;

export const atualizarPesquisaSchema = criarPesquisaSchema.partial();
export type AtualizarPesquisaInput = z.infer<typeof atualizarPesquisaSchema>;

// ---------- Seção / Pergunta / Opção ----------

export const opcaoSchema = z.object({
  texto: z.string().min(1),
  ordem: z.number().int().min(0),
});
export type OpcaoInput = z.infer<typeof opcaoSchema>;

export const perguntaSchema = z
  .object({
    enunciado: z.string().min(1),
    tipo: z.enum(["TEXTO", "NUMERO", "DATA", "MULTIPLA_ESCOLHA", "ESCOLHA_UNICA", "CAMPO_ABERTO"]),
    obrigatoria: z.boolean().default(false),
    ordem: z.number().int().min(0),
    secaoId: z.string().uuid().optional(),
    ajuda: z.string().optional(),
    opcoes: z.array(opcaoSchema).optional(),
  })
  .refine(
    (dados) => {
      const exigeOpcoes = dados.tipo === "MULTIPLA_ESCOLHA" || dados.tipo === "ESCOLHA_UNICA";
      const quantidade = dados.opcoes?.length ?? 0;
      return exigeOpcoes ? quantidade >= 2 : quantidade === 0;
    },
    {
      message:
        "Perguntas de múltipla escolha ou escolha única exigem ao menos 2 opções; demais tipos não devem ter opções.",
      path: ["opcoes"],
    },
  );
export type PerguntaInput = z.infer<typeof perguntaSchema>;

export const secaoSchema = z.object({
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  ordem: z.number().int().min(0),
});
export type SecaoInput = z.infer<typeof secaoSchema>;

export const reordenarSchema = z.object({
  ordem: z.array(z.string().uuid()).min(1),
});
export type ReordenarInput = z.infer<typeof reordenarSchema>;

// ---------- Resposta ----------

export const itemRespostaSchema = z.object({
  perguntaId: z.string().uuid(),
  valorTexto: z.string().optional(),
  valorNumero: z.number().optional(),
  valorData: z.coerce.date().optional(),
  opcoesSelecionadas: z.array(z.string()).optional(),
});
export type ItemRespostaInput = z.infer<typeof itemRespostaSchema>;

export const criarRespostaSchema = z.object({
  municipio: z.string().optional(),
  unidade: z.string().optional(),
  regional: z.string().optional(),
  itens: z.array(itemRespostaSchema).min(1),
});
export type CriarRespostaInput = z.infer<typeof criarRespostaSchema>;

export const atualizarRespostaSchema = criarRespostaSchema;
export type AtualizarRespostaInput = z.infer<typeof atualizarRespostaSchema>;

export const reprovarRespostaSchema = z.object({
  observacao: z.string().max(500).optional(),
});
export type ReprovarRespostaInput = z.infer<typeof reprovarRespostaSchema>;

// ---------- Usuário ----------

export const criarUsuarioSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: senhaForte,
  papel: z.enum(["ADMIN", "GESTOR", "COLETADOR", "VISUALIZADOR"]),
});
export type CriarUsuarioInput = z.infer<typeof criarUsuarioSchema>;

export const atualizarUsuarioSchema = z.object({
  nome: z.string().min(1).optional(),
  email: z.string().email().optional(),
  papel: z.enum(["ADMIN", "GESTOR", "COLETADOR", "VISUALIZADOR"]).optional(),
  ativo: z.boolean().optional(),
  senha: senhaForte.optional(),
});
export type AtualizarUsuarioInput = z.infer<typeof atualizarUsuarioSchema>;

export const trocarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1),
    senhaNova: senhaForte,
  })
  .refine((dados) => dados.senhaAtual !== dados.senhaNova, {
    message: "A nova senha precisa ser diferente da atual.",
    path: ["senhaNova"],
  });
export type TrocarSenhaInput = z.infer<typeof trocarSenhaSchema>;

// ---------- Atualização parcial de Pergunta ----------
// `perguntaSchema` usa `.refine()`, que impede `.partial()`. Este schema aceita
// campos parciais e só valida a regra de opções quando `tipo` E `opcoes` vierem.
export const atualizarPerguntaSchema = z
  .object({
    enunciado: z.string().min(1).optional(),
    tipo: z.enum(["TEXTO", "NUMERO", "DATA", "MULTIPLA_ESCOLHA", "ESCOLHA_UNICA", "CAMPO_ABERTO"]).optional(),
    obrigatoria: z.boolean().optional(),
    ordem: z.number().int().min(0).optional(),
    secaoId: z.string().uuid().optional(),
    ajuda: z.string().optional(),
    opcoes: z.array(opcaoSchema).optional(),
  })
  .superRefine((dados, ctx) => {
    if (dados.tipo === undefined || dados.opcoes === undefined) return;
    const exigeOpcoes = dados.tipo === "MULTIPLA_ESCOLHA" || dados.tipo === "ESCOLHA_UNICA";
    const quantidade = dados.opcoes.length;
    if (exigeOpcoes && quantidade < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["opcoes"], message: "Exige ao menos 2 opções." });
    }
    if (!exigeOpcoes && quantidade > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["opcoes"], message: "Este tipo não deve ter opções." });
    }
  });
export type AtualizarPerguntaInput = z.infer<typeof atualizarPerguntaSchema>;

// ---------- Indicador ----------

const indicadorBaseSchema = z.object({
  codigo: z.string().min(1).max(60),
  nome: z.string().min(1),
  objetivo: z.string().optional(),
  tipo: z.enum([
    "PROPORCAO", "CRUZAMENTO", "MEDIA", "DERIVADA",
    "COMPOSTO", "CLASSIFICACAO", "CONTAGEM", "DISTRIBUICAO",
  ]),
  unidade: z.string().optional(),
  casasDecimais: z.number().int().min(0).max(4).default(1),
  pesquisaId: z.string().uuid().optional(),
  config: z.unknown(),
  recorte: z.literal("ANTES_APOS").optional(),
  recorteConfig: z
    .object({ substituicoes: z.array(z.object({ de: z.string().min(1), para: z.string().min(1) })).min(1) })
    .optional(),
  meta: z.number().optional(),
  formulaOriginal: z.string().optional(),
  origemPlanilha: z.number().int().optional(),
  // Sem status, o indicador nasce ATIVO (indicadorModel.criar): a API cadastra para calcular.
  status: z.enum(["ATIVO", "DEFINICAO_INCOMPLETA", "INATIVO"]).optional(),
  motivoIncompleto: z.string().optional(),
});

/**
 * Regras entre campos, as mesmas na criação e na edição. Na edição valem sobre o
 * registro mesclado (gravado + corpo), não só sobre o corpo: ver
 * `regrasIndicadorMescladoSchema`, aplicado em indicadorController.atualizar.
 */
interface CamposComRegra {
  status?: string;
  motivoIncompleto?: string;
  recorte?: string;
  recorteConfig?: unknown;
}

function regrasDoIndicador(dados: CamposComRegra, ctx: z.RefinementCtx) {
  if (dados.status === "DEFINICAO_INCOMPLETA" && !dados.motivoIncompleto?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["motivoIncompleto"],
      message: "Definição incompleta exige o motivo.",
    });
  }
  if (dados.recorte === "ANTES_APOS" && dados.recorteConfig === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recorteConfig"],
      message: "Recorte ANTES/APÓS exige recorteConfig.",
    });
  }
  if (dados.recorteConfig !== undefined && dados.recorte !== "ANTES_APOS") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recorte"],
      message: "recorteConfig só vale com recorte ANTES_APOS.",
    });
  }
}

export const criarIndicadorSchema = indicadorBaseSchema.superRefine(regrasDoIndicador);
export type CriarIndicadorInput = z.infer<typeof criarIndicadorSchema>;

// Sem as regras entre campos: só dá para conferi-las com o registro gravado em mãos.
export const atualizarIndicadorSchema = indicadorBaseSchema.partial();
export type AtualizarIndicadorInput = z.infer<typeof atualizarIndicadorSchema>;

/** As mesmas regras de `criarIndicadorSchema`, sobre o registro já mesclado (gravado + corpo). */
export const regrasIndicadorMescladoSchema = z
  .object({
    status: indicadorBaseSchema.shape.status,
    motivoIncompleto: z.string().optional(),
    recorte: indicadorBaseSchema.shape.recorte,
    recorteConfig: z.unknown().optional(),
  })
  .superRefine(regrasDoIndicador);
