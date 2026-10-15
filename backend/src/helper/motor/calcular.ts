import {
  validarConfig,
  perguntasReferenciadas,
  indicadoresReferenciados,
  type ConfigIndicador,
  type TipoIndicador,
} from "../indicadorConfig.js";
import { ordenarPorDependencia } from "../dependencias.js";
import { avaliar, opcaoSemNota } from "./avaliadores.js";
import { agregar, classificar, agregarDistribuicao, type ResultadoIndicador } from "./agregacao.js";
import { estatisticas } from "./padronizacao.js";
import { classificarAtalah, FAIXAS_ATALAH } from "./referencias/atalah.js";
import { imcPlausivel } from "./imc.js";
import type { RespostaAvaliavel, ValorIndividual } from "./tipos.js";

/**
 * Orquestração do motor: avalia cada indicador por indivíduo, na ordem de
 * dependência, aplica o recorte ANTES/APÓS e agrega.
 *
 * Regra que atravessa tudo: lacuna de definição nunca vira número. Indicador
 * incompleto — e todo mundo que depende dele — sai INCOMPLETO, apontando o
 * indicador que trava a cadeia. Ciclo gravado no banco não é lacuna, é dado
 * corrompido: `ordenarPorDependencia` lança `CicloDetectado` e o cálculo para.
 */

export interface IndicadorParaCalculo {
  id: string;
  codigo: string;
  tipo: TipoIndicador;
  config: unknown;
  casasDecimais: number;
  status: "ATIVO" | "DEFINICAO_INCOMPLETA" | "INATIVO";
  motivoIncompleto?: string | null;
  /** Com pesquisaId, o indicador só considera respostas dessa pesquisa; sem, todas. */
  pesquisaId: string | null;
  recorte?: "ANTES_APOS" | null;
  recorteConfig?: { substituicoes: Array<{ de: string; para: string }> } | null;
}

export type ResultadoComRecorte = ResultadoIndicador | { antes: ResultadoIndicador; apos: ResultadoIndicador };

type Substituicoes = Array<{ de: string; para: string }>;

/** Tipos que só existem na agregação: `avaliar` devolve null para eles (avaliadores.ts). */
const TIPOS_SEM_VALOR_INDIVIDUAL: ReadonlySet<TipoIndicador> = new Set([
  "CLASSIFICACAO",
  "CONTAGEM",
  "DISTRIBUICAO",
  "ATALAH",
]);

/** Tipos que podem fornecer o IMC (kg/m²) de PERCENTIL_OMS e ATALAH. */
const TIPOS_IMC: ReadonlySet<TipoIndicador> = new Set(["MEDIA", "DERIVADA"]);

/** Troca as perguntas do recorte, para avaliar o mesmo indicador no outro cenário. */
export function aplicarSubstituicoes(config: ConfigIndicador, substituicoes: Substituicoes): ConfigIndicador {
  const mapa = new Map(substituicoes.map((s) => [s.de, s.para]));
  const trocar = (id: string) => mapa.get(id) ?? id;

  switch (config.tipo) {
    case "PROPORCAO":
    case "MEDIA":
    case "DISTRIBUICAO":
      return { ...config, perguntaId: trocar(config.perguntaId) };
    case "CRUZAMENTO":
      return { ...config, condicoes: config.condicoes.map((c) => ({ ...c, perguntaId: trocar(c.perguntaId) })) };
    case "ESCALA":
      return { ...config, perguntaId: trocar(config.perguntaId) };
    case "META_POR_IDADE":
      return { ...config, perguntaId: trocar(config.perguntaId), nascimentoPerguntaId: trocar(config.nascimentoPerguntaId) };
    case "PERCENTIL_OMS":
      return { ...config, nascimentoPerguntaId: trocar(config.nascimentoPerguntaId), sexoPerguntaId: trocar(config.sexoPerguntaId) };
    case "ATALAH":
      return { ...config, semanaPerguntaId: trocar(config.semanaPerguntaId) };
    case "DERIVADA":
      return {
        ...config,
        variaveis: Object.fromEntries(Object.entries(config.variaveis).map(([k, v]) => [k, trocar(v)])),
      };
    default:
      // COMPOSTO e CLASSIFICACAO não leem pergunta: o cenário APÓS deles vem das dependências.
      return config;
  }
}

