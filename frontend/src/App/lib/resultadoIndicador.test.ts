import { describe, it, expect } from "vitest";
import { formatarResultado } from "./resultadoIndicador.js";

const ind = (tipo: string, casasDecimais = 1, meta: number | null = null) => ({ tipo, casasDecimais, meta }) as never;

describe("formatarResultado", () => {
  it("proporção em %", () =>
    expect(formatarResultado(ind("PROPORCAO"), { status: "OK", valor: 62.5 })).toEqual({ pareado: false, exibicao: { forma: "NUMERO", texto: "62,5%" } }));
  it("índice 0–100", () =>
    expect(formatarResultado(ind("COMPOSTO"), { status: "OK", valor: 71.43 })).toEqual({
      pareado: false, exibicao: { forma: "NUMERO", texto: "71,4", legenda: "índice de 0 a 100" } }));
  it("contagem com milhar", () =>
    expect(formatarResultado(ind("CONTAGEM", 0), { status: "OK", valor: 1234 })).toEqual({ pareado: false, exibicao: { forma: "NUMERO", texto: "1.234" } }));
  it("média com casas do indicador", () =>
    expect(formatarResultado(ind("MEDIA", 2), { status: "OK", valor: 3.456 })).toEqual({ pareado: false, exibicao: { forma: "NUMERO", texto: "3,46" } }));
  it("z-score com sinal e legenda", () => {
    expect(formatarResultado(ind("ZSCORE", 2), { status: "OK", valor: -0.35 })).toEqual({
      pareado: false, exibicao: { forma: "NUMERO", texto: "−0,35", legenda: "abaixo da média do estado" } });
    expect(formatarResultado(ind("ZSCORE", 2), { status: "OK", valor: 0.42 })).toMatchObject({ exibicao: { texto: "+0,42", legenda: "acima da média do estado" } });
    expect(formatarResultado(ind("ZSCORE", 2), { status: "OK", valor: 0 })).toMatchObject({ exibicao: { texto: "0,00", legenda: "na média do estado" } });
  });
  it("meta atingida ou não", () => {
    expect(formatarResultado(ind("PROPORCAO", 1, 70), { status: "OK", valor: 62.5 })).toMatchObject({
      exibicao: { meta: { texto: "meta 70,0%", atingida: false } } });
    expect(formatarResultado(ind("PROPORCAO", 1, 60), { status: "OK", valor: 60 })).toMatchObject({
      exibicao: { meta: { texto: "meta 60,0%", atingida: true } } });
  });
  it("faixas passam como vieram", () => {
    const faixas = [{ rotulo: "a", percentual: 40 }, { rotulo: "b", percentual: 60 }];
    expect(formatarResultado(ind("PERCENTIL_OMS"), { status: "OK_FAIXAS", faixas })).toEqual({ pareado: false, exibicao: { forma: "FAIXAS", faixas } });
  });
  it("distribuição escolhe rosca até 6 opções", () => {
    const itens = (n: number) => Array.from({ length: n }, (_, i) => ({ opcao: `o${i}`, contagem: 1, percentual: 100 / n }));
    expect(formatarResultado(ind("DISTRIBUICAO"), { status: "OK_DISTRIBUICAO", itens: itens(6) })).toMatchObject({ exibicao: { grafico: "ROSCA" } });
    expect(formatarResultado(ind("DISTRIBUICAO"), { status: "OK_DISTRIBUICAO", itens: itens(7) })).toMatchObject({ exibicao: { grafico: "BARRAS" } });
  });
  it("pareado com diferença em p.p.", () =>
    expect(formatarResultado(ind("PROPORCAO"), { antes: { status: "OK", valor: 40 }, apos: { status: "OK", valor: 52.5 } })).toMatchObject({
      pareado: true, diferenca: "+12,5 p.p." }));
  it("pareado com queda usa sinal de menos e sem sufixo fora de %", () =>
    expect(formatarResultado(ind("MEDIA"), { antes: { status: "OK", valor: 5.1 }, apos: { status: "OK", valor: 2 } })).toMatchObject({
      pareado: true, diferenca: "−3,1" }));
  it("pareado com um lado sem dados não calcula diferença", () => {
    const r = formatarResultado(ind("PROPORCAO"), { antes: { status: "SEM_DADOS" }, apos: { status: "OK", valor: 52.5 } });
    expect(r).toMatchObject({ pareado: true, antes: { forma: "SEM_DADOS" }, apos: { forma: "NUMERO", texto: "52,5%" } });
    expect((r as { diferenca?: string }).diferenca).toBeUndefined();
  });
  it("sem dados, incompleto e ausente nunca viram número", () => {
    expect(formatarResultado(ind("PROPORCAO"), { status: "SEM_DADOS" })).toEqual({ pareado: false, exibicao: { forma: "SEM_DADOS" } });
    expect(formatarResultado(ind("PROPORCAO"), { status: "INCOMPLETO", motivo: "definição pendente" })).toEqual({
      pareado: false, exibicao: { forma: "INCOMPLETO", motivo: "definição pendente" } });
    expect(formatarResultado(ind("PROPORCAO"), undefined)).toEqual({ pareado: false, exibicao: { forma: "INCOMPLETO", motivo: "sem resultado do cálculo" } });
  });
});
