import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { Prisma } from "@prisma/client";

vi.mock("../src/models/sessaoModel.js", async () => (await import("./helpers/sessao.js")).moduloSessaoFalso);
vi.mock("../src/models/indicadorModel.js");
vi.mock("../src/helper/auditoria.js");

import { createApp } from "../src/app.js";
import { indicadorModel } from "../src/models/indicadorModel.js";
import { registrarLog } from "../src/helper/auditoria.js";
import { tokenDe } from "./helpers/sessao.js";

const app = createApp();
const tokenGestor = tokenDe("u1", "GESTOR");
const tokenAdmin = tokenDe("u2", "ADMIN");
const tokenColetador = tokenDe("u3", "COLETADOR");

const CORPO_VALIDO = {
  codigo: "ZONA_RURAL",
  nome: "% Famílias em zona rural",
  tipo: "PROPORCAO",
  config: { perguntaId: "p1", opcoesNumerador: ["Rural"] },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(indicadorModel.grafoDeDependencias).mockResolvedValue(new Map());
  vi.mocked(indicadorModel.idsAtivos).mockImplementation(async (ids: string[]) => ids);
  vi.mocked(indicadorModel.pesquisaExiste).mockResolvedValue(true);
  vi.mocked(indicadorModel.perguntasPorId).mockResolvedValue([]);
});