type LerValores = (indicadorId: string) => ValorIndividual[] | undefined;

/**
 * `noEscopo[i]` diz se a resposta i é da pesquisa do indicador e está na
 * máscara do painel. Os vetores
 * nunca são filtrados — só anulados —, para que valores[i] continue sendo
 * a resposta i em quem depende deste indicador.
 */
function agregarPorTipo(
  config: ConfigIndicador,
  valores: ValorIndividual[],
  respostas: RespostaAvaliavel[],
  noEscopo: boolean[],
  casasDecimais: number,
  lerValores: LerValores,
): ResultadoIndicador {
  switch (config.tipo) {
    case "CLASSIFICACAO":
      return classificar(
        (lerValores(config.indicadorId) ?? []).map((v, i) => (noEscopo[i] ? v : null)),
        config.faixas,
        casasDecimais,
      );
    case "DISTRIBUICAO":
      return agregarDistribuicao(
        respostas.map((r, i) => (noEscopo[i] ? r.itens.get(config.perguntaId)?.opcoesSelecionadas ?? [] : [])),
        casasDecimais,
      );
    case "CONTAGEM":
      // Não há valor individual: cada resposta da pesquisa conta uma vez.
      return agregar(config, noEscopo.map((dentro) => (dentro ? 1 : null)), casasDecimais);
    case "ATALAH": {
      // Cada gestante cai numa das quatro faixas da semana dela. Reaproveita o
      // `classificar` (maior resto) com a posição da faixa como valor: 0.5, 1.5, ...
      const imcs = lerValores(config.imcIndicadorId) ?? [];
      const posicoes = respostas.map((r, i) => {
        if (!noEscopo[i]) return null;
        const imc = imcs[i];
        const semana = r.itens.get(config.semanaPerguntaId)?.valorNumero;
        if (imc === null || imc === undefined || typeof semana !== "number") return null;
        // IMC fora de [8, 60] ou não finito não é medida (altura em cm dá ≈ 0,002):
        // sem isto cairia em "Baixo peso" ou "Obesidade".
        if (!imcPlausivel(imc)) return null;
        const faixa = classificarAtalah(imc, semana);
        return faixa === null ? null : FAIXAS_ATALAH.indexOf(faixa) + 0.5;
      });
      return classificar(
        posicoes,
        FAIXAS_ATALAH.map((rotulo, i) => ({ rotulo, de: i, ate: i + 1 })),
        casasDecimais,
      );
    }
    default:
      return agregar(config, valores, casasDecimais);
  }
}

