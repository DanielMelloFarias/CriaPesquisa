/** Uma resposta reduzida ao que o motor precisa: nada de Prisma aqui dentro. */
export interface ItemAvaliavel {
  valorTexto?: string | null;
  valorNumero?: number | null;
  valorData?: Date | null;
  opcoesSelecionadas?: string[] | null;
}

export interface RespostaAvaliavel {
  id: string;
  /** Pesquisa de origem: indicador com pesquisaId só enxerga as respostas dela. */
  pesquisaId: string | null;
  /** Data da entrevista: base da idade (META_POR_IDADE, PERCENTIL_OMS). */
  enviadaEm: Date | null;
  /** Só a máscara do painel lê estes dois; o motor não. */
  municipio?: string | null;
  regional?: string | null;
  itens: Map<string, ItemAvaliavel>;
}

/**
 * Valor de um indicador para um indivíduo.
 * `null` = branco ou não aplicável: sai do numerador E do denominador.
 */
export type ValorIndividual = number | null;
