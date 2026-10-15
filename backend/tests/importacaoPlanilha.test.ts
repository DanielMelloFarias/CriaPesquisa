import { describe, it, expect, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import ExcelJS from "exceljs";
import { COLUNAS, lerPlanilha } from "../src/helper/importacao/planilha.js";

/** Planilha gerada aqui, sem dado pessoal real; DtRegistro/Usuario têm valores fictícios. */
const arquivos: string[] = [];

async function gerarXlsx(cabecalho: readonly string[], linhas: Array<Record<string, string | number>>) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Indicadores");
  sheet.addRow([...cabecalho]);
  for (const l of linhas) sheet.addRow(COLUNAS.map((c) => l[c] ?? ""));
  const caminho = join(tmpdir(), `importacao-planilha-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
  await workbook.xlsx.writeFile(caminho);
  arquivos.push(caminho);
  return caminho;
}

const PESSOAL = { DtRegistro: "2026-04-25", Usuario: "alguem@exemplo.com" };

afterAll(async () => {
  for (const a of arquivos) await rm(a, { force: true });
});

describe("lerPlanilha", () => {
  it("lê só as linhas do Cartão CRIA, divide a apresentação e não lê DtRegistro/Usuario", async () => {
    const caminho = await gerarXlsx(COLUNAS, [
      { ID: 165, Projeto: "Cartão CRIA (Criança)", "Nome do Indicador": "VCRAS", Apresentação: "Escopo", ...PESSOAL },
      { ID: "210", Projeto: "Cartão CRIA (Gestante)", "Nome do Indicador": "VCRAS G", ...PESSOAL },
      { ID: "999", Projeto: "Outro Projeto", "Nome do Indicador": "Fora", Apresentação: "Escopo", ...PESSOAL },
      {
        ID: " 150 ",
        Projeto: "Cartão CRIA (Criança)",
        "Nome do Indicador": "Zona",
        "Pergunta (Descrição)": "4. Zona",
        "Fórmula de Cálculo": "(Zona urbana / Total) × 100",
        Apresentação: "Escopo, Perfil",
        ...PESSOAL,
      },
    ]);

    const linhas = await lerPlanilha(caminho);

    expect(linhas.map((l) => l.id)).toEqual(["165", "210", "150"]);
    expect(linhas.map((l) => l.projeto)).toEqual(["Cartão CRIA (Criança)", "Cartão CRIA (Gestante)", "Cartão CRIA (Criança)"]);
    expect(linhas[0].apresentacao).toEqual(["Escopo"]);
    expect(linhas[1].apresentacao).toEqual([]);
    expect(linhas[2].apresentacao).toEqual(["Escopo", "Perfil"]);
    expect(linhas[2].perguntaDescricao).toBe("4. Zona");
    expect(linhas[2].formulaCalculo).toBe("(Zona urbana / Total) × 100");
    const tudo = JSON.stringify(linhas);
    expect(tudo).not.toContain("alguem@exemplo.com");
    expect(tudo).not.toContain("2026-04-25");
  });

  it("recusa planilha com coluna renomeada", async () => {
    const renomeado = COLUNAS.map((c) => (c === "Pergunta (Descrição)" ? "Pergunta" : c));
    const caminho = await gerarXlsx(renomeado, [{ ID: "165", Projeto: "Cartão CRIA (Criança)" }]);
    await expect(lerPlanilha(caminho)).rejects.toThrow("cabeçalho da planilha mudou");
  });

  it("recusa planilha com coluna faltando", async () => {
    const semColuna = COLUNAS.filter((c) => c !== "Observações");
    const caminho = await gerarXlsx(semColuna, [{ ID: "165", Projeto: "Cartão CRIA (Criança)" }]);
    await expect(lerPlanilha(caminho)).rejects.toThrow("cabeçalho da planilha mudou");
  });
});
