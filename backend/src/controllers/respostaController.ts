import type { Request, Response } from "express";
import type { StatusResposta } from "@prisma/client";
import { respostaModel } from "../models/respostaModel.js";
import type { ListarRespostasFiltros } from "../models/respostaModel.js";
import { pesquisaModel } from "../models/pesquisaModel.js";
import { registrarLog } from "../helper/auditoria.js";
import { invalidarCache } from "../helper/cacheIndicadores.js";
import {
  validarRespostaContraPerguntas,
  normalizarOpcoesParaTexto,
  type PerguntaParaValidacao,
} from "../helper/validarResposta.js";
import { parsePaginacao } from "../helper/paginacao.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { CriarRespostaInput, AtualizarRespostaInput, ReprovarRespostaInput } from "../helper/validators.js";

function parseQueryString(valor: unknown): string | undefined {
  return typeof valor === "string" ? valor : undefined;
}

function parseQueryDate(valor: unknown): Date | undefined {
  const texto = parseQueryString(valor);
  if (!texto) return undefined;
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? undefined : data;
}

function parseStatus(valor: unknown): StatusResposta | undefined {
  const texto = parseQueryString(valor);
  if (texto === "PENDENTE" || texto === "APROVADA" || texto === "REPROVADA") return texto;
  return undefined;
}

/** Filtros comuns (sem paginação) usados por resumo/export além da listagem. */
export function extrairFiltrosBase(query: Request["query"]): Omit<ListarRespostasFiltros, "page" | "pageSize"> {
  return {
    municipio: parseQueryString(query.municipio),
    regional: parseQueryString(query.regional),
    unidade: parseQueryString(query.unidade),
    status: parseStatus(query.status),
    de: parseQueryDate(query.de),
    ate: parseQueryDate(query.ate),
  };
}

export function extrairFiltrosListagem(query: Request["query"]): ListarRespostasFiltros {
  return {
    ...extrairFiltrosBase(query),
    ...parsePaginacao(query, 50),
  };
}

/**
 * Caminho único de criação e edição: valida contra as perguntas e grava as opções
 * pelo texto (ver normalizarOpcoesParaTexto).
 */
function validarEPreparar<T extends CriarRespostaInput>(perguntas: PerguntaParaValidacao[], dados: T): T {
  const erros = validarRespostaContraPerguntas(perguntas, dados.itens);
  if (erros.length > 0) {
    throw new HttpError(422, "VALIDACAO_RESPOSTA", "Resposta inválida", erros);
  }
  return { ...dados, itens: normalizarOpcoesParaTexto(perguntas, dados.itens) };
}

export async function criar(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id: pesquisaId } = req.params;

  const pesquisa = await pesquisaModel.obterPorId(pesquisaId);
  if (!pesquisa) throw new HttpError(404, "NAO_ENCONTRADA", "Pesquisa não encontrada");
  if (pesquisa.status !== "PUBLICADA") {
    throw new HttpError(409, "PESQUISA_NAO_PUBLICADA", "pesquisa não está publicada");
  }

  const dados = validarEPreparar(pesquisa.perguntas, req.body as CriarRespostaInput);

  const resposta = await respostaModel.criar(pesquisaId, usuario.id, dados);
  invalidarCache();
  await registrarLog({
    entidade: "Resposta",
    entidadeId: resposta.id,
    acao: "CREATE",
    usuarioId: usuario.id,
    dadosDepois: resposta,
    ip: req.ip,
  });

  res.status(201).json({ resposta });
}

export async function atualizar(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id } = req.params;

  const atual = await respostaModel.obterPorId(id);
  if (!atual) throw new HttpError(404, "NAO_ENCONTRADA", "Resposta não encontrada");

  const ehDono = atual.coletadorId === usuario.id;
  const ehGestor = usuario.papel === "GESTOR" || usuario.papel === "ADMIN";
  if (!ehDono && !ehGestor) {
    throw new HttpError(403, "SEM_PERMISSAO", "Você não pode editar esta resposta");
  }

  const pesquisa = await pesquisaModel.obterPorId(atual.pesquisaId);
  if (!pesquisa) throw new HttpError(404, "NAO_ENCONTRADA", "Pesquisa não encontrada");

  const dados = validarEPreparar(pesquisa.perguntas, req.body as AtualizarRespostaInput);

  const resposta = await respostaModel.atualizar(id, dados);
  invalidarCache();
  await registrarLog({
    entidade: "Resposta",
    entidadeId: id,
    acao: "UPDATE",
    usuarioId: usuario.id,
    dadosAntes: atual,
    dadosDepois: resposta,
    ip: req.ip,
  });

  res.json({ resposta });
}

export async function aprovar(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id } = req.params;

  const atual = await respostaModel.obterPorId(id);
  if (!atual) throw new HttpError(404, "NAO_ENCONTRADA", "Resposta não encontrada");

  const resposta = await respostaModel.mudarStatus(id, "APROVADA", usuario.id);
  invalidarCache();
  await registrarLog({
    entidade: "Resposta",
    entidadeId: id,
    acao: "APROVAR",
    usuarioId: usuario.id,
    dadosAntes: atual,
    dadosDepois: resposta,
    ip: req.ip,
  });

  res.json({ resposta });
}

export async function reprovar(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id } = req.params;
  const { observacao } = req.body as ReprovarRespostaInput;

  const atual = await respostaModel.obterPorId(id);
  if (!atual) throw new HttpError(404, "NAO_ENCONTRADA", "Resposta não encontrada");

  const resposta = await respostaModel.mudarStatus(id, "REPROVADA", usuario.id, observacao);
  invalidarCache();
  await registrarLog({
    entidade: "Resposta",
    entidadeId: id,
    acao: "REPROVAR",
    usuarioId: usuario.id,
    dadosAntes: atual,
    dadosDepois: resposta,
    ip: req.ip,
  });

  res.json({ resposta });
}

export async function listar(req: Request, res: Response) {
  const { id: pesquisaId } = req.params;

  const pesquisa = await pesquisaModel.obterPorId(pesquisaId);
  if (!pesquisa) throw new HttpError(404, "NAO_ENCONTRADA", "Pesquisa não encontrada");

  const filtros = extrairFiltrosListagem(req.query);
  const { total, itens } = await respostaModel.listar(pesquisaId, filtros);
  res.json({ total, page: filtros.page, pageSize: filtros.pageSize, itens });
}

export async function obter(req: Request, res: Response) {
  const { id } = req.params;
  const resposta = await respostaModel.obterPorId(id);
  if (!resposta) throw new HttpError(404, "NAO_ENCONTRADA", "Resposta não encontrada");
  res.json({ resposta });
}

export async function remover(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id } = req.params;

  const atual = await respostaModel.obterPorId(id);
  if (!atual) throw new HttpError(404, "NAO_ENCONTRADA", "Resposta não encontrada");

  await respostaModel.softDelete(id, usuario.id);
  invalidarCache();
  await registrarLog({
    entidade: "Resposta",
    entidadeId: id,
    acao: "DELETE",
    usuarioId: usuario.id,
    dadosAntes: atual,
    ip: req.ip,
  });

  res.status(204).send();
}
