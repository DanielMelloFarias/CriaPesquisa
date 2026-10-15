// Gera referencias/oms-imc-idade.json a partir das tabelas
// oficiais da OMS (BMI-for-age, expanded tables, z-scores por dia).
// Uso: npx tsx scripts/gerar-referencia-oms.ts <meninos.xlsx> <meninas.xlsx>
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const [meninos, meninas] = process.argv.slice(2);
if (!meninos || !meninas) throw new Error("Uso: gerar-referencia-oms.ts <meninos.xlsx> <meninas.xlsx>");

async function ler(caminho: string): Promise<Array<[number, number, number]>> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminho);
  const ws = wb.worksheets[0];
  const cabecalho = (ws.getRow(1).values as unknown[]).slice(1, 5);
  if (JSON.stringify(cabecalho) !== JSON.stringify(["Day", "L", "M", "S"])) {
    throw new Error(`cabeçalho inesperado em ${caminho}: ${JSON.stringify(cabecalho)}`);
  }
  const linhas: Array<[number, number, number]> = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const [dia, L, M, S] = (ws.getRow(r).values as unknown[]).slice(1, 5).map(Number);
    if (dia !== r - 2) throw new Error(`dia fora de sequência na linha ${r} de ${caminho}`);
    if (![L, M, S].every(Number.isFinite)) throw new Error(`valor não numérico na linha ${r} de ${caminho}`);
    linhas.push([L, M, S]);
  }
  if (linhas.length !== 1857) throw new Error(`${caminho}: esperava 1857 dias, li ${linhas.length}`);
  return linhas;
}

const saida = {
  fonte: "OMS, Child Growth Standards (2006), BMI-for-age, expanded tables (z-scores), 0–1856 dias",
  colunas: ["L", "M", "S"],
  masculino: await ler(meninos),
  feminino: await ler(meninas),
};
const destino = fileURLToPath(new URL("../referencias/oms-imc-idade.json", import.meta.url));
writeFileSync(destino, JSON.stringify(saida));
console.log(`gravado ${destino}`);
