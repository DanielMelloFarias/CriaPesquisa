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

  /**
   * Sexo é resposta a pergunta (enunciado contém "Sexo biológico"). Devolve, por
   * pesquisa, a pergunta a usar no filtro: "Sexo biológico da criança" quando a
   * pesquisa tem (o recorte é sobre a criança, não sobre quem responde); senão a
   * pergunta genérica "Sexo biológico".
   */
  async perguntasDeSexo(): Promise<Map<string, string>> {
    const perguntas = await prisma.pergunta.findMany({
      where: { enunciado: { contains: "Sexo biológico", mode: "insensitive" } },
      select: { id: true, pesquisaId: true, enunciado: true },
      orderBy: { ordem: "asc" },
    });
    const daCrianca = (enunciado: string) =>
      enunciado.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes("sexo biologico da crianca");
    const porPesquisa = new Map<string, string>();
    for (const p of perguntas) if (daCrianca(p.enunciado) && !porPesquisa.has(p.pesquisaId)) porPesquisa.set(p.pesquisaId, p.id);
    for (const p of perguntas) if (!porPesquisa.has(p.pesquisaId)) porPesquisa.set(p.pesquisaId, p.id);
    return porPesquisa;
  },

  async perguntasExistentes(): Promise<Set<string>> {
    const perguntas = await prisma.pergunta.findMany({ select: { id: true } });
    return new Set(perguntas.map((p) => p.id));
  },
};
