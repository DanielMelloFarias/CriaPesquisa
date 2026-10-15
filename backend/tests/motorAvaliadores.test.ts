import { describe, it, expect } from "vitest";
import { montarResposta, avaliar, opcaoSemNota, ItemDuplicado } from "../src/helper/motor/avaliadores.js";
import { validarConfig } from "../src/helper/indicadorConfig.js";

const vazio = new Map<string, number | null>();

function resposta(itens: Array<{ perguntaId: string; valorNumero?: number | null; opcoesSelecionadas?: string[] }>) {
  return montarResposta("r1", itens);
}

describe("PROPORCAO", () => {
  const config = validarConfig("PROPORCAO", { perguntaId: "p1", opcoesNumerador: ["Rural"] });

  it("dá 100 quando a opção está no numerador", () => {
    expect(avaliar(config, resposta([{ perguntaId: "p1", opcoesSelecionadas: ["Rural"] }]), vazio)).toBe(100);
  });

  it("dá 0 quando respondeu outra coisa", () => {
    expect(avaliar(config, resposta([{ perguntaId: "p1", opcoesSelecionadas: ["Urbana"] }]), vazio)).toBe(0);
  });

  it("dá null quando não respondeu — sai do denominador", () => {
    expect(avaliar(config, resposta([{ perguntaId: "p1", opcoesSelecionadas: [] }]), vazio)).toBeNull();
    expect(avaliar(config, resposta([]), vazio)).toBeNull();
  });
});

describe("MEDIA", () => {
  const config = validarConfig("MEDIA", { perguntaId: "renda" });

  it("devolve o número respondido", () => {
    expect(avaliar(config, resposta([{ perguntaId: "renda", valorNumero: 1200 }]), vazio)).toBe(1200);
  });

  it("zero é resposta válida, não branco", () => {
    // Renda declarada zero não pode sair do denominador: muda a média da amostra.
    expect(avaliar(config, resposta([{ perguntaId: "renda", valorNumero: 0 }]), vazio)).toBe(0);
  });

  it("null é branco", () => {
    expect(avaliar(config, resposta([{ perguntaId: "renda", valorNumero: null }]), vazio)).toBeNull();
  });
});

describe("DERIVADA", () => {
  const imc = validarConfig("DERIVADA", {
    variaveis: { peso: "peso", altura: "altura" },
    expressao: { op: "/", esq: { var: "peso" }, dir: { op: "*", esq: { var: "altura" }, dir: { var: "altura" } } },
  });

  it("calcula o IMC", () => {
    const r = resposta([{ perguntaId: "peso", valorNumero: 64 }, { perguntaId: "altura", valorNumero: 1.6 }]);
    expect(avaliar(imc, r, vazio)).toBeCloseTo(25, 5);
  });

  it("altura zero não vira Infinity: vira sem dados", () => {
    const r = resposta([{ perguntaId: "peso", valorNumero: 64 }, { perguntaId: "altura", valorNumero: 0 }]);
    expect(avaliar(imc, r, vazio)).toBeNull();
  });

  it("falta de uma das variáveis vira sem dados", () => {
    expect(avaliar(imc, resposta([{ perguntaId: "peso", valorNumero: 64 }]), vazio)).toBeNull();
  });
});

describe("CRUZAMENTO", () => {
  const config = validarConfig("CRUZAMENTO", {
    condicoes: [
      { perguntaId: "idade", operador: "<", valor: 18 },
      { perguntaId: "escolaridade", opcoes: ["Fundamental incompleto"] },
    ],
  });

  it("dá 100 só quando todas as condições valem", () => {
    const r = resposta([
      { perguntaId: "idade", valorNumero: 16 },
      { perguntaId: "escolaridade", opcoesSelecionadas: ["Fundamental incompleto"] },
    ]);
    expect(avaliar(config, r, vazio)).toBe(100);
  });

  it("dá 0 quando uma condição falha", () => {
    const r = resposta([
      { perguntaId: "idade", valorNumero: 30 },
      { perguntaId: "escolaridade", opcoesSelecionadas: ["Fundamental incompleto"] },
    ]);
    expect(avaliar(config, r, vazio)).toBe(0);
  });

  it("dá null quando falta o dado de alguma condição", () => {
    expect(avaliar(config, resposta([{ perguntaId: "idade", valorNumero: 16 }]), vazio)).toBeNull();
  });

  it("dá null quando falta o dado numérico, mesmo com a outra condição falhando", () => {
    const r = resposta([{ perguntaId: "escolaridade", opcoesSelecionadas: ["Superior"] }]);
    expect(avaliar(config, r, vazio)).toBeNull();
  });
});

