import type { Request } from "express";
import { HttpError } from "../middleware/errorHandler.js";

export interface FiltrosIndicador {
  pesquisaId?: string;
  municipio?: string;
  regional?: string;
  sexo?: string;
  de?: Date;
  ate?: Date;
}

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() !== "" ? valor : undefined;
}

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Limite final de período. "AAAA-MM-DD" vira meia-noite UTC e, com `lte`,
 * deixaria o último dia inteiro de fora: só com a data, vale até o fim do dia.
 * Data e hora completas ficam como vieram.
 */
export function fimDoPeriodo(bruto: string, d: Date): Date {
  return SO_DATA.test(bruto.trim()) ? new Date(d.getTime() + UM_DIA_MS - 1) : d;
}

/** Data ilegível é recusada: ignorá-la devolveria o período inteiro como se fosse o pedido. */
function data(valor: unknown, campo: "de" | "ate"): Date | undefined {
  const bruto = texto(valor);
  if (!bruto) return undefined;
  const d = new Date(bruto);
  if (Number.isNaN(d.getTime())) {
    throw new HttpError(422, "FILTRO_INVALIDO", `Data inválida em "${campo}"`, { [campo]: bruto });
  }
  return campo === "ate" ? fimDoPeriodo(bruto, d) : d;
}

export function extrairFiltrosIndicador(query: Request["query"]): FiltrosIndicador {
  return {
    pesquisaId: texto(query.pesquisaId),
    municipio: texto(query.municipio),
    regional: texto(query.regional),
    sexo: texto(query.sexo),
    de: data(query.de, "de"),
    ate: data(query.ate, "ate"),
  };
}

/** Chave estável do cache: a ordem dos filtros não pode gerar entrada nova. */
export function chaveDeCache(filtros: FiltrosIndicador): string {
  const partes = Object.entries(filtros)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${v instanceof Date ? v.toISOString() : String(v)}`)
    .sort();
  return partes.join("&");
}
