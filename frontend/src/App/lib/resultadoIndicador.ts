import type { Indicador } from "../api/indicadores.js";

export type Resultado =
  | { status: "OK"; valor: number }
  | { status: "OK_FAIXAS"; faixas: Array<{ rotulo: string; percentual: number }> }
  | { status: "OK_DISTRIBUICAO"; itens: Array<{ opcao: string; contagem: number; percentual: number }> }
  | { status: "SEM_DADOS" }
  | { status: "INCOMPLETO"; motivo: string; dependencia?: string };
export type ResultadoComRecorte = Resultado | { antes: Resultado; apos: Resultado };

export type Exibicao =
  | { forma: "NUMERO"; texto: string; legenda?: string; meta?: { texto: string; atingida: boolean } }
  | { forma: "FAIXAS"; faixas: Array<{ rotulo: string; percentual: number }> }
  | { forma: "DISTRIBUICAO"; itens: Array<{ opcao: string; percentual: number }>; grafico: "ROSCA" | "BARRAS" }
  | { forma: "SEM_DADOS" }
  | { forma: "INCOMPLETO"; motivo: string };
export type ExibicaoIndicador =
  | { pareado: false; exibicao: Exibicao }
  | { pareado: true; antes: Exibicao; apos: Exibicao; diferenca?: string };

type IndicadorFormato = Pick<Indicador, "tipo" | "casasDecimais" | "meta">;

const TIPOS_PERCENTUAIS = new Set(["PROPORCAO", "CRUZAMENTO", "PERCENTIL_OMS"]);
const TIPOS_INDICE = new Set(["COMPOSTO", "ESCALA", "META_POR_IDADE"]);
const MENOS = "−";

function numeroPtBr(valor: number, casas: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Sinal explícito: "+" / U+2212; zero (após arredondar) fica sem sinal. */
function comSinal(valor: number, casas: number): string {
  const texto = numeroPtBr(Math.abs(valor), casas);
  const zero = Number(texto.replace(/\./g, "").replace(",", ".")) === 0;
  if (zero) return texto;
  return (valor > 0 ? "+" : MENOS) + texto;
}

function textoDoNumero(ind: IndicadorFormato, valor: number): string {
  if (ind.tipo === "ZSCORE") return comSinal(valor, 2);
  if (ind.tipo === "CONTAGEM") return numeroPtBr(valor, 0);
  const base = numeroPtBr(valor, ind.casasDecimais);
  return TIPOS_PERCENTUAIS.has(ind.tipo) ? `${base}%` : base;
}

function exibir(ind: IndicadorFormato, r: Resultado | undefined): Exibicao {
  if (!r) return { forma: "INCOMPLETO", motivo: "sem resultado do cálculo" };
  switch (r.status) {
    case "OK": {
      const exibicao: Exibicao = { forma: "NUMERO", texto: textoDoNumero(ind, r.valor) };
      if (TIPOS_INDICE.has(ind.tipo)) exibicao.legenda = "índice de 0 a 100";
      if (ind.tipo === "ZSCORE") {
        const texto = exibicao.texto;
        exibicao.legenda = texto.startsWith("+")
          ? "acima da média do estado"
          : texto.startsWith(MENOS)
            ? "abaixo da média do estado"
            : "na média do estado";
      }
      if (ind.meta !== null && ind.meta !== undefined) {
        exibicao.meta = { texto: `meta ${textoDoNumero(ind, ind.meta)}`, atingida: r.valor >= ind.meta };
      }
      return exibicao;
    }
    case "OK_FAIXAS":
      return { forma: "FAIXAS", faixas: r.faixas };
    case "OK_DISTRIBUICAO":
      return {
        forma: "DISTRIBUICAO",
        itens: r.itens.map((i) => ({ opcao: i.opcao, percentual: i.percentual })),
        grafico: r.itens.length <= 6 ? "ROSCA" : "BARRAS",
      };
    case "SEM_DADOS":
      return { forma: "SEM_DADOS" };
    case "INCOMPLETO":
      return { forma: "INCOMPLETO", motivo: r.motivo };
  }
}

function diferencaEntre(ind: IndicadorFormato, antes: Resultado, apos: Resultado): string | undefined {
  if (antes.status !== "OK" || apos.status !== "OK") return undefined;
  const casas = ind.tipo === "ZSCORE" ? 2 : ind.tipo === "CONTAGEM" ? 0 : ind.casasDecimais;
  const texto = comSinal(apos.valor - antes.valor, casas);
  return TIPOS_PERCENTUAIS.has(ind.tipo) ? `${texto} p.p.` : texto;
}

function pareadoDe(r: ResultadoComRecorte): r is { antes: Resultado; apos: Resultado } {
  return "antes" in r && "apos" in r;
}

export function formatarResultado(indicador: IndicadorFormato, resultado: ResultadoComRecorte | undefined): ExibicaoIndicador {
  if (resultado && pareadoDe(resultado)) {
    const diferenca = diferencaEntre(indicador, resultado.antes, resultado.apos);
    return {
      pareado: true,
      antes: exibir(indicador, resultado.antes),
      apos: exibir(indicador, resultado.apos),
      ...(diferenca !== undefined ? { diferenca } : {}),
    };
  }
  return { pareado: false, exibicao: exibir(indicador, resultado) };
}
