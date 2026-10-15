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
});
