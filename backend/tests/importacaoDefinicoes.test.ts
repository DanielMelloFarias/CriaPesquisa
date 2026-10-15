import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { DEFINICOES } from "../src/helper/importacao/definicoes-cartao-cria.js";
import { resolverDefinicao, type PerguntaDoBanco } from "../src/helper/importacao/resolver.js";
import { validarConfig, perguntasReferenciadas } from "../src/helper/indicadorConfig.js";
import { problemasDasPerguntas, type PerguntaParaConferir } from "../src/helper/indicadorPerguntas.js";
import { indicadorModel } from "../src/models/indicadorModel.js";

/**
 * Contra o banco de dev (porta 5433), só leitura: prova que todo enunciado e
 * toda opção citados no mapa existem nas pesquisas do seed e que cada config
 * resolvida passa pela mesma validação do cadastro. Não grava nada.
 */

const TITULOS = ["Cartão CRIA — Criança", "Cartão CRIA — Gestante"];
let perguntas: PerguntaDoBanco[] = [];

beforeAll(async () => {
  const linhas = await prisma.pergunta.findMany({
    where: { pesquisa: { titulo: { in: TITULOS }, deletedAt: null } },
    select: { id: true, enunciado: true, pesquisa: { select: { titulo: true } } },
  });
  perguntas = linhas.map((l) => ({ id: l.id, enunciado: l.enunciado, pesquisa: l.pesquisa.titulo }));
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("mapa das definições do Cartão CRIA contra o seed", () => {
  it("as duas pesquisas estão no banco", () => {
    for (const titulo of TITULOS) expect(perguntas.some((p) => p.pesquisa === titulo)).toBe(true);
  });

  const idsPorCodigo = new Map(DEFINICOES.map((d) => [d.codigo, `id-${d.codigo}`]));

  for (const def of DEFINICOES) {
    it(`${def.codigo}: resolve, valida e confere perguntas e opções`, async () => {
      const resolvido = resolverDefinicao(def, perguntas, idsPorCodigo);
      expect(resolvido.faltando).toEqual([]);
      const config = validarConfig(def.tipo, resolvido.config);
      const ids = [
        ...perguntasReferenciadas(config),
        ...(resolvido.recorteConfig?.substituicoes.flatMap((s) => [s.de, s.para]) ?? []),
      ];
      const comOpcoes = await indicadorModel.perguntasPorId(ids);
      const mapa = new Map<string, PerguntaParaConferir>(comOpcoes.map((p) => [p.id, p]));
      expect(problemasDasPerguntas(config, mapa)).toEqual([]);
      // Toda opção citada (numerador, condição) existe de verdade na pergunta.
      const opcoesCitadas: Array<[string, string[]]> =
        config.tipo === "PROPORCAO"
          ? [[config.perguntaId, config.opcoesNumerador]]
          : config.tipo === "CRUZAMENTO"
            ? config.condicoes.map((c) => [c.perguntaId, c.opcoes ?? []])
            : [];
      for (const [perguntaId, opcoes] of opcoesCitadas) {
        for (const opcao of opcoes) expect(mapa.get(perguntaId)?.opcoes, `${def.codigo}: opção "${opcao}"`).toContain(opcao);
      }
    });
  }
});
