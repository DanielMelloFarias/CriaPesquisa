import { describe, it, expect, beforeAll } from "vitest";
import { calcular, type IndicadorParaCalculo } from "../src/helper/motor/calcular.js";
import { montarResposta } from "../src/helper/motor/avaliadores.js";

/**
 * Oito crianças, entrevista em 2026-01-01 (09:00 em Alagoas, mesmo dia).
 *
 * CPRE (ESCALA: Antes=100, Após=50, Sem=0, Não soube=fora):
 *   respostas: Antes, Antes, Após, Sem, Não soube, Antes, Após, Antes
 *   notas válidas: 100,100,50,0,100,50,100 (7) -> 500/7 = 71.43
 *
 * CPUER (META_POR_IDADE 0–11:7, 12–23:2, 24+:1):
 *   idades (meses): 6, 6, 18, 18, 30, 30, 9, 40
 *   consultas:      7, 3,  2,  1,  0,  2, null, 1
 *   valores: 100, 42.857143, 100, 50, 0, 100, (fora), 100 -> 492.857143/7 = 70.41
 *   (a 7ª não tem consultas: branco sai de numerador e denominador;
 *    a 6ª fez 2 contra meta 1 = 200, limitada a 100.)
 */
const ENTREVISTA = new Date("2026-01-01T12:00:00Z");
const NASC: Record<number, string> = { 6: "2025-07-01", 9: "2025-04-01", 18: "2024-07-01", 30: "2023-07-01", 40: "2022-09-01" };
const P = new Set(["pn", "consultas", "nasc"]);

function ind(p: Partial<IndicadorParaCalculo> & Pick<IndicadorParaCalculo, "id" | "tipo" | "config">): IndicadorParaCalculo {
  return { codigo: p.id, casasDecimais: 2, status: "ATIVO", pesquisaId: null, ...p };
}

const dados: Array<[string, number, number | null]> = [
  ["Antes", 6, 7], ["Antes", 6, 3], ["Após", 18, 2], ["Sem", 18, 1],
  ["Não soube", 30, 0], ["Antes", 30, 2], ["Após", 9, null], ["Antes", 40, 1],
];
const respostas = dados.map(([pn, meses, consultas], i) =>
  montarResposta(
    `c${i}`,
    [
      { perguntaId: "pn", opcoesSelecionadas: [pn] },
      { perguntaId: "nasc", valorData: new Date(NASC[meses]) },
      ...(consultas === null ? [] : [{ perguntaId: "consultas", valorNumero: consultas }]),
    ],
    null,
    { enviadaEm: ENTREVISTA },
  ),
);

let res: ReturnType<typeof calcular>;
beforeAll(() => {
  res = calcular(
    [
      ind({ id: "cpre", tipo: "ESCALA", config: { perguntaId: "pn", notas: { Antes: 100, "Após": 50, Sem: 0, "Não soube": null } } }),
      ind({ id: "cpuer", tipo: "META_POR_IDADE", config: { perguntaId: "consultas", nascimentoPerguntaId: "nasc",
        faixas: [{ deMeses: 0, ateMeses: 12, esperado: 7 }, { deMeses: 12, ateMeses: 24, esperado: 2 }, { deMeses: 24, ateMeses: null, esperado: 1 }] } }),
    ],
    respostas,
    P,
  );
});

describe("teste dourado — tipos novos", () => {
  it("CPRE", () => expect(res.get("cpre")).toEqual({ status: "OK", valor: 71.43 }));
  it("CPUER", () => expect(res.get("cpuer")).toEqual({ status: "OK", valor: 70.41 }));
});
