import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/models/sessaoModel.js", async () => (await import("./helpers/sessao.js")).moduloSessaoFalso);
vi.mock("../src/models/respostaModel.js");
vi.mock("../src/models/pesquisaModel.js");
vi.mock("../src/helper/auditoria.js");

import { createApp } from "../src/app.js";
import { respostaModel } from "../src/models/respostaModel.js";
import { pesquisaModel } from "../src/models/pesquisaModel.js";
import { registrarLog } from "../src/helper/auditoria.js";
import { tokenDe } from "./helpers/sessao.js";
import { PAGE_SIZE_MAX } from "../src/helper/paginacao.js";

const app = createApp();
const tokenGestor = tokenDe("u1", "GESTOR");
const tokenColetador = tokenDe("u2", "COLETADOR");
const tokenVisualizador = tokenDe("u3", "VISUALIZADOR");

const UUID_PERGUNTA = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/pesquisas/:id/respostas", () => {
  it("1) pesquisa não publicada (RASCUNHO) -> 409", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({ id: "p1", status: "RASCUNHO", perguntas: [] } as never);

    const res = await request(app)
      .post("/api/pesquisas/p1/respostas")
      .set("Authorization", `Bearer ${tokenColetador}`)
      .send({ itens: [{ perguntaId: UUID_PERGUNTA, valorTexto: "x" }] });

    expect(res.status).toBe(409);
    expect(respostaModel.criar).not.toHaveBeenCalled();
  });

  it("2) pergunta obrigatória faltando -> 422 com code VALIDACAO_RESPOSTA", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({
      id: "p1",
      status: "PUBLICADA",
      perguntas: [{ id: UUID_PERGUNTA, enunciado: "Qual seu nome?", tipo: "TEXTO", obrigatoria: true, opcoes: [] }],
    } as never);

    const res = await request(app)
      .post("/api/pesquisas/p1/respostas")
      .set("Authorization", `Bearer ${tokenColetador}`)
      .send({ itens: [{ perguntaId: UUID_PERGUNTA, valorTexto: "" }] });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDACAO_RESPOSTA");
    expect(res.body.error.details).toContain("Qual seu nome?: resposta obrigatória");
    expect(respostaModel.criar).not.toHaveBeenCalled();
  });

  it("3) submissão válida -> 201, chama respostaModel.criar e registrarLog", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({
      id: "p1",
      status: "PUBLICADA",
      perguntas: [{ id: UUID_PERGUNTA, enunciado: "Qual seu nome?", tipo: "TEXTO", obrigatoria: false, opcoes: [] }],
    } as never);
    vi.mocked(respostaModel.criar).mockResolvedValue({ id: "r1", pesquisaId: "p1" } as never);

    const res = await request(app)
      .post("/api/pesquisas/p1/respostas")
      .set("Authorization", `Bearer ${tokenColetador}`)
      .send({ itens: [{ perguntaId: UUID_PERGUNTA, valorTexto: "Maria" }] });

    expect(res.status).toBe(201);
    expect(respostaModel.criar).toHaveBeenCalledOnce();
    expect(registrarLog).toHaveBeenCalledOnce();
  });

  it("4) VISUALIZADOR não pode submeter resposta -> 403", async () => {
    const res = await request(app)
      .post("/api/pesquisas/p1/respostas")
      .set("Authorization", `Bearer ${tokenVisualizador}`)
      .send({ itens: [{ perguntaId: UUID_PERGUNTA, valorTexto: "x" }] });

    expect(res.status).toBe(403);
  });

  it("5) pesquisa inexistente -> 404", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/pesquisas/inexistente/respostas")
      .set("Authorization", `Bearer ${tokenColetador}`)
      .send({ itens: [{ perguntaId: UUID_PERGUNTA, valorTexto: "x" }] });

    expect(res.status).toBe(404);
  });
});

describe("opção selecionada é gravada pelo texto (o motor compara por texto)", () => {
  const UUID_SEXO = "33333333-3333-3333-3333-333333333333";
  const PESQUISA = {
    id: "p1",
    status: "PUBLICADA",
    perguntas: [
      {
        id: UUID_SEXO,
        enunciado: "Sexo",
        tipo: "MULTIPLA_ESCOLHA",
        obrigatoria: false,
        opcoes: [
          { id: "op-f", texto: "Feminino" },
          { id: "op-m", texto: "Masculino" },
        ],
      },
    ],
  };
  // Uma pelo id, outra já pelo texto: as duas chegam ao model como texto.
  const CORPO = { itens: [{ perguntaId: UUID_SEXO, opcoesSelecionadas: ["op-f", "Masculino"] }] };

  beforeEach(() => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue(PESQUISA as never);
    vi.mocked(respostaModel.obterPorId).mockResolvedValue({ id: "r1", pesquisaId: "p1", coletadorId: "u1" } as never);
    vi.mocked(respostaModel.criar).mockResolvedValue({ id: "r1" } as never);
    vi.mocked(respostaModel.atualizar).mockResolvedValue({ id: "r1" } as never);
  });

  it("na criação", async () => {
    const res = await request(app)
      .post("/api/pesquisas/p1/respostas")
      .set("Authorization", `Bearer ${tokenColetador}`)
      .send(CORPO);
    expect(res.status).toBe(201);
    const dados = vi.mocked(respostaModel.criar).mock.calls[0]![2];
    expect(dados.itens[0]!.opcoesSelecionadas).toEqual(["Feminino", "Masculino"]);
  });

  it("na edição", async () => {
    const res = await request(app)
      .put("/api/respostas/r1")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send(CORPO);
    expect(res.status).toBe(200);
    const dados = vi.mocked(respostaModel.atualizar).mock.calls[0]![1];
    expect(dados.itens[0]!.opcoesSelecionadas).toEqual(["Feminino", "Masculino"]);
  });
});

