import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/models/sessaoModel.js", async () => (await import("./helpers/sessao.js")).moduloSessaoFalso);
vi.mock("../src/models/indicadorModel.js");
vi.mock("../src/models/indicadorCalculoModel.js");
vi.mock("../src/helper/auditoria.js");

import { createApp } from "../src/app.js";
import { indicadorModel } from "../src/models/indicadorModel.js";
import { indicadorCalculoModel } from "../src/models/indicadorCalculoModel.js";
import { invalidarCache } from "../src/helper/cacheIndicadores.js";
import { montarResposta, ItemDuplicado } from "../src/helper/motor/avaliadores.js";
import { registrarLog } from "../src/helper/auditoria.js";
import { tokenDe } from "./helpers/sessao.js";

const app = createApp();
const token = tokenDe("u1", "VISUALIZADOR");
const tokenGestor = tokenDe("u2", "GESTOR");

const VCRAS = {
  id: "vcras", codigo: "VCRAS", tipo: "PROPORCAO", casasDecimais: 1, status: "ATIVO",
  config: { perguntaId: "cras", opcoesNumerador: ["Sim"] }, recorte: null, recorteConfig: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  invalidarCache();
  vi.mocked(indicadorModel.listarAtivos).mockResolvedValue([VCRAS] as never);
  vi.mocked(indicadorModel.grafoDeDependencias).mockResolvedValue(new Map());
  vi.mocked(indicadorModel.idsAtivos).mockImplementation(async (ids: string[]) => ids);
  vi.mocked(indicadorModel.pesquisaExiste).mockResolvedValue(true);
  vi.mocked(indicadorCalculoModel.perguntasExistentes).mockResolvedValue(new Set(["cras"]));
  vi.mocked(indicadorCalculoModel.perguntasDeSexo).mockResolvedValue(new Map());
  vi.mocked(indicadorCalculoModel.carregarRespostas).mockResolvedValue([
    montarResposta("A", [{ perguntaId: "cras", opcoesSelecionadas: ["Sim"] }]),
    montarResposta("B", [{ perguntaId: "cras", opcoesSelecionadas: ["Não"] }]),
  ]);
});

describe("GET /api/indicadores/calculo", () => {
  it("calcula e devolve o valor por indicador", async () => {
    const res = await request(app).get("/api/indicadores/calculo").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.resultados.VCRAS).toEqual({ status: "OK", valor: 50 });
  });

  it("filtro de município agrega só as respostas do município", async () => {
    vi.mocked(indicadorCalculoModel.carregarRespostas).mockResolvedValue([
      montarResposta("r1", [{ perguntaId: "cras", opcoesSelecionadas: ["Sim"] }], "ps1", { municipio: "Maceió" }),
      montarResposta("r2", [{ perguntaId: "cras", opcoesSelecionadas: ["Não"] }], "ps1", { municipio: "Arapiraca" }),
    ]);
    const res = await request(app).get("/api/indicadores/calculo?municipio=Maceió").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.resultados.VCRAS).toEqual({ status: "OK", valor: 100 });
    // O filtro não vai para o banco: a base inteira é carregada e a máscara decide.
    expect(indicadorCalculoModel.carregarRespostas).toHaveBeenCalledWith();
  });

  it("filtro de sexo usa as perguntas de sexo carregadas do banco", async () => {
    vi.mocked(indicadorCalculoModel.perguntasDeSexo).mockResolvedValue(new Map([["ps1", "sexo"]]));
    vi.mocked(indicadorCalculoModel.carregarRespostas).mockResolvedValue([
      montarResposta("r1", [{ perguntaId: "cras", opcoesSelecionadas: ["Não"] }, { perguntaId: "sexo", opcoesSelecionadas: ["Feminino"] }], "ps1"),
      montarResposta("r2", [{ perguntaId: "cras", opcoesSelecionadas: ["Sim"] }, { perguntaId: "sexo", opcoesSelecionadas: ["Masculino"] }], "ps1"),
    ]);
    const res = await request(app).get("/api/indicadores/calculo?sexo=Feminino").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.resultados.VCRAS).toEqual({ status: "OK", valor: 0 });
  });

  it("a rota não é lida como /indicadores/:id", async () => {
    await request(app).get("/api/indicadores/calculo").set("Authorization", `Bearer ${token}`);

    expect(indicadorModel.obterPorId).not.toHaveBeenCalled();
    expect(indicadorModel.listarAtivos).toHaveBeenCalledOnce();
  });

  it("exige autenticação -> 401", async () => {
    expect((await request(app).get("/api/indicadores/calculo")).status).toBe(401);
  });

  it("a segunda chamada com os mesmos filtros não recarrega do banco", async () => {
    await request(app).get("/api/indicadores/calculo?municipio=Maceió").set("Authorization", `Bearer ${token}`);
    const res = await request(app).get("/api/indicadores/calculo?municipio=Maceió").set("Authorization", `Bearer ${token}`);
    expect(indicadorCalculoModel.carregarRespostas).toHaveBeenCalledOnce();
    expect(res.body.cache).toBe(true);
  });

  it("filtros diferentes não compartilham cache", async () => {
    await request(app).get("/api/indicadores/calculo?municipio=Maceió").set("Authorization", `Bearer ${token}`);
    await request(app).get("/api/indicadores/calculo?municipio=Arapiraca").set("Authorization", `Bearer ${token}`);
    expect(indicadorCalculoModel.carregarRespostas).toHaveBeenCalledTimes(2);
  });

  it("ciclo gravado no banco vira 409 DEPENDENCIA_CIRCULAR, não 500", async () => {
    const composto = (id: string, dep: string) => ({
      id, codigo: id.toUpperCase(), tipo: "COMPOSTO", casasDecimais: 1, status: "ATIVO",
      config: { termos: [{ indicadorId: dep, peso: 1 }], divisor: 1 }, recorte: null, recorteConfig: null,
    });
    vi.mocked(indicadorModel.listarAtivos).mockResolvedValue([composto("a", "b"), composto("b", "a")] as never);

    const res = await request(app).get("/api/indicadores/calculo").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DEPENDENCIA_CIRCULAR");
  });

  it("invalidação durante o cálculo: o resultado velho não vai para o cache", async () => {
    vi.mocked(indicadorCalculoModel.carregarRespostas).mockImplementationOnce(async () => {
      invalidarCache(); // uma resposta mudou enquanto o banco era lido
      return [montarResposta("A", [{ perguntaId: "cras", opcoesSelecionadas: ["Sim"] }])];
    });
    const primeira = await request(app).get("/api/indicadores/calculo").set("Authorization", `Bearer ${token}`);
    const segunda = await request(app).get("/api/indicadores/calculo").set("Authorization", `Bearer ${token}`);
    expect(primeira.status).toBe(200);
    expect(segunda.body.cache).toBe(false);
    expect(indicadorCalculoModel.carregarRespostas).toHaveBeenCalledTimes(2);
  });

  it("resposta com item duplicado no banco vira 409 DADO_INCONSISTENTE com o respostaId, não 500", async () => {
    vi.mocked(indicadorCalculoModel.carregarRespostas).mockRejectedValueOnce(new ItemDuplicado("r9", "cras"));

    const res = await request(app).get("/api/indicadores/calculo").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DADO_INCONSISTENTE");
    expect(res.body.error.details).toEqual({ respostaId: "r9" });
  });

  it("filtro de data inválido -> 422 sem consultar o banco", async () => {
    const res = await request(app).get("/api/indicadores/calculo?de=lixo").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(422);
    expect(indicadorCalculoModel.carregarRespostas).not.toHaveBeenCalled();
  });

  it("não guarda em cache o cálculo que falhou", async () => {
    vi.mocked(indicadorModel.listarAtivos).mockRejectedValueOnce(new Error("falha"));
    await request(app).get("/api/indicadores/calculo").set("Authorization", `Bearer ${token}`);
    const res = await request(app).get("/api/indicadores/calculo").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.cache).toBe(false);
  });
});

