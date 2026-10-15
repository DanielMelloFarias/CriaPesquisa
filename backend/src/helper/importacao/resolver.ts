import type { DefinicaoConhecida } from "./definicoes-cartao-cria.js";

export type PerguntaDoBanco = { id: string; enunciado: string; pesquisa: string };
export type Resolvido = {
  config: unknown;
  recorteConfig?: { substituicoes: Array<{ de: string; para: string }> };
  faltando: string[];
};

/**
 * Troca as referências do mapa por ids do banco: `{ pergunta }` pelo id da
 * pergunta com aquele enunciado exato na pesquisa da definição, `{ indicador }`
 * pelo id já gravado daquele código. O que não resolve vai para `faltando` e
 * fica como string vazia — quem chama grava como DEFINICAO_INCOMPLETA e segue.
 */
export function resolverDefinicao(
  def: DefinicaoConhecida,
  perguntas: PerguntaDoBanco[],
  idsPorCodigo: Map<string, string>,
): Resolvido {
  const faltando: string[] = [];
  const daPesquisa = new Map(perguntas.filter((p) => p.pesquisa === def.pesquisa).map((p) => [p.enunciado, p.id]));
  const pergunta = (enunciado: string) => {
    const id = daPesquisa.get(enunciado);
    if (!id) faltando.push(`pergunta não encontrada: ${enunciado}`);
    return id ?? "";
  };
  const trocar = (valor: unknown): unknown => {
    if (Array.isArray(valor)) return valor.map(trocar);
    if (valor && typeof valor === "object") {
      const obj = valor as Record<string, unknown>;
      const chaves = Object.keys(obj);
      if (chaves.length === 1 && typeof obj.pergunta === "string") return pergunta(obj.pergunta);
      if (chaves.length === 1 && typeof obj.indicador === "string") {
        const id = idsPorCodigo.get(obj.indicador);
        if (!id) faltando.push(`indicador não encontrado: ${obj.indicador}`);
        return id ?? "";
      }
      return Object.fromEntries(chaves.map((k) => [k, trocar(obj[k])]));
    }
    return valor;
  };
  const config = trocar(def.config);
  const recorteConfig = def.recorte
    ? { substituicoes: [{ de: pergunta(def.recorte.antes), para: pergunta(def.recorte.apos) }] }
    : undefined;
  return { config, recorteConfig, faltando };
}
