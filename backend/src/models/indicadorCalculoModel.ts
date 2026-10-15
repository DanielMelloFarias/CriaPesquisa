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
