import { prisma } from "../config/prisma.js";
import type { Prisma, StatusResposta } from "@prisma/client";
import type { CriarRespostaInput, AtualizarRespostaInput } from "../helper/validators.js";

export interface ListarRespostasFiltros {
  municipio?: string;
  regional?: string;
  unidade?: string;
  status?: StatusResposta;
  de?: Date;
  ate?: Date;
  /** Restringe ao que um coletador registrou (o COLETADOR só vê as próprias). */
  coletadorId?: string;
  page?: number;
  pageSize?: number;
}

const resumoColetador = { select: { id: true, nome: true, papel: true } };

function construirWhere(pesquisaId: string, filtros: ListarRespostasFiltros = {}): Prisma.RespostaWhereInput {
  const where: Prisma.RespostaWhereInput = { pesquisaId, deletedAt: null };
  if (filtros.municipio) where.municipio = filtros.municipio;
  if (filtros.regional) where.regional = filtros.regional;
  if (filtros.unidade) where.unidade = filtros.unidade;
  if (filtros.status) where.status = filtros.status;
  if (filtros.coletadorId) where.coletadorId = filtros.coletadorId;
  if (filtros.de || filtros.ate) {
    where.enviadaEm = {
      ...(filtros.de ? { gte: filtros.de } : {}),
      ...(filtros.ate ? { lte: filtros.ate } : {}),
    };
  }
  return where;
}

export const respostaModel = {
  criar(pesquisaId: string, coletadorId: string, dados: CriarRespostaInput) {
    return prisma.$transaction(async (tx) => {
      const resposta = await tx.resposta.create({
        data: {
          pesquisaId,
          coletadorId,
          municipio: dados.municipio,
          unidade: dados.unidade,
          regional: dados.regional,
        },
      });
      await tx.itemResposta.createMany({
        data: dados.itens.map((item) => ({
          respostaId: resposta.id,
          perguntaId: item.perguntaId,
          valorTexto: item.valorTexto,
          valorNumero: item.valorNumero,
          valorData: item.valorData,
          opcoesSelecionadas: item.opcoesSelecionadas ?? [],
        })),
      });
      return resposta;
    });
  },

  /** Edita uma resposta: substitui os itens e volta o status para PENDENTE (re-revisão). */
  atualizar(id: string, dados: AtualizarRespostaInput) {
    return prisma.$transaction(async (tx) => {
      await tx.itemResposta.deleteMany({ where: { respostaId: id } });
      await tx.itemResposta.createMany({
        data: dados.itens.map((item) => ({
          respostaId: id,
          perguntaId: item.perguntaId,
          valorTexto: item.valorTexto,
          valorNumero: item.valorNumero,
          valorData: item.valorData,
          opcoesSelecionadas: item.opcoesSelecionadas ?? [],
        })),
      });
      return tx.resposta.update({
        where: { id },
        data: {
          municipio: dados.municipio,
          unidade: dados.unidade,
          regional: dados.regional,
          status: "PENDENTE",
          revisadoPorId: null,
          revisadoEm: null,
          observacao: null,
        },
      });
    });
  },

  mudarStatus(id: string, status: StatusResposta, revisadoPorId: string, observacao?: string) {
    return prisma.resposta.update({
      where: { id },
      data: { status, revisadoPorId, revisadoEm: new Date(), observacao: observacao ?? null },
    });
  },

  async listar(pesquisaId: string, filtros: ListarRespostasFiltros = {}) {
    const { page = 1, pageSize = 20 } = filtros;
    const where = construirWhere(pesquisaId, filtros);
    const [total, itens] = await Promise.all([
      prisma.resposta.count({ where }),
      prisma.resposta.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { enviadaEm: "desc" },
        include: { coletador: resumoColetador, revisadoPor: resumoColetador },
      }),
    ]);
    return { total, itens };
  },

  obterPorId(id: string) {
    return prisma.resposta.findFirst({
      where: { id, deletedAt: null },
      include: { itens: true, coletador: resumoColetador, revisadoPor: resumoColetador },
    });
  },

  softDelete(id: string, usuarioId: string) {
    return prisma.resposta.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: usuarioId },
    });
  },

  contar(pesquisaId: string, filtros?: ListarRespostasFiltros) {
    return prisma.resposta.count({ where: construirWhere(pesquisaId, filtros) });
  },

  itensPorPergunta(pesquisaId: string, filtros?: ListarRespostasFiltros) {
    const where = construirWhere(pesquisaId, filtros);
    return prisma.itemResposta.findMany({ where: { resposta: where } });
  },
};
