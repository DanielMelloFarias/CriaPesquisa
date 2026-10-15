// Ativa os indicadores que a importação trouxe com a definição já decidida
// (motivo "definição pronta — conferir e ativar"). Idempotente: o que já está
// ativo não é tocado. Cada ativação passa pelo MESMO caminho da tela de revisão
// (indicadorController.atualizar): validação completa da config, referências,
// perguntas, recorte, ciclo e registro na auditoria em nome do primeiro ADMIN.
// Indicador que a API recusaria continua "para revisar" e aparece na saída.
//
// Uso: npx tsx scripts/ativar-indicadores-prontos.ts
// Depois de rodar, reinicie a API (o cache dos indicadores vive no processo dela).
import { fileURLToPath } from "node:url";
import type { Request, Response } from "express";
import { prisma } from "../src/config/prisma.js";
import { atualizar } from "../src/controllers/indicadorController.js";

export const MOTIVO_PRONTA = "definição pronta";

export type ResultadoAtivacao = { ativados: string[]; recusados: Array<{ codigo: string; motivo: string }> };

export async function ativarIndicadoresProntos(
  usuarioId: string,
  opcoes: { prefixoCodigo?: string } = {},
): Promise<ResultadoAtivacao> {
  const prontos = await prisma.indicador.findMany({
    where: {
      deletedAt: null,
      status: "DEFINICAO_INCOMPLETA",
      motivoIncompleto: { startsWith: MOTIVO_PRONTA },
      ...(opcoes.prefixoCodigo ? { codigo: { startsWith: opcoes.prefixoCodigo } } : {}),
    },
    select: { id: true, codigo: true },
    orderBy: { createdAt: "asc" },
  });

  const resultado: ResultadoAtivacao = { ativados: [], recusados: [] };
  for (const indicador of prontos) {
    const req = {
      params: { id: indicador.id },
      body: { status: "ATIVO" },
      usuario: { id: usuarioId, papel: "ADMIN" },
      ip: "script ativar-indicadores-prontos",
    } as unknown as Request;
    const res = { json: () => res } as unknown as Response;
    try {
      await atualizar(req, res);
      resultado.ativados.push(indicador.codigo);
    } catch (erro) {
      resultado.recusados.push({ codigo: indicador.codigo, motivo: erro instanceof Error ? erro.message : String(erro) });
    }
  }
  return resultado;
}

// Execução direta: atribui as ativações ao primeiro ADMIN ativo.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const admin = await prisma.usuario.findFirstOrThrow({ where: { papel: "ADMIN", ativo: true }, orderBy: { createdAt: "asc" } });
    const r = await ativarIndicadoresProntos(admin.id);
    console.log(`${r.ativados.length} ativados · ${r.recusados.length} recusados`);
    if (r.ativados.length) console.log(`ativados: ${r.ativados.join(", ")}`);
    for (const f of r.recusados) console.log(`recusado ${f.codigo}: ${f.motivo}`);
    if (r.recusados.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