describe("invalidação do cache em escrita de indicador", () => {
  async function aquecer() {
    await request(app).get("/api/indicadores/calculo").set("Authorization", `Bearer ${token}`);
    expect(indicadorCalculoModel.carregarRespostas).toHaveBeenCalledTimes(1);
  }
  async function recalculou() {
    await request(app).get("/api/indicadores/calculo").set("Authorization", `Bearer ${token}`);
    return vi.mocked(indicadorCalculoModel.carregarRespostas).mock.calls.length === 2;
  }

  it("criar invalida", async () => {
    await aquecer();
    vi.mocked(indicadorModel.criar).mockResolvedValue({ id: "i1" } as never);
    const res = await request(app).post("/api/indicadores").set("Authorization", `Bearer ${tokenGestor}`)
      .send({ codigo: "X", nome: "X", tipo: "PROPORCAO", config: { perguntaId: "cras", opcoesNumerador: ["Sim"] } });
    expect(res.status).toBe(201);
    expect(await recalculou()).toBe(true);
  });

  it("atualizar invalida", async () => {
    await aquecer();
    vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "i1", tipo: "PROPORCAO", config: VCRAS.config } as never);
    vi.mocked(indicadorModel.atualizar).mockResolvedValue({ id: "i1" } as never);
    const res = await request(app).put("/api/indicadores/i1").set("Authorization", `Bearer ${tokenGestor}`)
      .send({ nome: "Novo" });
    expect(res.status).toBe(200);
    expect(await recalculou()).toBe(true);
  });

  it("remover invalida", async () => {
    await aquecer();
    vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "i1" } as never);
    const res = await request(app).delete("/api/indicadores/i1").set("Authorization", `Bearer ${tokenGestor}`);
    expect(res.status).toBe(204);
    expect(await recalculou()).toBe(true);
  });

  // A escrita já foi feita quando a auditoria roda: se ela falhar, o cache não pode ficar velho.
  describe("invalida antes da auditoria (falha no registrarLog não deixa cache velho)", () => {
    beforeEach(() => {
      vi.mocked(registrarLog).mockRejectedValueOnce(new Error("auditoria fora"));
    });

    it("criar", async () => {
      await aquecer();
      vi.mocked(indicadorModel.criar).mockResolvedValue({ id: "i1" } as never);
      await request(app).post("/api/indicadores").set("Authorization", `Bearer ${tokenGestor}`)
        .send({ codigo: "X", nome: "X", tipo: "PROPORCAO", config: { perguntaId: "cras", opcoesNumerador: ["Sim"] } });
      expect(await recalculou()).toBe(true);
    });

    it("atualizar", async () => {
      await aquecer();
      vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "i1", tipo: "PROPORCAO", config: VCRAS.config } as never);
      vi.mocked(indicadorModel.atualizar).mockResolvedValue({ id: "i1" } as never);
      await request(app).put("/api/indicadores/i1").set("Authorization", `Bearer ${tokenGestor}`).send({ nome: "Novo" });
      expect(await recalculou()).toBe(true);
    });

    it("remover", async () => {
      await aquecer();
      vi.mocked(indicadorModel.obterPorId).mockResolvedValue({ id: "i1" } as never);
      await request(app).delete("/api/indicadores/i1").set("Authorization", `Bearer ${tokenGestor}`);
      expect(await recalculou()).toBe(true);
    });
  });
});
