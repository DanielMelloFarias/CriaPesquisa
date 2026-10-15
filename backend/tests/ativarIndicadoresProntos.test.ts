import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { ativarIndicadoresProntos } from "../scripts/ativar-indicadores-prontos.js";

// Só mexe nos indicadores que este teste cria (prefixo único): o banco de dev
// tem a importação real, que não pode ser ativada por um teste.
const P = `TATV${Date.now()}-`;
let usuarioId: string;

async function indicador(sufixo: string, motivo: string, config: object, tipo: "CONTAGEM" | "PROPORCAO" = "CONTAGEM") {
  return prisma.indicador.create({
    data: { codigo: P + sufixo, nome: sufixo, tipo, config, status: "DEFINICAO_INCOMPLETA", motivoIncompleto: motivo, createdById: usuarioId },
  });
}

beforeAll(async () => {
  const u = await prisma.usuario.create({
    data: { nome: "Teste ativação", email: `ativacao-${Date.now()}@teste.local`, senhaHash: "x", papel: "ADMIN" },
  });
  usuarioId = u.id;
  await indicador("pronto", "definição pronta — conferir e ativar", {});
  await indicador("sugerido", "pergunta sugerida: Zona — conferir tipo e opções", {});
  // "Pronto" mas com config que a API recusa ao ativar (PROPORCAO sem pergunta nem opções).
  await indicador("invalido", "definição pronta — conferir e ativar", { perguntaId: "", opcoesNumerador: [] }, "PROPORCAO");
});

afterAll(async () => {
  const ids = (await prisma.indicador.findMany({ where: { codigo: { startsWith: P } }, select: { id: true } })).map((i) => i.id);
  await prisma.indicadorDependencia.deleteMany({ where: { OR: [{ indicadorId: { in: ids } }, { dependeDeId: { in: ids } }] } });
  await prisma.logAlteracao.deleteMany({ where: { usuarioId } });
  await prisma.indicador.deleteMany({ where: { id: { in: ids } } });
  await prisma.usuario.deleteMany({ where: { id: usuarioId } });
});

describe("ativarIndicadoresProntos", () => {
  it("ativa só os de definição pronta que passam na validação, e audita", async () => {
    const r = await ativarIndicadoresProntos(usuarioId, { prefixoCodigo: P });
    expect(r.ativados).toEqual([P + "pronto"]);
    expect(r.recusados.map((x) => x.codigo)).toEqual([P + "invalido"]);

    const estado = Object.fromEntries(
      (await prisma.indicador.findMany({ where: { codigo: { startsWith: P } }, select: { codigo: true, status: true } })).map((i) => [i.codigo, i.status]),
    );
    expect(estado).toEqual({ [P + "pronto"]: "ATIVO", [P + "sugerido"]: "DEFINICAO_INCOMPLETA", [P + "invalido"]: "DEFINICAO_INCOMPLETA" });

    const logs = await prisma.logAlteracao.count({ where: { usuarioId, entidade: "Indicador", acao: "UPDATE" } });
    expect(logs).toBe(1);
  });

  it("rodar de novo não faz nada com o que já foi ativado", async () => {
    const r = await ativarIndicadoresProntos(usuarioId, { prefixoCodigo: P });
    expect(r.ativados).toEqual([]);
    expect(r.recusados.map((x) => x.codigo)).toEqual([P + "invalido"]);
  });
});
