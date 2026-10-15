import { describe, it, expect } from "vitest";
import { lmsImcParaIdade, zscoreLms, percentilDeZ } from "../src/helper/motor/referencias/oms.js";
import { classificarAtalah, FAIXAS_ATALAH } from "../src/helper/motor/referencias/atalah.js";

describe("OMS IMC-para-idade (valores da tabela oficial)", () => {
  it("LMS de dias conhecidos", () => {
    expect(lmsImcParaIdade("masculino", 0)).toEqual({ L: -0.3053, M: 13.4069, S: 0.0956 });
    expect(lmsImcParaIdade("masculino", 365)).toEqual({ L: -0.4113, M: 16.7992, S: 0.08009 });
    expect(lmsImcParaIdade("feminino", 730)).toEqual({ L: -0.5989, M: 15.4052, S: 0.08545 });
    expect(lmsImcParaIdade("feminino", 1856)).toEqual({ L: -0.5684, M: 15.2798, S: 0.09825 });
  });
  it("fora de 0–1856 dias = null", () => {
    expect(lmsImcParaIdade("masculino", -1)).toBeNull();
    expect(lmsImcParaIdade("masculino", 1857)).toBeNull();
    expect(lmsImcParaIdade("masculino", 10.5)).toBeNull();
  });
  it("z-score LMS reproduz as colunas SD da tabela", () => {
    // Colunas SD1 (menino, 365 dias) = 18.225 e SD2neg (menina, 730 dias) = 13.092.
    expect(zscoreLms(18.225, lmsImcParaIdade("masculino", 365)!)).toBeCloseTo(1, 2);
    expect(zscoreLms(13.092, lmsImcParaIdade("feminino", 730)!)).toBeCloseTo(-2, 2);
    expect(zscoreLms(16.7992, lmsImcParaIdade("masculino", 365)!)).toBeCloseTo(0, 6);
  });
  it("percentil da normal padrão", () => {
    expect(percentilDeZ(0)).toBeCloseTo(50, 5);
    expect(percentilDeZ(1)).toBeCloseTo(84.1345, 3);
    expect(percentilDeZ(-2)).toBeCloseTo(2.275, 3);
    expect(percentilDeZ(-1.2816)).toBeCloseTo(10, 2);
  });
});

describe("Atalah (Quadro 19, SISVAN 2011)", () => {
  it("ordem das faixas", () => {
    expect(FAIXAS_ATALAH).toEqual(["Baixo peso", "Adequado", "Sobrepeso", "Obesidade"]);
  });
  it("semana 20: BP ≤ 21,5 · A 21,6–26,3 · S 26,4–31,0 · O ≥ 31,1", () => {
    expect(classificarAtalah(21.5, 20)).toBe("Baixo peso");
    expect(classificarAtalah(22.0, 20)).toBe("Adequado");
    expect(classificarAtalah(26.3, 20)).toBe("Adequado");
    expect(classificarAtalah(26.4, 20)).toBe("Sobrepeso");
    expect(classificarAtalah(31.0, 20)).toBe("Sobrepeso");
    expect(classificarAtalah(31.1, 20)).toBe("Obesidade");
  });
  it("IMC é arredondado a uma casa antes de comparar (a tabela tem uma casa)", () => {
    expect(classificarAtalah(21.54, 20)).toBe("Baixo peso");
    expect(classificarAtalah(21.56, 20)).toBe("Adequado");
  });
  it("semana 37 tem vão entre BP (24,3) e A (24,5): 24,4 é adequado", () => {
    expect(classificarAtalah(24.4, 37)).toBe("Adequado");
  });
  it("semana fora de 6–42 ou não inteira = null", () => {
    expect(classificarAtalah(22, 5)).toBeNull();
    expect(classificarAtalah(22, 43)).toBeNull();
    expect(classificarAtalah(22, 20.5)).toBeNull();
  });
});
