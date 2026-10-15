import { describe, it, expect, beforeAll } from "vitest";
import { calcular, type IndicadorParaCalculo } from "../src/helper/motor/calcular.js";
import { montarResposta } from "../src/helper/motor/avaliadores.js";
import { CicloDetectado } from "../src/helper/dependencias.js";

const PERGUNTAS = new Set(["cras", "vacina", "puer", "renda"]);

function ind(parcial: Partial<IndicadorParaCalculo> & Pick<IndicadorParaCalculo, "id" | "tipo" | "config">): IndicadorParaCalculo {
  return { codigo: parcial.id, casasDecimais: 2, status: "ATIVO", pesquisaId: null, ...parcial };
}

/**
 * Teste dourado: três crianças, MCC calculado no papel.
 * MCC = [(VCRAS×3) + (CVAC×5) + (CPUER×5)] ÷ 13, tudo em 0–100.
 *   A: 100,100,100 -> 1300/13 = 100
 *   B:   0,100,  0 ->  500/13 = 38.46
 *   C: 100,  0,100 ->  800/13 = 61.54
 * Média = 200/3 = 66.67
 * Faixas: A Alto, B Baixo, C Moderado -> 1/3 em cada, 0% em Crítico.
 *   Arredondamento por maior resto (Tarefa 6): as faixas somam 100, então o centésimo
 *   que sobra vai para a primeira faixa empatada (Baixo = 33.34), não 3 × 33.33 = 99.99.
 */
const INDICADORES: IndicadorParaCalculo[] = [
  ind({ id: "vcras", tipo: "PROPORCAO", config: { perguntaId: "cras", opcoesNumerador: ["Sim"] } }),
  ind({ id: "cvac", tipo: "PROPORCAO", config: { perguntaId: "vacina", opcoesNumerador: ["Sim"] } }),
  ind({ id: "cpuer", tipo: "PROPORCAO", config: { perguntaId: "puer", opcoesNumerador: ["Sim"] } }),
  ind({
    id: "mcc",
    tipo: "COMPOSTO",
    config: {
      termos: [{ indicadorId: "vcras", peso: 3 }, { indicadorId: "cvac", peso: 5 }, { indicadorId: "cpuer", peso: 5 }],
      divisor: 13,
    },
  }),
  ind({
    id: "idtcFaixas",
    tipo: "CLASSIFICACAO",
    config: {
      indicadorId: "mcc",
      faixas: [
        { rotulo: "Crítico", de: 0, ate: 25 },
        { rotulo: "Baixo", de: 25, ate: 50 },
        { rotulo: "Moderado", de: 50, ate: 75 },
        { rotulo: "Alto", de: 75, ate: 100 },
      ],
    },
  }),
];

function crianca(id: string, cras: string, vacina: string, puer: string) {
  return montarResposta(id, [
    { perguntaId: "cras", opcoesSelecionadas: [cras] },
    { perguntaId: "vacina", opcoesSelecionadas: [vacina] },
    { perguntaId: "puer", opcoesSelecionadas: [puer] },
  ]);
}

const AMOSTRA = [
  crianca("A", "Sim", "Sim", "Sim"),
  crianca("B", "Não", "Sim", "Não"),
  crianca("C", "Sim", "Não", "Sim"),
];

describe("teste dourado do MCC", () => {
  // Em beforeAll, não no corpo do describe: se calcular lançar, só estes testes caem.
  let resultados: ReturnType<typeof calcular>;
  beforeAll(() => {
    resultados = calcular(INDICADORES, AMOSTRA, PERGUNTAS);
  });

  it("a média do MCC bate com a conta feita no papel", () => {
    expect(resultados.get("mcc")).toEqual({ status: "OK", valor: 66.67 });
  });

  it("as faixas distribuem as três crianças corretamente", () => {
    expect(resultados.get("idtcFaixas")).toEqual({
      status: "OK_FAIXAS",
      faixas: [
        { rotulo: "Crítico", percentual: 0 },
        { rotulo: "Baixo", percentual: 33.34 },
        { rotulo: "Moderado", percentual: 33.33 },
        { rotulo: "Alto", percentual: 33.33 },
      ],
    });
  });

  it("os termos também saem calculados", () => {
    expect(resultados.get("vcras")).toEqual({ status: "OK", valor: 66.67 });
  });

  it("a ordem de entrada não importa: o composto vem antes dos termos e o resultado é o mesmo", () => {
    const invertidos = [...INDICADORES].reverse();
    expect(calcular(invertidos, AMOSTRA, PERGUNTAS)).toEqual(resultados);
  });
});

