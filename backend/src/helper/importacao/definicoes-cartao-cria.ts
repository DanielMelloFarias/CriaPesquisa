import type { TipoIndicador } from "../indicadorConfig.js";

/**
 * Definições dos indicadores do Cartão CRIA já decididas com a especialista.
 *
 * Perguntas são citadas pelo enunciado EXATO (copiado de
 * prisma/pesquisas-cartao-cria.ts) e outros indicadores pelo código: os ids do
 * banco mudam de um ambiente para outro. O resolvedor (resolver.ts) troca as
 * referências por ids na hora da importação.
 *
 * A ordem do array é a ordem de dependência: todo `{ indicador }` aponta para
 * um código que aparece antes.
 */

export type RefPergunta = { pergunta: string }; // enunciado exato, na pesquisa da definição
export type RefIndicador = { indicador: string }; // código de outra definição do mapa

export interface DefinicaoConhecida {
  codigo: string;
  nome: string;
  pesquisa: "Cartão CRIA — Criança" | "Cartão CRIA — Gestante";
  idsPlanilha: string[]; // [] = indicador auxiliar, não vem de linha da planilha
  tipo: TipoIndicador;
  config: unknown; // usa RefPergunta / RefIndicador no lugar de ids
  recorte?: { antes: string; apos: string }; // enunciados do par ANTES/APÓS
  apresentacao?: Array<"Escopo" | "Perfil">;
  motivo: string; // motivoIncompleto gravado
}

const CRIANCA = "Cartão CRIA — Criança" as const;
const GESTANTE = "Cartão CRIA — Gestante" as const;

const PRONTA = "definição pronta — conferir e ativar";
const MOTIVO_MORADIA = "conferir a ordem das notas de moradia (proposta: cedida 0 · alugada 50 · própria 100 · outro fora)";

const p = (pergunta: string): RefPergunta => ({ pergunta });
const i = (indicador: string): RefIndicador => ({ indicador });

// ── Enunciados (idênticos ao seed) ──────────────────────────────────────────
// Comuns às duas pesquisas
const TRIA_Q1 = "Nos últimos três meses, os alimentos acabaram antes que você tivesse dinheiro para comprar mais comida?";
const TRIA_Q2 = "Nos últimos três meses, você comeu apenas alguns alimentos que ainda tinha porque o dinheiro acabou?";
const RENDA = "Renda mensal total da família (R$)";
const ESCOLARIDADE = "Escolaridade";
const MORADIA = "Tipo de moradia";

// Criança
const C_CRAS_ANTES = "A criança e a família participam de atividades propostas pelo CRAS? — ANTES do Cartão CRIA";
const C_CRAS_APOS = "A criança e a família participam de atividades propostas pelo CRAS? — APÓS o Cartão CRIA";
const C_VAC_ANTES = "Carteira de vacinação da criança atualizada — ANTES do Cartão CRIA";
const C_VAC_APOS = "Carteira de vacinação da criança atualizada — APÓS o Cartão CRIA";
const C_PUERICULTURA = "Número de consultas de puericultura no último ano";
const C_NASCIMENTO = "Data de nascimento da criança";
const C_SEXO = "Sexo biológico da criança";
const C_PESO = "Peso da criança em kg (atual)";
const C_ALTURA = "Altura da criança em metros (atual)";

// Gestante
const G_CRAS_ANTES = "A gestante e a família participam de atividades propostas pelo CRAS? — ANTES do Cartão CRIA";
const G_CRAS_APOS = "A gestante e a família participam de atividades propostas pelo CRAS? — APÓS o Cartão CRIA";
const G_VACINACAO = "A caderneta/carteira de vacinação da gestante está atualizada conforme orientação da unidade de saúde?";
const G_PRE_NATAL = "Quando iniciou o pré-natal?";
const G_PESO_ATUAL = "Qual é o peso atual da gestante?";
const G_PESO_PRE = "Qual era o peso da gestante antes de engravidar (aproximadamente)?";
const G_ALTURA = "Qual a altura da gestante em metros (atual)?";
const G_SEMANA = "Semana gestacional atual";

