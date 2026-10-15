import ExcelJS from "exceljs";

/**
 * Cabeçalho exato da "Exportação Indicadores.xlsx". Se mudar, a importação para
 * antes de gravar qualquer coisa: coluna renomeada é sinal de que o significado
 * pode ter mudado também.
 */
export const COLUNAS = [
  "ID", "Setor", "Projeto", "Nome do Indicador", "Formula Descritiva", "Fórmula de Cálculo",
  "Tipo de Indicador", "Objetivo do Indicador / O que mede", "Meta", "Nº Pergunta", "Pergunta (Descrição)",
  "Observações", "Táticos relacionados", "Operacionais relacionados", "Apresentação", "DtRegistro", "Usuario",
] as const;

export const PROJETOS = ["Cartão CRIA (Criança)", "Cartão CRIA (Gestante)"] as const;
export type ProjetoPlanilha = (typeof PROJETOS)[number];

export type LinhaPlanilha = {
  id: string; // "" quando a célula está vazia: o importador pula e lista a linha
  numeroLinha: number; // linha na planilha (o cabeçalho é a 1)
  projeto: ProjetoPlanilha;
  nome: string;
  formulaDescritiva: string;
  formulaCalculo: string;
  categoria: string;
  objetivo: string;
  perguntaDescricao: string;
  observacoes: string;
  apresentacao: Array<"Escopo" | "Perfil">;
};

// Posição (1-based) de cada coluna lida. A última lida é "Apresentação" (15):
// DtRegistro (16) e Usuario (17) são dados pessoais e nunca são lidos.
const COL = {
  id: 1,
  projeto: 3,
  nome: 4,
  formulaDescritiva: 5,
  formulaCalculo: 6,
  categoria: 7,
  objetivo: 8,
  perguntaDescricao: 11,
  observacoes: 12,
  apresentacao: 15,
} as const;
const ULTIMA_COLUNA_LIDA = COLUNAS.indexOf("Apresentação") + 1;

function texto(row: ExcelJS.Row, coluna: number): string {
  if (coluna > ULTIMA_COLUNA_LIDA) throw new Error(`coluna ${coluna} não pode ser lida`);
  const cell = row.getCell(coluna);
  if (cell.value === null || cell.value === undefined) return "";
  return String(cell.text ?? "").trim();
}

function ehProjetoCartaoCria(valor: string): valor is ProjetoPlanilha {
  return (PROJETOS as readonly string[]).includes(valor);
}

/** Lê a primeira aba. Lança se o cabeçalho não for exatamente `COLUNAS`. */
export async function lerPlanilha(caminho: string): Promise<LinhaPlanilha[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(caminho);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("cabeçalho da planilha mudou: planilha sem abas");

  // Só o cabeçalho das 17 colunas é conferido (o nome da coluna, não o conteúdo).
  const cabecalho = sheet.getRow(1);
  const lido = COLUNAS.map((_, i) => String(cabecalho.getCell(i + 1).text ?? "").trim());
  const diferentes = COLUNAS.flatMap((esperado, i) =>
    lido[i] === esperado ? [] : [`coluna ${i + 1}: esperado "${esperado}", veio "${lido[i]}"`],
  );
  const extra = String(cabecalho.getCell(COLUNAS.length + 1).text ?? "").trim();
  if (extra) diferentes.push(`coluna ${COLUNAS.length + 1} a mais: "${extra}"`);
  if (diferentes.length > 0) throw new Error(`cabeçalho da planilha mudou: ${diferentes.join("; ")}`);

  const linhas: LinhaPlanilha[] = [];
  for (let n = 2; n <= sheet.rowCount; n++) {
    const row = sheet.getRow(n);
    const projeto = texto(row, COL.projeto);
    if (!ehProjetoCartaoCria(projeto)) continue;
    linhas.push({
      id: texto(row, COL.id),
      numeroLinha: n,
      projeto,
      nome: texto(row, COL.nome),
      formulaDescritiva: texto(row, COL.formulaDescritiva),
      formulaCalculo: texto(row, COL.formulaCalculo),
      categoria: texto(row, COL.categoria),
      objetivo: texto(row, COL.objetivo),
      perguntaDescricao: texto(row, COL.perguntaDescricao),
      observacoes: texto(row, COL.observacoes),
      apresentacao: texto(row, COL.apresentacao)
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is "Escopo" | "Perfil" => s === "Escopo" || s === "Perfil"),
    });
  }
  return linhas;
}
