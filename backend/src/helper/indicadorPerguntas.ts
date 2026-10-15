import type { ConfigIndicador } from "./indicadorConfig.js";

export type PerguntaParaConferir = {
  id: string;
  tipo: "TEXTO" | "NUMERO" | "DATA" | "MULTIPLA_ESCOLHA" | "ESCOLHA_UNICA" | "CAMPO_ABERTO";
  opcoes: string[];
};

/**
 * Confere a config dos tipos novos contra as perguntas reais. Os tipos antigos
 * continuam sendo conferidos só pelo motor (pergunta inexistente → INCOMPLETO).
 */
export function problemasDasPerguntas(config: ConfigIndicador, perguntas: Map<string, PerguntaParaConferir>): string[] {
  const problemas: string[] = [];
  const exigir = (id: string, tipo: PerguntaParaConferir["tipo"]): PerguntaParaConferir | null => {
    const p = perguntas.get(id);
    if (!p) {
      problemas.push(`pergunta ${id} não existe`);
      return null;
    }
    if (p.tipo !== tipo) {
      problemas.push(`pergunta ${id} precisa ser ${tipo}`);
      return null;
    }
    return p;
  };

  switch (config.tipo) {
    case "ESCALA": {
      const p = exigir(config.perguntaId, "ESCOLHA_UNICA");
      if (!p) break;
      for (const opcao of p.opcoes) if (!Object.hasOwn(config.notas, opcao)) problemas.push(`opção "${opcao}" sem nota`);
      for (const chave of Object.keys(config.notas)) if (!p.opcoes.includes(chave)) problemas.push(`opção "${chave}" não existe na pergunta`);
      break;
    }
    case "META_POR_IDADE":
      exigir(config.perguntaId, "NUMERO");
      exigir(config.nascimentoPerguntaId, "DATA");
      break;
    case "PERCENTIL_OMS": {
      exigir(config.nascimentoPerguntaId, "DATA");
      const p = exigir(config.sexoPerguntaId, "ESCOLHA_UNICA");
      if (p) {
        for (const opcao of [config.opcoesSexo.masculino, config.opcoesSexo.feminino]) {
          if (!p.opcoes.includes(opcao)) problemas.push(`opção "${opcao}" não existe na pergunta ${p.id}`);
        }
      }
      break;
    }
    case "ATALAH":
      exigir(config.semanaPerguntaId, "NUMERO");
      break;
    default:
      break;
  }
  return problemas;
}
