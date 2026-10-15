import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/config/prisma.js";
import { COLUNAS } from "../src/helper/importacao/planilha.js";
import { DEFINICOES } from "../src/helper/importacao/definicoes-cartao-cria.js";
import { indicadorModel } from "../src/models/indicadorModel.js";
import { importarIndicadores, type ResumoImportacao } from "../scripts/importar-indicadores.js";

/**
 * Contra o banco real (porta 5433), com as pesquisas do Cartão CRIA do seed.
 * A planilha é gerada aqui (sem dado pessoal real) e apagada no fim; tudo o
 * que a importação grava é apagado no afterAll.
 *
 * Os códigos do mapa são únicos no banco: se a importação real já rodou neste
 * banco, este teste não tem como rodar sem mexer nela e é pulado (com aviso).
 */

const CODIGOS_MAPA = DEFINICOES.map((d) => d.codigo);
const escopo: Prisma.IndicadorWhereInput = {
  OR: [{ codigo: { in: CODIGOS_MAPA } }, { codigo: { startsWith: "CRIA-" } }, { idsPlanilha: { isEmpty: false } }],
};

const jaImportado = (await prisma.indicador.count({ where: escopo })) > 0;
if (jaImportado) {
  console.warn("importarIndicadores.test: o banco já tem indicadores importados; teste de banco pulado.");
}

const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const caminho = join(tmpdir(), `importar-indicadores-${sufixo}.xlsx`);
const EMAIL_PLANILHA = "alguem@exemplo.com";
let usuarioId = "";
const existentesAntes = new Set<string>();
let primeira: ResumoImportacao;

async function gerarXlsx() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Indicadores");
  sheet.addRow([...COLUNAS]);
  const linhas: Array<Record<string, string>> = [
    { ID: "165", "Nome do Indicador": "VCRAS", "Pergunta (Descrição)": "Participa do CRAS", Apresentação: "Escopo" },
    { ID: "sd51sd", "Nome do Indicador": "IDTC Crítico", "Tipo de Indicador": "Desenvolvimento", Apresentação: "Perfil" },
    { ID: "sd5v4sd45v", "Nome do Indicador": "IDTC Baixo", Apresentação: "Perfil" },
    {
      ID: "150",
      "Nome do Indicador": "% Zona urbana",
      "Pergunta (Descrição)": "4. Zona",
      "Fórmula de Cálculo": "(Zona urbana / Total) × 100",
      "Tipo de Indicador": "Território",
      Apresentação: "Escopo, Perfil",
    },
    { ID: "900", "Nome do Indicador": "Sem pergunta", "Fórmula de Cálculo": "algo" },
  ];
  for (const l of linhas) {
    const completa: Record<string, string> = {
      Projeto: "Cartão CRIA (Criança)",
      DtRegistro: "2026-04-25",
      Usuario: EMAIL_PLANILHA,
      ...l,
    };
    sheet.addRow(COLUNAS.map((c) => completa[c] ?? ""));
  }
  await workbook.xlsx.writeFile(caminho);
}

beforeAll(async () => {
  if (jaImportado) return;
  for (const i of await prisma.indicador.findMany({ select: { id: true } })) existentesAntes.add(i.id);
  const usuario = await prisma.usuario.create({
    data: { nome: "Importação Indicadores", email: `import-ind-${sufixo}@cria.al`, senhaHash: "x", papel: "ADMIN" },
  });
  usuarioId = usuario.id;
  await gerarXlsx();
  primeira = await importarIndicadores(caminho, usuarioId);
}, 60000);

afterAll(async () => {
  await rm(caminho, { force: true });
  if (!jaImportado) {
    const criados = (await prisma.indicador.findMany({ where: escopo, select: { id: true } }))
      .map((i) => i.id)
      .filter((id) => !existentesAntes.has(id));
    await prisma.indicadorDependencia.deleteMany({
      where: { OR: [{ indicadorId: { in: criados } }, { dependeDeId: { in: criados } }] },
    });
    await prisma.indicador.deleteMany({ where: { id: { in: criados } } });
    await prisma.logAlteracao.deleteMany({ where: { entidade: "Indicador", entidadeId: { in: criados } } });
    if (usuarioId) {
      await prisma.logAlteracao.deleteMany({ where: { usuarioId } });
      await prisma.usuario.delete({ where: { id: usuarioId } });
    }
  }
  await prisma.$disconnect();
}, 60000);

const porCodigo = (codigo: string) => prisma.indicador.findUniqueOrThrow({ where: { codigo } });

