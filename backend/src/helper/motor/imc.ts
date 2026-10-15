/**
 * Faixa de IMC (kg/m²) que ainda é medida de gente. Fora dela é erro de digitação
 * — altura em centímetros dá IMC ≈ 0,002; peso em gramas, milhares — e não
 * criança/gestante magra ou obesa. PERCENTIL_OMS e ATALAH usam a mesma faixa.
 */
export const FAIXA_IMC_PLAUSIVEL = { min: 8, max: 60 } as const;

/** IMC finito dentro de [8, 60] kg/m². */
export function imcPlausivel(imc: number): boolean {
  return Number.isFinite(imc) && imc >= FAIXA_IMC_PLAUSIVEL.min && imc <= FAIXA_IMC_PLAUSIVEL.max;
}
