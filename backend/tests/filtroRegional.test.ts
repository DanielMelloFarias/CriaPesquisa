import { describe, it, expect, vi } from "vitest";

vi.mock("../src/config/prisma.js", () => ({
  prisma: { resposta: { findMany: vi.fn(), count: vi.fn() } },
}));

import { prisma } from "../src/config/prisma.js";
import { extrairFiltrosBase } from "../src/controllers/respostaController.js";
import { respostaModel } from "../src/models/respostaModel.js";

describe("filtro regional das respostas", () => {
  it("extrairFiltrosBase lê regional da query", () => {
    expect(extrairFiltrosBase({ regional: "1ª Regional" }).regional).toBe("1ª Regional");
  });

  it("extrairFiltrosBase: `ate` só com a data inclui o dia inteiro", () => {
    expect(extrairFiltrosBase({ ate: "2026-06-30" }).ate?.toISOString()).toBe("2026-06-30T23:59:59.999Z");
  });

  it("extrairFiltrosBase: `ate` com data e hora completas fica como veio", () => {
    expect(extrairFiltrosBase({ ate: "2026-06-30T12:00:00.000Z" }).ate?.toISOString()).toBe("2026-06-30T12:00:00.000Z");
  });

  it("contar filtra por regional no where", async () => {
    vi.mocked(prisma.resposta.count).mockResolvedValue(0 as never);
    await respostaModel.contar("ps1", { regional: "1ª Regional" });
    const arg = vi.mocked(prisma.resposta.count).mock.calls[0]![0] as { where: { regional?: string } };
    expect(arg.where.regional).toBe("1ª Regional");
  });
});