// ── Pedaços de config repetidos ─────────────────────────────────────────────
const IMC_EXPRESSAO = { op: "/", esq: { var: "peso" }, dir: { op: "*", esq: { var: "altura" }, dir: { var: "altura" } } };

const NOTAS_ESCOLARIDADE = {
  "Não estudou": 0,
  "Fundamental incompleto": 16.67,
  "Fundamental completo": 33.33,
  "Médio incompleto": 50,
  "Médio completo": 66.67,
  "Superior incompleto": 83.33,
  "Superior completo": 100,
};

const NOTAS_MORADIA = { "Cedida/Ocupação": 0, Alugada: 50, Própria: 100, Outro: null };

const FAIXAS_TRIA = [
  { rotulo: "Sem risco", de: 0, ate: 0.5 },
  { rotulo: "Risco leve", de: 0.5, ate: 1.5 },
  { rotulo: "Risco moderado/alto", de: 1.5, ate: 2 },
];

const FAIXAS_DESENVOLVIMENTO = [
  { rotulo: "Desenvolvimento Crítico", de: 0, ate: 25 },
  { rotulo: "Desenvolvimento Baixo", de: 25, ate: 50 },
  { rotulo: "Desenvolvimento Moderado", de: 50, ate: 75 },
  { rotulo: "Alto Desenvolvimento", de: 75, ate: 100 },
];

const percentilOms = (corte: { abaixoDe: number } | { acimaDe: number }) => ({
  imcIndicadorId: i("C-IMC"),
  nascimentoPerguntaId: p(C_NASCIMENTO),
  sexoPerguntaId: p(C_SEXO),
  opcoesSexo: { masculino: "Masculino", feminino: "Feminino" },
  corte,
});