export function calcular(
  indicadores: IndicadorParaCalculo[],
  respostas: RespostaAvaliavel[],
  perguntasExistentes: Set<string>,
  mascara: boolean[] = respostas.map(() => true),
): Map<string, ResultadoComRecorte> {
  const porId = new Map(indicadores.map((i) => [i.id, i]));

  const grafo = new Map<string, string[]>();
  for (const indicador of indicadores) {
    try {
      grafo.set(indicador.id, indicadoresReferenciados(validarConfig(indicador.tipo, indicador.config)));
    } catch {
      // Config inválida não impede a ordenação; vira INCOMPLETO adiante.
      grafo.set(indicador.id, []);
    }
  }

  const resultados = new Map<string, ResultadoComRecorte>();
  const valoresAntes = new Map<string, ValorIndividual[]>();
  // Indicadores pareados: os de recorte próprio e os que herdaram o par de uma dependência.
  const valoresApos = new Map<string, ValorIndividual[]>();
  const incompletos = new Map<string, string>(); // id -> id do indicador que trava a cadeia

  const marcarIncompleto = (id: string, motivo: string, raiz: string, dependencia?: string) => {
    resultados.set(id, dependencia ? { status: "INCOMPLETO", motivo, dependencia } : { status: "INCOMPLETO", motivo });
    incompletos.set(id, raiz);
  };

  for (const id of ordenarPorDependencia(grafo)) {
    const indicador = porId.get(id)!;

    // 1. Marcado como incompleto no cadastro. Vem antes da validação: um indicador
    //    pendente costuma ter config pela metade, e o motivo do cadastro é o que importa.
    if (indicador.status === "DEFINICAO_INCOMPLETA") {
      marcarIncompleto(id, indicador.motivoIncompleto ?? "definição pendente", id);
      continue;
    }

    // 2. Config que não valida é definição incompleta, não exceção.
    let config: ConfigIndicador;
    try {
      config = validarConfig(indicador.tipo, indicador.config);
    } catch {
      marcarIncompleto(id, "configuração inválida", id);
      continue;
    }

    // 3. Aponta para pergunta que não existe mais.
    const faltando = perguntasReferenciadas(config).find((p) => !perguntasExistentes.has(p));
    if (faltando) {
      marcarIncompleto(id, `pergunta ${faltando} não existe mais`, id);
      continue;
    }

    // Fora da pesquisa do indicador vale como branco. A avaliação usa `daPesquisa`
    // (a referência do ZSCORE é a pesquisa inteira); a agregação usa `noEscopo`,
    // que também respeita a máscara do painel.
    const daPesquisa = respostas.map((r) => indicador.pesquisaId == null || r.pesquisaId === indicador.pesquisaId);

    // 3b. Escala que não conhece uma opção marcada: a pergunta ganhou opção depois
    //     do cadastro. Tratar como branco tiraria gente do denominador em silêncio.
    if (config.tipo === "ESCALA") {
      const semNota = opcaoSemNota(config, respostas.filter((_, i) => daPesquisa[i]));
      if (semNota) {
        marcarIncompleto(id, `opção "${semNota}" sem nota na escala`, id);
        continue;
      }
    }

    // 4. Dependência fora do conjunto calculado (inativa, apagada): sem ela não há número.
    const dependencias = indicadoresReferenciados(config);
    const ausente = dependencias.find((dep) => !porId.has(dep));
    if (ausente) {
      marcarIncompleto(id, `depende de ${ausente}, que não está disponível`, ausente, ausente);
      continue;
    }

    // 5. Depende de alguém incompleto: a lacuna propaga, nunca vira zero. O link
    //    aponta para a raiz — quem trava a cadeia —, não para o intermediário.
    const travado = dependencias.find((dep) => incompletos.has(dep));
    if (travado) {
      const raiz = incompletos.get(travado)!;
      marcarIncompleto(id, `depende de ${raiz}`, raiz, raiz);
      continue;
    }

    // 5b. Dependência de tipo que não tem valor por indivíduo: o dependente leria só
    //     nulos e sairia "sem dados" em silêncio. O cadastro não impede (o tipo da
    //     dependência pode mudar depois), então o motor recusa aqui. A definição
    //     quebrada é a deste indicador: ele é a raiz para quem vier acima.
    const semValorIndividual = dependencias.find((dep) => TIPOS_SEM_VALOR_INDIVIDUAL.has(porId.get(dep)!.tipo));
    if (semValorIndividual) {
      const tipo = porId.get(semValorIndividual)!.tipo;
      marcarIncompleto(
        id,
        `depende de ${semValorIndividual}, do tipo ${tipo}, que não tem valor por indivíduo`,
        id,
        semValorIndividual,
      );
      continue;
    }

    // 5c. ZSCORE não está em 0–100: somá-lo num COMPOSTO ou classificá-lo em faixas
    //     de 0–100 daria número plausível e errado.
    if (config.tipo === "COMPOSTO" || config.tipo === "CLASSIFICACAO") {
      const zDep = dependencias.find((dep) => porId.get(dep)!.tipo === "ZSCORE");
      if (zDep) {
        marcarIncompleto(id, `depende de ${zDep}, que não está em 0–100`, id, zDep);
        continue;
      }
    }

    // 5d. PERCENTIL_OMS e ATALAH comparam o IMC com tabelas em kg/m². IMC é pergunta
    //     numérica (MEDIA) ou peso÷altura² (DERIVADA); qualquer outro tipo (z-score,
    //     0–100, …) daria número plausível e errado.
    if (config.tipo === "PERCENTIL_OMS" || config.tipo === "ATALAH") {
      const dep = config.imcIndicadorId;
      const tipo = porId.get(dep)!.tipo;
      if (!TIPOS_IMC.has(tipo)) {
        marcarIncompleto(id, `depende de ${dep}, do tipo ${tipo}, que não é um IMC`, id, dep);
        continue;
      }
    }

    // 6. Recorte ANTES/APÓS: o par precisa existir de fato.
    const pareado = indicador.recorte === "ANTES_APOS";
    const depPareada = dependencias.find((dep) => valoresApos.has(dep));
    let configApos: ConfigIndicador | null = null;

    if (!pareado && depPareada) {
      // O recorte propaga sozinho: quem consome um indicador pareado também sai
      // pareado, cada lado calculado com o lado correspondente da dependência.
      // Escolher um lado em silêncio daria número plausível e errado.
      configApos = config;
    }

    if (pareado) {
      const substituicoes: Substituicoes = indicador.recorteConfig?.substituicoes ?? [];
      const usadas = perguntasReferenciadas(config);
      const naoUsada = substituicoes.find((s) => !usadas.includes(s.de));
      if (naoUsada) {
        marcarIncompleto(id, `recorte troca a pergunta ${naoUsada.de}, que o indicador não usa`, id);
        continue;
      }
      if (substituicoes.length === 0 && !depPareada) {
        // Antes e depois sairiam iguais: dois números plausíveis e errados.
        marcarIncompleto(id, "recorte ANTES/APÓS sem par de perguntas definido", id);
        continue;
      }
      configApos = aplicarSubstituicoes(config, substituicoes);
      const faltandoApos = perguntasReferenciadas(configApos).find((p) => !perguntasExistentes.has(p));
      if (faltandoApos) {
        marcarIncompleto(id, `pergunta ${faltandoApos} não existe mais`, id);
        continue;
      }
      // 6b. A mesma regra do 3b no cenário APÓS: a pergunta trocada também pode ter
      //     ganhado opção sem nota, e o APÓS sairia com o denominador encolhido.
      if (configApos.tipo === "ESCALA") {
        const semNotaApos = opcaoSemNota(configApos, respostas.filter((_, i) => daPesquisa[i]));
        if (semNotaApos) {
          marcarIncompleto(id, `opção "${semNotaApos}" sem nota na escala`, id);
          continue;
        }
      }
    }

    const noEscopo = daPesquisa.map((dentro, i) => dentro && mascara[i] === true);

    const calcularCenario = (cfg: ConfigIndicador, lerValores: LerValores) => {
      // ZSCORE: a referência de cada componente é a pesquisa inteira do indicador
      // (daPesquisa), nunca a máscara do painel — senão a média do recorte seria zero.
      // `lerValores` é o do cenário: no pareado, o APÓS padroniza contra o APÓS.
      const referencias =
        cfg.tipo === "ZSCORE"
          ? cfg.componentes.map((c) => {
              const vetor = lerValores(c.indicadorId) ?? [];
              const base = vetor.filter((v, i): v is number => daPesquisa[i] && v !== null && Number.isFinite(v));
              return { ...c, vetor, est: estatisticas(base) };
            })
          : null;

      const valores = respostas.map((resposta, indice) => {
        if (!daPesquisa[indice]) return null;
        if (referencias) {
          let soma = 0;
          let pesos = 0;
          for (const c of referencias) {
            const v = c.vetor[indice];
            if (!c.est || v === null || v === undefined) return null;
            soma += ((v - c.est.media) / c.est.desvio) * c.peso;
            pesos += c.peso;
          }
          return soma / pesos;
        }
        const deps = new Map<string, ValorIndividual>();
        for (const depId of dependencias) {
          // Posição, não busca: o valor do MCC da criança i está em valores[i].
          deps.set(depId, lerValores(depId)?.[indice] ?? null);
        }
        return avaliar(cfg, resposta, deps);
      });
      // `valores` (sem máscara) é o que os dependentes leem; só a agregação é mascarada.
      const naAgregacao = valores.map((v, i) => (noEscopo[i] ? v : null));
      return { valores, resultado: agregarPorTipo(cfg, naAgregacao, respostas, noEscopo, indicador.casasDecimais, lerValores) };
    };

    const antes = calcularCenario(config, (dep) => valoresAntes.get(dep));
    valoresAntes.set(id, antes.valores);

    if (configApos) {
      // No cenário APÓS, dependência pareada contribui com o APÓS dela; a não pareada é a mesma nos dois.
      const apos = calcularCenario(configApos, (dep) => valoresApos.get(dep) ?? valoresAntes.get(dep));
      valoresApos.set(id, apos.valores);
      resultados.set(id, { antes: antes.resultado, apos: apos.resultado });
    } else {
      resultados.set(id, antes.resultado);
    }
  }

  return resultados;
}
