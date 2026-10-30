import ExcelJS from "exceljs";
import type { TipoPergunta } from "@prisma/client";

export interface OpcaoParaExport {
  id: string;
  texto: string;
}

export interface PerguntaParaExport {
  id: string;
  enunciado: string;
  tipo: TipoPergunta;
  opcoes?: OpcaoParaExport[];
}

export interface ItemParaExport {
  perguntaId: string;
  valorTexto?: string | null;
  valorNumero?: number | null;
  valorData?: Date | string | null;
  opcoesSelecionadas?: string[] | null;
}

export interface RespostaParaExport {
  id: string;
  municipio?: string | null;
  unidade?: string | null;
  regional?: string | null;
  enviadaEm: Date | string;
  itens: ItemParaExport[];
}

const CABECALHOS_METADADOS = ["Município", "Unidade", "Regional", "Enviada em"];

function formatarDataISO(valor: Date | string): string {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return data.toISOString();
}

function formatarDataApenasData(valor: Date | string): string {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return data.toISOString().slice(0, 10);
}

function rotuloOpcao(pergunta: PerguntaParaExport, valor: string): string {
  const opcao = (pergunta.opcoes ?? []).find((o) => o.id === valor || o.texto === valor);
  return opcao?.texto ?? valor;
}

function formatarValorItem(pergunta: PerguntaParaExport, item: ItemParaExport | undefined): string {
  if (!item) return "";

  switch (pergunta.tipo) {
    case "NUMERO":
      return typeof item.valorNumero === "number" && Number.isFinite(item.valorNumero) ? String(item.valorNumero) : "";
    case "DATA":
      return item.valorData ? formatarDataApenasData(item.valorData) : "";
    case "ESCOLHA_UNICA":
    case "MULTIPLA_ESCOLHA":
      return (item.opcoesSelecionadas ?? []).map((valor) => rotuloOpcao(pergunta, valor)).join("; ");
    case "TEXTO":
    case "CAMPO_ABERTO":
    default:
      return item.valorTexto ?? "";
  }
}

/**
 * Monta a matriz de exportação (cabeçalho + uma linha por resposta).
 * Função pura, usada tanto por `gerarCsv` quanto por `gerarXlsx`.
 */
export function montarLinhasExport(perguntas: PerguntaParaExport[], respostas: RespostaParaExport[]): string[][] {
  const cabecalho = [...CABECALHOS_METADADOS, ...perguntas.map((pergunta) => pergunta.enunciado)];

  const linhas = respostas.map((resposta) => {
    const itemPorPergunta = new Map(resposta.itens.map((item) => [item.perguntaId, item]));
    const valores = perguntas.map((pergunta) => formatarValorItem(pergunta, itemPorPergunta.get(pergunta.id)));
    return [
      resposta.municipio ?? "",
      resposta.unidade ?? "",
      resposta.regional ?? "",
      formatarDataISO(resposta.enviadaEm),
      ...valores,
    ];
  });

  return [cabecalho, ...linhas];
}

/**
 * Texto que começa com = + - @ (ou tab/CR) é lido como fórmula ao abrir o CSV no
 * Excel. O apóstrofo na frente faz o Excel tratar como texto. Número (inclusive
 * negativo) passa intacto. Só no CSV: no .xlsx a célula já é gravada como texto.
 */
function neutralizarFormula(valor: string): string {
  if (/^[=+\-@\t\r]/.test(valor) && !/^[-+]?\d+(\.\d+)?$/.test(valor)) return `'${valor}`;
  return valor;
}

function escaparCampoCsv(valor: string): string {
  if (/["\n,;]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

/**
 * Gera um CSV (separador `,`, com BOM UTF-8 para compatibilidade com Excel).
 */
export function gerarCsv(perguntas: PerguntaParaExport[], respostas: RespostaParaExport[]): string {
  const linhas = montarLinhasExport(perguntas, respostas);
  const corpo = linhas
    .map((linha) => linha.map((campo) => escaparCampoCsv(neutralizarFormula(campo))).join(","))
    .join("\r\n");
  const BOM = String.fromCharCode(0xfeff);
  return BOM + corpo;
}

/**
 * Gera um workbook .xlsx (worksheet "Respostas") com exceljs.
 */
export async function gerarXlsx(perguntas: PerguntaParaExport[], respostas: RespostaParaExport[]): Promise<Buffer> {
  const linhas = montarLinhasExport(perguntas, respostas);

  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet("Respostas");
  linhas.forEach((linha) => planilha.addRow(linha));
  planilha.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
