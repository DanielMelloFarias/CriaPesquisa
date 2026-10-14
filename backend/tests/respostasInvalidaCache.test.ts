import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/models/sessaoModel.js", async () => (await import("./helpers/sessao.js")).moduloSessaoFalso);
vi.mock("../src/models/respostaModel.js");
vi.mock("../src/models/pesquisaModel.js");
vi.mock("../src/helper/auditoria.js");

import { createApp } from "../src/app.js";
import { respostaModel } from "../src/models/respostaModel.js";
import { pesquisaModel } from "../src/models/pesquisaModel.js";
import { lerCache, gravarCache, invalidarCache } from "../src/helper/cacheIndicadores.js";
import { tokenDe } from "./helpers/sessao.js";

const app = createApp();
const UUID = "22222222-2222-2222-2222-222222222222";
const CORPO = { itens: [{ perguntaId: UUID, valorTexto: "x" }] };
const auth = `Bearer ${tokenDe("u1", "GESTOR")}`;

beforeEach(() => {
  vi.clearAllMocks();
  invalidarCache();
  gravarCache("k", { VCRAS: 1 });
  vi.mocked(respostaModel.obterPorId).mockResolvedValue({ id: "r1", pesquisaId: "p1", coletadorId: "u1" } as never);
  vi.mocked(respostaModel.criar).mockResolvedValue({ id: "r1" } as never);
  vi.mocked(respostaModel.atualizar).mockResolvedValue({ id: "r1" } as never);
  vi.mocked(respostaModel.mudarStatus).mockResolvedValue({ id: "r1" } as never);
  vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({ id: "p1", status: "PUBLICADA", perguntas: [{ id: UUID, enunciado: "Nome", tipo: "TEXTO", obrigatoria: false, opcoes: [] }] } as never);
});

describe("escrita de resposta invalida o cache dos indicadores", () => {
  it("criar", async () => {
    const res = await request(app).post("/api/pesquisas/p1/respostas").set("Authorization", auth).send(CORPO);
    expect(res.status).toBe(201);
    expect(lerCache("k")).toBeUndefined();
  });

  it("editar (volta a PENDENTE)", async () => {
    const res = await request(app).put("/api/respostas/r1").set("Authorization", auth).send(CORPO);
    expect(res.status).toBe(200);
    expect(lerCache("k")).toBeUndefined();
  });

  it("aprovar", async () => {
    const res = await request(app).post("/api/respostas/r1/aprovar").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(lerCache("k")).toBeUndefined();
  });

  it("reprovar", async () => {
    const res = await request(app).post("/api/respostas/r1/reprovar").set("Authorization", auth).send({});
    expect(res.status).toBe(200);
    expect(lerCache("k")).toBeUndefined();
  });

  it("remover (soft delete)", async () => {
    const res = await request(app).delete("/api/respostas/r1").set("Authorization", auth);
    expect(res.status).toBe(204);
    expect(lerCache("k")).toBeUndefined();
  });

  it("escrita recusada não invalida", async () => {
    vi.mocked(respostaModel.obterPorId).mockResolvedValue(null as never);
    const res = await request(app).post("/api/respostas/r1/aprovar").set("Authorization", auth);
    expect(res.status).toBe(404);
    expect(lerCache("k")).toEqual({ VCRAS: 1 });
  });
});

// Pesquisa apagada tira as respostas dela do cálculo (e restaurada as devolve).
describe("apagar e restaurar pesquisa invalidam o cache dos indicadores", () => {
  const authAdmin = `Bearer ${tokenDe("u2", "ADMIN")}`;

  it("remover (soft delete)", async () => {
    vi.mocked(pesquisaModel.softDelete).mockResolvedValue({ id: "p1" } as never);
    const res = await request(app).delete("/api/pesquisas/p1").set("Authorization", auth);
    expect(res.status).toBe(204);
    expect(lerCache("k")).toBeUndefined();
  });

  it("restaurar", async () => {
    vi.mocked(pesquisaModel.restaurar).mockResolvedValue({ id: "p1" } as never);
    const res = await request(app).post("/api/pesquisas/p1/restaurar").set("Authorization", authAdmin);
    expect(res.status).toBe(200);
    expect(lerCache("k")).toBeUndefined();
  });

  it("remover pesquisa inexistente não invalida", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue(null as never);
    const res = await request(app).delete("/api/pesquisas/p1").set("Authorization", auth);
    expect(res.status).toBe(404);
    expect(lerCache("k")).toEqual({ VCRAS: 1 });
  });
});
