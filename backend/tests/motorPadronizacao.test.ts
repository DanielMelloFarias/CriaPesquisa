import { describe, it, expect } from "vitest";
import { estatisticas } from "../src/helper/motor/padronizacao.js";

describe("estatisticas", () => {
  it("média e desvio amostral", () => {
    expect(estatisticas([10, 20, 30])).toEqual({ media: 20, desvio: 10 });
    const e = estatisticas([5, 5, 20])!;
    expect(e.media).toBe(10);
    expect(e.desvio).toBeCloseTo(Math.sqrt(75), 12);
  });
  it("menos de 2 valores ou desvio zero = null", () => {
    expect(estatisticas([])).toBeNull();
    expect(estatisticas([7])).toBeNull();
    expect(estatisticas([4, 4, 4])).toBeNull();
  });
});