describe("COMPOSTO", () => {
  const mcc = validarConfig("COMPOSTO", {
    termos: [
      { indicadorId: "vcras", peso: 3 },
      { indicadorId: "cvac", peso: 5 },
      { indicadorId: "cpuer", peso: 5 },
    ],
    divisor: 13,
  });

  it("soma ponderada dividida pelo divisor", () => {
    const deps = new Map([["vcras", 100], ["cvac", 100], ["cpuer", 100]]);
    expect(avaliar(mcc, resposta([]), deps)).toBeCloseTo(100, 6);
  });

  it("dá null se qualquer termo estiver sem valor", () => {
    const deps = new Map<string, number | null>([["vcras", 100], ["cvac", null], ["cpuer", 100]]);
    expect(avaliar(mcc, resposta([]), deps)).toBeNull();
  });
});

describe("montarResposta", () => {
  it("recusa dois itens para a mesma pergunta", () => {
    // Dado sujo: sem isso, o último item venceria em silêncio.
    expect(() =>
      montarResposta("r1", [
        { perguntaId: "p1", valorNumero: 1 },
        { perguntaId: "p1", valorNumero: 2 },
      ]),
    ).toThrow(ItemDuplicado);
  });
});

describe("ESCALA", () => {
  const cfg = validarConfig("ESCALA", {
    perguntaId: "pn",
    notas: { "Antes de 12": 100, "Após 12": 50, "Sem pré-natal": 0, "Não soube": null },
  });
  const r = (op?: string[]) => montarResposta("r", op ? [{ perguntaId: "pn", opcoesSelecionadas: op }] : []);
  it("nota da opção", () => {
    expect(avaliar(cfg, r(["Antes de 12"]), new Map())).toBe(100);
    expect(avaliar(cfg, r(["Após 12"]), new Map())).toBe(50);
    expect(avaliar(cfg, r(["Sem pré-natal"]), new Map())).toBe(0);
  });
  it("opção com nota null, branco ou marcação múltipla = fora", () => {
    expect(avaliar(cfg, r(["Não soube"]), new Map())).toBeNull();
    expect(avaliar(cfg, r(), new Map())).toBeNull();
    expect(avaliar(cfg, r([]), new Map())).toBeNull();
    expect(avaliar(cfg, r(["Antes de 12", "Após 12"]), new Map())).toBeNull();
  });
  it("opção desconhecida não vira número (o calcular marca INCOMPLETO)", () => {
    expect(avaliar(cfg, r(["Opção nova"]), new Map())).toBeNull();
    expect(opcaoSemNota(cfg as never, [r(["Antes de 12"]), r(["Opção nova"])])).toBe("Opção nova");
    expect(opcaoSemNota(cfg as never, [r(["Antes de 12"]), r(["Não soube"])])).toBeNull();
  });
});

describe("META_POR_IDADE", () => {
  const cfg = validarConfig("META_POR_IDADE", {
    perguntaId: "consultas",
    nascimentoPerguntaId: "nasc",
    faixas: [
      { deMeses: 0, ateMeses: 12, esperado: 7 },
      { deMeses: 12, ateMeses: 24, esperado: 2 },
      { deMeses: 24, ateMeses: null, esperado: 1 },
    ],
  });
  const entrevista = new Date("2026-01-01T12:00:00Z");
  const r = (nasc: string | null, consultas: number | null, enviadaEm: Date | null = entrevista) =>
    montarResposta(
      "r",
      [
        ...(nasc ? [{ perguntaId: "nasc", valorData: new Date(nasc) }] : []),
        ...(consultas !== null ? [{ perguntaId: "consultas", valorNumero: consultas }] : []),
      ],
      null,
      { enviadaEm },
    );
  it("proporcional ao esperado da faixa, teto 100", () => {
    expect(avaliar(cfg, r("2025-07-01", 4), new Map())).toBeCloseTo(400 / 7, 10); // 6 meses: 4 de 7
    expect(avaliar(cfg, r("2024-07-01", 2), new Map())).toBe(100); // 18 meses: 2 de 2
    expect(avaliar(cfg, r("2023-07-01", 3), new Map())).toBe(100); // 30 meses: teto
  });
  it("zero consultas é zero, não branco", () => {
    expect(avaliar(cfg, r("2023-07-01", 0), new Map())).toBe(0);
  });
  it("sem nascimento, sem consultas, sem data da entrevista ou idade negativa = null", () => {
    expect(avaliar(cfg, r(null, 3), new Map())).toBeNull();
    expect(avaliar(cfg, r("2025-07-01", null), new Map())).toBeNull();
    expect(avaliar(cfg, r("2025-07-01", 3, null), new Map())).toBeNull();
    expect(avaliar(cfg, r("2026-06-01", 3), new Map())).toBeNull();
  });
  it("idade fora de todas as faixas = null", () => {
    const fechada = validarConfig("META_POR_IDADE", {
      perguntaId: "consultas", nascimentoPerguntaId: "nasc", faixas: [{ deMeses: 0, ateMeses: 12, esperado: 7 }],
    });
    expect(avaliar(fechada, r("2024-07-01", 2), new Map())).toBeNull();
  });
});
