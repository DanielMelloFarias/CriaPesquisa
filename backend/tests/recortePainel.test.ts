import { describe, it, expect } from "vitest";
import { mascaraDoRecorte } from "../src/helper/recortePainel.js";
import { montarResposta } from "../src/helper/motor/avaliadores.js";

const SEXO = "sexo";
function resp(id: string, extras: { pesquisaId?: string; municipio?: string; regional?: string; enviadaEm?: string; sexo?: string }) {
  return montarResposta(
    id,
    extras.sexo ? [{ perguntaId: SEXO, opcoesSelecionadas: [extras.sexo] }] : [],
    extras.pesquisaId ?? "p1",
    { municipio: extras.municipio ?? null, regional: extras.regional ?? null, enviadaEm: extras.enviadaEm ? new Date(extras.enviadaEm) : null },
  );
}

const R = [
  resp("a", { municipio: "Maceió", regional: "1ª", enviadaEm: "2026-03-10T12:00:00Z", sexo: "Feminino" }),
  resp("b", { municipio: "Arapiraca", regional: "7ª", enviadaEm: "2026-03-31T23:30:00Z", sexo: "Masculino" }),
  resp("c", { pesquisaId: "p2", municipio: "Maceió", regional: "1ª", enviadaEm: "2026-04-01T00:00:00Z" }),
];

describe("mascaraDoRecorte", () => {
  it("sem filtros: todas", () => {
    expect(mascaraDoRecorte(R, {}, new Map([["p1", SEXO]]))).toEqual([true, true, true]);
  });
  it("pesquisa, município e regional", () => {
    expect(mascaraDoRecorte(R, { pesquisaId: "p1" }, new Map())).toEqual([true, true, false]);
    expect(mascaraDoRecorte(R, { municipio: "Maceió" }, new Map())).toEqual([true, false, true]);
    expect(mascaraDoRecorte(R, { regional: "7ª" }, new Map())).toEqual([false, true, false]);
  });
  it("período inclusivo nas duas pontas", () => {
    const de = new Date("2026-03-10T12:00:00Z");
    const ate = new Date("2026-03-31T23:59:59.999Z");
    expect(mascaraDoRecorte(R, { de, ate }, new Map())).toEqual([true, true, false]);
  });
  it("só 'de': fica fora quem veio antes; quem veio exatamente no limite entra", () => {
    expect(mascaraDoRecorte(R, { de: new Date("2026-03-31T23:30:00Z") }, new Map())).toEqual([false, true, true]);
  });
  it("só 'ate': fica fora quem veio depois; quem veio exatamente no limite entra", () => {
    expect(mascaraDoRecorte(R, { ate: new Date("2026-03-31T23:30:00Z") }, new Map())).toEqual([true, true, false]);
  });
  it("resposta sem data fica fora quando há filtro de período", () => {
    const semData = [resp("x", {})];
    expect(mascaraDoRecorte(semData, { de: new Date("2026-01-01") }, new Map())).toEqual([false]);
    expect(mascaraDoRecorte(semData, { ate: new Date("2099-12-31") }, new Map())).toEqual([false]);
    expect(mascaraDoRecorte(semData, {}, new Map())).toEqual([true]);
  });
  it("sexo pela opção marcada em qualquer pergunta de sexo", () => {
    expect(mascaraDoRecorte(R, { sexo: "Feminino" }, new Map([["p1", SEXO]]))).toEqual([true, false, false]);
  });
  it("regional derivada do município quando Resposta.regional é nula", () => {
    const semRegional = [resp("m", { municipio: "Maceió" }), resp("a", { municipio: "Arapiraca" }), resp("s", {})];
    expect(mascaraDoRecorte(semRegional, { regional: "1ª Regional – Maceió" }, new Map())).toEqual([true, false, false]);
    expect(mascaraDoRecorte(semRegional, { regional: "2ª Regional – Arapiraca" }, new Map())).toEqual([false, true, false]);
  });
  it("sexo usa a pergunta da pesquisa da resposta (criança, não quem responde)", () => {
    const CRIANCA = "pc", GESTANTE = "pg";
    const crianca = montarResposta("c", [
      { perguntaId: "sexoResp", opcoesSelecionadas: ["Feminino"] },
      { perguntaId: "sexoCrianca", opcoesSelecionadas: ["Masculino"] },
    ], CRIANCA);
    const gestante = montarResposta("g", [{ perguntaId: "sexoGest", opcoesSelecionadas: ["Feminino"] }], GESTANTE);
    const mapa = new Map([[CRIANCA, "sexoCrianca"], [GESTANTE, "sexoGest"]]);
    expect(mascaraDoRecorte([crianca, gestante], { sexo: "Feminino" }, mapa)).toEqual([false, true]);
    expect(mascaraDoRecorte([crianca, gestante], { sexo: "Masculino" }, mapa)).toEqual([true, false]);
  });
});
