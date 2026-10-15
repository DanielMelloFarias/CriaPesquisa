import { describe, it, expect } from "vitest";
import { mesesCompletos, diasCompletos, dataLocalAlagoas } from "../src/helper/motor/idade.js";

const d = (s: string) => new Date(s);

describe("idade", () => {
  it("meses completos", () => {
    expect(mesesCompletos(d("2025-07-01"), d("2026-01-01T15:00:00Z"))).toBe(6);
    expect(mesesCompletos(d("2025-07-15"), d("2026-01-14T15:00:00Z"))).toBe(5);
    expect(mesesCompletos(d("2025-07-15"), d("2026-01-15T00:00:00Z"))).toBe(6);
    expect(mesesCompletos(d("2024-07-01"), d("2026-01-01"))).toBe(18);
    expect(mesesCompletos(d("2026-02-01"), d("2026-01-01"))).toBe(-1);
  });
  it("fim de mês e ano bissexto", () => {
    expect(mesesCompletos(d("2025-01-31"), d("2025-02-28"))).toBe(0);
    expect(mesesCompletos(d("2025-01-31"), d("2025-03-01"))).toBe(1);
    expect(mesesCompletos(d("2024-02-29"), d("2025-02-28"))).toBe(11);
    expect(mesesCompletos(d("2024-02-29"), d("2025-03-01"))).toBe(12);
  });
  it("data local de Alagoas (UTC-3)", () => {
    expect(dataLocalAlagoas(d("2026-01-01T01:00:00Z")).toISOString()).toBe("2025-12-31T00:00:00.000Z");
    expect(dataLocalAlagoas(d("2026-01-01T03:00:00Z")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
  it("dias completos", () => {
    expect(diasCompletos(d("2025-01-01"), d("2026-01-01T10:00:00Z"))).toBe(365);
    expect(diasCompletos(d("2024-01-02"), d("2026-01-01"))).toBe(730);
    expect(diasCompletos(d("2026-01-02"), d("2026-01-01"))).toBe(-1);
  });
});
