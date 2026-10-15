import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = vi.hoisted(() => ({
  indicadorDependencia: { deleteMany: vi.fn() },
  indicador: { update: vi.fn() },
}));

vi.mock("../src/config/prisma.js", () => ({
  prisma: {
    indicador: { create: vi.fn(), count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
  },
}));

import { prisma } from "../src/config/prisma.js";
import { indicadorModel } from "../src/models/indicadorModel.js";
import type { CriarIndicadorInput } from "../src/helper/validators.js";

const BASE: CriarIndicadorInput = {
  codigo: "VCRAS",
  nome: "Acompanhadas pelo CRAS",
  tipo: "PROPORCAO",
  casasDecimais: 1,
  config: { perguntaId: "p1", opcoesNumerador: ["Sim"] },
};

function dadosCriados(): Record<string, unknown> {
  return (vi.mocked(prisma.indicador.create).mock.calls[0]![0] as { data: Record<string, unknown> }).data;
}

function dadosAtualizados(): Record<string, unknown> {
  return (tx.indicador.update.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("indicadorModel.criar", () => {
  it("sem status: grava ATIVO explicitamente (não depende do default da coluna)", async () => {
    await indicadorModel.criar(BASE, "u1", []);
    expect(dadosCriados().status).toBe("ATIVO");
    expect(dadosCriados().motivoIncompleto).toBeNull();
  });

  it("DEFINICAO_INCOMPLETA grava o motivo", async () => {
    await indicadorModel.criar({ ...BASE, status: "DEFINICAO_INCOMPLETA", motivoIncompleto: "falta pergunta" }, "u1", []);
    expect(dadosCriados()).toMatchObject({ status: "DEFINICAO_INCOMPLETA", motivoIncompleto: "falta pergunta" });
  });

  it("status diferente de DEFINICAO_INCOMPLETA descarta motivo", async () => {
    await indicadorModel.criar({ ...BASE, status: "ATIVO", motivoIncompleto: "sobra" }, "u1", []);
    expect(dadosCriados().motivoIncompleto).toBeNull();
  });
});

describe("indicadorModel.criar com campos da planilha", () => {
  it("grava apresentacao e categoria; idsPlanilha/dadosPlanilha só vêm do argumento origem", async () => {
    await indicadorModel.criar({ ...BASE, apresentacao: ["Escopo"], categoria: "Renda" }, "u1", []);
    expect(dadosCriados()).toMatchObject({ apresentacao: ["Escopo"], categoria: "Renda" });
    expect(dadosCriados().idsPlanilha).toBeUndefined();
    vi.clearAllMocks();
    await indicadorModel.criar(BASE, "u1", [], { idsPlanilha: ["12"], dadosPlanilha: { Nome: "x" } });
    expect(dadosCriados()).toMatchObject({ idsPlanilha: ["12"], dadosPlanilha: { Nome: "x" } });
  });
});

describe("indicadorModel.listar e contarPorStatus", () => {
  it("apresentacao vira where.apresentacao = { has }", async () => {
    vi.mocked(prisma.indicador.count).mockResolvedValue(0);
    vi.mocked(prisma.indicador.findMany).mockResolvedValue([]);
    await indicadorModel.listar({ apresentacao: "Escopo" });
    const where = (vi.mocked(prisma.indicador.findMany).mock.calls[0]![0] as { where: Record<string, unknown> }).where;
    expect(where).toMatchObject({ deletedAt: null, apresentacao: { has: "Escopo" } });
  });

  it("contarPorStatus agrupa por status (sem apagados) e preenche zero nos ausentes", async () => {
    vi.mocked(prisma.indicador.groupBy).mockResolvedValue([
      { status: "ATIVO", _count: { _all: 3 } },
    ] as never);
    const r = await indicadorModel.contarPorStatus();
    expect(r).toEqual({ ATIVO: 3, DEFINICAO_INCOMPLETA: 0, INATIVO: 0 });
    expect(vi.mocked(prisma.indicador.groupBy).mock.calls[0]![0]).toMatchObject({ by: ["status"], where: { deletedAt: null } });
  });
});

describe("indicadorModel.atualizar", () => {
  it("promover para ATIVO limpa o motivo", async () => {
    await indicadorModel.atualizar("i1", { status: "ATIVO" }, "u1", []);
    expect(dadosAtualizados()).toMatchObject({ status: "ATIVO", motivoIncompleto: null });
  });

  it("sem status no corpo não mexe no motivo", async () => {
    await indicadorModel.atualizar("i1", { nome: "Novo" }, "u1", []);
    expect(dadosAtualizados()).not.toHaveProperty("motivoIncompleto");
  });
});
