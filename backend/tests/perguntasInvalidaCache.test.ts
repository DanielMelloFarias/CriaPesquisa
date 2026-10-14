import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/models/perguntaModel.js");
vi.mock("../src/models/pesquisaModel.js");
vi.mock("../src/helper/auditoria.js");
vi.mock("../src/models/sessaoModel.js", async () => (await import("./helpers/sessao.js")).moduloSessaoFalso);

import { createApp } from "../src/app.js";
import { perguntaModel } from "../src/models/perguntaModel.js";
import { pesquisaModel } from "../src/models/pesquisaModel.js";
import { lerCache, gravarCache, invalidarCache } from "../src/helper/cacheIndicadores.js";
import { tokenDe } from "./helpers/sessao.js";

const app = createApp();
const auth = `Bearer ${tokenDe("u1", "GESTOR")}`;
const PERGUNTA = {
  enunciado: "Sexo",
  tipo: "ESCOLHA_UNICA",
  obrigatoria: false,
  ordem: 0,
  opcoes: [
    { texto: "Feminino", ordem: 0 },
    { texto: "Masculino", ordem: 1 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  invalidarCache();
  gravarCache("k", { VCRAS: 1 });
  vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({ id: "p1", status: "RASCUNHO", perguntas: [] } as never);
  vi.mocked(perguntaModel.obterPerguntaPorId).mockResolvedValue({ id: "q1", pesquisaId: "p1", opcoes: [] } as never);
  vi.mocked(perguntaModel.criarPergunta).mockResolvedValue({ id: "q1" } as never);
  vi.mocked(perguntaModel.atualizarPergunta).mockResolvedValue({ id: "q1" } as never);
  vi.mocked(perguntaModel.deletarPergunta).mockResolvedValue({ id: "q1" } as never);
});

describe("escrita de pergunta invalida o cache dos indicadores", () => {
  it("criar pergunta (com opções)", async () => {
    const res = await request(app).post("/api/pesquisas/p1/perguntas").set("Authorization", auth).send(PERGUNTA);
    expect(res.status).toBe(201);
    expect(lerCache("k")).toBeUndefined();
  });

  it("editar pergunta ou suas opções", async () => {
    const res = await request(app)
      .put("/api/perguntas/q1")
      .set("Authorization", auth)
      .send({ tipo: "ESCOLHA_UNICA", opcoes: [{ texto: "F", ordem: 0 }, { texto: "M", ordem: 1 }] });
    expect(res.status).toBe(200);
    expect(lerCache("k")).toBeUndefined();
  });

  it("remover pergunta", async () => {
    const res = await request(app).delete("/api/perguntas/q1").set("Authorization", auth);
    expect(res.status).toBe(204);
    expect(lerCache("k")).toBeUndefined();
  });

  it("escrita recusada (pesquisa publicada) não invalida", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({ id: "p1", status: "PUBLICADA", perguntas: [] } as never);
    const res = await request(app).delete("/api/perguntas/q1").set("Authorization", auth);
    expect(res.status).toBe(409);
    expect(lerCache("k")).toEqual({ VCRAS: 1 });
  });
});
