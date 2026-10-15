import { describe, it, expect } from "vitest";
import { normalizar, semelhanca, sugerirPergunta, sugerirTipo, type PerguntaCandidata } from "../src/helper/importacao/casamento.js";

const P: PerguntaCandidata[] = [
  { id: "zona", enunciado: "Zona", tipo: "ESCOLHA_UNICA" },
  { id: "mun", enunciado: "Município", tipo: "ESCOLHA_UNICA" },
  { id: "crasA", enunciado: "A criança e a família participam de atividades propostas pelo CRAS? — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA" },
  { id: "crasD", enunciado: "A criança e a família participam de atividades propostas pelo CRAS? — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA" },
  { id: "ali1", enunciado: "Nos últimos três meses, os alimentos acabaram antes que você tivesse dinheiro para comprar mais comida?", tipo: "ESCOLHA_UNICA" },
  { id: "ali2", enunciado: "Nos últimos três meses, você comeu apenas alguns alimentos que ainda tinha porque o dinheiro acabou?", tipo: "ESCOLHA_UNICA" },
  { id: "renda", enunciado: "Renda mensal total da família (R$)", tipo: "NUMERO" },
];

describe("normalizar", () => {
  it("tira acento, número inicial, sufixo ANTES/APÓS e pontuação", () => {
    expect(normalizar("4. Zona:")).toBe("zona");
    expect(normalizar("A criança participa? — APÓS o Cartão CRIA")).toBe("a crianca participa");
    expect(normalizar("23 - Município")).toBe("municipio");
  });
});

describe("semelhanca", () => {
  it("1 para textos iguais após normalizar, 0 sem palavra comum", () => {
    expect(semelhanca("Município:", "município")).toBe(1);
    expect(semelhanca("Zona", "Renda")).toBe(0);
  });
});

describe("sugerirPergunta", () => {
  it("única", () => expect(sugerirPergunta("4. Zona", P)).toEqual({ situacao: "UNICA", perguntaId: "zona" }));
  it("par ANTES/APÓS", () =>
    expect(sugerirPergunta("A criança e a família participam de atividades propostas pelo CRAS?", P))
      .toEqual({ situacao: "PAR", antesId: "crasA", aposId: "crasD" }));
  it("ambígua quando cita duas perguntas parecidas", () =>
    expect(sugerirPergunta("Nos últimos três meses, você alimentos dinheiro que", P).situacao).toBe("AMBIGUA"));
  // Janela de empate (0,05): D tem 10 palavras com 3+ letras.
  const D = "alfa bravo carlos delta eco foxtrote golfe hotel india julia";
  it("quase empate dentro da janela de 0,05 -> ambígua", () => {
    // Q1: 9 das 10 palavras de D -> 9/10 = 0,900. Q2: D + "kilo" -> 10/11 = 0,909. Diferença 0,009 (< 0,05).
    const Q: PerguntaCandidata[] = [
      { id: "q1", enunciado: "alfa bravo carlos delta eco foxtrote golfe hotel india", tipo: "ESCOLHA_UNICA" },
      { id: "q2", enunciado: `${D} kilo`, tipo: "ESCOLHA_UNICA" },
    ];
    expect(sugerirPergunta(D, Q)).toEqual({ situacao: "AMBIGUA", candidatas: ["q2", "q1"] });
  });
  it("segunda colocada >= 0,5 mas fora da janela -> única", () => {
    // Q2: D + "kilo" -> 10/11 = 0,909. Q3: 6 das 10 palavras de D -> 6/10 = 0,600. Diferença 0,309 (> 0,05), ambas >= 0,5.
    const Q: PerguntaCandidata[] = [
      { id: "q3", enunciado: "alfa bravo carlos delta eco foxtrote", tipo: "ESCOLHA_UNICA" },
      { id: "q2", enunciado: `${D} kilo`, tipo: "ESCOLHA_UNICA" },
    ];
    expect(sugerirPergunta(D, Q)).toEqual({ situacao: "UNICA", perguntaId: "q2" });
  });
  it("nenhuma abaixo de 0,5", () => {
    expect(sugerirPergunta("Benefícios federais recebidos", P)).toEqual({ situacao: "NENHUMA" });
    // semelhança 0,33 com "Renda mensal total da família": parcial, mas abaixo do limiar
    expect(sugerirPergunta("Renda per capita da família", P)).toEqual({ situacao: "NENHUMA" });
  });
  it("sem descrição", () => {
    expect(sugerirPergunta("", P)).toEqual({ situacao: "SEM_DESCRICAO" });
    expect(sugerirPergunta(null, P)).toEqual({ situacao: "SEM_DESCRICAO" });
  });
});

describe("sugerirTipo", () => {
  it("proporção, distribuição, média, contagem e nada", () => {
    expect(sugerirTipo("(CRAS / Total) × 100", "ESCOLHA_UNICA")).toBe("PROPORCAO");
    expect(sugerirTipo("Nº de usuárias por município / Nº total x 100", "ESCOLHA_UNICA")).toBe("DISTRIBUICAO");
    expect(sugerirTipo("Média Renda", "NUMERO")).toBe("MEDIA");
    expect(sugerirTipo("Total de famílias entrevistadas", null)).toBe("CONTAGEM");
    expect(sugerirTipo("Índice de gravidade", "ESCOLHA_UNICA")).toBeNull();
  });
});