describe.skipIf(jaImportado)("importarIndicadores (banco real)", () => {
  it("resume a primeira rodada", () => {
    expect(primeira.lidas).toBe(5);
    expect(primeira.jaExistiam).toBe(0);
    // Todas as definições do mapa (inclusive as que não têm linha no arquivo) + 2 por sugestão.
    expect(primeira.importadas).toBe(DEFINICOES.length + 2);
    expect(primeira.auxiliares).toBe(DEFINICOES.filter((d) => d.idsPlanilha.length === 0).length);
    expect(primeira.porSituacao.PERGUNTA_SUGERIDA).toEqual(["150"]);
    expect(primeira.porSituacao.SEM_DESCRICAO).toEqual(["900"]);
    expect(primeira.porSituacao.DEFINICAO_PRONTA).toContain("165");
  });

  it("C-VCRAS vem do mapa, incompleto, com o recorte ANTES/APÓS", async () => {
    const vcras = await porCodigo("C-VCRAS");
    expect(vcras.idsPlanilha).toContain("165");
    expect(vcras.status).toBe("DEFINICAO_INCOMPLETA");
    expect(vcras.motivoIncompleto).toMatch(/^definição pronta/);
    expect(vcras.recorte).toBe("ANTES_APOS");
    const recorte = vcras.recorteConfig as { substituicoes: Array<{ de: string; para: string }> };
    expect(recorte.substituicoes).toHaveLength(1);
    expect(recorte.substituicoes[0].de).not.toBe("");
    expect(vcras.categoria).toBeNull();
    expect(vcras.dadosPlanilha).toMatchObject({ nome: "VCRAS", perguntaDescricao: "Participa do CRAS" });
  });

  it("as faixas do IDTC viram um indicador só, com os 4 ids do mapa, dependendo do C-IDTC", async () => {
    const faixas = await prisma.indicador.findMany({ where: { idsPlanilha: { hasSome: ["sd51sd", "sd5v4sd45v"] } } });
    expect(faixas.map((f) => f.codigo)).toEqual(["C-IDTC-FAIXAS"]);
    expect(faixas[0].idsPlanilha).toEqual(["sd51sd", "sd5v4sd45v", "sd5v4sv87", "sdv67vd7v"]);
    expect(faixas[0].categoria).toBe("Desenvolvimento");
    const idtc = await porCodigo("C-IDTC");
    const deps = await prisma.indicadorDependencia.findMany({ where: { indicadorId: faixas[0].id } });
    expect(deps.map((d) => d.dependeDeId)).toEqual([idtc.id]);
  });

  it("MCB é gravado sem pesquisa", async () => {
    const mcb = await porCodigo("MCB");
    expect(mcb.pesquisaId).toBeNull();
    const vcras = await porCodigo("C-VCRAS");
    expect(vcras.pesquisaId).not.toBeNull();
  });

  it("linha 150 vira PROPORCAO sugerida sobre a pergunta Zona, sem opções", async () => {
    const ind = await porCodigo("CRIA-C-150");
    const zona = await prisma.pergunta.findFirstOrThrow({
      where: { enunciado: "Zona", pesquisa: { titulo: "Cartão CRIA — Criança", deletedAt: null } },
    });
    expect(ind.tipo).toBe("PROPORCAO");
    expect(ind.config).toEqual({ perguntaId: zona.id, opcoesNumerador: [] });
    expect(ind.motivoIncompleto).toBe("pergunta sugerida: Zona — conferir tipo e opções");
    expect(ind.idsPlanilha).toEqual(["150"]);
    expect(ind.apresentacao).toEqual(["Escopo", "Perfil"]);
    expect(ind.categoria).toBe("Território");
    expect(ind.pesquisaId).toBe(zona.pesquisaId);
  });

  it("linha 900 sem descrição pede a pergunta na revisão", async () => {
    const ind = await porCodigo("CRIA-C-900");
    expect(ind.motivoIncompleto).toBe("planilha sem a pergunta — escolher na revisão");
    expect(ind.tipo).toBe("CONTAGEM");
  });

  it("nada entra ATIVO, nada leva o e-mail da coluna Usuario, toda gravação tem log", async () => {
    const importados = await prisma.indicador.findMany({ where: escopo });
    expect(importados.length).toBe(DEFINICOES.length + 2);
    expect(importados.every((i) => i.status === "DEFINICAO_INCOMPLETA")).toBe(true);
    expect(JSON.stringify(importados)).not.toContain(EMAIL_PLANILHA);
    const logs = await prisma.logAlteracao.findMany({ where: { usuarioId, entidade: "Indicador", acao: "CREATE" } });
    expect(new Set(logs.map((l) => l.entidadeId))).toEqual(new Set(importados.map((i) => i.id)));
    expect(logs).toHaveLength(importados.length);
    expect(JSON.stringify(logs)).not.toContain(EMAIL_PLANILHA);
  });

  it("planilha com coluna renomeada para antes de gravar qualquer coisa", async () => {
    const renomeada = join(tmpdir(), `importar-indicadores-renomeada-${sufixo}.xlsx`);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Indicadores");
      sheet.addRow(COLUNAS.map((c) => (c === "Fórmula de Cálculo" ? "Formula" : c)));
      sheet.addRow(COLUNAS.map((c) => (c === "ID" ? "777" : c === "Projeto" ? "Cartão CRIA (Criança)" : "")));
      await workbook.xlsx.writeFile(renomeada);
      const logsAntes = await prisma.logAlteracao.count({ where: { usuarioId } });

      await expect(importarIndicadores(renomeada, usuarioId)).rejects.toThrow("cabeçalho da planilha mudou");

      expect(await prisma.indicador.count({ where: escopo })).toBe(DEFINICOES.length + 2);
      expect(await prisma.indicador.findUnique({ where: { codigo: "CRIA-C-777" } })).toBeNull();
      expect(await prisma.logAlteracao.count({ where: { usuarioId } })).toBe(logsAntes);
    } finally {
      await rm(renomeada, { force: true });
    }
  });

  it("rodar de novo não duplica nem sobrescreve a revisão", async () => {
    await prisma.indicador.update({ where: { codigo: "CRIA-C-150" }, data: { nome: "Nome revisado" } });
    const antes = await prisma.indicador.count({ where: escopo });
    // A checagem de idempotência usa estes dois: os conjuntos já trazem o que a primeira rodada gravou.
    expect((await indicadorModel.idsPlanilhaExistentes()).has("165")).toBe(true);
    expect((await indicadorModel.codigosExistentes()).has("CRIA-C-900")).toBe(true);

    const segunda = await importarIndicadores(caminho, usuarioId);

    expect(segunda.importadas).toBe(0);
    expect(segunda.jaExistiam).toBe(DEFINICOES.length + 2);
    expect(await prisma.indicador.count({ where: escopo })).toBe(antes);
    expect((await porCodigo("CRIA-C-150")).nome).toBe("Nome revisado");
  });
});
