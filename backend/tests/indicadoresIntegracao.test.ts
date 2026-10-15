import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { gerarToken } from "../src/helper/token.js";

/**
 * Ponta a ponta contra o banco real (porta 5433), sem mock de model:
 * pesquisa -> pergunta -> respostas aprovadas -> indicador criado pela API -> cálculo.
 * Tudo que é criado aqui é apagado no afterAll.
 */

const app = createApp();
const sufixo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CODIGO = `INTEG_${sufixo}`;

let usuarioId = "";
let auth = "";
let pesquisaId = "";
let perguntaId = "";
const respostaIds: string[] = [];
const indicadorIds: string[] = [];
const pesquisasExtrasIds: string[] = [];

beforeAll(async () => {
  const usuario = await prisma.usuario.create({
    data: { nome: "Integração Indicadores", email: `integ-ind-${sufixo}@cria.al`, senhaHash: "x", papel: "GESTOR" },
  });
  usuarioId = usuario.id;
  auth = `Bearer ${gerarToken({ sub: usuarioId, papel: "GESTOR" })}`;

  const pesquisa = await request(app)
    .post("/api/pesquisas")
    .set("Authorization", auth)
    .send({ titulo: `Integração indicadores ${sufixo}`, responsavelId: usuarioId });
  expect(pesquisa.status).toBe(201);
  pesquisaId = pesquisa.body.pesquisa.id;

  const pergunta = await request(app)
    .post(`/api/pesquisas/${pesquisaId}/perguntas`)
    .set("Authorization", auth)
    .send({
      enunciado: "Acompanhada pelo CRAS?",
      tipo: "ESCOLHA_UNICA",
      ordem: 0,
      opcoes: [{ texto: "Sim", ordem: 0 }, { texto: "Não", ordem: 1 }],
    });
  expect(pergunta.status).toBe(201);
  perguntaId = pergunta.body.pergunta.id;

  expect((await request(app).post(`/api/pesquisas/${pesquisaId}/publicar`).set("Authorization", auth)).status).toBe(200);

  for (const opcao of ["Sim", "Sim", "Não"]) {
    const r = await request(app)
      .post(`/api/pesquisas/${pesquisaId}/respostas`)
      .set("Authorization", auth)
      .send({ itens: [{ perguntaId, opcoesSelecionadas: [opcao] }] });
    expect(r.status).toBe(201);
    respostaIds.push(r.body.resposta.id);
    expect((await request(app).post(`/api/respostas/${r.body.resposta.id}/aprovar`).set("Authorization", auth)).status).toBe(200);
  }
}, 60000);

afterAll(async () => {
  await prisma.indicadorDependencia.deleteMany({ where: { indicadorId: { in: indicadorIds } } });
  await prisma.indicador.deleteMany({ where: { id: { in: indicadorIds } } });
  await prisma.itemResposta.deleteMany({ where: { respostaId: { in: respostaIds } } });
  await prisma.itemResposta.deleteMany({ where: { resposta: { pesquisaId: { in: pesquisasExtrasIds } } } });
  await prisma.resposta.deleteMany({ where: { pesquisaId: { in: pesquisasExtrasIds } } });
  for (const id of pesquisasExtrasIds) await prisma.pesquisa.delete({ where: { id } });
  await prisma.resposta.deleteMany({ where: { pesquisaId } });
  if (pesquisaId) await prisma.pesquisa.delete({ where: { id: pesquisaId } });
  await prisma.logAlteracao.deleteMany({ where: { usuarioId } });
  if (usuarioId) await prisma.usuario.delete({ where: { id: usuarioId } });
  await prisma.$disconnect();
}, 60000);

