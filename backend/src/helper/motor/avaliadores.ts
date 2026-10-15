import type { ConfigIndicador, NoExpressao } from "../indicadorConfig.js";
import type { ItemAvaliavel, RespostaAvaliavel, ValorIndividual } from "./tipos.js";

export type { ItemAvaliavel, RespostaAvaliavel, ValorIndividual };

export class ItemDuplicado extends Error {
  constructor(
    public readonly respostaId: string,
    public readonly perguntaId: string,
  ) {
    super(`resposta ${respostaId} tem mais de um item para a pergunta ${perguntaId}`);
    this.name = "ItemDuplicado";
  }
}

export function montarResposta(
  id: string,
  itens: Array<ItemAvaliavel & { perguntaId: string }>,
  pesquisaId: string | null = null,
  extras: { enviadaEm?: Date | null; municipio?: string | null; regional?: string | null } = {},
): RespostaAvaliavel {
  const mapa = new Map<string, ItemAvaliavel>();
  for (const { perguntaId, ...item } of itens) {
    if (mapa.has(perguntaId)) throw new ItemDuplicado(id, perguntaId);
    mapa.set(perguntaId, item);
  }
  return {
    id,
    pesquisaId,
    enviadaEm: extras.enviadaEm ?? null,
    municipio: extras.municipio ?? null,
    regional: extras.regional ?? null,
    itens: mapa,
  };
}

/** Zero é resposta; branco é ausência. Confundir os dois muda o denominador. */
function temNumero(item?: ItemAvaliavel): item is ItemAvaliavel & { valorNumero: number } {
  return typeof item?.valorNumero === "number" && Number.isFinite(item.valorNumero);
}

function opcoes(item?: ItemAvaliavel): string[] {
  return item?.opcoesSelecionadas ?? [];
}

function finitoOuNulo(valor: number): ValorIndividual {
  return Number.isFinite(valor) ? valor : null;
}

function avaliarExpressao(no: NoExpressao, valores: Map<string, number>): number {
  if ("const" in no) return no.const;
  if ("var" in no) return valores.get(no.var) ?? Number.NaN;
  const esq = avaliarExpressao(no.esq, valores);
  const dir = avaliarExpressao(no.dir, valores);
  switch (no.op) {
    case "+": return esq + dir;
    case "-": return esq - dir;
    case "*": return esq * dir;
    case "/": return dir === 0 ? Number.NaN : esq / dir;
  }
}

export function avaliar(
  config: ConfigIndicador,
  resposta: RespostaAvaliavel,
  valoresDependencias: Map<string, ValorIndividual>,
): ValorIndividual {
  switch (config.tipo) {
    case "PROPORCAO": {
      const selecionadas = opcoes(resposta.itens.get(config.perguntaId));
      if (selecionadas.length === 0) return null;
      return selecionadas.some((o) => config.opcoesNumerador.includes(o)) ? 100 : 0;
    }

    case "CRUZAMENTO": {
      let todas = true;
      for (const condicao of config.condicoes) {
        const item = resposta.itens.get(condicao.perguntaId);
        if (condicao.opcoes) {
          const selecionadas = opcoes(item);
          if (selecionadas.length === 0) return null;
          if (!selecionadas.some((o) => condicao.opcoes!.includes(o))) todas = false;
        } else if (condicao.operador && condicao.valor !== undefined) {
          if (!temNumero(item)) return null;
          const v = item.valorNumero;
          const alvo = condicao.valor;
          const vale =
            condicao.operador === "<" ? v < alvo :
            condicao.operador === "<=" ? v <= alvo :
            condicao.operador === ">" ? v > alvo :
            condicao.operador === ">=" ? v >= alvo : v === alvo;
          if (!vale) todas = false;
        }
      }
      return todas ? 100 : 0;
    }

    case "MEDIA": {
      const item = resposta.itens.get(config.perguntaId);
      return temNumero(item) ? item.valorNumero : null;
    }

    case "DERIVADA": {
      const valores = new Map<string, number>();
      for (const [nome, perguntaId] of Object.entries(config.variaveis)) {
        const item = resposta.itens.get(perguntaId);
        if (!temNumero(item)) return null;
        valores.set(nome, item.valorNumero);
      }
      return finitoOuNulo(avaliarExpressao(config.expressao, valores));
    }

    case "COMPOSTO": {
      let soma = 0;
      for (const termo of config.termos) {
        const valor = valoresDependencias.get(termo.indicadorId);
        if (valor === null || valor === undefined) return null;
        soma += valor * termo.peso;
      }
      return finitoOuNulo(soma / config.divisor);
    }

    // CLASSIFICACAO, CONTAGEM e DISTRIBUICAO não produzem valor individual:
    // existem só na agregação.
    default:
      return null;
  }
}
