/** Média e desvio-padrão amostral (n − 1). Sem base para padronizar: null. */
export function estatisticas(valores: number[]): { media: number; desvio: number } | null {
  if (valores.length < 2) return null;
  const media = valores.reduce((s, v) => s + v, 0) / valores.length;
  const variancia = valores.reduce((s, v) => s + (v - media) ** 2, 0) / (valores.length - 1);
  const desvio = Math.sqrt(variancia);
  return desvio > 0 && Number.isFinite(desvio) ? { media, desvio } : null;
}
