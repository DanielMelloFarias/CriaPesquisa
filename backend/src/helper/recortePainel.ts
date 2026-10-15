import type { FiltrosIndicador } from "./filtrosIndicador.js";
import type { RespostaAvaliavel } from "./motor/tipos.js";

/**
 * Quais respostas entram na agregação do painel. O motor calcula o indivíduo
 * sobre a base inteira (o ZSCORE precisa dela como referência) e só agrega
 * onde a máscara é true. Mesmas regras que o `where` do banco aplicava.
 */
export function mascaraDoRecorte(
  respostas: RespostaAvaliavel[],
  filtros: FiltrosIndicador,
  perguntasSexo: Set<string>,
): boolean[] {
  return respostas.map((r) => {
    if (filtros.pesquisaId && r.pesquisaId !== filtros.pesquisaId) return false;
    if (filtros.municipio && r.municipio !== filtros.municipio) return false;
    if (filtros.regional && r.regional !== filtros.regional) return false;
    if (filtros.de || filtros.ate) {
      if (!r.enviadaEm) return false;
      const t = r.enviadaEm.getTime();
      if (filtros.de && t < filtros.de.getTime()) return false;
      if (filtros.ate && t > filtros.ate.getTime()) return false;
    }
    if (filtros.sexo) {
      const sexo = filtros.sexo;
      const marcou = [...perguntasSexo].some((p) => r.itens.get(p)?.opcoesSelecionadas?.includes(sexo) ?? false);
      if (!marcou) return false;
    }
    return true;
  });
}
