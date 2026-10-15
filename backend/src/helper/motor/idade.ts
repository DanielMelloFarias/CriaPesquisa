/**
 * Idade na data da entrevista, em UTC. `valorData` é gravado como data pura
 * (meia-noite UTC), então UTC evita perder um dia no fuso de Alagoas.
 */
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