describe("propagação de definição incompleta", () => {
  it("quem depende de um indicador incompleto não produz número", () => {
    const comLacuna = INDICADORES.map((i) =>
      i.id === "cvac" ? { ...i, status: "DEFINICAO_INCOMPLETA" as const, motivoIncompleto: "falta régua" } : i,
    );
    const r = calcular(comLacuna, AMOSTRA, PERGUNTAS);

    expect(r.get("cvac")).toMatchObject({ status: "INCOMPLETO" });
    expect(r.get("mcc")).toMatchObject({ status: "INCOMPLETO", dependencia: "cvac" });
    // E a lacuna alcança o neto, não só o filho.
    expect(r.get("idtcFaixas")).toMatchObject({ status: "INCOMPLETO" });
  });

  it("o neto aponta para o indicador que trava a cadeia, não para o intermediário", () => {
    const comLacuna = INDICADORES.map((i) =>
      i.id === "cvac" ? { ...i, status: "DEFINICAO_INCOMPLETA" as const } : i,
    );
    const r = calcular(comLacuna, AMOSTRA, PERGUNTAS);
    expect(r.get("idtcFaixas")).toEqual({ status: "INCOMPLETO", motivo: "depende de cvac", dependencia: "cvac" });
  });

  it("indicador marcado incompleto mostra o motivo do cadastro, mesmo com config ainda inválida", () => {
    const pendente = [
      ind({ id: "pend", tipo: "PROPORCAO", config: {}, status: "DEFINICAO_INCOMPLETA", motivoIncompleto: "falta régua" }),
    ];
    expect(calcular(pendente, AMOSTRA, PERGUNTAS).get("pend")).toEqual({ status: "INCOMPLETO", motivo: "falta régua" });
  });

  it("indicador que aponta para pergunta inexistente vira incompleto, não erro", () => {
    const orfao = [ind({ id: "orfao", tipo: "MEDIA", config: { perguntaId: "apagada" } })];
    const r = calcular(orfao, AMOSTRA, PERGUNTAS);
    expect(r.get("orfao")).toMatchObject({ status: "INCOMPLETO" });
  });

  it("config inválida no banco vira incompleto, não derruba o cálculo", () => {
    const quebrado = [ind({ id: "quebrado", tipo: "PROPORCAO", config: { perguntaId: "cras" } })];
    const r = calcular(quebrado, AMOSTRA, PERGUNTAS);
    expect(r.get("quebrado")).toMatchObject({ status: "INCOMPLETO" });
  });

  it("dependência fora do conjunto (inativa ou apagada) vira incompleto, não sem dados", () => {
    const semTermo = INDICADORES.filter((i) => i.id !== "cpuer");
    const r = calcular(semTermo, AMOSTRA, PERGUNTAS);
    expect(r.get("mcc")).toEqual({
      status: "INCOMPLETO",
      motivo: "depende de cpuer, que não está disponível",
      dependencia: "cpuer",
    });
    expect(r.get("idtcFaixas")).toMatchObject({ status: "INCOMPLETO", dependencia: "cpuer" });
  });

  describe("dependência de tipo sem valor por indivíduo vira incompleto, não sem dados", () => {
    const total = ind({ id: "total", tipo: "CONTAGEM", config: {} });
    const dist = ind({ id: "dist", tipo: "DISTRIBUICAO", config: { perguntaId: "cras" } });
    const faixasMcc = INDICADORES.find((i) => i.id === "idtcFaixas")!;
    const faixas = (id: string, indicadorId: string) =>
      ind({ id, tipo: "CLASSIFICACAO", config: { indicadorId, faixas: [{ rotulo: "Todas", de: 0, ate: 100 }] } });

    it("COMPOSTO sobre CONTAGEM, e a lacuna propaga para cima", () => {
      const sobreTotal = ind({ id: "sobreTotal", tipo: "COMPOSTO", config: { termos: [{ indicadorId: "total", peso: 1 }], divisor: 1 } });
      const r = calcular([total, sobreTotal, faixas("acima", "sobreTotal")], AMOSTRA, PERGUNTAS);
      expect(r.get("sobreTotal")).toEqual({
        status: "INCOMPLETO",
        motivo: "depende de total, do tipo CONTAGEM, que não tem valor por indivíduo",
        dependencia: "total",
      });
      expect(r.get("acima")).toMatchObject({ status: "INCOMPLETO", dependencia: "sobreTotal" });
      expect(r.get("total")).toEqual({ status: "OK", valor: 3 });
    });

    it("CLASSIFICACAO sobre DISTRIBUICAO", () => {
      const r = calcular([dist, faixas("sobreDist", "dist")], AMOSTRA, PERGUNTAS);
      expect(r.get("sobreDist")).toMatchObject({ status: "INCOMPLETO", dependencia: "dist" });
    });

    it("CLASSIFICACAO sobre CLASSIFICACAO", () => {
      const r = calcular([...INDICADORES, faixas("sobreFaixas", "idtcFaixas")], AMOSTRA, PERGUNTAS);
      expect(r.get("sobreFaixas")).toMatchObject({ status: "INCOMPLETO", dependencia: faixasMcc.id });
    });
  });

  it("dependência circular gravada no banco é acusada, não calculada", () => {
    const ciclo = [
      ind({ id: "x", tipo: "COMPOSTO", config: { termos: [{ indicadorId: "y", peso: 1 }], divisor: 1 } }),
      ind({ id: "y", tipo: "COMPOSTO", config: { termos: [{ indicadorId: "x", peso: 1 }], divisor: 1 } }),
    ];
    expect(() => calcular(ciclo, AMOSTRA, PERGUNTAS)).toThrow(CicloDetectado);
  });
});

