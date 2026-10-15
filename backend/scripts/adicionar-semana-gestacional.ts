// Acrescenta "Semana gestacional atual" à pesquisa Gestante já publicada
// (o sistema recusa editar pesquisa publicada pela API). Idempotente.
// Uso: npx tsx scripts/adicionar-semana-gestacional.ts
// Depois de rodar, reinicie a API ou edite qualquer indicador: o cache dos
// indicadores vive no processo da API e não enxerga escrita de outro processo.
import { fileURLToPath } from "node:url";
import { prisma } from "../src/config/prisma.js";
import { registrarLog } from "../src/helper/auditoria.js";

export const ENUNCIADO_SEMANA = "Semana gestacional atual";
const AJUDA = "Semanas completas de gestação (número inteiro de 1 a 42)";
const DEPOIS_DE = "Qual é o peso atual da gestante?";
const TITULO_GESTANTE = "Cartão CRIA — Gestante";

export async function adicionarSemanaGestacional(
  usuarioId: string,
  pesquisaId?: string,
): Promise<{ criada: boolean; perguntaId: string }> {
  const pesquisa = pesquisaId
    ? await prisma.pesquisa.findUniqueOrThrow({ where: { id: pesquisaId } })
    : await prisma.pesquisa.findFirstOrThrow({ where: { titulo: TITULO_GESTANTE, deletedAt: null } });

  const existente = await prisma.pergunta.findFirst({ where: { pesquisaId: pesquisa.id, enunciado: ENUNCIADO_SEMANA } });
  if (existente) return { criada: false, perguntaId: existente.id };

  const ancora = await prisma.pergunta.findFirstOrThrow({ where: { pesquisaId: pesquisa.id, enunciado: DEPOIS_DE } });

  const criada = await prisma.$transaction(async (tx) => {
    await tx.pergunta.updateMany({
      where: { pesquisaId: pesquisa.id, ordem: { gt: ancora.ordem } },
      data: { ordem: { increment: 1 } },
    });
    return tx.pergunta.create({
      data: {
        pesquisaId: pesquisa.id,
        secaoId: ancora.secaoId,
        enunciado: ENUNCIADO_SEMANA,
        tipo: "NUMERO",
        ajuda: AJUDA,
        ordem: ancora.ordem + 1,
      },
    });
  });

  await registrarLog({
    entidade: "Pergunta",
    entidadeId: criada.id,
    acao: "CREATE",
    usuarioId,
    dadosDepois: { pesquisaId: pesquisa.id, enunciado: ENUNCIADO_SEMANA, ordem: criada.ordem, origem: "script adicionar-semana-gestacional" },
  });
  return { criada: true, perguntaId: criada.id };
}

// Execução direta: atribui a alteração ao primeiro ADMIN ativo.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const admin = await prisma.usuario.findFirstOrThrow({ where: { papel: "ADMIN", ativo: true }, orderBy: { createdAt: "asc" } });
  const r = await adicionarSemanaGestacional(admin.id);
  console.log(r.criada ? `pergunta criada: ${r.perguntaId}` : `já existia: ${r.perguntaId}`);
  await prisma.$disconnect();
}
