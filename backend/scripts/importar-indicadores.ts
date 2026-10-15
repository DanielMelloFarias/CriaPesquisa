// Importa os indicadores do Cartão CRIA da "Exportação Indicadores.xlsx".
// Tudo nasce DEFINICAO_INCOMPLETA, para revisão na tela de indicadores.
// Idempotente: o que já existe (pelo código ou pelo id da planilha) é pulado e
// nunca sobrescrito, então rodar de novo não desfaz a revisão de ninguém.
// Uso: npx tsx scripts/importar-indicadores.ts <arquivo.xlsx>
// As colunas DtRegistro e Usuario (dados pessoais) não são lidas.
// Depois de rodar, reinicie a API: o cache dos indicadores vive no processo da
// API e não enxerga escrita de outro processo.
import { fileURLToPath } from "node:url";
import { prisma } from "../src/config/prisma.js";
import { registrarLog } from "../src/helper/auditoria.js";
import { indicadorModel } from "../src/models/indicadorModel.js";
import { indicadoresReferenciados, validarConfig, type TipoIndicador } from "../src/helper/indicadorConfig.js";
import type { CriarIndicadorInput } from "../src/helper/validators.js";
import { lerPlanilha, type LinhaPlanilha } from "../src/helper/importacao/planilha.js";
import { DEFINICOES, type DefinicaoConhecida } from "../src/helper/importacao/definicoes-cartao-cria.js";
import { resolverDefinicao, type PerguntaDoBanco } from "../src/helper/importacao/resolver.js";
import { sugerirPergunta, sugerirTipo, type PerguntaCandidata } from "../src/helper/importacao/casamento.js";

type Situacao = "DEFINICAO_PRONTA" | "PERGUNTA_SUGERIDA" | "AMBIGUA" | "SEM_CANDIDATA" | "SEM_DESCRICAO";

export type ResumoImportacao = {
  lidas: number;
  importadas: number;
  jaExistiam: number;
  porSituacao: Record<Situacao, string[]>;
  auxiliares: number;
};

const TITULOS = {
  "Cartão CRIA (Criança)": "Cartão CRIA — Criança",
  "Cartão CRIA (Gestante)": "Cartão CRIA — Gestante",
} as const;
const PREFIXO = { "Cartão CRIA (Criança)": "CRIA-C-", "Cartão CRIA (Gestante)": "CRIA-G-" } as const;

type PerguntaCarregada = PerguntaCandidata & { pesquisa: string };

function dadosPlanilha(l: LinhaPlanilha): Record<string, string> {
  return {
    nome: l.nome,
    formulaCalculo: l.formulaCalculo,
    formulaDescritiva: l.formulaDescritiva,
    perguntaDescricao: l.perguntaDescricao,
    objetivo: l.objetivo,
    observacoes: l.observacoes,
    categoria: l.categoria,
  };
}

/** Só depende de quem a config valida cita; config pela metade não tem dependência. */
function dependenciasDe(tipo: TipoIndicador, config: unknown): string[] {
  try {
    return indicadoresReferenciados(validarConfig(tipo, config));
  } catch {
    return [];
  }
}

const vazioParaUndefined = (s: string | undefined) => (s && s.trim() ? s : undefined);

