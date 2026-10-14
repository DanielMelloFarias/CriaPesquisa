import type { Request, Response } from "express";
import { perguntaModel } from "../models/perguntaModel.js";
import { pesquisaModel } from "../models/pesquisaModel.js";
import { registrarLog } from "../helper/auditoria.js";
import { invalidarCache } from "../helper/cacheIndicadores.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { SecaoInput, PerguntaInput, ReordenarInput } from "../helper/validators.js";

async function exigirPesquisaRascunho(pesquisaId: string) {
  const pesquisa = await pesquisaModel.obterPorId(pesquisaId);
  if (!pesquisa) throw new HttpError(404, "NAO_ENCONTRADA", "Pesquisa não encontrada");
  if (pesquisa.status !== "RASCUNHO") {
    throw new HttpError(409, "PESQUISA_PUBLICADA", "pesquisa publicada não pode ser editada");
  }
  return pesquisa;
}

// ---------- Seções ----------

export async function criarSecao(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id: pesquisaId } = req.params;

  await exigirPesquisaRascunho(pesquisaId);

  const dados = req.body as SecaoInput;
  const secao = await perguntaModel.criarSecao(pesquisaId, dados);
  await registrarLog({
    entidade: "Secao",
    entidadeId: secao.id,
    acao: "CREATE",
    usuarioId: usuario.id,
    dadosDepois: secao,
    ip: req.ip,
  });

  res.status(201).json({ secao });
}

export async function atualizarSecao(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id } = req.params;

  const secaoAtual = await perguntaModel.obterSecaoPorId(id);
  if (!secaoAtual) throw new HttpError(404, "NAO_ENCONTRADA", "Seção não encontrada");
  await exigirPesquisaRascunho(secaoAtual.pesquisaId);

  const dados = req.body as Partial<SecaoInput>;
  const secao = await perguntaModel.atualizarSecao(id, dados);
  await registrarLog({
    entidade: "Secao",
    entidadeId: id,
    acao: "UPDATE",
    usuarioId: usuario.id,
    dadosAntes: secaoAtual,
    dadosDepois: secao,
    ip: req.ip,
  });

  res.json({ secao });
}

export async function deletarSecao(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id } = req.params;

  const secaoAtual = await perguntaModel.obterSecaoPorId(id);
  if (!secaoAtual) throw new HttpError(404, "NAO_ENCONTRADA", "Seção não encontrada");
  await exigirPesquisaRascunho(secaoAtual.pesquisaId);

  await perguntaModel.deletarSecao(id);
  await registrarLog({
    entidade: "Secao",
    entidadeId: id,
    acao: "DELETE",
    usuarioId: usuario.id,
    dadosAntes: secaoAtual,
    ip: req.ip,
  });

  res.status(204).send();
}

// ---------- Perguntas ----------

export async function criarPergunta(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id: pesquisaId } = req.params;

  await exigirPesquisaRascunho(pesquisaId);

  const dados = req.body as PerguntaInput;
  const pergunta = await perguntaModel.criarPergunta(pesquisaId, dados);
  invalidarCache(); // o cálculo conhece as perguntas existentes
  await registrarLog({
    entidade: "Pergunta",
    entidadeId: pergunta.id,
    acao: "CREATE",
    usuarioId: usuario.id,
    dadosDepois: pergunta,
    ip: req.ip,
  });

  res.status(201).json({ pergunta });
}

export async function atualizarPergunta(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id } = req.params;

  const perguntaAtual = await perguntaModel.obterPerguntaPorId(id);
  if (!perguntaAtual) throw new HttpError(404, "NAO_ENCONTRADA", "Pergunta não encontrada");
  await exigirPesquisaRascunho(perguntaAtual.pesquisaId);

  const dados = req.body as Partial<PerguntaInput>;
  const pergunta = await perguntaModel.atualizarPergunta(id, dados);
  invalidarCache(); // pergunta ou opções mudaram: o número em cache pode estar velho
  await registrarLog({
    entidade: "Pergunta",
    entidadeId: id,
    acao: "UPDATE",
    usuarioId: usuario.id,
    dadosAntes: perguntaAtual,
    dadosDepois: pergunta,
    ip: req.ip,
  });

  res.json({ pergunta });
}

export async function deletarPergunta(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id } = req.params;

  const perguntaAtual = await perguntaModel.obterPerguntaPorId(id);
  if (!perguntaAtual) throw new HttpError(404, "NAO_ENCONTRADA", "Pergunta não encontrada");
  await exigirPesquisaRascunho(perguntaAtual.pesquisaId);

  await perguntaModel.deletarPergunta(id);
  invalidarCache(); // indicador que usava a pergunta passa a ficar incompleto
  await registrarLog({
    entidade: "Pergunta",
    entidadeId: id,
    acao: "DELETE",
    usuarioId: usuario.id,
    dadosAntes: perguntaAtual,
    ip: req.ip,
  });

  res.status(204).send();
}

export async function reordenarPerguntas(req: Request, res: Response) {
  const usuario = req.usuario!;
  const { id: pesquisaId } = req.params;

  await exigirPesquisaRascunho(pesquisaId);

  const { ordem } = req.body as ReordenarInput;
  await perguntaModel.reordenarPerguntas(pesquisaId, ordem);
  await registrarLog({
    entidade: "Pergunta",
    entidadeId: pesquisaId,
    acao: "UPDATE",
    usuarioId: usuario.id,
    dadosDepois: { ordem },
    ip: req.ip,
  });

  res.json({ ok: true });
}