describe("denominador zero e tipos sem valor individual", () => {
  it("sem nenhuma resposta preenchida é sem dados, e o composto acima também", () => {
    const vazias = [montarResposta("A", []), montarResposta("B", [])];
    const r = calcular(INDICADORES, vazias, PERGUNTAS);
    expect(r.get("vcras")).toEqual({ status: "SEM_DADOS" });
    expect(r.get("mcc")).toEqual({ status: "SEM_DADOS" });
    expect(r.get("idtcFaixas")).toEqual({ status: "SEM_DADOS" });
  });

  it("CONTAGEM conta as respostas", () => {
    const total = [ind({ id: "total", tipo: "CONTAGEM", config: {} })];
    expect(calcular(total, AMOSTRA, PERGUNTAS).get("total")).toEqual({ status: "OK", valor: 3 });
  });

  it("DISTRIBUICAO reparte as opções da pergunta", () => {
    const dist = [ind({ id: "dist", tipo: "DISTRIBUICAO", config: { perguntaId: "cras" }, casasDecimais: 1 })];
    expect(calcular(dist, AMOSTRA, PERGUNTAS).get("dist")).toEqual({
      status: "OK_DISTRIBUICAO",
      itens: [
        { opcao: "Sim", contagem: 2, percentual: 66.7 },
        { opcao: "Não", contagem: 1, percentual: 33.3 },
      ],
    });
  });
});

