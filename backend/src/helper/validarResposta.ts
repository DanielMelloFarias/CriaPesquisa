import type { TipoPergunta } from "@prisma/client";

export interface OpcaoParaValidacao {
  id: string;
  texto?: string;
}

export interface PerguntaParaValidacao {
  id: string;
  enunciado: string;
  tipo: TipoPergunta;
  obrigatoria: boolean;
  opcoes?: OpcaoParaValidacao[];
}

export interface ItemParaValidacao {
  perguntaId: string;
  valorTexto?: string | null;
  valorNumero?: number | null;
  valorData?: Date | string | null;
  opcoesSelecionadas?: string[] | null;
}

function estaPreenchido(item: ItemParaValidacao): boolean {
  const temTexto = typeof item.valorTexto === "string" && item.valorTexto.trim() !== "";
  const temNumero = item.valorNumero !== null && item.valorNumero !== undefined;
  const temData = item.valorData !== null && item.valorData !== undefined;
  const temOpcoes = (item.opcoesSelecionadas?.length ?? 0) > 0;
  return temTexto || temNumero || temData || temOpcoes;
}

function pertenceAsOpcoes(pergunta: PerguntaParaValidacao, valor: string): boolean {
  const opcoes = pergunta.opcoes ?? [];
  return opcoes.some((opcao) => opcao.id === valor || opcao.texto === valor);
}

/**
 * Troca a opção selecionada pelo id pelo seu texto. A validação aceita os dois,
 * mas o motor de indicadores e o filtro de sexo comparam por texto: gravar o id
 * faria a resposta sumir das contas. Valor que não é id de opção fica como veio.
 */
export function normalizarOpcoesParaTexto<T extends ItemParaValidacao>(
  perguntas: PerguntaParaValidacao[],
  itens: T[],
): T[] {
  const textoPorId = new Map<string, Map<string, string>>(
    perguntas.map((pergunta) => [
      pergunta.id,
      new Map((pergunta.opcoes ?? []).flatMap((o) => (o.texto === undefined ? [] : [[o.id, o.texto] as const]))),
    ]),
  );
  return itens.map((item) => {
    if (!item.opcoesSelecionadas) return item;
    const textos = textoPorId.get(item.perguntaId);
    return { ...item, opcoesSelecionadas: item.opcoesSelecionadas.map((v) => textos?.get(v) ?? v) };
  });
}

/**
 * Valida os itens de uma resposta contra as perguntas da pesquisa.
 * Função pura: não acessa banco de dados. Retorna uma lista de mensagens de
 * erro (vazia quando a resposta é válida).
 */
export function validarRespostaContraPerguntas(
  perguntas: PerguntaParaValidacao[],
  itens: ItemParaValidacao[],
): string[] {
  const erros: string[] = [];
  const perguntasPorId = new Map(perguntas.map((pergunta) => [pergunta.id, pergunta]));
  const itemPorPerguntaId = new Map<string, ItemParaValidacao>();

  for (const item of itens) {
    if (!perguntasPorId.has(item.perguntaId)) {
      erros.push("pergunta desconhecida");
      continue;
    }
    // Dois itens para a mesma pergunta: qual vale? O motor de indicadores recusa o dado.
    if (itemPorPerguntaId.has(item.perguntaId)) {
      erros.push(`${perguntasPorId.get(item.perguntaId)!.enunciado}: pergunta respondida mais de uma vez`);
      continue;
    }
    itemPorPerguntaId.set(item.perguntaId, item);
  }

  for (const pergunta of perguntas) {
    const item = itemPorPerguntaId.get(pergunta.id);
    const preenchido = item ? estaPreenchido(item) : false;

    if (pergunta.obrigatoria && !preenchido) {
      erros.push(`${pergunta.enunciado}: resposta obrigatória`);
      continue;
    }
    if (!item || !preenchido) continue;

    switch (pergunta.tipo) {
      case "NUMERO":
        if (typeof item.valorNumero !== "number" || !Number.isFinite(item.valorNumero)) {
          erros.push(`${pergunta.enunciado}: valor numérico inválido`);
        }
        break;

      case "DATA": {
        const data = item.valorData ? new Date(item.valorData) : undefined;
        if (!data || Number.isNaN(data.getTime())) {
          erros.push(`${pergunta.enunciado}: data inválida`);
        }
        break;
      }

      case "TEXTO":
      case "CAMPO_ABERTO":
        if (typeof item.valorTexto !== "string" || item.valorTexto.trim() === "") {
          erros.push(`${pergunta.enunciado}: texto inválido`);
        }
        break;

      case "ESCOLHA_UNICA": {
        const selecionadas = item.opcoesSelecionadas ?? [];
        if (selecionadas.length !== 1) {
          erros.push(`${pergunta.enunciado}: selecione exatamente uma opção`);
        } else if (!pertenceAsOpcoes(pergunta, selecionadas[0])) {
          erros.push(`${pergunta.enunciado}: opção inválida`);
        }
        break;
      }

      case "MULTIPLA_ESCOLHA": {
        const selecionadas = item.opcoesSelecionadas ?? [];
        if (selecionadas.length < 1) {
          erros.push(`${pergunta.enunciado}: selecione ao menos uma opção`);
        } else if (!selecionadas.every((valor) => pertenceAsOpcoes(pergunta, valor))) {
          erros.push(`${pergunta.enunciado}: opção inválida`);
        }
        break;
      }
    }
  }

  return erros;
}