describe("POST /api/indicadores", () => {
  it("GESTOR cria indicador válido -> 201 e registra auditoria", async () => {
    vi.mocked(indicadorModel.criar).mockResolvedValue({ id: "i1", ...CORPO_VALIDO } as never);

    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send(CORPO_VALIDO);

    expect(res.status).toBe(201);
    expect(registrarLog).toHaveBeenCalledOnce();
  });

  it("ADMIN também pode criar -> 201", async () => {
    vi.mocked(indicadorModel.criar).mockResolvedValue({ id: "i1", ...CORPO_VALIDO } as never);
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send(CORPO_VALIDO);
    expect(res.status).toBe(201);
  });

  it("COLETADOR não pode criar -> 403", async () => {
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenColetador}`)
      .send(CORPO_VALIDO);
    expect(res.status).toBe(403);
    expect(indicadorModel.criar).not.toHaveBeenCalled();
  });

  it("sem token -> 401", async () => {
    const res = await request(app).post("/api/indicadores").send(CORPO_VALIDO);
    expect(res.status).toBe(401);
  });

  it("config que não bate com o tipo -> 422", async () => {
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ ...CORPO_VALIDO, tipo: "MEDIA" });

    expect(res.status).toBe(422);
    expect(indicadorModel.criar).not.toHaveBeenCalled();
  });

  it("ESCALA com pergunta sem uma das opções nas notas -> 422 PERGUNTA_INCOMPATIVEL", async () => {
    vi.mocked(indicadorModel.perguntasPorId).mockResolvedValue([
      { id: "pn", tipo: "ESCOLHA_UNICA", opcoes: ["Antes", "Após", "Não soube"] },
    ]);
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ codigo: "PN", nome: "Pré-natal", tipo: "ESCALA", config: { perguntaId: "pn", notas: { Antes: 100, "Após": 50 } } });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PERGUNTA_INCOMPATIVEL");
    expect(indicadorModel.criar).not.toHaveBeenCalled();
  });

  it("ESCALA completa -> 201", async () => {
    vi.mocked(indicadorModel.perguntasPorId).mockResolvedValue([
      { id: "pn", tipo: "ESCOLHA_UNICA", opcoes: ["Antes", "Após"] },
    ]);
    vi.mocked(indicadorModel.criar).mockResolvedValue({ id: "i1" } as never);
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ codigo: "PN", nome: "Pré-natal", tipo: "ESCALA", config: { perguntaId: "pn", notas: { Antes: 100, "Após": 50 } } });
    expect(res.status).toBe(201);
    expect(indicadorModel.criar).toHaveBeenCalledOnce();
  });

  it("codigo duplicado (P2002) -> 409 CODIGO_DUPLICADO", async () => {
    vi.mocked(indicadorModel.criar).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "x" }),
    );
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send(CORPO_VALIDO);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CODIGO_DUPLICADO");
    expect(registrarLog).not.toHaveBeenCalled();
  });

  it("dependência para indicador inexistente/apagado -> 422 e não grava", async () => {
    vi.mocked(indicadorModel.idsAtivos).mockResolvedValue([]);
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ codigo: "X", nome: "X", tipo: "COMPOSTO", config: { termos: [{ indicadorId: "fantasma", peso: 1 }], divisor: 1 } });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("DEPENDENCIA_INEXISTENTE");
    expect(indicadorModel.criar).not.toHaveBeenCalled();
  });

  it("pesquisaId inexistente -> 422 e não grava", async () => {
    vi.mocked(indicadorModel.pesquisaExiste).mockResolvedValue(false);
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ ...CORPO_VALIDO, pesquisaId: "7b8f6a52-3c1d-4e9a-8f10-2d5b6c7e8a90" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PESQUISA_INEXISTENTE");
    expect(indicadorModel.criar).not.toHaveBeenCalled();
  });

  it("DEFINICAO_INCOMPLETA sem motivo -> 422 e não grava", async () => {
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ ...CORPO_VALIDO, status: "DEFINICAO_INCOMPLETA" });
    expect(res.status).toBe(422);
    expect(res.body.error.details.fieldErrors.motivoIncompleto).toBeDefined();
    expect(indicadorModel.criar).not.toHaveBeenCalled();
  });

  it("DEFINICAO_INCOMPLETA com motivo em branco -> 422", async () => {
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ ...CORPO_VALIDO, status: "DEFINICAO_INCOMPLETA", motivoIncompleto: "   " });
    expect(res.status).toBe(422);
    expect(indicadorModel.criar).not.toHaveBeenCalled();
  });

  it("DEFINICAO_INCOMPLETA com motivo -> 201", async () => {
    vi.mocked(indicadorModel.criar).mockResolvedValue({ id: "i1", ...CORPO_VALIDO } as never);
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ ...CORPO_VALIDO, status: "DEFINICAO_INCOMPLETA", motivoIncompleto: "falta a pergunta de renda" });
    expect(res.status).toBe(201);
    expect(registrarLog).toHaveBeenCalledOnce();
  });

  it("status fora do enum -> 422", async () => {
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ ...CORPO_VALIDO, status: "LIGADO" });
    expect(res.status).toBe(422);
    expect(indicadorModel.criar).not.toHaveBeenCalled();
  });

  it("recorte ANTES_APOS sem recorteConfig -> 422", async () => {
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ ...CORPO_VALIDO, recorte: "ANTES_APOS" });
    expect(res.status).toBe(422);
    expect(res.body.error.details.fieldErrors.recorteConfig).toBeDefined();
    expect(indicadorModel.criar).not.toHaveBeenCalled();
  });

  it("recorteConfig sem recorte ANTES_APOS -> 422", async () => {
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ ...CORPO_VALIDO, recorteConfig: { substituicoes: [{ de: "p1", para: "p2" }] } });
    expect(res.status).toBe(422);
    expect(res.body.error.details.fieldErrors.recorte).toBeDefined();
    expect(indicadorModel.criar).not.toHaveBeenCalled();
  });

  it("recorte ANTES_APOS com recorteConfig -> 201", async () => {
    vi.mocked(indicadorModel.criar).mockResolvedValue({ id: "i1", ...CORPO_VALIDO } as never);
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ ...CORPO_VALIDO, recorte: "ANTES_APOS", recorteConfig: { substituicoes: [{ de: "p1", para: "p2" }] } });
    expect(res.status).toBe(201);
  });
});

describe("PUT /api/indicadores/:id", () => {
  it("recusa dependência circular -> 409 com o ciclo no corpo", async () => {
    // O IDTC já depende do MCC. Editar o MCC para depender do IDTC fecha o ciclo.
    vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "mcc", tipo: "COMPOSTO", config: {} } as never);
    vi.mocked(indicadorModel.grafoDeDependencias).mockResolvedValue(new Map([["idtc", ["mcc"]]]));

    const res = await request(app)
      .put("/api/indicadores/mcc")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ tipo: "COMPOSTO", config: { termos: [{ indicadorId: "idtc", peso: 1 }], divisor: 1 } });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DEPENDENCIA_CIRCULAR");
    expect(indicadorModel.atualizar).not.toHaveBeenCalled();
  });

  it("edição de ESCALA confere a config gravada com as perguntas atuais -> 422 PERGUNTA_INCOMPATIVEL", async () => {
    vi.mocked(indicadorModel.obterPorId).mockResolvedValue({
      id: "i1", tipo: "ESCALA", config: { perguntaId: "pn", notas: { Antes: 100 } },
    } as never);
    vi.mocked(indicadorModel.perguntasPorId).mockResolvedValue([
      { id: "pn", tipo: "ESCOLHA_UNICA", opcoes: ["Antes", "Após"] },
    ]);
    const res = await request(app)
      .put("/api/indicadores/i1")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ nome: "Novo nome" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("PERGUNTA_INCOMPATIVEL");
    expect(indicadorModel.atualizar).not.toHaveBeenCalled();
  });

  it("codigo duplicado na edição (P2002) -> 409", async () => {
    vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "i1", tipo: "PROPORCAO", config: CORPO_VALIDO.config } as never);
    vi.mocked(indicadorModel.atualizar).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "x" }),
    );
    const res = await request(app)
      .put("/api/indicadores/i1")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ codigo: "JA_EXISTE" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CODIGO_DUPLICADO");
  });

  it("dependência para indicador inexistente na edição -> 422", async () => {
    vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "i1", tipo: "PROPORCAO", config: CORPO_VALIDO.config } as never);
    vi.mocked(indicadorModel.idsAtivos).mockResolvedValue([]);
    const res = await request(app)
      .put("/api/indicadores/i1")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ tipo: "COMPOSTO", config: { termos: [{ indicadorId: "fantasma", peso: 1 }], divisor: 1 } });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("DEPENDENCIA_INEXISTENTE");
    expect(indicadorModel.atualizar).not.toHaveBeenCalled();
  });

  it("promove para ATIVO -> 200, repassa o status e audita", async () => {
    vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "i1", tipo: "PROPORCAO", config: CORPO_VALIDO.config, status: "DEFINICAO_INCOMPLETA", motivoIncompleto: "x" } as never);
    vi.mocked(indicadorModel.atualizar).mockResolvedValue({ id: "i1", status: "ATIVO", motivoIncompleto: null } as never);
    const res = await request(app)
      .put("/api/indicadores/i1")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ status: "ATIVO" });
    expect(res.status).toBe(200);
    expect(indicadorModel.atualizar).toHaveBeenCalledWith("i1", expect.objectContaining({ status: "ATIVO" }), "u1", []);
    expect(registrarLog).toHaveBeenCalledOnce();
  });

  it("rebaixa para DEFINICAO_INCOMPLETA sem motivo -> 422", async () => {
    vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "i1", tipo: "PROPORCAO", config: CORPO_VALIDO.config, status: "ATIVO", motivoIncompleto: null } as never);
    const res = await request(app)
      .put("/api/indicadores/i1")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ status: "DEFINICAO_INCOMPLETA" });
    expect(res.status).toBe(422);
    expect(indicadorModel.atualizar).not.toHaveBeenCalled();
  });

  it("recorteConfig sem recorte na edição -> 422", async () => {
    vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "i1", tipo: "PROPORCAO", config: CORPO_VALIDO.config, status: "ATIVO", recorte: null, recorteConfig: null } as never);
    const res = await request(app)
      .put("/api/indicadores/i1")
      .set("Authorization", `Bearer ${tokenGestor}`)
      .send({ recorteConfig: { substituicoes: [{ de: "p1", para: "p2" }] } });
    expect(res.status).toBe(422);
    expect(indicadorModel.atualizar).not.toHaveBeenCalled();
  });

  describe("regras entre campos valem sobre o registro mesclado (gravado + corpo)", () => {
    const GRAVADO = { id: "i1", tipo: "PROPORCAO", config: CORPO_VALIDO.config, recorte: null, recorteConfig: null };
    const RECORTE_CONFIG = { substituicoes: [{ de: "p1", para: "p2" }] };

    beforeEach(() => {
      vi.mocked(indicadorModel.atualizar).mockResolvedValue({ id: "i1" } as never);
    });

    it("motivo em branco num indicador já DEFINICAO_INCOMPLETA -> 422", async () => {
      vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ ...GRAVADO, status: "DEFINICAO_INCOMPLETA", motivoIncompleto: "falta régua" } as never);
      const res = await request(app)
        .put("/api/indicadores/i1")
        .set("Authorization", `Bearer ${tokenGestor}`)
        .send({ motivoIncompleto: "  " });
      expect(res.status).toBe(422);
      expect(res.body.error.details.fieldErrors.motivoIncompleto).toBeDefined();
      expect(indicadorModel.atualizar).not.toHaveBeenCalled();
    });

    it("motivo enviado para indicador que não é DEFINICAO_INCOMPLETA não é gravado", async () => {
      vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ ...GRAVADO, status: "ATIVO", motivoIncompleto: null } as never);
      const res = await request(app)
        .put("/api/indicadores/i1")
        .set("Authorization", `Bearer ${tokenGestor}`)
        .send({ nome: "Novo nome", motivoIncompleto: "sobra" });
      expect(res.status).toBe(200);
      const dados = vi.mocked(indicadorModel.atualizar).mock.calls[0]![1];
      expect(dados.motivoIncompleto ?? null).toBeNull();
    });

    it("rebaixa para DEFINICAO_INCOMPLETA quando o registro já tem motivo -> 200", async () => {
      vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ ...GRAVADO, status: "INATIVO", motivoIncompleto: "falta régua" } as never);
      const res = await request(app)
        .put("/api/indicadores/i1")
        .set("Authorization", `Bearer ${tokenGestor}`)
        .send({ status: "DEFINICAO_INCOMPLETA" });
      expect(res.status).toBe(200);
      expect(indicadorModel.atualizar).toHaveBeenCalledOnce();
    });

    it("recorte ANTES_APOS quando o registro já tem recorteConfig -> 200", async () => {
      vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ ...GRAVADO, status: "ATIVO", recorteConfig: RECORTE_CONFIG } as never);
      const res = await request(app)
        .put("/api/indicadores/i1")
        .set("Authorization", `Bearer ${tokenGestor}`)
        .send({ recorte: "ANTES_APOS" });
      expect(res.status).toBe(200);
      expect(indicadorModel.atualizar).toHaveBeenCalledOnce();
    });
  });
});

describe("GET /api/indicadores", () => {
  it("qualquer papel autenticado lista -> 200", async () => {
    vi.mocked(indicadorModel.listar).mockResolvedValue({ total: 0, itens: [] } as never);
    const res = await request(app).get("/api/indicadores").set("Authorization", `Bearer ${tokenColetador}`);
    expect(res.status).toBe(200);
  });

  it("status inválido na query -> 422 sem consultar o model", async () => {
    const res = await request(app).get("/api/indicadores?status=lixo").set("Authorization", `Bearer ${tokenGestor}`);
    expect(res.status).toBe(422);
    expect(indicadorModel.listar).not.toHaveBeenCalled();
  });

  it("status válido na query é repassado ao model", async () => {
    vi.mocked(indicadorModel.listar).mockResolvedValue({ total: 0, itens: [] } as never);
    await request(app).get("/api/indicadores?status=ATIVO").set("Authorization", `Bearer ${tokenGestor}`);
    expect(indicadorModel.listar).toHaveBeenCalledWith(expect.objectContaining({ status: "ATIVO" }));
  });
});

describe("DELETE /api/indicadores/:id", () => {
  it("recusa apagar indicador do qual outro depende -> 409", async () => {
    vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "mcc", codigo: "MCC" } as never);
    vi.mocked(indicadorModel.grafoDeDependencias).mockResolvedValue(new Map([["idtc", ["mcc"]]]));

    const res = await request(app).delete("/api/indicadores/mcc").set("Authorization", `Bearer ${tokenGestor}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INDICADOR_EM_USO");
    expect(indicadorModel.softDelete).not.toHaveBeenCalled();
  });
});