export async function importarIndicadores(caminho: string, usuarioId: string): Promise<ResumoImportacao> {
  // 1. Se a planilha não confere, para aqui: nada foi gravado.
  const linhas = await lerPlanilha(caminho);
  const porId = new Map(linhas.map((l) => [l.id, l]));

  // 2. Estado do banco.
  const pesquisas = await prisma.pesquisa.findMany({
    where: { titulo: { in: Object.values(TITULOS) }, deletedAt: null },
    select: { id: true, titulo: true },
  });
  const pesquisaPorTitulo = new Map(pesquisas.map((p) => [p.titulo, p.id]));
  for (const titulo of Object.values(TITULOS)) {
    if (!pesquisaPorTitulo.has(titulo)) throw new Error(`pesquisa não encontrada: ${titulo}`);
  }
  const perguntas: PerguntaCarregada[] = (
    await prisma.pergunta.findMany({
      where: { pesquisaId: { in: pesquisas.map((p) => p.id) } },
      select: { id: true, enunciado: true, tipo: true, pesquisa: { select: { titulo: true } } },
      orderBy: { ordem: "asc" },
    })
  ).map((p) => ({ id: p.id, enunciado: p.enunciado, tipo: p.tipo, pesquisa: p.pesquisa.titulo }));
  const perguntaPorId = new Map(perguntas.map((p) => [p.id, p]));
  const idsExistentes = await indicadorModel.idsPlanilhaExistentes();
  const codigosExistentes = await indicadorModel.codigosExistentes();

  const resumo: ResumoImportacao = {
    lidas: linhas.length,
    importadas: 0,
    jaExistiam: 0,
    porSituacao: { DEFINICAO_PRONTA: [], PERGUNTA_SUGERIDA: [], AMBIGUA: [], SEM_CANDIDATA: [], SEM_DESCRICAO: [] },
    auxiliares: 0,
  };

  const gravar = async (
    dados: CriarIndicadorInput,
    dependencias: string[],
    origem: { idsPlanilha: string[]; dadosPlanilha: Record<string, string> },
  ) => {
    // indicadorModel.criar não registra log (quem registra é o controller): registra aqui, uma vez.
    const indicador = await indicadorModel.criar(dados, usuarioId, dependencias, origem);
    await registrarLog({
      entidade: "Indicador",
      entidadeId: indicador.id,
      acao: "CREATE",
      usuarioId,
      dadosDepois: { ...indicador, origem: "script importar-indicadores" },
    });
    codigosExistentes.add(indicador.codigo);
    for (const id of indicador.idsPlanilha) idsExistentes.add(id);
    resumo.importadas++;
    return indicador;
  };

  // 3. Definições do mapa, em ordem de dependência.
  const idsPorCodigo = new Map<string, string>();
  const consumidos = new Set<string>(DEFINICOES.flatMap((d) => d.idsPlanilha));

  for (const def of DEFINICOES) {
    if (codigosExistentes.has(def.codigo) || def.idsPlanilha.some((id) => idsExistentes.has(id))) {
      resumo.jaExistiam++;
      const existente = await prisma.indicador.findFirst({
        where: {
          deletedAt: null,
          OR: [{ codigo: def.codigo }, ...(def.idsPlanilha.length ? [{ idsPlanilha: { hasSome: def.idsPlanilha } }] : [])],
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, codigo: true },
      });
      if (existente) idsPorCodigo.set(def.codigo, existente.id);
      continue;
    }
    const criado = await gravarDefinicao(def);
    idsPorCodigo.set(def.codigo, criado.id);
    if (def.idsPlanilha.length === 0) resumo.auxiliares++;
    else resumo.porSituacao.DEFINICAO_PRONTA.push(...def.idsPlanilha);
  }

  async function gravarDefinicao(def: DefinicaoConhecida) {
    const { config, recorteConfig, faltando } = resolverDefinicao(def, perguntas as PerguntaDoBanco[], idsPorCodigo);
    const linha = def.idsPlanilha.map((id) => porId.get(id)).find((l) => l !== undefined);
    const motivo = [def.motivo, ...faltando].join("; ");
    return gravar(
      {
        codigo: def.codigo,
        nome: def.nome,
        objetivo: vazioParaUndefined(linha?.objetivo),
        tipo: def.tipo,
        casasDecimais: 1,
        // MCB é média entre as duas pesquisas: fica sem pesquisa.
        pesquisaId: def.codigo === "MCB" ? undefined : pesquisaPorTitulo.get(def.pesquisa),
        config,
        recorte: recorteConfig ? "ANTES_APOS" : undefined,
        recorteConfig,
        formulaOriginal: vazioParaUndefined(linha?.formulaCalculo),
        apresentacao: def.apresentacao ?? linha?.apresentacao,
        categoria: vazioParaUndefined(linha?.categoria),
        status: "DEFINICAO_INCOMPLETA",
        motivoIncompleto: motivo,
      },
      dependenciasDe(def.tipo, config),
      { idsPlanilha: def.idsPlanilha, dadosPlanilha: linha ? dadosPlanilha(linha) : {} },
    );
  }

  // 4. Linhas que o mapa não cobre: sugestão de pergunta e de tipo.
  for (const linha of linhas) {
    if (consumidos.has(linha.id)) continue;
    const codigo = `${PREFIXO[linha.projeto]}${linha.id}`;
    if (idsExistentes.has(linha.id) || codigosExistentes.has(codigo)) {
      resumo.jaExistiam++;
      continue;
    }
    const titulo = TITULOS[linha.projeto];
    const daPesquisa = perguntas.filter((p) => p.pesquisa === titulo);
    const sugestao = sugerirPergunta(linha.perguntaDescricao, daPesquisa);

    const perguntaId =
      sugestao.situacao === "UNICA" ? sugestao.perguntaId : sugestao.situacao === "PAR" ? sugestao.antesId : undefined;
    const pergunta = perguntaId ? perguntaPorId.get(perguntaId) : undefined;
    const tipoSugerido = sugerirTipo(linha.formulaCalculo, pergunta?.tipo ?? null);

    let tipo: TipoIndicador = "CONTAGEM";
    let config: Record<string, unknown> = {};
    if (tipoSugerido === "PROPORCAO" && perguntaId) {
      tipo = "PROPORCAO";
      config = { perguntaId, opcoesNumerador: [] };
    } else if ((tipoSugerido === "DISTRIBUICAO" || tipoSugerido === "MEDIA") && perguntaId) {
      tipo = tipoSugerido;
      config = { perguntaId };
    }
    const comTipo = tipoSugerido !== null && (tipoSugerido === "CONTAGEM" || perguntaId !== undefined);

    let motivo: string;
    let situacao: Situacao;
    switch (sugestao.situacao) {
      case "UNICA":
      case "PAR":
        situacao = "PERGUNTA_SUGERIDA";
        motivo = comTipo
          ? `pergunta sugerida: ${pergunta!.enunciado} — conferir tipo e opções`
          : `pergunta sugerida: ${pergunta!.enunciado} — definir tipo e pergunta`;
        break;
      case "AMBIGUA":
        situacao = "AMBIGUA";
        motivo = "a linha cita mais de uma pergunta — escolher na revisão";
        break;
      case "NENHUMA":
        situacao = "SEM_CANDIDATA";
        motivo = "nenhuma pergunta parecida — escolher na revisão";
        break;
      case "SEM_DESCRICAO":
        situacao = "SEM_DESCRICAO";
        motivo = "planilha sem a pergunta — escolher na revisão";
        break;
    }

    const recorteConfig =
      sugestao.situacao === "PAR" ? { substituicoes: [{ de: sugestao.antesId, para: sugestao.aposId }] } : undefined;

    await gravar(
      {
        codigo,
        nome: linha.nome || codigo,
        objetivo: vazioParaUndefined(linha.objetivo),
        tipo,
        casasDecimais: 1,
        pesquisaId: pesquisaPorTitulo.get(titulo),
        config,
        recorte: recorteConfig ? "ANTES_APOS" : undefined,
        recorteConfig,
        formulaOriginal: vazioParaUndefined(linha.formulaCalculo),
        apresentacao: linha.apresentacao,
        categoria: vazioParaUndefined(linha.categoria),
        status: "DEFINICAO_INCOMPLETA",
        motivoIncompleto: motivo,
      },
      [],
      { idsPlanilha: [linha.id], dadosPlanilha: dadosPlanilha(linha) },
    );
    resumo.porSituacao[situacao].push(linha.id);
  }

  return resumo;
}

