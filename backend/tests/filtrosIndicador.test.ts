import { describe, it, expect } from "vitest";
import { extrairFiltrosIndicador, chaveDeCache } from "../src/helper/filtrosIndicador.js";

describe("extrairFiltrosIndicador", () => {
  it("lê os quatro filtros do painel", () => {
    const f = extrairFiltrosIndicador({
      municipio: "Maceió",
      regional: "1ª Regional – Maceió",
      sexo: "Feminino",
      de: "2026-01-01",
      ate: "2026-06-30",
    });
    expect(f.municipio).toBe("Maceió");
    expect(f.regional).toBe("1ª Regional – Maceió");
    expect(f.sexo).toBe("Feminino");
    expect(f.de?.toISOString().slice(0, 10)).toBe("2026-01-01");
  });

  it("`ate` só com a data inclui o dia inteiro (fim do dia)", () => {
    expect(extrairFiltrosIndicador({ ate: "2026-06-30" }).ate?.toISOString()).toBe("2026-06-30T23:59:59.999Z");
  });

  it("`ate` com data e hora completas fica como veio", () => {
    expect(extrairFiltrosIndicador({ ate: "2026-06-30T12:00:00.000Z" }).ate?.toISOString()).toBe("2026-06-30T12:00:00.000Z");
  });

  it("data inválida em `de` é recusada (422), não ignorada", () => {
    expect(() => extrairFiltrosIndicador({ de: "ontem" })).toThrow(
      expect.objectContaining({ status: 422, code: "FILTRO_INVALIDO" }),
    );
  });

  it("data inválida em `ate` é recusada (422), não ignorada", () => {
    expect(() => extrairFiltrosIndicador({ ate: "lixo" })).toThrow(
      expect.objectContaining({ status: 422, code: "FILTRO_INVALIDO" }),
    );
  });

  it("data ausente ou vazia continua sem filtro", () => {
    expect(extrairFiltrosIndicador({ de: "" }).de).toBeUndefined();
    expect(extrairFiltrosIndicador({}).ate).toBeUndefined();
  });

  it("ignora parâmetro repetido (array na query)", () => {
    expect(extrairFiltrosIndicador({ municipio: ["Maceió", "Arapiraca"] }).municipio).toBeUndefined();
  });
});

describe("chaveDeCache", () => {
  it("filtros iguais em ordem diferente geram a mesma chave", () => {
    const a = chaveDeCache({ municipio: "Maceió", sexo: "Feminino" });
    const b = chaveDeCache({ sexo: "Feminino", municipio: "Maceió" });
    expect(a).toBe(b);
  });

  it("filtro ausente (undefined) não altera a chave", () => {
    expect(chaveDeCache({ municipio: "Maceió", sexo: undefined })).toBe(chaveDeCache({ municipio: "Maceió" }));
  });

  it("filtros diferentes geram chaves diferentes", () => {
    expect(chaveDeCache({ municipio: "Maceió" })).not.toBe(chaveDeCache({ municipio: "Arapiraca" }));
  });
});
