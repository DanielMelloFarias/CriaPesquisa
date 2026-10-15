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

  describe("recorte ANTES/APÓS: a pergunta trocada também é conferida", () => {
    const escalaPareada = {
      codigo: "PN",
      nome: "Pré-natal",
      tipo: "ESCALA",
      config: { perguntaId: "pnAntes", notas: { Baixa: 0, Alta: 100 } },
      recorte: "ANTES_APOS",
      recorteConfig: { substituicoes: [{ de: "pnAntes", para: "pnDepois" }] },
    };

    it("ESCALA cuja pergunta do APÓS tem opção sem nota -> 422 PERGUNTA_INCOMPATIVEL", async () => {
      vi.mocked(indicadorModel.perguntasPorId).mockResolvedValue([
        { id: "pnAntes", tipo: "ESCOLHA_UNICA", opcoes: ["Baixa", "Alta"] },
        { id: "pnDepois", tipo: "ESCOLHA_UNICA", opcoes: ["Baixa", "Alta", "Nova opção"] },
      ]);
      const res = await request(app).post("/api/indicadores").set("Authorization", `Bearer ${tokenGestor}`).send(escalaPareada);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("PERGUNTA_INCOMPATIVEL");
      expect(res.body.error.details.problemas).toEqual(['opção "Nova opção" sem nota']);
      expect(indicadorModel.criar).not.toHaveBeenCalled();
    });

    it("ESCALA com as duas perguntas cobertas pelas notas -> 201", async () => {
      vi.mocked(indicadorModel.perguntasPorId).mockResolvedValue([
        { id: "pnAntes", tipo: "ESCOLHA_UNICA", opcoes: ["Baixa", "Alta"] },
        { id: "pnDepois", tipo: "ESCOLHA_UNICA", opcoes: ["Baixa", "Alta"] },
      ]);
      vi.mocked(indicadorModel.criar).mockResolvedValue({ id: "i1" } as never);
      const res = await request(app).post("/api/indicadores").set("Authorization", `Bearer ${tokenGestor}`).send(escalaPareada);
      expect(res.status).toBe(201);
    });

    it("PERCENTIL_OMS cuja pergunta de sexo do APÓS não tem a opção feminina -> 422", async () => {
      vi.mocked(indicadorModel.perguntasPorId).mockResolvedValue([
        { id: "nasc", tipo: "DATA", opcoes: [] },
        { id: "sexo", tipo: "ESCOLHA_UNICA", opcoes: ["Masculino", "Feminino"] },
        { id: "sexo2", tipo: "ESCOLHA_UNICA", opcoes: ["Masculino", "Menina"] },
      ]);
      const res = await request(app)
        .post("/api/indicadores")
        .set("Authorization", `Bearer ${tokenGestor}`)
        .send({
          codigo: "P10",
          nome: "Abaixo do P10",
          tipo: "PERCENTIL_OMS",
          config: {
            imcIndicadorId: "imc", nascimentoPerguntaId: "nasc", sexoPerguntaId: "sexo",
            opcoesSexo: { masculino: "Masculino", feminino: "Feminino" }, corte: { abaixoDe: 10 },
          },
          recorte: "ANTES_APOS",
          recorteConfig: { substituicoes: [{ de: "sexo", para: "sexo2" }] },
        });
      expect(res.status).toBe(422);
      expect(res.body.error.details.problemas).toEqual(['opção "Feminino" não existe na pergunta sexo2']);
    });

    it("PUT só com recorteConfig confere a config gravada no cenário APÓS -> 422", async () => {
      vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "i1", tipo: "ESCALA", config: escalaPareada.config } as never);
      vi.mocked(indicadorModel.perguntasPorId).mockResolvedValue([
        { id: "pnAntes", tipo: "ESCOLHA_UNICA", opcoes: ["Baixa", "Alta"] },
        { id: "pnDepois", tipo: "ESCOLHA_UNICA", opcoes: ["Baixa", "Alta", "Nova opção"] },
      ]);
      const res = await request(app)
        .put("/api/indicadores/i1")
        .set("Authorization", `Bearer ${tokenGestor}`)
        .send({ recorte: "ANTES_APOS", recorteConfig: escalaPareada.recorteConfig });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("PERGUNTA_INCOMPATIVEL");
      expect(indicadorModel.atualizar).not.toHaveBeenCalled();
    });
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

  describe("conferência das perguntas só quando tipo/config vêm no corpo", () => {
    const gravado = { id: "i1", tipo: "ESCALA", config: { perguntaId: "pn", notas: { Antes: 100 } } };
    const pergunta = { id: "pn", tipo: "ESCOLHA_UNICA" as const, opcoes: ["Antes", "Após"] };
    const put = (corpo: object) =>
      request(app).put("/api/indicadores/i1").set("Authorization", `Bearer ${tokenGestor}`).send(corpo);

    it("só renomear indicador cuja pergunta ganhou opção -> 200 sem consultar perguntas", async () => {
      vi.mocked(indicadorModel.obterPorId).mockResolvedValue(gravado as never);
      vi.mocked(indicadorModel.perguntasPorId).mockResolvedValue([pergunta]);
      vi.mocked(indicadorModel.atualizar).mockResolvedValue({ id: "i1" } as never);
      const res = await put({ nome: "Novo nome" });
      expect(res.status).toBe(200);
      expect(indicadorModel.perguntasPorId).not.toHaveBeenCalled();
    });

    it("corpo com config incompleta -> 422 PERGUNTA_INCOMPATIVEL", async () => {
      vi.mocked(indicadorModel.obterPorId).mockResolvedValue(gravado as never);
      vi.mocked(indicadorModel.perguntasPorId).mockResolvedValue([pergunta]);
      const res = await put({ config: { perguntaId: "pn", notas: { Antes: 100 } } });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("PERGUNTA_INCOMPATIVEL");
      expect(indicadorModel.atualizar).not.toHaveBeenCalled();
    });

    it("corpo só com tipo e config gravada incompatível -> 422 PERGUNTA_INCOMPATIVEL", async () => {
      vi.mocked(indicadorModel.obterPorId).mockResolvedValue(gravado as never);
      vi.mocked(indicadorModel.perguntasPorId).mockResolvedValue([pergunta]);
      const res = await put({ tipo: "ESCALA" });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("PERGUNTA_INCOMPATIVEL");
      expect(indicadorModel.atualizar).not.toHaveBeenCalled();
    });
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

describe("listagem com filtros e contadores", () => {
  const authGestor = `Bearer ${tokenGestor}`;

  it("repassa status, pesquisaId, apresentacao e q ao model e devolve contadores", async () => {
    vi.mocked(indicadorModel.listar).mockResolvedValue({ total: 0, itens: [] } as never);
    vi.mocked(indicadorModel.contarPorStatus).mockResolvedValue({ ATIVO: 2, DEFINICAO_INCOMPLETA: 5, INATIVO: 1 });
    const pesquisaId = "7b8f6a52-3c1d-4e9a-8f10-2d5b6c7e8a90";
    const res = await request(app)
      .get(`/api/indicadores?status=DEFINICAO_INCOMPLETA&pesquisaId=${pesquisaId}&apresentacao=Escopo&q=vac`)
      .set("Authorization", authGestor);
    expect(res.status).toBe(200);
    expect(vi.mocked(indicadorModel.listar).mock.calls[0]![0]).toMatchObject({
      status: "DEFINICAO_INCOMPLETA", pesquisaId, apresentacao: "Escopo", q: "vac",
    });
    expect(res.body.contadores).toEqual({ ATIVO: 2, DEFINICAO_INCOMPLETA: 5, INATIVO: 1 });
  });

  it("apresentacao fora de Escopo/Perfil = 422", async () => {
    const res = await request(app).get("/api/indicadores?apresentacao=Outra").set("Authorization", authGestor);
    expect(res.status).toBe(422);
    expect(indicadorModel.listar).not.toHaveBeenCalled();
  });

  it("cadastro aceita apresentacao e categoria, mas não idsPlanilha/dadosPlanilha", async () => {
    vi.mocked(indicadorModel.criar).mockResolvedValue({ id: "i1", ...CORPO_VALIDO } as never);
    const res = await request(app)
      .post("/api/indicadores")
      .set("Authorization", authGestor)
      .send({
        ...CORPO_VALIDO,
        apresentacao: ["Escopo", "Perfil"],
        categoria: "Renda",
        idsPlanilha: ["x"],
        dadosPlanilha: { a: "b" },
      });
    expect(res.status).toBe(201);
    const dados = vi.mocked(indicadorModel.criar).mock.calls[0]![0] as Record<string, unknown>;
    expect(dados.apresentacao).toEqual(["Escopo", "Perfil"]);
    expect(dados.categoria).toBe("Renda");
    expect(dados).not.toHaveProperty("idsPlanilha");
    expect(dados).not.toHaveProperty("dadosPlanilha");
  });

  it("edição aceita apresentacao e categoria; apresentacao inválida = 422", async () => {
    vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "i1", tipo: "PROPORCAO", config: CORPO_VALIDO.config, status: "ATIVO" } as never);
    vi.mocked(indicadorModel.atualizar).mockResolvedValue({ id: "i1" } as never);
    const ok = await request(app)
      .put("/api/indicadores/i1")
      .set("Authorization", authGestor)
      .send({ apresentacao: ["Perfil"], categoria: "Saúde" });
    expect(ok.status).toBe(200);
    expect(vi.mocked(indicadorModel.atualizar).mock.calls[0]![1]).toMatchObject({ apresentacao: ["Perfil"], categoria: "Saúde" });
    const ruim = await request(app).put("/api/indicadores/i1").set("Authorization", authGestor).send({ apresentacao: ["Outra"] });
    expect(ruim.status).toBe(422);
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
