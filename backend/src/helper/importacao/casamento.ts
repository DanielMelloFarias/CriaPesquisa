export type PerguntaCandidata = {
  id: string;
  enunciado: string;
  tipo: "TEXTO" | "NUMERO" | "DATA" | "MULTIPLA_ESCOLHA" | "ESCOLHA_UNICA" | "CAMPO_ABERTO";
};

export type Sugestao =
  | { situacao: "UNICA"; perguntaId: string }
  | { situacao: "PAR"; antesId: string; aposId: string }
  | { situacao: "AMBIGUA"; candidatas: string[] }
  | { situacao: "NENHUMA" }
  | { situacao: "SEM_DESCRICAO" };

export type TipoSugerido = "DISTRIBUICAO" | "PROPORCAO" | "MEDIA" | "CONTAGEM" | null;

const LIMIAR = 0.5;
const EMPATE = 0.05;

export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^\s*\d+\s*[.\-–)]\s*/, "")
    .replace(/[—–-]?\s*(antes|apos)\s+(do|o)\s+cartao\s+cria\s*$/, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palavras(texto: string): Set<string> {
  return new Set(normalizar(texto).split(" ").filter((p) => p.length >= 3));
}

export function semelhanca(a: string, b: string): number {
  const A = palavras(a);
  const B = palavras(b);
  if (A.size === 0 || B.size === 0) return 0;
  let comuns = 0;
  for (const p of A) if (B.has(p)) comuns++;
  return comuns / (A.size + B.size - comuns);
}

export function sugerirPergunta(descricao: string | null | undefined, perguntas: PerguntaCandidata[]): Sugestao {
  if (!descricao || !descricao.trim()) return { situacao: "SEM_DESCRICAO" };
  const ordenadas = perguntas
    .map((p) => ({ p, s: semelhanca(descricao, p.enunciado) }))
    .sort((x, y) => y.s - x.s);
  const melhor = ordenadas[0];
  if (!melhor || melhor.s < LIMIAR) return { situacao: "NENHUMA" };
  const topo = ordenadas.filter((c) => c.s >= melhor.s - EMPATE).map((c) => c.p);
  if (topo.length === 1) return { situacao: "UNICA", perguntaId: topo[0].id };
  if (topo.length === 2 && normalizar(topo[0].enunciado) === normalizar(topo[1].enunciado)) {
    const antes = topo.find((p) => /ANTES/i.test(p.enunciado));
    const apos = topo.find((p) => /AP[ÓO]S/i.test(p.enunciado));
    if (antes && apos) return { situacao: "PAR", antesId: antes.id, aposId: apos.id };
  }
  return { situacao: "AMBIGUA", candidatas: topo.map((p) => p.id) };
}

export function sugerirTipo(formula: string, tipoPergunta: PerguntaCandidata["tipo"] | null): TipoSugerido {
  const f = ` ${formula.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()} `;
  const escolha = tipoPergunta === "ESCOLHA_UNICA" || tipoPergunta === "MULTIPLA_ESCOLHA";
  if (!tipoPergunta && /total de/.test(f)) return "CONTAGEM";
  if (tipoPergunta === "NUMERO" && /medi[ao]/.test(f)) return "MEDIA";
  if (escolha && (/ por [a-z]/.test(f) || /distribuicao/.test(f))) return "DISTRIBUICAO";
  if (escolha && (/\/\s*total/.test(f) || /[x×]\s*100/.test(f))) return "PROPORCAO";
  return null;
}
