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
  it("entrevista após 21h em Alagoas conta o dia local, não o dia UTC", () => {
    // 2026-01-01T01:00Z = 22h de 31/12/2025 em Alagoas: 11 meses, faixa 0-12 (esperado 7).
    expect(avaliar(cfg, r("2025-01-01", 7, new Date("2026-01-01T01:00:00Z")), new Map())).toBe(100);
    expect(avaliar(cfg, r("2025-01-01", 1, new Date("2026-01-01T01:00:00Z")), new Map())).toBeCloseTo(100 / 7, 10);
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

/**
 * Valores de IMC derivados do LMS do JSON da OMS (referencias/oms-imc-idade.json),
 * com IMC no k-ésimo DP = M·(1 + L·S·k)^(1/L):
 *   menina, 730 d: L −0,5989  M 15,4052 S 0,08545 → −2 DP = 13,0919 (P2,3)
 *   menino, 365 d: L −0,4113  M 16,7992 S 0,08009 → +1 DP = 18,2246 (P84,1); +2 DP = 19,8267 (P97,7)
 *   19,9 está acima do +2 DP do dia 365 (z ≈ 2,04): folga de 0,07 kg/m².
 */
describe("PERCENTIL_OMS", () => {
  const cfg = (corte: object) =>
    validarConfig("PERCENTIL_OMS", {
      imcIndicadorId: "imc", nascimentoPerguntaId: "nasc", sexoPerguntaId: "sexo",
      opcoesSexo: { masculino: "Masculino", feminino: "Feminino" }, corte,
    });
  const entrevista = new Date("2026-01-01T12:00:00Z");
  const r = (sexo: string | string[] | null, nasc: string | null, enviadaEm: Date | null = entrevista) =>
    montarResposta(
      "r",
      [
        ...(sexo ? [{ perguntaId: "sexo", opcoesSelecionadas: Array.isArray(sexo) ? sexo : [sexo] }] : []),
        ...(nasc ? [{ perguntaId: "nasc", valorData: new Date(nasc) }] : []),
      ],
      null,
      { enviadaEm },
    );
  const imc = (v: number | null) => new Map([["imc", v]]);

  it("menina de 730 dias com IMC no −2 DP (P2,3) está abaixo do P10", () => {
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Feminino", "2024-01-02"), imc(13.092))).toBe(100);
  });
  it("menino de 365 dias com IMC na mediana não está abaixo do P10 nem acima do P85", () => {
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Masculino", "2025-01-01"), imc(16.7992))).toBe(0);
    expect(avaliar(cfg({ acimaDe: 85 }), r("Masculino", "2025-01-01"), imc(16.7992))).toBe(0);
  });
  it("menino de 365 dias no +1 DP (P84,1) não passa do P85; no +2 DP passa", () => {
    expect(avaliar(cfg({ acimaDe: 85 }), r("Masculino", "2025-01-01"), imc(18.225))).toBe(0);
    expect(avaliar(cfg({ acimaDe: 85 }), r("Masculino", "2025-01-01"), imc(19.9))).toBe(100);
  });
  it("sexo fora das opções configuradas, ausente, sem nascimento, sem IMC ou acima de 5 anos = null", () => {
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Intersexo", "2025-01-01"), imc(16))).toBeNull();
    expect(avaliar(cfg({ abaixoDe: 10 }), r(null, "2025-01-01"), imc(16))).toBeNull();
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Masculino", null), imc(16))).toBeNull();
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Masculino", "2025-01-01"), imc(null))).toBeNull();
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Masculino", "2020-06-01"), imc(16))).toBeNull();
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Masculino", "2025-01-01", null), imc(16))).toBeNull();
  });
  it("dois sexos marcados ou nascimento depois da entrevista = null", () => {
    expect(avaliar(cfg({ abaixoDe: 10 }), r(["Masculino", "Feminino"], "2025-01-01"), imc(13))).toBeNull();
    expect(avaliar(cfg({ abaixoDe: 10 }), r("Masculino", "2026-06-01"), imc(13))).toBeNull();
  });
  it("IMC zero, negativo ou não finito = null (o LMS daria NaN/−Infinity)", () => {
    for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(avaliar(cfg({ abaixoDe: 10 }), r("Masculino", "2025-01-01"), imc(v))).toBeNull();
      expect(avaliar(cfg({ acimaDe: 85 }), r("Masculino", "2025-01-01"), imc(v))).toBeNull();
    }
  });
  it("entrevista após 21h em Alagoas usa o dia local (364), não o dia UTC (365)", () => {
    // 2026-01-01T01:00Z = 22h de 31/12/2025 em Alagoas. P85 em IMC, pelo LMS do JSON
    // (z_85 = 1,036433): dia 364 → 18,284264; dia 365 → 18,279666. 18,282 fica entre os
    // dois: acima do P85 no dia 365, abaixo no 364 (folga ≈ 0,0023 kg/m² de cada lado,
    // muito acima do erro de 7,5e-8 da aproximação de Φ).
    const noite = new Date("2026-01-01T01:00:00Z");
    expect(avaliar(cfg({ acimaDe: 85 }), r("Masculino", "2025-01-01", noite), imc(18.282))).toBe(0);
    // Controle: ao meio-dia do mesmo 1º/jan (dia 365) o mesmo IMC passa do P85.
    expect(avaliar(cfg({ acimaDe: 85 }), r("Masculino", "2025-01-01"), imc(18.282))).toBe(100);
    // Fim da tabela (0–1856 d): nascido em 2020-12-01, no dia local 31/12/2025 tem 1856 dias
    // (dentro); no dia UTC 01/01/2026 teria 1857 (fora → null).
    expect(avaliar(cfg({ acimaDe: 85 }), r("Masculino", "2020-12-01", noite), imc(30))).toBe(100);
  });
});
