import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { indicadorModel } from "../models/indicadorModel.js";
import { registrarLog } from "../helper/auditoria.js";
import { HttpError } from "../middleware/errorHandler.js";
import { parsePaginacao } from "../helper/paginacao.js";
import { validarConfig, indicadoresReferenciados, perguntasReferenciadas } from "../helper/indicadorConfig.js";
import { problemasDasPerguntas } from "../helper/indicadorPerguntas.js";
import { ordenarPorDependencia, CicloDetectado } from "../helper/dependencias.js";
import { regrasIndicadorMescladoSchema, type CriarIndicadorInput, type AtualizarIndicadorInput } from "../helper/validators.js";
import { indicadorCalculoModel } from "../models/indicadorCalculoModel.js";
import { extrairFiltrosIndicador, chaveDeCache } from "../helper/filtrosIndicador.js";
import { lerCache, gravarCache, invalidarCache, geracaoAtual } from "../helper/cacheIndicadores.js";
import { calcular, type IndicadorParaCalculo } from "../helper/motor/calcular.js";
import { ItemDuplicado } from "../helper/motor/avaliadores.js";
import { mascaraDoRecorte } from "../helper/recortePainel.js";

/** Valida a config contra o tipo e devolve de quais indicadores este depende. */
function conferirConfig(tipo: CriarIndicadorInput["tipo"], config: unknown): string[] {
  return indicadoresReferenciados(validarConfig(tipo, config));
}

/**
 * Recusa o salvamento se a nova aresta fechar um ciclo.
 *
 * `id` precisa ser o uuid do indicador, porque é por uuid que as arestas são
 * gravadas. Na criação o uuid ainda não existe, então entra um nó sentinela:
 * ciclo na criação é impossível (nada consegue referenciar um id inexistente),
 * mas a checagem fica no mesmo caminho para não divergir das regras da edição.
 */
const statusSchema = z.enum(["ATIVO", "DEFINICAO_INCOMPLETA", "INATIVO"]);

/** Recusa (422) dependência para indicador inexistente/apagado e pesquisa inexistente, antes de gravar. */
async function conferirReferencias(dependencias: string[], pesquisaId?: string): Promise<void> {
  const unicas = [...new Set(dependencias)];
  const ativos = new Set(await indicadorModel.idsAtivos(unicas));
  const ausentes = unicas.filter((d) => !ativos.has(d));
  if (ausentes.length > 0) {
    throw new HttpError(422, "DEPENDENCIA_INEXISTENTE", "Config referencia indicador inexistente ou apagado", { ausentes });
  }
  if (pesquisaId && !(await indicadorModel.pesquisaExiste(pesquisaId))) {
    throw new HttpError(422, "PESQUISA_INEXISTENTE", "Pesquisa não encontrada");
  }
}

const TIPOS_CONFERIDOS = new Set(["ESCALA", "META_POR_IDADE", "PERCENTIL_OMS", "ATALAH"]);

/** Tipos novos: confere a config contra o tipo e as opções das perguntas reais (422 se não bater). */
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

/** Traduz violação de unicidade do `codigo` em 409; demais erros seguem. */
function traduzirErroDeGravacao(erro: unknown): never {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    throw new HttpError(409, "CODIGO_DUPLICADO", "Já existe um indicador com este código");
  }
  throw erro;
}

async function conferirCiclo(id: string, dependencias: string[]): Promise<void> {
  const grafo = await indicadorModel.grafoDeDependencias();
  grafo.set(id, dependencias);
  try {
    ordenarPorDependencia(grafo);
  } catch (erro) {
    if (erro instanceof CicloDetectado) {
      throw new HttpError(409, "DEPENDENCIA_CIRCULAR", erro.message, { ciclo: erro.ciclo });
    }
    throw erro;
  }
}

export async function listar(req: Request, res: Response) {
  const status = req.query.status === undefined ? undefined : statusSchema.parse(req.query.status);
  const { page, pageSize } = parsePaginacao(req.query, 50);
  const { total, itens } = await indicadorModel.listar({ status, page, pageSize });
  res.json({ total, page, pageSize, itens });
}

export async function obter(req: Request, res: Response) {
  const indicador = await indicadorModel.obterPorId(req.params.id);
  if (!indicador) throw new HttpError(404, "NAO_ENCONTRADO", "Indicador não encontrado");
  res.json({ indicador });
}

export async function criar(req: Request, res: Response) {
  const usuario = req.usuario!;
  const dados = req.body as CriarIndicadorInput;

  const dependencias = conferirConfig(dados.tipo, dados.config);
  await conferirReferencias(dependencias, dados.pesquisaId);
  await conferirPerguntas(dados.tipo, dados.config);
  await conferirCiclo("__novo__", dependencias);

  const indicador = await indicadorModel.criar(dados, usuario.id, dependencias).catch(traduzirErroDeGravacao);
  // Logo após gravar: se a auditoria falhar, o cache já não serve número velho.
  invalidarCache();
  await registrarLog({
    entidade: "Indicador",
    entidadeId: indicador.id,
    acao: "CREATE",
    usuarioId: usuario.id,
    dadosDepois: indicador,
    ip: req.ip,
  });
  res.status(201).json({ indicador });
}