describe("recorte ANTES/APÓS", () => {
  it("devolve os dois cenários do mesmo indicador", () => {
    const perguntas = new Set(["crasAntes", "crasApos"]);
    const pareado = [
      ind({
        id: "vcras",
        tipo: "PROPORCAO",
        config: { perguntaId: "crasAntes", opcoesNumerador: ["Sim"] },
        recorte: "ANTES_APOS",
        recorteConfig: { substituicoes: [{ de: "crasAntes", para: "crasApos" }] },
      }),
    ];
    const respostas = [
      montarResposta("A", [
        { perguntaId: "crasAntes", opcoesSelecionadas: ["Não"] },
        { perguntaId: "crasApos", opcoesSelecionadas: ["Sim"] },
      ]),
      montarResposta("B", [
        { perguntaId: "crasAntes", opcoesSelecionadas: ["Não"] },
        { perguntaId: "crasApos", opcoesSelecionadas: ["Sim"] },
      ]),
    ];

    expect(calcular(pareado, respostas, perguntas).get("vcras")).toEqual({
      antes: { status: "OK", valor: 0 },
      apos: { status: "OK", valor: 100 },
    });
  });

  // --- Cenário pareado com dependências: VCRAS e CVAC têm par, CPUER não. ---
  const PERG_PAR = new Set(["crasA", "crasD", "vacA", "vacD", "puer"]);
  const vcrasPar = ind({
    id: "vcras",
    tipo: "PROPORCAO",
    config: { perguntaId: "crasA", opcoesNumerador: ["Sim"] },
    recorte: "ANTES_APOS",
    recorteConfig: { substituicoes: [{ de: "crasA", para: "crasD" }] },
  });
  const cvacPar = ind({
    id: "cvac",
    tipo: "PROPORCAO",
    config: { perguntaId: "vacA", opcoesNumerador: ["Sim"] },
    recorte: "ANTES_APOS",
    recorteConfig: { substituicoes: [{ de: "vacA", para: "vacD" }] },
  });
  const cpuer = ind({ id: "cpuer", tipo: "PROPORCAO", config: { perguntaId: "puer", opcoesNumerador: ["Sim"] } });
  const mccPar = ind({
    id: "mcc",
    tipo: "COMPOSTO",
    config: {
      termos: [{ indicadorId: "vcras", peso: 3 }, { indicadorId: "cvac", peso: 5 }, { indicadorId: "cpuer", peso: 5 }],
      divisor: 13,
    },
    recorte: "ANTES_APOS",
  });
  const faixasPar = ind({
    id: "faixas",
    tipo: "CLASSIFICACAO",
    config: { indicadorId: "mcc", faixas: [{ rotulo: "Baixo", de: 0, ate: 50 }, { rotulo: "Alto", de: 50, ate: 100 }] },
    recorte: "ANTES_APOS",
  });
  // Antes: ninguém no CRAS nem vacinado; depois: todos. CPUER = Sim para os dois.
  //   MCC antes = (0×3 + 0×5 + 100×5)/13 = 38.46 ; depois = 1300/13 = 100.
  const RESP_PAR = ["A", "B"].map((id) =>
    montarResposta(id, [
      { perguntaId: "crasA", opcoesSelecionadas: ["Não"] },
      { perguntaId: "crasD", opcoesSelecionadas: ["Sim"] },
      { perguntaId: "vacA", opcoesSelecionadas: ["Não"] },
      { perguntaId: "vacD", opcoesSelecionadas: ["Sim"] },
      { perguntaId: "puer", opcoesSelecionadas: ["Sim"] },
    ]),
  );

  it("composto pareado usa o APÓS das dependências pareadas no cenário APÓS", () => {
    const r = calcular([vcrasPar, cvacPar, cpuer, mccPar], RESP_PAR, PERG_PAR);
    expect(r.get("mcc")).toEqual({ antes: { status: "OK", valor: 38.46 }, apos: { status: "OK", valor: 100 } });
  });

  it("classificação pareada classifica cada cenário com os valores dele", () => {
    const r = calcular([vcrasPar, cvacPar, cpuer, mccPar, faixasPar], RESP_PAR, PERG_PAR);
    expect(r.get("faixas")).toEqual({
      antes: { status: "OK_FAIXAS", faixas: [{ rotulo: "Baixo", percentual: 100 }, { rotulo: "Alto", percentual: 0 }] },
      apos: { status: "OK_FAIXAS", faixas: [{ rotulo: "Baixo", percentual: 0 }, { rotulo: "Alto", percentual: 100 }] },
    });
  });

  describe("o recorte propaga para quem depende de um pareado", () => {
    // Só VCRAS é pareado; CVAC (vacA) e CPUER não. MCC, IDTC e faixas sem recorte no cadastro.
    //   MCC antes = (0×3 + 0×5 + 100×5)/13 = 38.46 ; depois = (100×3 + 0×5 + 100×5)/13 = 61.54.
    const cvacSemPar = { ...cvacPar, recorte: null, recorteConfig: null };
    const mccSemRecorte = { ...mccPar, recorte: null };
    const idtc = ind({ id: "idtc", tipo: "COMPOSTO", config: { termos: [{ indicadorId: "mcc", peso: 1 }], divisor: 1 } });
    const faixasIdtc = ind({
      id: "faixasIdtc",
      tipo: "CLASSIFICACAO",
      config: { indicadorId: "idtc", faixas: [{ rotulo: "Baixo", de: 0, ate: 50 }, { rotulo: "Alto", de: 50, ate: 100 }] },
    });
    let r: ReturnType<typeof calcular>;
    beforeAll(() => {
      r = calcular([vcrasPar, cvacSemPar, cpuer, mccSemRecorte, idtc, faixasIdtc], RESP_PAR, PERG_PAR);
    });

    it("composto sem recorte sai pareado, cada lado com o lado correspondente da dependência", () => {
      expect(r.get("mcc")).toEqual({ antes: { status: "OK", valor: 38.46 }, apos: { status: "OK", valor: 61.54 } });
    });

    it("a propagação alcança o neto (composto e classificação)", () => {
      expect(r.get("idtc")).toEqual({ antes: { status: "OK", valor: 38.46 }, apos: { status: "OK", valor: 61.54 } });
      expect(r.get("faixasIdtc")).toEqual({
        antes: { status: "OK_FAIXAS", faixas: [{ rotulo: "Baixo", percentual: 100 }, { rotulo: "Alto", percentual: 0 }] },
        apos: { status: "OK_FAIXAS", faixas: [{ rotulo: "Baixo", percentual: 0 }, { rotulo: "Alto", percentual: 100 }] },
      });
    });

    it("dependência não pareada continua simples", () => {
      expect(r.get("cvac")).toEqual({ status: "OK", valor: 0 });
      expect(r.get("cpuer")).toEqual({ status: "OK", valor: 100 });
    });
  });

  it("composto pareado sem nenhuma dependência pareada não tem par: incompleto", () => {
    const cvacSemPar = { ...cvacPar, recorte: null, recorteConfig: null };
    const vcrasSemPar = { ...vcrasPar, recorte: null, recorteConfig: null };
    const r = calcular([vcrasSemPar, cvacSemPar, cpuer, mccPar], RESP_PAR, PERG_PAR);
    expect(r.get("mcc")).toMatchObject({ status: "INCOMPLETO" });
  });

  it("um dos lados todo em branco: o outro sai calculado e o vazio é sem dados", () => {
    const soAntes = ["A", "B"].map((id) => montarResposta(id, [{ perguntaId: "crasA", opcoesSelecionadas: ["Sim"] }]));
    expect(calcular([vcrasPar], soAntes, PERG_PAR).get("vcras")).toEqual({
      antes: { status: "OK", valor: 100 },
      apos: { status: "SEM_DADOS" },
    });
  });

  it("pareado sem recorteConfig é definição incompleta, não dois números iguais", () => {
    const semPar = [{ ...vcrasPar, recorteConfig: null }];
    expect(calcular(semPar, RESP_PAR, PERG_PAR).get("vcras")).toMatchObject({ status: "INCOMPLETO" });
  });

  it("substituição de pergunta que o indicador não usa é incompleta (erro de digitação)", () => {
    const errado = [{ ...vcrasPar, recorteConfig: { substituicoes: [{ de: "crasX", para: "crasD" }] } }];
    expect(calcular(errado, RESP_PAR, PERG_PAR).get("vcras")).toMatchObject({ status: "INCOMPLETO" });
  });

  it("pergunta APÓS inexistente é incompleta", () => {
    const orfao = [{ ...vcrasPar, recorteConfig: { substituicoes: [{ de: "crasA", para: "apagada" }] } }];
    expect(calcular(orfao, RESP_PAR, PERG_PAR).get("vcras")).toMatchObject({ status: "INCOMPLETO" });
  });

  it("CRUZAMENTO e DERIVADA trocam as perguntas no cenário APÓS", () => {
    const perguntas = new Set(["sexo", "rendaA", "rendaD"]);
    const respostas = [
      montarResposta("A", [
        { perguntaId: "sexo", opcoesSelecionadas: ["F"] },
        { perguntaId: "rendaA", valorNumero: 100 },
        { perguntaId: "rendaD", valorNumero: 300 },
      ]),
    ];
    const recorteConfig = { substituicoes: [{ de: "rendaA", para: "rendaD" }] };
    const r = calcular(
      [
        ind({
          id: "cruz",
          tipo: "CRUZAMENTO",
          config: { condicoes: [{ perguntaId: "sexo", opcoes: ["F"] }, { perguntaId: "rendaA", operador: ">", valor: 200 }] },
          recorte: "ANTES_APOS",
          recorteConfig,
        }),
        ind({
          id: "deriv",
          tipo: "DERIVADA",
          config: { variaveis: { r: "rendaA" }, expressao: { op: "*", esq: { var: "r" }, dir: { const: 2 } } },
          recorte: "ANTES_APOS",
          recorteConfig,
        }),
      ],
      respostas,
      perguntas,
    );
    expect(r.get("cruz")).toEqual({ antes: { status: "OK", valor: 0 }, apos: { status: "OK", valor: 100 } });
    expect(r.get("deriv")).toEqual({ antes: { status: "OK", valor: 200 }, apos: { status: "OK", valor: 600 } });
  });

  it("DISTRIBUICAO e MEDIA trocam a pergunta no cenário APÓS", () => {
    const perguntas = new Set(["corA", "corD", "nA", "nD"]);
    const respostas = [
      montarResposta("A", [
        { perguntaId: "corA", opcoesSelecionadas: ["Azul"] },
        { perguntaId: "corD", opcoesSelecionadas: ["Verde"] },
        { perguntaId: "nA", valorNumero: 1 },
        { perguntaId: "nD", valorNumero: 5 },
      ]),
    ];
    const r = calcular(
      [
        ind({
          id: "dist",
          tipo: "DISTRIBUICAO",
          config: { perguntaId: "corA" },
          recorte: "ANTES_APOS",
          recorteConfig: { substituicoes: [{ de: "corA", para: "corD" }] },
        }),
        ind({
          id: "media",
          tipo: "MEDIA",
          config: { perguntaId: "nA" },
          recorte: "ANTES_APOS",
          recorteConfig: { substituicoes: [{ de: "nA", para: "nD" }] },
        }),
      ],
      respostas,
      perguntas,
    );
    expect(r.get("dist")).toEqual({
      antes: { status: "OK_DISTRIBUICAO", itens: [{ opcao: "Azul", contagem: 1, percentual: 100 }] },
      apos: { status: "OK_DISTRIBUICAO", itens: [{ opcao: "Verde", contagem: 1, percentual: 100 }] },
    });
    expect(r.get("media")).toEqual({ antes: { status: "OK", valor: 1 }, apos: { status: "OK", valor: 5 } });
  });
});