describe("indicadores ponta a ponta (banco real)", () => {
  it("PROPORCAO criada pela API produz número com as respostas aprovadas", async () => {
    const criado = await request(app)
      .post("/api/indicadores")
      .set("Authorization", auth)
      .send({
        codigo: CODIGO,
        nome: "% acompanhadas pelo CRAS (integração)",
        tipo: "PROPORCAO",
        pesquisaId,
        config: { perguntaId, opcoesNumerador: ["Sim"] },
      });
    expect(criado.status).toBe(201);
    indicadorIds.push(criado.body.indicador.id);

    const res = await request(app).get("/api/indicadores/calculo").set("Authorization", auth);

    expect(res.status).toBe(200);
    // 2 de 3 respostas aprovadas marcaram "Sim".
    expect(res.body.resultados[CODIGO]).toEqual({ status: "OK", valor: 66.7 });
  });

  it("CONTAGEM com pesquisaId conta só as respostas aprovadas daquela pesquisa", async () => {
    const codigo = `${CODIGO}_CONT`;
    const criado = await request(app)
      .post("/api/indicadores")
      .set("Authorization", auth)
      .send({ codigo, nome: "Total de respostas (integração)", tipo: "CONTAGEM", pesquisaId, config: {} });
    expect(criado.status).toBe(201);
    indicadorIds.push(criado.body.indicador.id);

    const res = await request(app).get("/api/indicadores/calculo").set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(res.body.resultados[codigo]).toEqual({ status: "OK", valor: 3 });
  });

  it("ESCALA sobre pergunta de escolha única: valor sem filtro e com ?municipio", async () => {
    const pesquisa = await request(app)
      .post("/api/pesquisas")
      .set("Authorization", auth)
      .send({ titulo: `Integração escala ${sufixo}`, responsavelId: usuarioId });
    expect(pesquisa.status).toBe(201);
    const pesquisaEscalaId: string = pesquisa.body.pesquisa.id;
    pesquisasExtrasIds.push(pesquisaEscalaId);

    const pergunta = await request(app)
      .post(`/api/pesquisas/${pesquisaEscalaId}/perguntas`)
      .set("Authorization", auth)
      .send({
        enunciado: "Fez o pré-natal?",
        tipo: "ESCOLHA_UNICA",
        ordem: 0,
        opcoes: [{ texto: "Sim", ordem: 0 }, { texto: "Não", ordem: 1 }],
      });
    expect(pergunta.status).toBe(201);
    const perguntaEscalaId: string = pergunta.body.pergunta.id;

    expect((await request(app).post(`/api/pesquisas/${pesquisaEscalaId}/publicar`).set("Authorization", auth)).status).toBe(200);

    // Duas em Maceió (Sim, Sim) e uma em Arapiraca (Não).
    for (const [opcao, municipio] of [["Sim", "Maceió"], ["Sim", "Maceió"], ["Não", "Arapiraca"]] as const) {
      const r = await request(app)
        .post(`/api/pesquisas/${pesquisaEscalaId}/respostas`)
        .set("Authorization", auth)
        .send({ municipio, itens: [{ perguntaId: perguntaEscalaId, opcoesSelecionadas: [opcao] }] });
      expect(r.status).toBe(201);
      expect((await request(app).post(`/api/respostas/${r.body.resposta.id}/aprovar`).set("Authorization", auth)).status).toBe(200);
    }

    const codigo = `${CODIGO}_ESC`;
    const criado = await request(app)
      .post("/api/indicadores")
      .set("Authorization", auth)
      .send({
        codigo,
        nome: "Escala pré-natal (integração)",
        tipo: "ESCALA",
        pesquisaId: pesquisaEscalaId,
        config: { perguntaId: perguntaEscalaId, notas: { Sim: 100, Não: 0 } },
      });
    expect(criado.status).toBe(201);
    indicadorIds.push(criado.body.indicador.id);

    const semFiltro = await request(app).get("/api/indicadores/calculo").set("Authorization", auth);
    expect(semFiltro.status).toBe(200);
    // (100 + 100 + 0) / 3 = 66.7
    expect(semFiltro.body.resultados[codigo]).toEqual({ status: "OK", valor: 66.7 });

    const comFiltro = await request(app)
      .get("/api/indicadores/calculo")
      .query({ municipio: "Maceió" })
      .set("Authorization", auth);
    expect(comFiltro.status).toBe(200);
    // Só as duas de Maceió: (100 + 100) / 2 = 100
    expect(comFiltro.body.resultados[codigo]).toEqual({ status: "OK", valor: 100 });
  }, 60000);

  /**
   * PERCENTIL_OMS de ponta a ponta: nascimento gravado em coluna @db.Date (volta como
   * meia-noite UTC), enviadaEm = now() do banco, dia de vida no calendário de Alagoas.
   * Limiares pelo LMS do JSON da OMS (referencias/oms-imc-idade.json):
   *   menina, 730 d: L −0,5989 M 15,4052 S 0,08545 → P10 (z −1,2816) = 13,86; −2 DP = 13,09.
   *     IMC 9,39 / 0,85² = 13,00 → abaixo do P10 (100).
   *   menino, 365 d: mediana M = 16,7992. IMC 9,45 / 0,75² = 16,80 → não está abaixo do P10 (0).
   * As folgas (> 0,8 kg/m²) toleram um dia a mais ou a menos; o nascimento é calculado
   * a partir do dia de hoje em Alagoas para que o dia de vida seja exatamente o pretendido.
   */
  it("PERCENTIL_OMS com IMC DERIVADA e nascimento em @db.Date: sem filtro e com ?municipio", async () => {
    const pesquisa = await request(app)
      .post("/api/pesquisas")
      .set("Authorization", auth)
      .send({ titulo: `Integração percentil ${sufixo}`, responsavelId: usuarioId });
    expect(pesquisa.status).toBe(201);
    const pesquisaPercId: string = pesquisa.body.pesquisa.id;
    pesquisasExtrasIds.push(pesquisaPercId);

    const criarPergunta = async (corpo: object): Promise<string> => {
      const p = await request(app).post(`/api/pesquisas/${pesquisaPercId}/perguntas`).set("Authorization", auth).send(corpo);
      expect(p.status).toBe(201);
      return p.body.pergunta.id;
    };
    const nascId = await criarPergunta({ enunciado: "Data de nascimento da criança", tipo: "DATA", ordem: 0 });
    const sexoId = await criarPergunta({
      enunciado: "Sexo biológico da criança",
      tipo: "ESCOLHA_UNICA",
      ordem: 1,
      opcoes: [{ texto: "Masculino", ordem: 0 }, { texto: "Feminino", ordem: 1 }],
    });
    const pesoId = await criarPergunta({ enunciado: "Peso (kg)", tipo: "NUMERO", ordem: 2 });
    const alturaId = await criarPergunta({ enunciado: "Altura (m)", tipo: "NUMERO", ordem: 3 });

    expect((await request(app).post(`/api/pesquisas/${pesquisaPercId}/publicar`).set("Authorization", auth)).status).toBe(200);

    // Hoje em Alagoas (UTC−3, sem horário de verão) menos N dias, como "AAAA-MM-DD".
    const nascidoHaDias = (dias: number) => {
      const agoraAlagoas = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const hoje = Date.UTC(agoraAlagoas.getUTCFullYear(), agoraAlagoas.getUTCMonth(), agoraAlagoas.getUTCDate());
      return new Date(hoje - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    };

    const criancas = [
      { municipio: "Maceió", sexo: "Feminino", dias: 730, peso: 9.39, altura: 0.85 },
      { municipio: "Arapiraca", sexo: "Masculino", dias: 365, peso: 9.45, altura: 0.75 },
    ];
    for (const c of criancas) {
      const r = await request(app)
        .post(`/api/pesquisas/${pesquisaPercId}/respostas`)
        .set("Authorization", auth)
        .send({
          municipio: c.municipio,
          itens: [
            { perguntaId: nascId, valorData: nascidoHaDias(c.dias) },
            { perguntaId: sexoId, opcoesSelecionadas: [c.sexo] },
            { perguntaId: pesoId, valorNumero: c.peso },
            { perguntaId: alturaId, valorNumero: c.altura },
          ],
        });
      expect(r.status).toBe(201);
      expect((await request(app).post(`/api/respostas/${r.body.resposta.id}/aprovar`).set("Authorization", auth)).status).toBe(200);
    }

    // O banco devolve a data pura como meia-noite UTC: é o que o motor compara com o dia de Alagoas.
    const gravado = await prisma.itemResposta.findFirst({
      where: { perguntaId: nascId, resposta: { municipio: "Maceió", pesquisaId: pesquisaPercId } },
    });
    expect(gravado?.valorData?.toISOString()).toBe(`${nascidoHaDias(730)}T00:00:00.000Z`);

    const codigoImc = `${CODIGO}_IMC`;
    const imc = await request(app)
      .post("/api/indicadores")
      .set("Authorization", auth)
      .send({
        codigo: codigoImc,
        nome: "IMC da criança (integração)",
        tipo: "DERIVADA",
        pesquisaId: pesquisaPercId,
        casasDecimais: 2,
        config: {
          variaveis: { p: pesoId, a: alturaId },
          expressao: { op: "/", esq: { var: "p" }, dir: { op: "*", esq: { var: "a" }, dir: { var: "a" } } },
        },
      });
    expect(imc.status).toBe(201);
    indicadorIds.push(imc.body.indicador.id);

    const codigo = `${CODIGO}_P10`;
    const criado = await request(app)
      .post("/api/indicadores")
      .set("Authorization", auth)
      .send({
        codigo,
        nome: "% abaixo do P10 de IMC (integração)",
        tipo: "PERCENTIL_OMS",
        pesquisaId: pesquisaPercId,
        config: {
          imcIndicadorId: imc.body.indicador.id,
          nascimentoPerguntaId: nascId,
          sexoPerguntaId: sexoId,
          opcoesSexo: { masculino: "Masculino", feminino: "Feminino" },
          corte: { abaixoDe: 10 },
        },
      });
    expect(criado.status).toBe(201);
    indicadorIds.push(criado.body.indicador.id);

    const calculo = (query: Record<string, string> = {}) =>
      request(app).get("/api/indicadores/calculo").query(query).set("Authorization", auth);

    const semFiltro = await calculo();
    expect(semFiltro.status).toBe(200);
    // IMC: 9,39/0,7225 = 12,9965 e 9,45/0,5625 = 16,8 → média 14,8983.
    expect(semFiltro.body.resultados[codigoImc]).toEqual({ status: "OK", valor: 14.9 });
    // Menina abaixo do P10 (100), menino na mediana (0): 50%.
    expect(semFiltro.body.resultados[codigo]).toEqual({ status: "OK", valor: 50 });

    const maceio = await calculo({ municipio: "Maceió" });
    expect(maceio.status).toBe(200);
    expect(maceio.body.resultados[codigo]).toEqual({ status: "OK", valor: 100 });

    const arapiraca = await calculo({ municipio: "Arapiraca" });
    expect(arapiraca.status).toBe(200);
    expect(arapiraca.body.resultados[codigo]).toEqual({ status: "OK", valor: 0 });
  }, 60000);
});