export async function atualizar(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id } = req.params;
  const atual = await indicadorModel.obterPorId(id);
  if (!atual) throw new HttpError(404, "NAO_ENCONTRADO", "Indicador não encontrado");

  const dados = { ...(req.body as AtualizarIndicadorInput) };

  // As regras entre campos valem sobre o que vai ficar gravado, não só sobre o corpo:
  // quem manda só o status (ou só o recorte) aproveita o motivo (ou a config) já gravado.
  const statusFinal = dados.status ?? atual.status;
  regrasIndicadorMescladoSchema.parse({
    status: statusFinal,
    motivoIncompleto: dados.motivoIncompleto ?? atual.motivoIncompleto ?? undefined,
    recorte: dados.recorte ?? atual.recorte ?? undefined,
    recorteConfig: dados.recorteConfig ?? atual.recorteConfig ?? undefined,
  });
  // Motivo só descreve DEFINICAO_INCOMPLETA: fora dela, não grava sobra do corpo.
  if (statusFinal !== "DEFINICAO_INCOMPLETA") delete dados.motivoIncompleto;

  const tipo = dados.tipo ?? (atual.tipo as CriarIndicadorInput["tipo"]);
  const dependencias = conferirConfig(tipo, dados.config ?? atual.config);
  await conferirReferencias(dependencias, dados.pesquisaId);
  // Só quando tipo/config mudam: indicador cuja pergunta ganhou opção continua editável (o motor marca INCOMPLETO).
  if (dados.tipo !== undefined || dados.config !== undefined) await conferirPerguntas(tipo, dados.config ?? atual.config);
  await conferirCiclo(id, dependencias);

  const indicador = await indicadorModel.atualizar(id, dados, usuario.id, dependencias).catch(traduzirErroDeGravacao);
  invalidarCache();
  await registrarLog({
    entidade: "Indicador",
    entidadeId: id,
    acao: "UPDATE",
    usuarioId: usuario.id,
    dadosAntes: atual,
    dadosDepois: indicador,
    ip: req.ip,
  });
  res.json({ indicador });
}

export async function remover(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id } = req.params;
  const atual = await indicadorModel.obterPorId(id);
  if (!atual) throw new HttpError(404, "NAO_ENCONTRADO", "Indicador não encontrado");

  // Apagar um MCC em silêncio deixaria o IDTC e as classificações sem base.
  const grafo = await indicadorModel.grafoDeDependencias();
  const dependentes = [...grafo.entries()].filter(([, deps]) => deps.includes(id)).map(([quem]) => quem);
  if (dependentes.length > 0) {
    throw new HttpError(409, "INDICADOR_EM_USO", "Outros indicadores dependem deste", { dependentes });
  }

  await indicadorModel.softDelete(id, usuario.id);
  invalidarCache();
  await registrarLog({
    entidade: "Indicador",
    entidadeId: id,
    acao: "DELETE",
    usuarioId: usuario.id,
    dadosAntes: atual,
    ip: req.ip,
  });
  res.status(204).end();
}

export async function calculo(req: Request, res: Response) {
  const filtros = extrairFiltrosIndicador(req.query);
  const chave = chaveDeCache(filtros);

  const emCache = lerCache<Record<string, unknown>>(chave);
  if (emCache) return res.json({ resultados: emCache, cache: true });

  const geracao = geracaoAtual(); // antes de ler o banco: ver gravarCache
  const [indicadores, respostas, perguntas, perguntasSexo] = await Promise.all([
    indicadorModel.listarAtivos(),
    indicadorCalculoModel.carregarRespostas(),
    indicadorCalculoModel.perguntasExistentes(),
    indicadorCalculoModel.perguntasDeSexo(),
  ]).catch((erro: unknown) => {
    // Resposta gravada com dois itens para a mesma pergunta: dado corrompido, não falha do servidor.
    if (erro instanceof ItemDuplicado) {
      throw new HttpError(409, "DADO_INCONSISTENTE", erro.message, { respostaId: erro.respostaId });
    }
    throw erro;
  });
  const paraCalculo = indicadores as unknown as IndicadorParaCalculo[];

  let calculados;
  try {
    calculados = calcular(paraCalculo, respostas, perguntas, mascaraDoRecorte(respostas, filtros, perguntasSexo));
  } catch (erro) {
    // Ciclo já gravado (corrida entre dois salvamentos): dado corrompido, não falha do servidor.
    if (erro instanceof CicloDetectado) {
      throw new HttpError(409, "DEPENDENCIA_CIRCULAR", erro.message, { ciclo: erro.ciclo });
    }
    throw erro;
  }

  // A chave pública é o código, não o uuid: é o que o painel e a planilha usam.
  const porCodigo = new Map(paraCalculo.map((i) => [i.id, i.codigo]));
  const resultados = Object.fromEntries(
    [...calculados.entries()].map(([id, resultado]) => [porCodigo.get(id) ?? id, resultado]),
  );

  gravarCache(chave, resultados, geracao);
  res.json({ resultados, cache: false });
}