describe("indicador com pesquisaId considera só as respostas daquela pesquisa", () => {
  // Criança (pc) e Gestante (pg) compartilham a pergunta "cras" só para o teste.
  const respostas = [
    montarResposta("A", [{ perguntaId: "cras", opcoesSelecionadas: ["Sim"] }, { perguntaId: "vacina", opcoesSelecionadas: ["Sim"] }], "pc"),
    montarResposta("B", [{ perguntaId: "cras", opcoesSelecionadas: ["Não"] }, { perguntaId: "vacina", opcoesSelecionadas: ["Sim"] }], "pc"),
    montarResposta("G1", [{ perguntaId: "cras", opcoesSelecionadas: ["Sim"] }, { perguntaId: "vacina", opcoesSelecionadas: ["Não"] }], "pg"),
    montarResposta("G2", [{ perguntaId: "cras", opcoesSelecionadas: ["Sim"] }, { perguntaId: "vacina", opcoesSelecionadas: ["Não"] }], "pg"),
    montarResposta("G3", [{ perguntaId: "cras", opcoesSelecionadas: ["Sim"] }, { perguntaId: "vacina", opcoesSelecionadas: ["Não"] }], "pg"),
  ];

  it("CONTAGEM conta só as respostas da pesquisa do indicador", () => {
    const r = calcular([ind({ id: "total", tipo: "CONTAGEM", config: {}, pesquisaId: "pc" })], respostas, PERGUNTAS);
    expect(r.get("total")).toEqual({ status: "OK", valor: 2 });
  });

  it("PROPORCAO usa só as respostas da pesquisa do indicador", () => {
    const r = calcular(
      [ind({ id: "vcras", tipo: "PROPORCAO", config: { perguntaId: "cras", opcoesNumerador: ["Sim"] }, pesquisaId: "pc" })],
      respostas,
      PERGUNTAS,
    );
    expect(r.get("vcras")).toEqual({ status: "OK", valor: 50 });
  });

  it("DISTRIBUICAO usa só as respostas da pesquisa do indicador", () => {
    const r = calcular([ind({ id: "dist", tipo: "DISTRIBUICAO", config: { perguntaId: "cras" }, pesquisaId: "pc" })], respostas, PERGUNTAS);
    expect(r.get("dist")).toEqual({
      status: "OK_DISTRIBUICAO",
      itens: [{ opcao: "Sim", contagem: 1, percentual: 50 }, { opcao: "Não", contagem: 1, percentual: 50 }],
    });
  });

  it("COMPOSTO e CLASSIFICACAO mantêm o alinhamento por posição e respeitam o escopo", () => {
    // Dependências sem pesquisa (veem todas), compostos restritos à pesquisa da criança.
    const vcras = ind({ id: "vcras", tipo: "PROPORCAO", config: { perguntaId: "cras", opcoesNumerador: ["Sim"] } });
    const cvac = ind({ id: "cvac", tipo: "PROPORCAO", config: { perguntaId: "vacina", opcoesNumerador: ["Sim"] } });
    const mcc = ind({
      id: "mcc",
      tipo: "COMPOSTO",
      config: { termos: [{ indicadorId: "vcras", peso: 1 }, { indicadorId: "cvac", peso: 1 }], divisor: 2 },
      pesquisaId: "pc",
    });
    const faixas = ind({
      id: "faixas",
      tipo: "CLASSIFICACAO",
      config: { indicadorId: "vcras", faixas: [{ rotulo: "Baixo", de: 0, ate: 50 }, { rotulo: "Alto", de: 50, ate: 100 }] },
      pesquisaId: "pc",
    });
    const r = calcular([vcras, cvac, mcc, faixas], respostas, PERGUNTAS);
    // A: (100+100)/2 = 100; B: (0+100)/2 = 50 -> 75. As gestantes dariam 50 cada e puxariam para baixo.
    expect(r.get("mcc")).toEqual({ status: "OK", valor: 75 });
    // vcras na criança: A=100 (Alto), B=0 (Baixo). Com gestantes seriam 4 Altos de 5.
    expect(r.get("faixas")).toEqual({
      status: "OK_FAIXAS",
      faixas: [{ rotulo: "Baixo", percentual: 50 }, { rotulo: "Alto", percentual: 50 }],
    });
  });

  it("dependente sem pesquisaId lê branco nas respostas fora da pesquisa da dependência", () => {
    // vcras só da criança; o composto vê todas, mas as gestantes chegam a ele em branco.
    const vcrasPc = ind({ id: "vcras", tipo: "PROPORCAO", config: { perguntaId: "cras", opcoesNumerador: ["Sim"] }, pesquisaId: "pc" });
    const geral = ind({ id: "geral", tipo: "COMPOSTO", config: { termos: [{ indicadorId: "vcras", peso: 1 }], divisor: 1 } });
    // A=100, B=0 -> 50. Se as gestantes (todas Sim) vazassem, daria 80.
    expect(calcular([vcrasPc, geral], respostas, PERGUNTAS).get("geral")).toEqual({ status: "OK", valor: 50 });
  });

  it("indicador sem pesquisaId continua usando todas as respostas", () => {
    const r = calcular(
      [
        ind({ id: "total", tipo: "CONTAGEM", config: {} }),
        ind({ id: "vcras", tipo: "PROPORCAO", config: { perguntaId: "cras", opcoesNumerador: ["Sim"] } }),
      ],
      respostas,
      PERGUNTAS,
    );
    expect(r.get("total")).toEqual({ status: "OK", valor: 5 });
    expect(r.get("vcras")).toEqual({ status: "OK", valor: 80 });
  });
});

