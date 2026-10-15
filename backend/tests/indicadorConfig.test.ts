import { describe, it, expect } from "vitest";
import { validarConfig, perguntasReferenciadas, indicadoresReferenciados } from "../src/helper/indicadorConfig.js";

describe("validarConfig", () => {
  it("aceita PROPORCAO com pergunta e opções do numerador", () => {
    const config = validarConfig("PROPORCAO", { perguntaId: "p1", opcoesNumerador: ["Rural"] });
    expect(config).toEqual({ tipo: "PROPORCAO", perguntaId: "p1", opcoesNumerador: ["Rural"] });
  });

  it("recusa PROPORCAO sem nenhuma opção no numerador", () => {
    // Sem numerador o indicador daria 0 para todo mundo, silenciosamente.
    expect(() => validarConfig("PROPORCAO", { perguntaId: "p1", opcoesNumerador: [] })).toThrow();
  });

  it("recusa config de um tipo aplicada a outro", () => {
    expect(() => validarConfig("MEDIA", { perguntaId: "p1", opcoesNumerador: ["x"] })).toThrow();
  });

  it("aceita COMPOSTO com termos ponderados e divisor", () => {
    const config = validarConfig("COMPOSTO", {
      termos: [{ indicadorId: "i1", peso: 3 }, { indicadorId: "i2", peso: 5 }],
      divisor: 8,
    });
    expect(indicadoresReferenciados(config)).toEqual(["i1", "i2"]);
  });

  it("recusa COMPOSTO com divisor zero", () => {
    expect(() => validarConfig("COMPOSTO", { termos: [{ indicadorId: "i1", peso: 1 }], divisor: 0 })).toThrow();
  });

  it("aceita DERIVADA como árvore de expressão, sem texto para avaliar", () => {
    const config = validarConfig("DERIVADA", {
      variaveis: { peso: "p10", altura: "p11" },
      expressao: { op: "/", esq: { var: "peso" }, dir: { op: "*", esq: { var: "altura" }, dir: { var: "altura" } } },
    });
    expect(perguntasReferenciadas(config).sort()).toEqual(["p10", "p11"]);
  });

  it("recusa DERIVADA que usa variável não declarada", () => {
    expect(() =>
      validarConfig("DERIVADA", { variaveis: { peso: "p10" }, expressao: { var: "altura" } }),
    ).toThrow();
  });

  it("aceita CLASSIFICACAO com faixas e devolve o indicador de origem", () => {
    const config = validarConfig("CLASSIFICACAO", {
      indicadorId: "mcc",
      faixas: [
        { rotulo: "Crítico", de: 0, ate: 25 },
        { rotulo: "Baixo", de: 25, ate: 50 },
      ],
    });
    expect(indicadoresReferenciados(config)).toEqual(["mcc"]);
  });

  it("recusa CLASSIFICACAO com faixa invertida", () => {
    expect(() =>
      validarConfig("CLASSIFICACAO", { indicadorId: "mcc", faixas: [{ rotulo: "X", de: 50, ate: 10 }] }),
    ).toThrow();
  });

  it("recusa CLASSIFICACAO com faixas fora de ordem", () => {
    expect(() =>
      validarConfig("CLASSIFICACAO", {
        indicadorId: "mcc",
        faixas: [
          { rotulo: "Alto", de: 50, ate: 100 },
          { rotulo: "Baixo", de: 0, ate: 50 },
        ],
      }),
    ).toThrow();
  });

  it("recusa CLASSIFICACAO com faixas sobrepostas", () => {
    expect(() =>
      validarConfig("CLASSIFICACAO", {
        indicadorId: "mcc",
        faixas: [
          { rotulo: "Baixo", de: 0, ate: 60 },
          { rotulo: "Alto", de: 50, ate: 100 },
        ],
      }),
    ).toThrow();
  });

  it("aceita CLASSIFICACAO com faixas encostadas ou com vão entre elas", () => {
    expect(() =>
      validarConfig("CLASSIFICACAO", {
        indicadorId: "mcc",
        faixas: [
          { rotulo: "Baixo", de: 0, ate: 50 },
          { rotulo: "Alto", de: 50, ate: 100 },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      validarConfig("CLASSIFICACAO", {
        indicadorId: "mcc",
        faixas: [
          { rotulo: "Baixo", de: 0, ate: 40 },
          { rotulo: "Alto", de: 60, ate: 100 },
        ],
      }),
    ).not.toThrow();
  });
});

describe("DERIVADA: variáveis e divisão", () => {
  it("recusa variável que só existe no protótipo do objeto", () => {
    for (const nome of ["constructor", "toString", "hasOwnProperty"]) {
      expect(() => validarConfig("DERIVADA", { variaveis: {}, expressao: { var: nome } })).toThrow();
    }
  });

  it("aceita expressão com nó const", () => {
    const config = validarConfig("DERIVADA", {
      variaveis: { a: "p1" },
      expressao: { op: "*", esq: { var: "a" }, dir: { const: 100 } },
    });
    expect(perguntasReferenciadas(config)).toEqual(["p1"]);
  });

  it("recusa divisão por const 0, mesmo aninhada", () => {
    expect(() =>
      validarConfig("DERIVADA", { variaveis: {}, expressao: { op: "/", esq: { const: 1 }, dir: { const: 0 } } }),
    ).toThrow();
    expect(() =>
      validarConfig("DERIVADA", {
        variaveis: { a: "p1" },
        expressao: { op: "+", esq: { var: "a" }, dir: { op: "/", esq: { var: "a" }, dir: { const: 0 } } },
      }),
    ).toThrow();
  });

  it("aceita divisão por variável (zero só se sabe na execução)", () => {
    expect(() =>
      validarConfig("DERIVADA", {
        variaveis: { a: "p1", b: "p2" },
        expressao: { op: "/", esq: { var: "a" }, dir: { var: "b" } },
      }),
    ).not.toThrow();
  });

  it("recusa const infinita", () => {
    expect(() =>
      validarConfig("DERIVADA", { variaveis: {}, expressao: { const: Infinity } }),
    ).toThrow();
  });
});

describe("CRUZAMENTO", () => {
  it("aceita condições por opções e por operador+valor", () => {
    const config = validarConfig("CRUZAMENTO", {
      condicoes: [{ perguntaId: "p1", opcoes: ["Rural"] }, { perguntaId: "p2", operador: "<", valor: 3 }],
    });
    expect(perguntasReferenciadas(config)).toEqual(["p1", "p2"]);
  });

  it("recusa menos de duas condições", () => {
    expect(() => validarConfig("CRUZAMENTO", { condicoes: [{ perguntaId: "p1", opcoes: ["a"] }] })).toThrow();
  });

  const ok = { perguntaId: "p2", opcoes: ["a"] };
  it.each([
    ["sem critério algum", { perguntaId: "p1" }],
    ["operador sem valor", { perguntaId: "p1", operador: "<" }],
    ["valor sem operador", { perguntaId: "p1", valor: 3 }],
    ["opcoes junto com operador", { perguntaId: "p1", opcoes: ["a"], operador: "<", valor: 3 }],
    ["opcoes junto com valor", { perguntaId: "p1", opcoes: ["a"], valor: 3 }],
    ["valor infinito", { perguntaId: "p1", operador: ">", valor: Infinity }],
  ])("recusa condição %s", (_nome, condicao) => {
    expect(() => validarConfig("CRUZAMENTO", { condicoes: [condicao, ok] })).toThrow();
  });
});

describe("MEDIA, CONTAGEM e DISTRIBUICAO", () => {
  it("MEDIA aceita pergunta e recusa sem pergunta", () => {
    expect(perguntasReferenciadas(validarConfig("MEDIA", { perguntaId: "p1" }))).toEqual(["p1"]);
    expect(() => validarConfig("MEDIA", {})).toThrow();
  });

  it("CONTAGEM aceita config vazia e recusa chave extra", () => {
    expect(validarConfig("CONTAGEM", {})).toEqual({ tipo: "CONTAGEM" });
    expect(() => validarConfig("CONTAGEM", { perguntaId: "p1" })).toThrow();
  });

  it("DISTRIBUICAO aceita pergunta e recusa sem pergunta", () => {
    expect(perguntasReferenciadas(validarConfig("DISTRIBUICAO", { perguntaId: "p1" }))).toEqual(["p1"]);
    expect(() => validarConfig("DISTRIBUICAO", {})).toThrow();
  });

  it("tipos sem pergunta/indicador referenciam nada", () => {
    const c = validarConfig("CONTAGEM", {});
    expect(perguntasReferenciadas(c)).toEqual([]);
    expect(indicadoresReferenciados(c)).toEqual([]);
  });
});

describe("rigor estrutural", () => {
  it("recusa chave extra dentro de condição", () => {
    expect(() =>
      validarConfig("CRUZAMENTO", {
        condicoes: [{ perguntaId: "p1", opcoes: ["a"], extra: 1 }, { perguntaId: "p2", opcoes: ["a"] }],
      }),
    ).toThrow();
  });

  it("recusa chave extra dentro de termo do COMPOSTO", () => {
    expect(() =>
      validarConfig("COMPOSTO", { termos: [{ indicadorId: "i1", peso: 1, extra: 1 }], divisor: 1 }),
    ).toThrow();
  });

  it("recusa chave extra dentro de faixa", () => {
    expect(() =>
      validarConfig("CLASSIFICACAO", {
        indicadorId: "i1",
        faixas: [{ rotulo: "A", de: 0, ate: 1, extra: 1 }],
      }),
    ).toThrow();
  });

  it("recusa chave extra dentro de nó de expressão", () => {
    expect(() =>
      validarConfig("DERIVADA", { variaveis: { a: "p1" }, expressao: { var: "a", extra: 1 } }),
    ).toThrow();
    expect(() =>
      validarConfig("DERIVADA", { variaveis: {}, expressao: { const: 1, extra: 1 } }),
    ).toThrow();
    expect(() =>
      validarConfig("DERIVADA", {
        variaveis: {},
        expressao: { op: "+", esq: { const: 1 }, dir: { const: 2 }, extra: 1 },
      }),
    ).toThrow();
  });

  it.each([
    ["PROPORCAO", { perguntaId: "p1", opcoesNumerador: ["a"] }],
    ["CRUZAMENTO", { condicoes: [{ perguntaId: "p1", opcoes: ["a"] }, { perguntaId: "p2", opcoes: ["a"] }] }],
    ["MEDIA", { perguntaId: "p1" }],
    ["DERIVADA", { variaveis: {}, expressao: { const: 1 } }],
    ["COMPOSTO", { termos: [{ indicadorId: "i1", peso: 1 }], divisor: 1 }],
    ["CLASSIFICACAO", { indicadorId: "i1", faixas: [{ rotulo: "A", de: 0, ate: 1 }] }],
    ["CONTAGEM", {}],
    ["DISTRIBUICAO", { perguntaId: "p1" }],
  ] as const)("%s: aceita a config válida e recusa a mesma com chave extra no topo", (tipo, valida) => {
    expect(() => validarConfig(tipo, valida)).not.toThrow();
    expect(() => validarConfig(tipo, { ...valida, extra: 1 })).toThrow();
  });

  it("o tipo informado vence qualquer tipo dentro do JSON", () => {
    const config = validarConfig("MEDIA", { tipo: "CONTAGEM", perguntaId: "p1" });
    expect(config.tipo).toBe("MEDIA");
  });

  it("recusa entrada que não é objeto", () => {
    expect(() => validarConfig("CONTAGEM", null)).toThrow();
    expect(() => validarConfig("CONTAGEM", [])).toThrow();
    expect(() => validarConfig("CONTAGEM", "texto")).toThrow();
  });

  it("recusa números infinitos em peso, divisor e faixa", () => {
    expect(() => validarConfig("COMPOSTO", { termos: [{ indicadorId: "i1", peso: Infinity }], divisor: 1 })).toThrow();
    expect(() => validarConfig("COMPOSTO", { termos: [{ indicadorId: "i1", peso: 1 }], divisor: Infinity })).toThrow();
    expect(() =>
      validarConfig("CLASSIFICACAO", { indicadorId: "i", faixas: [{ rotulo: "A", de: 0, ate: Infinity }] }),
    ).toThrow();
    expect(() =>
      validarConfig("CLASSIFICACAO", { indicadorId: "i", faixas: [{ rotulo: "A", de: -Infinity, ate: 1 }] }),
    ).toThrow();
  });
});

describe("tipos novos", () => {
  it("ESCALA: aceita notas 0–100 e null; recusa nota fora da faixa ou não finita", () => {
    expect(() => validarConfig("ESCALA", { perguntaId: "p", notas: { "Antes": 100, "Após": 50, "Não soube": null } })).not.toThrow();
    expect(() => validarConfig("ESCALA", { perguntaId: "p", notas: { "A": 101 } })).toThrow();
    expect(() => validarConfig("ESCALA", { perguntaId: "p", notas: { "A": -1 } })).toThrow();
    expect(() => validarConfig("ESCALA", { perguntaId: "p", notas: { "A": Infinity } })).toThrow();
    expect(() => validarConfig("ESCALA", { perguntaId: "p", notas: {} })).toThrow();
  });

  it("META_POR_IDADE: faixas em ordem, sem sobreposição, última pode ser aberta", () => {
    const base = { perguntaId: "n", nascimentoPerguntaId: "d" };
    expect(() => validarConfig("META_POR_IDADE", { ...base, faixas: [
      { deMeses: 0, ateMeses: 12, esperado: 7 }, { deMeses: 12, ateMeses: 24, esperado: 2 }, { deMeses: 24, ateMeses: null, esperado: 1 },
    ] })).not.toThrow();
    // sobreposição
    expect(() => validarConfig("META_POR_IDADE", { ...base, faixas: [
      { deMeses: 0, ateMeses: 13, esperado: 7 }, { deMeses: 12, ateMeses: 24, esperado: 2 },
    ] })).toThrow();
    // faixa aberta no meio
    expect(() => validarConfig("META_POR_IDADE", { ...base, faixas: [
      { deMeses: 0, ateMeses: null, esperado: 7 }, { deMeses: 12, ateMeses: 24, esperado: 2 },
    ] })).toThrow();
    // esperado zero
    expect(() => validarConfig("META_POR_IDADE", { ...base, faixas: [{ deMeses: 0, ateMeses: 12, esperado: 0 }] })).toThrow();
    // de >= ate
    expect(() => validarConfig("META_POR_IDADE", { ...base, faixas: [{ deMeses: 12, ateMeses: 12, esperado: 1 }] })).toThrow();
  });

  it("ZSCORE: ao menos um componente, peso > 0", () => {
    expect(() => validarConfig("ZSCORE", { componentes: [{ indicadorId: "a", peso: 1 }] })).not.toThrow();
    expect(() => validarConfig("ZSCORE", { componentes: [] })).toThrow();
    expect(() => validarConfig("ZSCORE", { componentes: [{ indicadorId: "a", peso: 0 }] })).toThrow();
  });

  it("PERCENTIL_OMS: corte entre 1 e 99, um só lado", () => {
    const base = { imcIndicadorId: "imc", nascimentoPerguntaId: "d", sexoPerguntaId: "s", opcoesSexo: { masculino: "Masculino", feminino: "Feminino" } };
    expect(() => validarConfig("PERCENTIL_OMS", { ...base, corte: { abaixoDe: 10 } })).not.toThrow();
    expect(() => validarConfig("PERCENTIL_OMS", { ...base, corte: { acimaDe: 85 } })).not.toThrow();
    expect(() => validarConfig("PERCENTIL_OMS", { ...base, corte: { abaixoDe: 0 } })).toThrow();
    expect(() => validarConfig("PERCENTIL_OMS", { ...base, corte: { acimaDe: 100 } })).toThrow();
    expect(() => validarConfig("PERCENTIL_OMS", { ...base, corte: { abaixoDe: 10, acimaDe: 85 } })).toThrow();
    expect(() => validarConfig("PERCENTIL_OMS", { ...base, opcoesSexo: { masculino: "X", feminino: "X" }, corte: { abaixoDe: 10 } })).toThrow();
  });

  it("ATALAH: precisa do IMC e da pergunta de semana", () => {
    expect(() => validarConfig("ATALAH", { imcIndicadorId: "imc", semanaPerguntaId: "sem" })).not.toThrow();
    expect(() => validarConfig("ATALAH", { imcIndicadorId: "imc" })).toThrow();
  });

  it("referências cobrem os campos novos", () => {
    expect(perguntasReferenciadas(validarConfig("ESCALA", { perguntaId: "p", notas: { A: 1 } }))).toEqual(["p"]);
    expect(perguntasReferenciadas(validarConfig("META_POR_IDADE", { perguntaId: "n", nascimentoPerguntaId: "d",
      faixas: [{ deMeses: 0, ateMeses: null, esperado: 1 }] }))).toEqual(["n", "d"]);
    const oms = validarConfig("PERCENTIL_OMS", { imcIndicadorId: "imc", nascimentoPerguntaId: "d", sexoPerguntaId: "s",
      opcoesSexo: { masculino: "M", feminino: "F" }, corte: { abaixoDe: 10 } });
    expect(perguntasReferenciadas(oms)).toEqual(["d", "s"]);
    expect(indicadoresReferenciados(oms)).toEqual(["imc"]);
    const atalah = validarConfig("ATALAH", { imcIndicadorId: "imc", semanaPerguntaId: "sem" });
    expect(perguntasReferenciadas(atalah)).toEqual(["sem"]);
    expect(indicadoresReferenciados(atalah)).toEqual(["imc"]);
    expect(indicadoresReferenciados(validarConfig("ZSCORE", { componentes: [{ indicadorId: "a", peso: 1 }, { indicadorId: "b", peso: 1 }] })))
      .toEqual(["a", "b"]);
  });

  it("tipos novos recusam chave desconhecida (.strict)", () => {
    expect(() => validarConfig("ESCALA", { perguntaId: "p", notas: { A: 1 }, extra: 1 })).toThrow();
    expect(() => validarConfig("ATALAH", { imcIndicadorId: "imc", semanaPerguntaId: "s", extra: 1 })).toThrow();
  });
});
