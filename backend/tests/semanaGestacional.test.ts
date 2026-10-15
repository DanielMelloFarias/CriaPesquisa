import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { adicionarSemanaGestacional, ENUNCIADO_SEMANA } from "../scripts/adicionar-semana-gestacional.js";

let pesquisaId: string | undefined;
let usuarioId: string | undefined;

beforeAll(async () => {
  const usuario = await prisma.usuario.create({
    data: { nome: "Teste semana", email: `semana-${Date.now()}@teste.local`, senhaHash: "x", papel: "ADMIN" },
  });
  usuarioId = usuario.id;
  const pesquisa = await prisma.pesquisa.create({
    data: {
      titulo: `Cartão CRIA — Gestante (teste ${Date.now()})`,
      status: "PUBLICADA",
      responsavelId: usuario.id,
      createdById: usuario.id,
      perguntas: {
        create: [
          { enunciado: "Qual a altura da gestante em metros (atual)?", tipo: "NUMERO", ordem: 0 },
          { enunciado: "Qual é o peso atual da gestante?", tipo: "NUMERO", ordem: 1 },
          { enunciado: "Nos últimos três meses, os alimentos acabaram?", tipo: "ESCOLHA_UNICA", ordem: 2 },
        ],
      },
    },
  });
  pesquisaId = pesquisa.id;
});

afterAll(async () => {
  if (usuarioId) await prisma.logAlteracao.deleteMany({ where: { usuarioId } });
  if (pesquisaId) await prisma.pesquisa.deleteMany({ where: { id: pesquisaId } });
  if (usuarioId) await prisma.usuario.deleteMany({ where: { id: usuarioId } });
});

describe("adicionarSemanaGestacional", () => {
  it("insere depois do peso atual e empurra as seguintes", async () => {
    const r = await adicionarSemanaGestacional(usuarioId!, pesquisaId);
    expect(r.criada).toBe(true);
    const ordem = await prisma.pergunta.findMany({
      where: { pesquisaId },
      orderBy: { ordem: "asc" },
      select: { enunciado: true, tipo: true },
    });
    expect(ordem.map((p) => p.enunciado)).toEqual([
      "Qual a altura da gestante em metros (atual)?",
      "Qual é o peso atual da gestante?",
      ENUNCIADO_SEMANA,
      "Nos últimos três meses, os alimentos acabaram?",
    ]);
    expect(ordem[2].tipo).toBe("NUMERO");
  });

  it("rodar de novo não duplica", async () => {
    const r = await adicionarSemanaGestacional(usuarioId!, pesquisaId);
    expect(r.criada).toBe(false);
    expect(await prisma.pergunta.count({ where: { pesquisaId, enunciado: ENUNCIADO_SEMANA } })).toBe(1);
  });
});