describe("máscara do painel", () => {
  const indicadores = [
    ind({ id: "vcras", tipo: "PROPORCAO", config: { perguntaId: "cras", opcoesNumerador: ["Sim"] } }),
    ind({ id: "total", tipo: "CONTAGEM", config: {} }),
    ind({ id: "mccM", tipo: "COMPOSTO", config: { termos: [{ indicadorId: "vcras", peso: 1 }], divisor: 1 } }),
  ];
  const respostas = [crianca("A", "Sim", "Sim", "Sim"), crianca("B", "Não", "Sim", "Não"), crianca("C", "Sim", "Não", "Sim")];
  let comMascara: Map<string, unknown>;
  let semMascara: Map<string, unknown>;

  beforeAll(() => {
    comMascara = calcular(indicadores, respostas, PERGUNTAS, [true, true, false]);
    semMascara = calcular(indicadores, respostas.slice(0, 2), PERGUNTAS);
  });

  it("agrega só quem está na máscara", () => {
    expect(comMascara.get("vcras")).toEqual({ status: "OK", valor: 50 });
    expect(comMascara.get("total")).toEqual({ status: "OK", valor: 2 });
    expect(comMascara.get("mccM")).toEqual({ status: "OK", valor: 50 });
  });

  it("dá o mesmo número que filtrar as respostas antes", () => {
    expect(comMascara).toEqual(semMascara);
  });

  it("sem máscara: todas", () => {
    expect(calcular(indicadores, respostas, PERGUNTAS).get("total")).toEqual({ status: "OK", valor: 3 });
  });
});

