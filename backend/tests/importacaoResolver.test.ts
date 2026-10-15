import { describe, it, expect } from "vitest";
import { resolverDefinicao, type PerguntaDoBanco } from "../src/helper/importacao/resolver.js";
import { DEFINICOES } from "../src/helper/importacao/definicoes-cartao-cria.js";

const PERG: PerguntaDoBanco[] = [
  { id: "p1", enunciado: "Data de nascimento da criança", pesquisa: "Cartão CRIA — Criança" },
  { id: "p2", enunciado: "Número de consultas de puericultura no último ano", pesquisa: "Cartão CRIA — Criança" },
  { id: "p9", enunciado: "Número de consultas de puericultura no último ano", pesquisa: "Cartão CRIA — Gestante" },
];

describe("resolverDefinicao", () => {
  it("troca enunciado e código por id, só na pesquisa da definição", () => {
    const def = DEFINICOES.find((d) => d.codigo === "C-CPUER")!;
    const r = resolverDefinicao(def, PERG, new Map());
    expect(r.faltando).toEqual([]);
    expect(r.config).toMatchObject({ perguntaId: "p2", nascimentoPerguntaId: "p1" });
  });

  it("referência que não resolve vai para faltando e não lança", () => {
    const def = DEFINICOES.find((d) => d.codigo === "C-MCC")!;
    const r = resolverDefinicao(def, PERG, new Map([["C-VCRAS", "i1"]]));
    expect(r.faltando).toEqual(["indicador não encontrado: C-CVAC", "indicador não encontrado: C-CPUER"]);
  });

  it("pergunta citada que não existe (enunciado mudou) vai para faltando com o enunciado e fica vazia", () => {
    const def = DEFINICOES.find((d) => d.codigo === "C-CVAC")!;
    const r = resolverDefinicao(def, PERG, new Map());
    expect(r.faltando).toContain("pergunta não encontrada: Carteira de vacinação da criança atualizada — ANTES do Cartão CRIA");
    expect(r.config).toMatchObject({ perguntaId: "" });
  });

  it("recorte vira substituição", () => {
    const def = DEFINICOES.find((d) => d.codigo === "C-VCRAS")!;
    const perg = [
      { id: "a", enunciado: "A criança e a família participam de atividades propostas pelo CRAS? — ANTES do Cartão CRIA", pesquisa: "Cartão CRIA — Criança" },
      { id: "b", enunciado: "A criança e a família participam de atividades propostas pelo CRAS? — APÓS o Cartão CRIA", pesquisa: "Cartão CRIA — Criança" },
    ];
    expect(resolverDefinicao(def, perg, new Map()).recorteConfig).toEqual({ substituicoes: [{ de: "a", para: "b" }] });
  });

  it("o mapa está em ordem de dependência e sem código repetido", () => {
    const vistos = new Set<string>();
    for (const d of DEFINICOES) {
      expect(vistos.has(d.codigo)).toBe(false);
      for (const ref of JSON.stringify(d.config).matchAll(/"indicador":"([^"]+)"/g)) expect(vistos.has(ref[1])).toBe(true);
      vistos.add(d.codigo);
    }
  });

  it("nenhum id de planilha aparece em duas definições", () => {
    const ids = DEFINICOES.flatMap((d) => d.idsPlanilha);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("o mapa tem as 41 definições decididas", () => {
    expect(DEFINICOES).toHaveLength(41);
  });
});
