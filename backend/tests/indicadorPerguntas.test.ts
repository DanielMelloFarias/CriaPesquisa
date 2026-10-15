import { describe, it, expect } from "vitest";
import { problemasDasPerguntas, type PerguntaParaConferir } from "../src/helper/indicadorPerguntas.js";
import { validarConfig } from "../src/helper/indicadorConfig.js";

const P = (id: string, tipo: PerguntaParaConferir["tipo"], opcoes: string[] = []) => [id, { id, tipo, opcoes }] as const;
const perguntas = new Map<string, PerguntaParaConferir>([
  P("pn", "ESCOLHA_UNICA", ["Antes", "Após", "Não soube"]),
  P("consultas", "NUMERO"),
  P("nasc", "DATA"),
  P("sexo", "ESCOLHA_UNICA", ["Masculino", "Feminino"]),
  P("semana", "NUMERO"),
  P("texto", "TEXTO"),
]);

describe("problemasDasPerguntas", () => {
  it("ESCALA completa: ok", () => {
    expect(problemasDasPerguntas(validarConfig("ESCALA", { perguntaId: "pn", notas: { Antes: 100, "Após": 50, "Não soube": null } }), perguntas)).toEqual([]);
  });
  it("ESCALA: opção faltando, opção sobrando, tipo errado, pergunta inexistente", () => {
    expect(problemasDasPerguntas(validarConfig("ESCALA", { perguntaId: "pn", notas: { Antes: 100, "Após": 50 } }), perguntas))
      .toEqual(['opção "Não soube" sem nota']);
    expect(problemasDasPerguntas(validarConfig("ESCALA", { perguntaId: "pn", notas: { Antes: 100, "Após": 50, "Não soube": null, Outra: 1 } }), perguntas))
      .toEqual(['opção "Outra" não existe na pergunta']);
    expect(problemasDasPerguntas(validarConfig("ESCALA", { perguntaId: "texto", notas: { A: 1 } }), perguntas))
      .toEqual(["pergunta texto precisa ser ESCOLHA_UNICA"]);
    expect(problemasDasPerguntas(validarConfig("ESCALA", { perguntaId: "nada", notas: { A: 1 } }), perguntas))
      .toEqual(["pergunta nada não existe"]);
  });
  it("META_POR_IDADE: tipos das perguntas", () => {
    const ok = validarConfig("META_POR_IDADE", { perguntaId: "consultas", nascimentoPerguntaId: "nasc", faixas: [{ deMeses: 0, ateMeses: null, esperado: 1 }] });
    expect(problemasDasPerguntas(ok, perguntas)).toEqual([]);
    const errado = validarConfig("META_POR_IDADE", { perguntaId: "nasc", nascimentoPerguntaId: "consultas", faixas: [{ deMeses: 0, ateMeses: null, esperado: 1 }] });
    expect(problemasDasPerguntas(errado, perguntas)).toEqual(["pergunta nasc precisa ser NUMERO", "pergunta consultas precisa ser DATA"]);
  });
  it("PERCENTIL_OMS: opção de sexo inexistente", () => {
    const cfg = validarConfig("PERCENTIL_OMS", { imcIndicadorId: "imc", nascimentoPerguntaId: "nasc", sexoPerguntaId: "sexo",
      opcoesSexo: { masculino: "Menino", feminino: "Feminino" }, corte: { abaixoDe: 10 } });
    expect(problemasDasPerguntas(cfg, perguntas)).toEqual(['opção "Menino" não existe na pergunta sexo']);
  });
  it("ATALAH: semana precisa ser número", () => {
    expect(problemasDasPerguntas(validarConfig("ATALAH", { imcIndicadorId: "imc", semanaPerguntaId: "texto" }), perguntas))
      .toEqual(["pergunta texto precisa ser NUMERO"]);
  });
  it("tipos antigos não são conferidos aqui", () => {
    expect(problemasDasPerguntas(validarConfig("MEDIA", { perguntaId: "nada" }), perguntas)).toEqual([]);
  });
});
