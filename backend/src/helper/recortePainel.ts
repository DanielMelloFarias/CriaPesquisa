import type { FiltrosIndicador } from "./filtrosIndicador.js";
import type { RespostaAvaliavel } from "./motor/tipos.js";
import { regionalDoMunicipio } from "./regionais.js";

/**
 * Quais respostas entram na agregação do painel. O motor calcula o indivíduo
 * sobre a base inteira (o ZSCORE precisa dela como referência) e só agrega
 * onde a máscara é true. Mesmas regras que o `where` do banco aplicava.
 */
export function mascaraDoRecorte(
  respostas: RespostaAvaliavel[],
  filtros: FiltrosIndicador,
  /** pesquisaId → perguntaId da pergunta de sexo daquela pesquisa (ver perguntasDeSexo). */
  perguntasSexo: Map<string, string>,
): boolean[] {
  return respostas.map((r) => {
    if (filtros.pesquisaId && r.pesquisaId !== filtros.pesquisaId) return false;
    if (filtros.municipio && r.municipio !== filtros.municipio) return false;
    if (filtros.regional) {
      // Resposta.regional não é preenchida na coleta: deriva do município.
      const regional = r.regional ?? (r.municipio ? regionalDoMunicipio(r.municipio) : null);
      if (regional !== filtros.regional) return false;
    }
    if (filtros.de || filtros.ate) {
      if (!r.enviadaEm) return false;
      const t = r.enviadaEm.getTime();
      if (filtros.de && t < filtros.de.getTime()) return false;
      if (filtros.ate && t > filtros.ate.getTime()) return false;
    }
    if (filtros.sexo) {
      const pergunta = r.pesquisaId ? perguntasSexo.get(r.pesquisaId) : undefined;
      const marcou = pergunta ? (r.itens.get(pergunta)?.opcoesSelecionadas?.includes(filtros.sexo) ?? false) : false;
      if (!marcou) return false;
    }
    return true;
  });
}