export const DEFINICOES: DefinicaoConhecida[] = [
  // ── Criança ───────────────────────────────────────────────────────────────
  {
    codigo: "C-VCRAS",
    nome: "% Participação no CRAS",
    pesquisa: CRIANCA,
    idsPlanilha: ["165"],
    tipo: "PROPORCAO",
    config: { perguntaId: p(C_CRAS_ANTES), opcoesNumerador: ["Sim"] },
    recorte: { antes: C_CRAS_ANTES, apos: C_CRAS_APOS },
    apresentacao: ["Escopo"],
    motivo: PRONTA,
  },
  {
    codigo: "C-CVAC",
    nome: "% Vacinação em dia",
    pesquisa: CRIANCA,
    idsPlanilha: ["177"],
    tipo: "PROPORCAO",
    // "Não soube informar" fica no denominador (resposta 6-b).
    config: { perguntaId: p(C_VAC_ANTES), opcoesNumerador: ["Sim"] },
    recorte: { antes: C_VAC_ANTES, apos: C_VAC_APOS },
    apresentacao: ["Escopo"],
    motivo: PRONTA,
  },
  {
    codigo: "C-CPUER",
    nome: "CPUER — consultas de puericultura pela Caderneta",
    pesquisa: CRIANCA,
    idsPlanilha: [],
    tipo: "META_POR_IDADE",
    config: {
      perguntaId: p(C_PUERICULTURA),
      nascimentoPerguntaId: p(C_NASCIMENTO),
      faixas: [
        { deMeses: 0, ateMeses: 12, esperado: 7 },
        { deMeses: 12, ateMeses: 24, esperado: 2 },
        { deMeses: 24, ateMeses: null, esperado: 1 },
      ],
    },
    motivo: PRONTA,
  },
  {
    codigo: "C-MCC",
    nome: "MCC — Média de Condicionalidades da Criança",
    pesquisa: CRIANCA,
    idsPlanilha: ["191"],
    tipo: "COMPOSTO",
    config: {
      termos: [
        { indicadorId: i("C-VCRAS"), peso: 3 },
        { indicadorId: i("C-CVAC"), peso: 5 },
        { indicadorId: i("C-CPUER"), peso: 5 },
      ],
      divisor: 13,
    },
    apresentacao: ["Escopo"],
    motivo: PRONTA,
  },
  {
    codigo: "C-SEG-ALIM",
    nome: "Segurança alimentar (criança)",
    pesquisa: CRIANCA,
    idsPlanilha: [],
    tipo: "CRUZAMENTO",
    // = 100 − TRIA risco (respostas 1-a e 2-a).
    config: {
      condicoes: [
        { perguntaId: p(TRIA_Q1), opcoes: ["Não"] },
        { perguntaId: p(TRIA_Q2), opcoes: ["Não"] },
      ],
    },
    motivo: PRONTA,
  },
  {
    codigo: "C-TRIA-Q1",
    nome: "TRIA — alimentos acabaram (criança)",
    pesquisa: CRIANCA,
    idsPlanilha: [],
    tipo: "ESCALA",
    config: { perguntaId: p(TRIA_Q1), notas: { Sim: 100, Não: 0 } },
    motivo: PRONTA,
  },
  {
    codigo: "C-TRIA-Q2",
    nome: "TRIA — comeu apenas alguns alimentos (criança)",
    pesquisa: CRIANCA,
    idsPlanilha: [],
    tipo: "ESCALA",
    config: { perguntaId: p(TRIA_Q2), notas: { Sim: 100, Não: 0 } },
    motivo: PRONTA,
  },
  {
    codigo: "C-TRIA-SIM",
    nome: 'TRIA — número de "sim" (criança)',
    pesquisa: CRIANCA,
    idsPlanilha: [],
    tipo: "COMPOSTO",
    // 0, 1 ou 2 por criança.
    config: {
      termos: [
        { indicadorId: i("C-TRIA-Q1"), peso: 1 },
        { indicadorId: i("C-TRIA-Q2"), peso: 1 },
      ],
      divisor: 100,
    },
    motivo: PRONTA,
  },
  {
    codigo: "C-TRIA",
    nome: "Índice TRIA (criança)",
    pesquisa: CRIANCA,
    idsPlanilha: ["200"],
    tipo: "CLASSIFICACAO",
    config: { indicadorId: i("C-TRIA-SIM"), faixas: FAIXAS_TRIA },
    apresentacao: ["Escopo", "Perfil"],
    motivo: PRONTA,
  },
  {
    codigo: "C-IDTC",
    nome: "IDTC — Índice de Desenvolvimento Tridimensional das Crianças",
    pesquisa: CRIANCA,
    idsPlanilha: ["vsdvsd1", "199"],
    tipo: "COMPOSTO",
    // IDTC e IDMCC são o mesmo índice (resposta 12).
    config: {
      termos: [
        { indicadorId: i("C-SEG-ALIM"), peso: 1 },
        { indicadorId: i("C-MCC"), peso: 1 },
      ],
      divisor: 2,
    },
    apresentacao: ["Escopo"],
    motivo: PRONTA,
  },
  {
    codigo: "C-IDTC-FAIXAS",
    nome: "Classificação do IDTC",
    pesquisa: CRIANCA,
    idsPlanilha: ["sd51sd", "sd5v4sd45v", "sd5v4sv87", "sdv67vd7v"],
    tipo: "CLASSIFICACAO",
    config: { indicadorId: i("C-IDTC"), faixas: FAIXAS_DESENVOLVIMENTO },
    apresentacao: ["Perfil"],
    motivo: PRONTA,
  },
  {
    codigo: "C-IMC",
    nome: "IMC médio infantil",
    pesquisa: CRIANCA,
    idsPlanilha: ["188"],
    tipo: "DERIVADA",
    config: { variaveis: { peso: p(C_PESO), altura: p(C_ALTURA) }, expressao: IMC_EXPRESSAO },
    apresentacao: ["Perfil"],
    motivo: PRONTA,
  },
  {
    codigo: "C-DESNUT",
    nome: "% Desnutrição infantil",
    pesquisa: CRIANCA,
    idsPlanilha: ["193"],
    tipo: "PERCENTIL_OMS",
    config: percentilOms({ abaixoDe: 10 }),
    apresentacao: ["Escopo"],
    motivo: PRONTA,
  },
  {
    codigo: "C-OBES",
    nome: "% Obesidade infantil",
    pesquisa: CRIANCA,
    idsPlanilha: ["194"],
    tipo: "PERCENTIL_OMS",
    config: percentilOms({ acimaDe: 85 }),
    apresentacao: ["Perfil"],
    motivo: PRONTA,
  },
  {
    codigo: "C-RENDA",
    nome: "Renda média familiar",
    pesquisa: CRIANCA,
    idsPlanilha: ["159"],
    tipo: "MEDIA",
    config: { perguntaId: p(RENDA) },
    apresentacao: ["Escopo"],
    motivo: PRONTA,
  },
  {
    codigo: "C-ESCOL-NOTA",
    nome: "Escolaridade (nota, criança)",
    pesquisa: CRIANCA,
    idsPlanilha: [],
    tipo: "ESCALA",
    config: { perguntaId: p(ESCOLARIDADE), notas: NOTAS_ESCOLARIDADE },
    motivo: PRONTA,
  },
  {
    codigo: "C-MORADIA-NOTA",
    nome: "Moradia (nota, criança)",
    pesquisa: CRIANCA,
    idsPlanilha: [],
    tipo: "ESCALA",
    config: { perguntaId: p(MORADIA), notas: NOTAS_MORADIA },
    motivo: MOTIVO_MORADIA,
  },
  {
    codigo: "C-ISF",
    nome: "Índice Socioeconômico Familiar (criança)",
    pesquisa: CRIANCA,
    idsPlanilha: ["187"],
    tipo: "ZSCORE",
    config: {
      componentes: [
        { indicadorId: i("C-RENDA"), peso: 1 },
        { indicadorId: i("C-ESCOL-NOTA"), peso: 1 },
        { indicadorId: i("C-MORADIA-NOTA"), peso: 1 },
      ],
    },
    apresentacao: ["Escopo"],
    motivo: MOTIVO_MORADIA,
  },
  {
    // Forma válida só para gravar: DEFINICAO_INCOMPLETA impede o cálculo.
    // Gravado com pesquisaId = null (é média entre as duas pesquisas).
    codigo: "MCB",
    nome: "MCB — Média de Condicionalidades dos Beneficiários",
    pesquisa: CRIANCA,
    idsPlanilha: ["192", "241"],
    tipo: "COMPOSTO",
    config: { termos: [{ indicadorId: i("C-MCC"), peso: 1 }], divisor: 1 },
    apresentacao: ["Escopo"],
    motivo: "MCB é média entre crianças e gestantes; o motor calcula por indivíduo e ainda não tem agregação entre pesquisas",
  },

  // ── Gestante ──────────────────────────────────────────────────────────────
  {
    codigo: "G-VCRAS",
    nome: "% Participação em atividades do CRAS",
    pesquisa: GESTANTE,
    idsPlanilha: ["210"],
    tipo: "PROPORCAO",
    config: { perguntaId: p(G_CRAS_ANTES), opcoesNumerador: ["Sim"] },
    recorte: { antes: G_CRAS_ANTES, apos: G_CRAS_APOS },
    apresentacao: ["Escopo"],
    motivo: PRONTA,
  },
  {
    codigo: "G-CVAC",
    nome: "Vacinação da gestante em dia",
    pesquisa: GESTANTE,
    idsPlanilha: [],
    tipo: "PROPORCAO",
    config: { perguntaId: p(G_VACINACAO), opcoesNumerador: ["Sim, está atualizada"] },
    motivo: PRONTA,
  },
  {
    codigo: "G-VAC-ATRASO",
    nome: "% Vacinação desatualizada",
    pesquisa: GESTANTE,
    idsPlanilha: ["234"],
    tipo: "PROPORCAO",
    config: { perguntaId: p(G_VACINACAO), opcoesNumerador: ["Não, está atrasada"] },
    apresentacao: ["Escopo"],
    motivo: PRONTA,
  },
  {
    codigo: "G-CPRE",
    nome: "CPRE — início do pré-natal",
    pesquisa: GESTANTE,
    idsPlanilha: [],
    tipo: "ESCALA",
    // Resposta 5-a.
    config: {
      perguntaId: p(G_PRE_NATAL),
      notas: {
        "Iniciou antes de 12 semanas (3 meses)": 100,
        "Iniciou após 12 semanas (3 meses)": 50,
        "Sem pré-natal": 0,
        "Não soube informar": null,
      },
    },
    motivo: PRONTA,
  },
  {
    codigo: "G-MCG",
    nome: "MCG — Média de Condicionalidades da Gestante",
    pesquisa: GESTANTE,
    idsPlanilha: ["240"],
    tipo: "COMPOSTO",
    config: {
      termos: [
        { indicadorId: i("G-VCRAS"), peso: 3 },
        { indicadorId: i("G-CVAC"), peso: 5 },
        { indicadorId: i("G-CPRE"), peso: 5 },
      ],
      divisor: 13,
    },
    apresentacao: ["Escopo"],
    motivo: PRONTA,
  },
  {
    codigo: "G-SEG-ALIM",
    nome: "Segurança alimentar (gestante)",
    pesquisa: GESTANTE,
    idsPlanilha: [],
    tipo: "CRUZAMENTO",
    config: {
      condicoes: [
        { perguntaId: p(TRIA_Q1), opcoes: ["Não"] },
        { perguntaId: p(TRIA_Q2), opcoes: ["Não"] },
      ],
    },
    motivo: PRONTA,
  },
  {
    codigo: "G-TRIA-Q1",
    nome: "TRIA — alimentos acabaram (gestante)",
    pesquisa: GESTANTE,
    idsPlanilha: [],
    tipo: "ESCALA",
    config: { perguntaId: p(TRIA_Q1), notas: { Sim: 100, Não: 0 } },
    motivo: PRONTA,
  },
  {
    codigo: "G-TRIA-Q2",
    nome: "TRIA — comeu apenas alguns alimentos (gestante)",
    pesquisa: GESTANTE,
    idsPlanilha: [],
    tipo: "ESCALA",
    config: { perguntaId: p(TRIA_Q2), notas: { Sim: 100, Não: 0 } },
    motivo: PRONTA,
  },
  {
    codigo: "G-TRIA-SIM",
    nome: 'TRIA — número de "sim" (gestante)',
    pesquisa: GESTANTE,
    idsPlanilha: [],
    tipo: "COMPOSTO",
    config: {
      termos: [
        { indicadorId: i("G-TRIA-Q1"), peso: 1 },
        { indicadorId: i("G-TRIA-Q2"), peso: 1 },
      ],
      divisor: 100,
    },
    motivo: PRONTA,
  },
  {
    codigo: "G-TRIA",
    nome: "Índice TRIA (gestante)",
    pesquisa: GESTANTE,
    idsPlanilha: ["250"],
    tipo: "CLASSIFICACAO",
    config: { indicadorId: i("G-TRIA-SIM"), faixas: FAIXAS_TRIA },
    apresentacao: ["Escopo", "Perfil"],
    motivo: PRONTA,
  },
  {
    codigo: "G-INSEG",
    nome: "% Insegurança alimentar",
    pesquisa: GESTANTE,
    idsPlanilha: ["243"],
    tipo: "CLASSIFICACAO",
    config: {
      indicadorId: i("G-TRIA-SIM"),
      faixas: [
        { rotulo: "Sem insegurança", de: 0, ate: 0.5 },
        { rotulo: "Com insegurança", de: 0.5, ate: 2 },
      ],
    },
    apresentacao: ["Escopo", "Perfil"],
    motivo: PRONTA,
  },
  {
    codigo: "G-ESCALA-INSEG",
    nome: "Escala de insegurança alimentar",
    pesquisa: GESTANTE,
    idsPlanilha: ["244"],
    tipo: "CLASSIFICACAO",
    // Resposta 3-a.
    config: {
      indicadorId: i("G-TRIA-SIM"),
      faixas: [
        { rotulo: "Sem insegurança", de: 0, ate: 0.5 },
        { rotulo: "Média", de: 0.5, ate: 1.5 },
        { rotulo: "Grave", de: 1.5, ate: 2 },
      ],
    },
    apresentacao: ["Escopo", "Perfil"],
    motivo: PRONTA,
  },
  {
    codigo: "G-IMC",
    nome: "IMC médio gestante (atual)",
    pesquisa: GESTANTE,
    idsPlanilha: ["245"],
    tipo: "DERIVADA",
    config: { variaveis: { peso: p(G_PESO_ATUAL), altura: p(G_ALTURA) }, expressao: IMC_EXPRESSAO },
    motivo: PRONTA,
  },
  {
    codigo: "G-IMC-PRE",
    nome: "IMC pré-gestacional",
    pesquisa: GESTANTE,
    idsPlanilha: [],
    tipo: "DERIVADA",
    config: { variaveis: { peso: p(G_PESO_PRE), altura: p(G_ALTURA) }, expressao: IMC_EXPRESSAO },
    motivo: PRONTA,
  },
  {
    codigo: "G-IMC-PRE-CLASSE",
    nome: "Classificação do IMC pré-gestacional",
    pesquisa: GESTANTE,
    idsPlanilha: [],
    tipo: "CLASSIFICACAO",
    // Resposta 11.
    config: {
      indicadorId: i("G-IMC-PRE"),
      faixas: [
        { rotulo: "Baixo peso", de: 0, ate: 18.5 },
        { rotulo: "Eutrofia", de: 18.5, ate: 25 },
        { rotulo: "Sobrepeso", de: 25, ate: 30 },
        { rotulo: "Obesidade", de: 30, ate: 100 },
      ],
    },
    apresentacao: ["Perfil"],
    motivo: PRONTA,
  },
  {
    codigo: "G-ATALAH",
    nome: "Estado nutricional da gestante (Atalah)",
    pesquisa: GESTANTE,
    idsPlanilha: [],
    tipo: "ATALAH",
    config: { imcIndicadorId: i("G-IMC"), semanaPerguntaId: p(G_SEMANA) },
    apresentacao: ["Perfil"],
    motivo: PRONTA,
  },
  {
    codigo: "G-RENDA",
    nome: "Renda média familiar (gestante)",
    pesquisa: GESTANTE,
    idsPlanilha: ["221"],
    tipo: "MEDIA",
    config: { perguntaId: p(RENDA) },
    apresentacao: ["Escopo"],
    motivo: PRONTA,
  },
  {
    codigo: "G-ESCOL-NOTA",
    nome: "Escolaridade (nota, gestante)",
    pesquisa: GESTANTE,
    idsPlanilha: [],
    tipo: "ESCALA",
    config: { perguntaId: p(ESCOLARIDADE), notas: NOTAS_ESCOLARIDADE },
    motivo: PRONTA,
  },
  {
    codigo: "G-MORADIA-NOTA",
    nome: "Moradia (nota, gestante)",
    pesquisa: GESTANTE,
    idsPlanilha: [],
    tipo: "ESCALA",
    config: { perguntaId: p(MORADIA), notas: NOTAS_MORADIA },
    motivo: MOTIVO_MORADIA,
  },
  {
    codigo: "G-ISF",
    nome: "Índice Socioeconômico Familiar (gestante)",
    pesquisa: GESTANTE,
    idsPlanilha: ["247"],
    tipo: "ZSCORE",
    config: {
      componentes: [
        { indicadorId: i("G-RENDA"), peso: 1 },
        { indicadorId: i("G-ESCOL-NOTA"), peso: 1 },
        { indicadorId: i("G-MORADIA-NOTA"), peso: 1 },
      ],
    },
    apresentacao: ["Escopo"],
    motivo: MOTIVO_MORADIA,
  },
  {
    codigo: "G-IDMG",
    nome: "Índice de Desenvolvimento Multidimensional das Gestantes",
    pesquisa: GESTANTE,
    idsPlanilha: ["249"],
    tipo: "COMPOSTO",
    config: {
      termos: [
        { indicadorId: i("G-SEG-ALIM"), peso: 1 },
        { indicadorId: i("G-MCG"), peso: 1 },
      ],
      divisor: 2,
    },
    apresentacao: ["Escopo"],
    motivo: "a planilha repete a fórmula do MCG; proposta por analogia ao IDTC: (Segurança Alimentar + MCG) ÷ 2 — confirmar",
  },
  {
    codigo: "G-IDMG-FAIXAS",
    nome: "Classificação do IDMG",
    pesquisa: GESTANTE,
    idsPlanilha: ["6sdv4", "s5v6sv9", "6sdv67", "sdv6v444v"],
    tipo: "CLASSIFICACAO",
    config: { indicadorId: i("G-IDMG"), faixas: FAIXAS_DESENVOLVIMENTO },
    apresentacao: ["Perfil"],
    motivo: "depende da confirmação do IDMG",
  },
];
