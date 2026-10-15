import { lerReferencia } from "./ler.js";

export type Sexo = "masculino" | "feminino";
type Lms = { L: number; M: number; S: number };

const linhas = lerReferencia<Record<Sexo, Array<[number, number, number]>>>("oms-imc-idade.json");

/** LMS da OMS para o dia de vida; null fora da tabela (0–1856 dias). */
export function lmsImcParaIdade(sexo: Sexo, dias: number): Lms | null {
  if (!Number.isInteger(dias) || dias < 0) return null;
  const linha = linhas[sexo][dias];
  if (!linha) return null;
  const [L, M, S] = linha;
  return { L, M, S };
}

/** Escore-z pelo método LMS (Cole). */
export function zscoreLms(x: number, { L, M, S }: Lms): number {
  return L === 0 ? Math.log(x / M) / S : ((x / M) ** L - 1) / (L * S);
}

/** Φ(z) × 100, aproximação de Abramowitz & Stegun 26.2.17 (erro < 7,5e-8). */
export function percentilDeZ(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const cauda = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return (z > 0 ? 1 - cauda : cauda) * 100;
}