export function formatarResumo(r: ResumoImportacao): string {
  const pelaSugestao =
    r.porSituacao.PERGUNTA_SUGERIDA.length +
    r.porSituacao.AMBIGUA.length +
    r.porSituacao.SEM_CANDIDATA.length +
    r.porSituacao.SEM_DESCRICAO.length;
  const pelaMapa = r.importadas - pelaSugestao - r.auxiliares;
  const lista = (ids: string[]) => (ids.length ? ids.join(", ") : "—");
  return [
    `${r.lidas} lidas · ${pelaMapa} importadas pelo mapa · ${pelaSugestao} por sugestão · ${r.jaExistiam} já existiam · ${r.auxiliares} auxiliares`,
    `definição pronta: ${lista(r.porSituacao.DEFINICAO_PRONTA)}`,
    `pergunta sugerida: ${lista(r.porSituacao.PERGUNTA_SUGERIDA)}`,
    `ambígua: ${lista(r.porSituacao.AMBIGUA)}`,
    `sem candidata: ${lista(r.porSituacao.SEM_CANDIDATA)}`,
    `sem descrição: ${lista(r.porSituacao.SEM_DESCRICAO)}`,
  ].join("\n");
}

// Execução direta: atribui a importação ao primeiro ADMIN ativo.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const caminho = process.argv[2];
    if (!caminho) throw new Error("uso: npx tsx scripts/importar-indicadores.ts <arquivo.xlsx>");
    const admin = await prisma.usuario.findFirstOrThrow({
      where: { papel: "ADMIN", ativo: true },
      orderBy: { createdAt: "asc" },
    });
    console.log(formatarResumo(await importarIndicadores(caminho, admin.id)));
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
