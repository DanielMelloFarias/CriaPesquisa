import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  montarLinhasExport,
  gerarCsv,
  gerarXlsx,
  type PerguntaParaExport,
  type RespostaParaExport,
} from "../src/helper/export.js";

const perguntas: PerguntaParaExport[] = [
  { id: "p-texto", enunciado: "Comentário", tipo: "TEXTO" },
  { id: "p-numero", enunciado: "Idade", tipo: "NUMERO" },
  {
    id: "p-escolha",
    enunciado: "Recomendaria?",
    tipo: "ESCOLHA_UNICA",
    opcoes: [
      { id: "op-sim", texto: "Sim" },
      { id: "op-nao", texto: "Não" },
    ],
  },
];

const respostas: RespostaParaExport[] = [
  {
    id: "r1",
    municipio: "Maceió",
    unidade: "Unidade Central",
    regional: "1ª Regional",
    enviadaEm: new Date("2026-01-15T12:00:00.000Z"),
    itens: [
      { perguntaId: "p-texto", valorTexto: "Muito bom" },
      { perguntaId: "p-numero", valorNumero: 42 },
      { perguntaId: "p-escolha", opcoesSelecionadas: ["op-sim"] },
    ],
  },
];

describe("montarLinhasExport", () => {
  it("gera cabeçalho com metadados + enunciados e uma linha por resposta", () => {
    const linhas = montarLinhasExport(perguntas, respostas);
    expect(linhas[0]).toEqual(["Município", "Unidade", "Regional", "Enviada em", "Comentário", "Idade", "Recomendaria?"]);
    expect(linhas[1]).toEqual([
      "Maceió",
      "Unidade Central",
      "1ª Regional",
      "2026-01-15T12:00:00.000Z",
      "Muito bom",
      "42",
      "Sim",
    ]);
  });
});

describe("gerarCsv", () => {
  it("contém cabeçalhos, BOM e a linha esperada", () => {
    const csv = gerarCsv(perguntas, respostas);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Município,Unidade,Regional,Enviada em,Comentário,Idade,Recomendaria?");
    expect(csv).toContain("Maceió,Unidade Central,1ª Regional,2026-01-15T12:00:00.000Z,Muito bom,42,Sim");
  });

  it("escapa campos com vírgula e aspas", () => {
    const respostaComVirgula: RespostaParaExport[] = [
      {
        id: "r2",
        municipio: "Cidade, com vírgula",
        unidade: null,
        regional: null,
        enviadaEm: new Date("2026-01-01T00:00:00.000Z"),
        itens: [{ perguntaId: "p-texto", valorTexto: 'texto com "aspas"' }],
      },
    ];
    const csv = gerarCsv(perguntas, respostaComVirgula);
    expect(csv).toContain('"Cidade, com vírgula"');
    expect(csv).toContain('"texto com ""aspas"""');
  });

  // Texto livre que começa com = + - @ vira fórmula ao abrir o CSV no Excel.
  it("neutraliza texto que o Excel leria como fórmula, sem mexer em número negativo", () => {
    const respostaFormula: RespostaParaExport[] = [
      {
        id: "r3",
        municipio: "@Maceió",
        unidade: null,
        regional: null,
        enviadaEm: new Date("2026-01-01T00:00:00.000Z"),
        itens: [
          { perguntaId: "p-texto", valorTexto: "=1+1" },
          { perguntaId: "p-numero", valorNumero: -5 },
        ],
      },
    ];
    const linha = gerarCsv(perguntas, respostaFormula).split("\r\n")[1]!;
    expect(linha.split(",")).toEqual(["'@Maceió", "", "", "2026-01-01T00:00:00.000Z", "'=1+1", "-5", ""]);
  });
});

describe("gerarXlsx", () => {
  it("retorna um Buffer com conteúdo", async () => {
    const buffer = await gerarXlsx(perguntas, respostas);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("workbook reaberto contém o cabeçalho esperado em A1 e worksheet 'Respostas'", async () => {
    const buffer = await gerarXlsx(perguntas, respostas);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const planilha = workbook.getWorksheet("Respostas");
    expect(planilha).toBeDefined();
    expect(planilha!.getCell("A1").value).toBe("Município");
    expect(planilha!.getCell("A2").value).toBe("Maceió");
  });
});