describe("máscara do painel não muda número de tipo antigo (Review Focus 1)", () => {
  // Todos os tipos antigos juntos, com pareamento ANTES/APÓS próprio (vcras) e herdado
  // (mcc, faixasMcc), CLASSIFICACAO sobre COMPOSTO simples e pareado, e escopo de pesquisa.
  const perguntas = new Set(["crasA", "crasD", "vac", "n", "cor"]);
  const indicadores = [
    ind({
      id: "vcras",
      tipo: "PROPORCAO",
      config: { perguntaId: "crasA", opcoesNumerador: ["Sim"] },
      recorte: "ANTES_APOS",
      recorteConfig: { substituicoes: [{ de: "crasA", para: "crasD" }] },
    }),
    ind({ id: "cvac", tipo: "PROPORCAO", config: { perguntaId: "vac", opcoesNumerador: ["Sim"] } }),
    ind({ id: "media", tipo: "MEDIA", config: { perguntaId: "n" } }),
    ind({ id: "total", tipo: "CONTAGEM", config: {} }),
    ind({ id: "totalPc", tipo: "CONTAGEM", config: {}, pesquisaId: "pc" }),
    ind({ id: "dist", tipo: "DISTRIBUICAO", config: { perguntaId: "cor" } }),
    ind({
      id: "mcc",
      tipo: "COMPOSTO",
      config: { termos: [{ indicadorId: "vcras", peso: 3 }, { indicadorId: "cvac", peso: 5 }], divisor: 8 },
    }),
    ind({
      id: "faixasMcc",
      tipo: "CLASSIFICACAO",
      config: { indicadorId: "mcc", faixas: [{ rotulo: "Baixo", de: 0, ate: 50 }, { rotulo: "Alto", de: 50, ate: 100 }] },
    }),
    ind({ id: "soVac", tipo: "COMPOSTO", config: { termos: [{ indicadorId: "cvac", peso: 1 }], divisor: 1 }, pesquisaId: "pc" }),
    ind({
      id: "faixasSoVac",
      tipo: "CLASSIFICACAO",
      config: { indicadorId: "soVac", faixas: [{ rotulo: "Baixo", de: 0, ate: 50 }, { rotulo: "Alto", de: 50, ate: 100 }] },
    }),
  ];
  const r = (id: string, pesquisa: string, crasA: string, crasD: string, vac: string, n: number | null, cor: string) =>
    montarResposta(
      id,
      [
        { perguntaId: "crasA", opcoesSelecionadas: [crasA] },
        { perguntaId: "crasD", opcoesSelecionadas: [crasD] },
        { perguntaId: "vac", opcoesSelecionadas: [vac] },
        { perguntaId: "n", valorNumero: n },
        { perguntaId: "cor", opcoesSelecionadas: [cor] },
      ],
      pesquisa,
    );
  const respostas = [
    r("A", "pc", "Sim", "Sim", "Sim", 10, "Azul"),
    r("B", "pc", "Não", "Sim", "Não", 0, "Verde"),
    r("C", "pc", "Não", "Não", "Sim", 7, "Azul"),
    r("D", "pg", "Não", "Não", "Não", null, "Verde"),
    r("E", "pc", "Não", "Sim", "Sim", 3, "Verde"),
    r("F", "pg", "Sim", "Sim", "Sim", 1, "Azul"),
  ];
  const mascara = [true, false, true, false, true, true];

  it("calcular(todas, máscara) == calcular(só as da máscara), indicador por indicador", () => {
    const comMascara = calcular(indicadores, respostas, perguntas, mascara);
    const filtradas = calcular(indicadores, respostas.filter((_, i) => mascara[i]), perguntas);
    for (const { id } of indicadores) {
      expect(comMascara.get(id), id).toEqual(filtradas.get(id));
    }
    expect(comMascara).toEqual(filtradas);
  });

  it("a máscara de fato muda o número (o teste acima não é vácuo)", () => {
    const comMascara = calcular(indicadores, respostas, perguntas, mascara);
    const todas = calcular(indicadores, respostas, perguntas);
    for (const id of ["vcras", "mcc", "faixasMcc", "faixasSoVac", "media", "total", "dist"]) {
      expect(comMascara.get(id), id).not.toEqual(todas.get(id));
    }
    // E os pareados continuam pareados.
    expect(comMascara.get("vcras")).toHaveProperty("apos");
    expect(comMascara.get("faixasMcc")).toHaveProperty("apos");
  });
});
