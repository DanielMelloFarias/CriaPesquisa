import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/config/prisma.js", () => ({
  prisma: { resposta: { findMany: vi.fn() }, pergunta: { findMany: vi.fn() } },
}));

import { prisma } from "../src/config/prisma.js";
import { indicadorCalculoModel } from "../src/models/indicadorCalculoModel.js";

function whereUsado(): Record<string, unknown> {
  const chamada = vi.mocked(prisma.resposta.findMany).mock.calls[0]![0] as { where: Record<string, unknown> };
  return chamada.where;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.resposta.findMany).mockResolvedValue([] as never);
});

describe("indicadorCalculoModel.carregarRespostas", () => {
  // Os filtros do painel não vão mais para o banco: estão em recortePainel.test.ts.
  it("só aprovadas, não excluídas e de pesquisa não excluída", async () => {
    await indicadorCalculoModel.carregarRespostas();
    expect(whereUsado()).toEqual({ deletedAt: null, status: "APROVADA", pesquisa: { deletedAt: null } });
  });

  it("resposta com item duplicado lança ItemDuplicado com o respostaId", async () => {
    vi.mocked(prisma.resposta.findMany).mockResolvedValue([
      {
        id: "r7",
        pesquisaId: "ps1",
        itens: [
          { perguntaId: "p1", valorTexto: null, valorNumero: 1, opcoesSelecionadas: [] },
          { perguntaId: "p1", valorTexto: null, valorNumero: 2, opcoesSelecionadas: [] },
        ],
      },
    ] as never);
    await expect(indicadorCalculoModel.carregarRespostas()).rejects.toMatchObject({ name: "ItemDuplicado", respostaId: "r7" });
  });

  it("monta RespostaAvaliavel com mapa de itens por pergunta", async () => {
    vi.mocked(prisma.resposta.findMany).mockResolvedValue([
      { id: "r1", pesquisaId: "ps1", itens: [{ perguntaId: "p1", valorTexto: null, valorNumero: 0, opcoesSelecionadas: [] }] },
    ] as never);
    const [r] = await indicadorCalculoModel.carregarRespostas();
    expect(r!.id).toBe("r1");
    expect(r!.pesquisaId).toBe("ps1");
    const select = (vi.mocked(prisma.resposta.findMany).mock.calls[0]![0] as { select: Record<string, unknown> }).select;
    expect(select.pesquisaId).toBe(true);
    expect(r!.itens.get("p1")?.valorNumero).toBe(0);
  });

  it("carrega enviadaEm, município, regional e valorData", async () => {
    const enviada = new Date("2026-03-01T10:00:00Z");
    vi.mocked(prisma.resposta.findMany).mockResolvedValue([
      { id: "r1", pesquisaId: "ps1", enviadaEm: enviada, municipio: "Maceió", regional: "1ª",
        itens: [{ perguntaId: "nasc", valorTexto: null, valorNumero: null, valorData: new Date("2025-01-01"), opcoesSelecionadas: [] }] },
    ] as never);
    const [r] = await indicadorCalculoModel.carregarRespostas();
    expect(r!.enviadaEm).toEqual(enviada);
    expect(r!.municipio).toBe("Maceió");
    expect(r!.regional).toBe("1ª");
    expect(r!.itens.get("nasc")?.valorData).toEqual(new Date("2025-01-01"));
    const select = (vi.mocked(prisma.resposta.findMany).mock.calls[0]![0] as {
      select: { enviadaEm: boolean; municipio: boolean; regional: boolean; itens: { select: Record<string, boolean> } };
    }).select;
    expect(select.enviadaEm).toBe(true);
    expect(select.municipio).toBe(true);
    expect(select.regional).toBe(true);
    expect(select.itens.select.valorData).toBe(true);
  });
});

describe("indicadorCalculoModel.perguntasDeSexo", () => {
  it("procura pelo enunciado", async () => {
    vi.mocked(prisma.pergunta.findMany).mockResolvedValue([{ id: "s1" }, { id: "s2" }] as never);
    expect(await indicadorCalculoModel.perguntasDeSexo()).toEqual(new Set(["s1", "s2"]));
    expect(vi.mocked(prisma.pergunta.findMany).mock.calls[0]![0]).toEqual({
      where: { enunciado: { contains: "Sexo biológico", mode: "insensitive" } },
      select: { id: true },
    });
  });
});

describe("indicadorCalculoModel.perguntasExistentes", () => {
  it("devolve o conjunto de ids", async () => {
    vi.mocked(prisma.pergunta.findMany).mockResolvedValue([{ id: "a" }, { id: "b" }] as never);
    expect(await indicadorCalculoModel.perguntasExistentes()).toEqual(new Set(["a", "b"]));
  });
});
