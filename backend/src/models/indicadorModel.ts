import { prisma } from "../config/prisma.js";
import type { Prisma, StatusIndicador } from "@prisma/client";
import type { CriarIndicadorInput, AtualizarIndicadorInput } from "../helper/validators.js";

import type { PerguntaParaConferir } from "../helper/indicadorPerguntas.js";

export interface ListarIndicadoresFiltros {
  status?: StatusIndicador;
  pesquisaId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export const indicadorModel = {
  async listar(filtros: ListarIndicadoresFiltros = {}) {
    const { status, pesquisaId, q, page = 1, pageSize = 50 } = filtros;
    const where: Prisma.IndicadorWhereInput = { deletedAt: null };
    if (status) where.status = status;
    if (pesquisaId) where.pesquisaId = pesquisaId;
    if (q) where.nome = { contains: q, mode: "insensitive" };

    const [total, itens] = await Promise.all([
      prisma.indicador.count({ where }),
      prisma.indicador.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { codigo: "asc" },
      }),
    ]);
    return { total, itens };
  },

  obterPorId(id: string) {
    return prisma.indicador.findFirst({ where: { id, deletedAt: null } });
  },

  async perguntasPorId(ids: string[]): Promise<PerguntaParaConferir[]> {
    if (ids.length === 0) return [];
    const linhas = await prisma.pergunta.findMany({
      where: { id: { in: ids } },
      select: { id: true, tipo: true, opcoes: { select: { texto: true }, orderBy: { ordem: "asc" } } },
    });
    return linhas.map((l) => ({ id: l.id, tipo: l.tipo, opcoes: l.opcoes.map((o) => o.texto) }));
  },

  /** Dos ids recebidos, devolve só os que existem e não foram apagados. */
  async idsAtivos(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const linhas = await prisma.indicador.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    return linhas.map((l) => l.id);
  },

  async pesquisaExiste(id: string): Promise<boolean> {
    return (await prisma.pesquisa.count({ where: { id, deletedAt: null } })) > 0;
  },

  listarAtivos() {
    return prisma.indicador.findMany({ where: { deletedAt: null, status: { not: "INATIVO" } } });
  },

  async criar(dados: CriarIndicadorInput, usuarioId: string, dependencias: string[]) {
    // Explícito, não o default da coluna (DEFINICAO_INCOMPLETA): indicador da API nasce calculável.
    const status = dados.status ?? "ATIVO";
    return prisma.indicador.create({
      data: {
        codigo: dados.codigo,
        nome: dados.nome,
        objetivo: dados.objetivo,
        tipo: dados.tipo,
        unidade: dados.unidade,
        casasDecimais: dados.casasDecimais,
        pesquisaId: dados.pesquisaId,
        config: dados.config as Prisma.InputJsonValue,
        recorte: dados.recorte,
        recorteConfig: dados.recorteConfig as Prisma.InputJsonValue | undefined,
        meta: dados.meta,
        formulaOriginal: dados.formulaOriginal,
        origemPlanilha: dados.origemPlanilha,
        status,
        motivoIncompleto: status === "DEFINICAO_INCOMPLETA" ? dados.motivoIncompleto : null,
        createdById: usuarioId,
        dependeDe: { create: dependencias.map((dependeDeId) => ({ dependeDeId })) },
      },
    });
  },

  async atualizar(id: string, dados: AtualizarIndicadorInput, usuarioId: string, dependencias: string[]) {
    return prisma.$transaction(async (tx) => {
      await tx.indicadorDependencia.deleteMany({ where: { indicadorId: id } });
      return tx.indicador.update({
        where: { id },
        data: {
          ...dados,
          // Saiu de DEFINICAO_INCOMPLETA: o motivo antigo não descreve mais nada.
          ...(dados.status &&dados.status !== "DEFINICAO_INCOMPLETA" ? { motivoIncompleto: null } : {}),
          config: dados.config as Prisma.InputJsonValue,
          recorteConfig: dados.recorteConfig as Prisma.InputJsonValue | undefined,
          updatedById: usuarioId,
          dependeDe: { create: dependencias.map((dependeDeId) => ({ dependeDeId })) },
        },
      });
    });
  },

  softDelete(id: string, usuarioId: string) {
    return prisma.indicador.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: usuarioId },
    });
  },

  /** indicadorId -> ids de quem ele consome. Base da ordem de cálculo e da recusa de ciclo. */
  async grafoDeDependencias(): Promise<Map<string, string[]>> {
    const arestas = await prisma.indicadorDependencia.findMany({
      where: { indicador: { deletedAt: null } },
    });
    const grafo = new Map<string, string[]>();
    for (const { indicadorId, dependeDeId } of arestas) {
      grafo.set(indicadorId, [...(grafo.get(indicadorId) ?? []), dependeDeId]);
    }
    return grafo;
  },
};
