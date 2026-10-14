import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/models/sessaoModel.js", async () => (await import("./helpers/sessao.js")).moduloSessaoFalso);
vi.mock("../src/models/pesquisaModel.js");
vi.mock("../src/models/perguntaModel.js");
vi.mock("../src/helper/auditoria.js");
vi.mock("../src/helper/versao.js");

import { createApp } from "../src/app.js";
import { pesquisaModel } from "../src/models/pesquisaModel.js";
import { registrarLog } from "../src/helper/auditoria.js";
import { tokenDe } from "./helpers/sessao.js";

const app = createApp();
const tokenGestor = tokenDe("u1", "GESTOR");
const tokenColetador = tokenDe("u2", "COLETADOR");

const UUID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/pesquisas", () => {
  it("1) cria pesquisa como GESTOR com body válido -> 201, chama pesquisaModel.criar e registrarLog", async () => {
    const pesquisaCriada = { id: "p1", titulo: "Pesquisa de satisfação", responsavelId: UUID, status: "RASCUNHO" };
    vi.mocked(pesquisaModel.criar).mockResolvedValue(pesquisaCriada as never);

    const res = await request(app)
      .post("/api/pesquisas")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ titulo: "Pesquisa de satisfação", responsavelId: UUID });

    expect(res.status).toBe(201);
    expect(pesquisaModel.criar).toHaveBeenCalledOnce();
    expect(registrarLog).toHaveBeenCalledOnce();
  });

  it("2) COLETADOR não pode criar pesquisa -> 403", async () => {
    const res = await request(app)
      .post("/api/pesquisas")
      .set("Authorization", `Bearer ${tokenColetador}`)
      .send({ titulo: "Pesquisa X", responsavelId: UUID });

    expect(res.status).toBe(403);
  });

  it("3) sem token -> 401", async () => {
    const res = await request(app).post("/api/pesquisas").send({ titulo: "Pesquisa X", responsavelId: UUID });

    expect(res.status).toBe(401);
  });

  it("4) body inválido (sem titulo) -> 422", async () => {
    const res = await request(app)
      .post("/api/pesquisas")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ responsavelId: UUID });

    expect(res.status).toBe(422);
  });
});

describe("POST /api/pesquisas/:id/publicar", () => {
  it("5) contarPerguntas=0 -> 400", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({ id: "p1", status: "RASCUNHO" } as never);
    vi.mocked(pesquisaModel.contarPerguntas).mockResolvedValue(0);

    const res = await request(app).post("/api/pesquisas/p1/publicar").set("Authorization", `Bearer ${tokenGestor}`);

    expect(res.status).toBe(400);
  });

  it("6) contarPerguntas=2 e status RASCUNHO -> 200 e mudarStatus(...,'PUBLICADA') chamado", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({ id: "p1", status: "RASCUNHO" } as never);
    vi.mocked(pesquisaModel.contarPerguntas).mockResolvedValue(2);
    vi.mocked(pesquisaModel.mudarStatus).mockResolvedValue({ id: "p1", status: "PUBLICADA" } as never);

    const res = await request(app).post("/api/pesquisas/p1/publicar").set("Authorization", `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(pesquisaModel.mudarStatus).toHaveBeenCalledWith("p1", "PUBLICADA");
  });
});

describe("PUT /api/pesquisas/:id", () => {
  // Editar aqui mexe só em metadados (título, descrição, responsável, período);
  // as perguntas têm rota própria e essa sim exige RASCUNHO. Por isso corrigir o
  // título de uma pesquisa já publicada é permitido.
  it("7) pesquisa PUBLICADA aceita edição de metadados -> 200", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({ id: "p1", status: "PUBLICADA" } as never);
    vi.mocked(pesquisaModel.atualizar).mockResolvedValue({ id: "p1", titulo: "Novo título" } as never);

    const res = await request(app)
      .put("/api/pesquisas/p1")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ titulo: "Novo título" });

    expect(res.status).toBe(200);
    expect(pesquisaModel.atualizar).toHaveBeenCalledWith("p1", { titulo: "Novo título" });
  });

  it("7b) pesquisa ARQUIVADA -> 409", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({ id: "p1", status: "ARQUIVADA" } as never);

    const res = await request(app)
      .put("/api/pesquisas/p1")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ titulo: "Novo título" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PESQUISA_ARQUIVADA");
    expect(pesquisaModel.atualizar).not.toHaveBeenCalled();
  });
});

describe("POST /api/pesquisas/:id/perguntas", () => {
  it("8) pesquisa PUBLICADA -> 409", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({ id: "p1", status: "PUBLICADA" } as never);

    const res = await request(app)
      .post("/api/pesquisas/p1/perguntas")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ enunciado: "Qual seu nome?", tipo: "TEXTO", ordem: 0 });

    expect(res.status).toBe(409);
  });
});

describe("GET /api/pesquisas/:id", () => {
  it("9) inexistente -> 404", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue(null);

    const res = await request(app).get("/api/pesquisas/inexistente").set("Authorization", `Bearer ${tokenGestor}`);

    expect(res.status).toBe(404);
  });
});
