const TRES_HORAS_MS = 3 * 60 * 60 * 1000;

/**
 * `enviadaEm` é um instante UTC; entrevista após 21h em Alagoas (UTC−3, sem horário
 * de verão) cai no dia seguinte em UTC. Devolve a data de calendário de Alagoas
 * como meia-noite UTC, comparável com `valorData` (data pura em meia-noite UTC).
 */
export function dataLocalAlagoas(instante: Date): Date {
  const local = new Date(instante.getTime() - TRES_HORAS_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

/** Diferença de calendário em meses completos, entre duas datas puras (campos UTC). */
export function mesesCompletos(nascimento: Date, referencia: Date): number {
  let meses =
    (referencia.getUTCFullYear() - nascimento.getUTCFullYear()) * 12 + (referencia.getUTCMonth() - nascimento.getUTCMonth());
  if (referencia.getUTCDate() < nascimento.getUTCDate()) meses -= 1;
  return meses;
}

const UM_DIA_MS = 24 * 60 * 60 * 1000;

export function diasCompletos(nascimento: Date, referencia: Date): number {
  const inicio = Date.UTC(nascimento.getUTCFullYear(), nascimento.getUTCMonth(), nascimento.getUTCDate());
  const fim = Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), referencia.getUTCDate());
  return Math.round((fim - inicio) / UM_DIA_MS);
}