describe("GET /api/pesquisas/:id/respostas", () => {
  it("6) lista respostas (mockado) -> 200 com total/page/pageSize/itens", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({ id: "p1", status: "PUBLICADA", perguntas: [] } as never);
    vi.mocked(respostaModel.listar).mockResolvedValue({ total: 1, itens: [{ id: "r1" }] } as never);

    const res = await request(app)
      .get("/api/pesquisas/p1/respostas")
      .set("Authorization", `Bearer ${tokenVisualizador}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(50);
    expect(res.body.itens).toHaveLength(1);
  });

  it("6b) pageSize absurdo é limitado ao teto (não despeja a tabela inteira)", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({ id: "p1", status: "PUBLICADA", perguntas: [] } as never);
    vi.mocked(respostaModel.listar).mockResolvedValue({ total: 1, itens: [{ id: "r1" }] } as never);

    const res = await request(app)
      .get("/api/pesquisas/p1/respostas?pageSize=999999")
      .set("Authorization", `Bearer ${tokenVisualizador}`);

    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(PAGE_SIZE_MAX);
    expect(respostaModel.listar).toHaveBeenCalledWith("p1", expect.objectContaining({ pageSize: PAGE_SIZE_MAX }));
  });
});

describe("GET /api/respostas/:id", () => {
  it("7) inexistente -> 404", async () => {
    vi.mocked(respostaModel.obterPorId).mockResolvedValue(null);

    const res = await request(app).get("/api/respostas/inexistente").set("Authorization", `Bearer ${tokenGestor}`);

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/respostas/:id", () => {
  it("8) GESTOR remove -> 204 e registrarLog chamado", async () => {
    vi.mocked(respostaModel.obterPorId).mockResolvedValue({ id: "r1" } as never);

    const res = await request(app).delete("/api/respostas/r1").set("Authorization", `Bearer ${tokenGestor}`);

    expect(res.status).toBe(204);
    expect(respostaModel.softDelete).toHaveBeenCalledWith("r1", "u1");
    expect(registrarLog).toHaveBeenCalledOnce();
  });

  it("9) COLETADOR não pode remover -> 403", async () => {
    const res = await request(app).delete("/api/respostas/r1").set("Authorization", `Bearer ${tokenColetador}`);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/pesquisas/:id/export", () => {
  it("10) formato csv -> 200 e content-type text/csv", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({
      id: "p1",
      status: "PUBLICADA",
      perguntas: [{ id: UUID_PERGUNTA, enunciado: "Qual seu nome?", tipo: "TEXTO", opcoes: [] }],
    } as never);
    vi.mocked(respostaModel.contar).mockResolvedValue(1);
    vi.mocked(respostaModel.listar).mockResolvedValue({
      total: 1,
      itens: [{ id: "r1", municipio: "Maceió", unidade: null, regional: null, enviadaEm: new Date("2026-01-01") }],
    } as never);
    vi.mocked(respostaModel.itensPorPergunta).mockResolvedValue([
      { respostaId: "r1", perguntaId: UUID_PERGUNTA, valorTexto: "Maria", valorNumero: null, valorData: null, opcoesSelecionadas: [] },
    ] as never);

    const res = await request(app)
      .get("/api/pesquisas/p1/export?formato=csv")
      .set("Authorization", `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("pesquisa-p1.csv");
    expect(res.text).toContain("Maria");
  });

  it("11) COLETADOR não pode exportar -> 403", async () => {
    const res = await request(app)
      .get("/api/pesquisas/p1/export?formato=csv")
      .set("Authorization", `Bearer ${tokenColetador}`);

    expect(res.status).toBe(403);
  });
});

describe("GET /api/pesquisas/:id/resumo", () => {
  it("12) retorna total e perguntas resumidas", async () => {
    vi.mocked(pesquisaModel.obterPorId).mockResolvedValue({
      id: "p1",
      status: "PUBLICADA",
      perguntas: [{ id: UUID_PERGUNTA, enunciado: "Qual seu nome?", tipo: "TEXTO", opcoes: [] }],
    } as never);
    vi.mocked(respostaModel.contar).mockResolvedValue(2);
    vi.mocked(respostaModel.itensPorPergunta).mockResolvedValue([
      { respostaId: "r1", perguntaId: UUID_PERGUNTA, valorTexto: "Maria", valorNumero: null, valorData: null, opcoesSelecionadas: [] },
      { respostaId: "r2", perguntaId: UUID_PERGUNTA, valorTexto: "João", valorNumero: null, valorData: null, opcoesSelecionadas: [] },
    ] as never);

    const res = await request(app).get("/api/pesquisas/p1/resumo").set("Authorization", `Bearer ${tokenVisualizador}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.perguntas).toHaveLength(1);
    expect(res.body.perguntas[0].preenchidos).toBe(2);
  });
});
