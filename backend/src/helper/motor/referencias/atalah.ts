import { lerReferencia } from "./ler.js";

export type FaixaAtalah = "Baixo peso" | "Adequado" | "Sobrepeso" | "Obesidade";
export const FAIXAS_ATALAH: readonly FaixaAtalah[] = ["Baixo peso", "Adequado", "Sobrepeso", "Obesidade"];

type LinhaAtalah = { semana: number; baixoPesoAte: number; sobrepesoDe: number; obesidadeDe: number };
const porSemana = new Map(lerReferencia<LinhaAtalah[]>("atalah.json").map((l) => [l.semana, l]));

/**
 * Quadro 19 (SISVAN 2011, Atalah 1997). A tabela tem uma casa decimal, então o
 * IMC é arredondado a uma casa antes da comparação. Faixa adequada = tudo entre
 * o fim do baixo peso e o início do sobrepeso (cobre o vão da semana 37).
 */
export function classificarAtalah(imc: number, semana: number): FaixaAtalah | null {
  if (!Number.isInteger(semana)) return null;
  const linha = porSemana.get(semana);
  if (!linha || !Number.isFinite(imc)) return null;
  const v = Math.round(imc * 10) / 10;
  if (v <= linha.baixoPesoAte) return "Baixo peso";
  if (v < linha.sobrepesoDe) return "Adequado";
  if (v < linha.obesidadeDe) return "Sobrepeso";
  return "Obesidade";
}
