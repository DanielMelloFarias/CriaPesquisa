// Fonte da verdade das pesquisas reais do Cartão CRIA (Criança e Gestante).
// Usado pelo seed (prisma/seed.ts) e pelos scripts de (re)criação
// (scripts/pesquisa-*-completa.ts). Fiel aos formulários oficiais do Google Forms.
//
// Convenções de modelagem (o sistema não tem tipo "grade/matriz"):
//  - Grades "Antes/Após o Cartão CRIA" e "Gestação anterior/atual" → 1 pergunta por linha.
//  - Grade de nota (1–5) por dimensão → 1 pergunta NUMERO por dimensão.
//  - Grade de caixas (marcar vários) → MULTIPLA_ESCOLHA por linha.
//  - Opção "Outro:" do Forms → opção "Outro" (sem campo de texto acoplado).
//  - Escalas 1–5 e 0–10 → NUMERO (permite média/funil no painel).
import type { TipoPergunta } from "@prisma/client";
import { prisma } from "../src/config/prisma.js";

export type PerguntaDef = { enunciado: string; tipo: TipoPergunta; obrigatoria?: boolean; opcoes?: string[]; ajuda?: string };
export type SecaoDef = { titulo: string; descricao?: string; perguntas: PerguntaDef[] };

// ── Listas reutilizadas ──────────────────────────────────────────────────────
const simNao = ["Sim", "Não"];
const racaOpts = ["Branca", "Preta", "Parda", "Amarelo", "Indígena"];
const freqRefeicoes = ["Sempre", "Quase sempre", "Raramente", "Nunca"];
const beneficios = ["Bolsa Família", "Incentivo Municipal", "BPC"];
const visitas = ["Sim, pouca frequência", "Sim, muita frequência", "Não"];
const sexoBio = ["Masculino", "Feminino", "Intersexo"];
const escolaridade = ["Não estudou", "Fundamental incompleto", "Fundamental completo", "Médio incompleto", "Médio completo", "Superior incompleto", "Superior completo"];
const gruposPopulacionais = [
  "Família Agricultores", "Família de Assentamento (Movimento MST)", "Família Acampada",
  "Família de Catadores de Material Reciclável", "Família de Comunidade Tradicional de Terreiro",
  "Família de Pescadores", "Família Ribeirinha", "Família Extrativista", "Família Romani (Cigana)",
  "Família de Preso do Sistema Carcerário", "Família Quilombola",
  "Família Atingida por Empreendimentos de Infraestrutura",
  "Família Beneficiária do Programa Nacional do Crédito Fundiário", "Família Indígena",
  "Famílias refugiadas ou imigrantes internacionais", "Família em situação de rua", "Nenhuma", "Outro",
];
const dificuldades = [
  "Bloqueio ou suspensão do benefício", "Atraso no pagamento",
  "Dificuldade de transporte para sacar ou utilizar o benefício",
  "Falta de informações claras sobre regras e condicionalidades",
  "Dificuldade de acesso ou atendimento no CRAS", "Problemas no Aplicativo CAIXA TEM",
  "Não há dificuldade", "Outro",
];

// 102 municípios de Alagoas.
export const MUNICIPIOS_AL = [
  "Água Branca", "Anadia", "Arapiraca", "Atalaia", "Barra de Santo Antônio", "Barra de São Miguel",
  "Batalha", "Belém", "Belo Monte", "Boca da Mata", "Branquinha", "Cacimbinhas", "Cajueiro", "Campestre",
  "Campo Alegre", "Campo Grande", "Canapi", "Capela", "Carneiros", "Chã Preta", "Coité do Nóia",
  "Colônia Leopoldina", "Coqueiro Seco", "Coruripe", "Craíbas", "Delmiro Gouveia", "Dois Riachos",
  "Estrela de Alagoas", "Feira Grande", "Feliz Deserto", "Flexeiras", "Girau do Ponciano", "Ibateguara",
  "Igaci", "Igreja Nova", "Inhapi", "Jacaré dos Homens", "Jacuípe", "Japaratinga", "Jaramataia",
  "Jequiá da Praia", "Joaquim Gomes", "Jundiá", "Junqueiro", "Lagoa da Canoa", "Limoeiro de Anadia",
  "Maceió", "Major Isidoro", "Mar Vermelho", "Maragogi", "Maravilha", "Marechal Deodoro", "Maribondo",
  "Mata Grande", "Matriz de Camaragibe", "Messias", "Minador do Negrão", "Monteirópolis", "Murici",
  "Novo Lino", "Olho d'Água das Flores", "Olho d'Água do Casado", "Olho d'Água Grande", "Olivença",
  "Ouro Branco", "Palestina", "Palmeira dos Índios", "Pão de Açúcar", "Pariconha", "Paripueira",
  "Passo de Camaragibe", "Paulo Jacinto", "Penedo", "Piaçabuçu", "Pilar", "Pindoba", "Piranhas",
  "Poço das Trincheiras", "Porto Calvo", "Porto de Pedras", "Porto Real do Colégio", "Quebrangulo",
  "Rio Largo", "Roteiro", "Santa Luzia do Norte", "Santana do Ipanema", "Santana do Mundaú", "São Brás",
  "São José da Laje", "São José da Tapera", "São Luís do Quitunde", "São Miguel dos Campos",
  "São Miguel dos Milagres", "São Sebastião", "Satuba", "Senador Rui Palmeira", "Tanque d'Arca",
  "Taquarana", "Teotônio Vilela", "Traipu", "União dos Palmares", "Viçosa",
];

// ── Pesquisa: Cartão CRIA — Criança ─────────────────────────────────────────
export const secoesCrianca: SecaoDef[] = [
  {
    titulo: "Identificação",
    perguntas: [
      { enunciado: "Nome completo da entrevistado(a)", tipo: "TEXTO", obrigatoria: true },
      { enunciado: "CPF", tipo: "TEXTO", obrigatoria: true },
      { enunciado: "NIS", tipo: "TEXTO" },
      { enunciado: "Zona", tipo: "ESCOLHA_UNICA", opcoes: ["Rural", "Urbana"] },
      { enunciado: "Município", tipo: "TEXTO" },
      { enunciado: "Grau de parentesco da beneficiário(a) com a criança", tipo: "ESCOLHA_UNICA", opcoes: ["Mãe", "Pai", "Avós", "Outro"] },
      { enunciado: "Orientação sexual", tipo: "ESCOLHA_UNICA", opcoes: ["Heterossexual", "Homossexual", "Bissexual", "Assexual", "Pansexual"] },
      { enunciado: "Sexo biológico", tipo: "ESCOLHA_UNICA", opcoes: sexoBio },
      { enunciado: "Identidade de gênero", tipo: "ESCOLHA_UNICA", opcoes: ["Cisgênero", "Transgênero", "Outro"] },
      { enunciado: "Idade", tipo: "NUMERO" },
      { enunciado: "Raça", tipo: "ESCOLHA_UNICA", opcoes: racaOpts },
      { enunciado: "Estado civil", tipo: "ESCOLHA_UNICA", opcoes: ["Solteira", "Casada/União estável", "Separada", "Viúva", "Outro"] },
      { enunciado: "Escolaridade", tipo: "ESCOLHA_UNICA", opcoes: escolaridade },
      { enunciado: "A família pertence a Grupos Populacionais Tradicionais e Específicos?", tipo: "ESCOLHA_UNICA", opcoes: gruposPopulacionais },
      { enunciado: "Nome da criança", tipo: "TEXTO" },
      { enunciado: "CPF da criança", tipo: "TEXTO" },
      { enunciado: "Data de nascimento da criança", tipo: "DATA" },
      { enunciado: "Sexo biológico da criança", tipo: "ESCOLHA_UNICA", opcoes: sexoBio },
    ],
  },
  {
    titulo: "Perfil da criança (Desenvolvimento e Educação)",
    perguntas: [
      { enunciado: "A criança está na educação infantil", tipo: "ESCOLHA_UNICA", opcoes: ["Creche CRIA", "Creche (Outra)", "Pré-escola", "Não faz parte a nenhum grupo"] },
    ],
  },
  {
    titulo: "Condições Socioeconômicas",
    perguntas: [
      { enunciado: "Número de pessoas na residência", tipo: "NUMERO" },
      { enunciado: "Quantas crianças de 0–6 anos no domicílio", tipo: "NUMERO" },
      { enunciado: "Renda mensal total da família (R$)", tipo: "NUMERO" },
      { enunciado: "Benefícios que a criança/família recebia ANTES do Cartão CRIA (federal/estadual/municipal)", tipo: "MULTIPLA_ESCOLHA", opcoes: beneficios },
      { enunciado: "Benefícios que a criança/família recebe APÓS o Cartão CRIA (federal/estadual/municipal)", tipo: "MULTIPLA_ESCOLHA", opcoes: beneficios },
      { enunciado: "Ocupação do responsável principal", tipo: "ESCOLHA_UNICA", opcoes: ["Empregado, formal", "Empregado, informal", "Desempregado", "Aposentado", "Estudante"] },
      { enunciado: "Tipo de moradia", tipo: "ESCOLHA_UNICA", opcoes: ["Própria", "Alugada", "Cedida/Ocupação", "Outro"] },
      { enunciado: "Em que dia, mês e ano você fez o cadastro/atualização no CRAS para solicitar o Cartão CRIA?", tipo: "DATA", obrigatoria: true },
      { enunciado: "Em que dia, mês e ano você começou a receber o benefício do Cartão CRIA?", tipo: "DATA", obrigatoria: true },
      { enunciado: "Há quanto tempo a família recebe o benefício do Cartão CRIA?", tipo: "ESCOLHA_UNICA", obrigatoria: true, opcoes: ["Menos de 6 meses", "Entre 6 meses - 1 ano", "Entre 1 - 2 anos", "Entre 2 - 3 anos", "Entre 3 - 4 anos", "Entre 4 - 5 anos", "Entre 5 anos - 5 anos e 11 meses"] },
      { enunciado: "Em que o benefício é mais utilizado?", tipo: "MULTIPLA_ESCOLHA", ajuda: "Marcar até 3", opcoes: ["Alimentação da criança", "Alimentação da família", "Transporte para consultas", "Medicamentos e vitaminas", "Contas e despesas básicas", "Realização de exames", "Outro"] },
      { enunciado: "Você se considera a principal responsável pelos cuidados e sustento da criança, sem o apoio de um companheiro(a)?", tipo: "ESCOLHA_UNICA", opcoes: simNao },
    ],
  },
  {
    titulo: "Participação no Cartão CRIA",
    perguntas: [
      { enunciado: "Recebeu visitas do Serviço de Proteção Social Básica no Domicílio (Programa Criança Feliz) — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: visitas },
      { enunciado: "Recebeu visitas do Serviço de Proteção Social Básica no Domicílio (Programa Criança Feliz) — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: visitas },
      { enunciado: "A criança e a família participam de atividades propostas pelo CRAS? — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: simNao },
      { enunciado: "A criança e a família participam de atividades propostas pelo CRAS? — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: simNao },
      { enunciado: "Quais dificuldades você enfrenta em relação ao Cartão CRIA da criança?", tipo: "MULTIPLA_ESCOLHA", opcoes: dificuldades },
    ],
  },
  {
    titulo: "Saúde, Alimentação e Segurança Alimentar",
    perguntas: [
      { enunciado: "A criança consegue realizar 3 refeições por dia — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: freqRefeicoes },
      { enunciado: "A criança consegue realizar 3 refeições por dia — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: freqRefeicoes },
      { enunciado: "Desde que passaram a receber o Cartão CRIA, as frequências das refeições diárias da família", tipo: "ESCOLHA_UNICA", opcoes: ["Aumentou muito", "Aumentou pouco", "Não mudou", "Diminuiu"] },
      { enunciado: "Todos os integrantes da família conseguem realizar 3 refeições por dia — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: freqRefeicoes },
      { enunciado: "Todos os integrantes da família conseguem realizar 3 refeições por dia — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: freqRefeicoes },
      { enunciado: "Nos últimos três meses, os alimentos acabaram antes que você tivesse dinheiro para comprar mais comida?", tipo: "ESCOLHA_UNICA", opcoes: simNao },
      { enunciado: "Nos últimos três meses, você comeu apenas alguns alimentos que ainda tinha porque o dinheiro acabou?", tipo: "ESCOLHA_UNICA", opcoes: simNao },
      { enunciado: "Houve aleitamento materno exclusivo até os 6 meses (crianças de 0–6 meses) — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: ["Sim, recebeu exclusivamente leite materno", "Não, recebia fórmula/leite além do leite materno", "Não, já recebia alimentos além do leite materno", "Não mamou no peito"] },
      { enunciado: "Houve aleitamento materno exclusivo até os 6 meses (crianças de 0–6 meses) — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: ["Sim, recebeu exclusivamente leite materno", "Não, recebia fórmula/leite além do leite materno", "Não, já recebia alimentos além do leite materno", "Não mamou no peito"] },
      { enunciado: "Classificação do peso ao nascer", tipo: "ESCOLHA_UNICA", opcoes: ["Baixo peso ao nascer (< 2.500 g)", "Muito baixo peso (< 1.500 g)", "Extremo baixo peso (< 1.000 g)", "Peso normal"] },
      { enunciado: "Altura da criança em metros (atual)", tipo: "NUMERO" },
      { enunciado: "Peso da criança em kg (atual)", tipo: "NUMERO" },
      { enunciado: "A criança possui diagnóstico de deficiência ou síndrome", tipo: "ESCOLHA_UNICA", opcoes: ["Não", "Sim, diagnóstico de Síndrome Congênita por Zika", "Outro"] },
      { enunciado: "A criança já teve consulta odontológica — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: simNao },
      { enunciado: "A criança já teve consulta odontológica — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: simNao },
      { enunciado: "Carteira de vacinação da criança atualizada — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: ["Sim", "Não", "Não soube informar"] },
      { enunciado: "Carteira de vacinação da criança atualizada — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: ["Sim", "Não", "Não soube informar"] },
      { enunciado: "Número de consultas de puericultura no último ano", tipo: "NUMERO" },
      { enunciado: "A família tem dificuldade de levar a criança às consultas na UBS?", tipo: "ESCOLHA_UNICA", opcoes: ["Não", "Sim, transporte", "Sim, falta de vaga", "Sim, trabalho/cuidado com outros filhos", "Sim, distância", "Outro"] },
      { enunciado: "A criança recebeu suplementação de ferro nos últimos 12 meses?", tipo: "ESCOLHA_UNICA", ajuda: "Para crianças de 6 meses a 1 ano e 11 meses", opcoes: ["Sim, no último ano", "Sim, nos últimos 6 meses", "Não", "Não sabe", "Sim, em tratamento (para crianças acima de 1 ano e 11 meses)"] },
      { enunciado: "A criança recebeu vitamina A no último ano?", tipo: "ESCOLHA_UNICA", ajuda: "Para crianças de 6 meses a 4 anos e 11 meses", opcoes: ["Sim, no último ano", "Sim, nos últimos 6 meses", "Não", "Não sabe", "Não se aplica, sendo maior que 5 anos"] },
    ],
  },
  {
    titulo: "Bem-estar, Segurança e Autonomia",
    perguntas: [
      { enunciado: "De 1 a 5, quanto o Cartão CRIA contribuiu para o bem-estar da família?", tipo: "NUMERO", ajuda: "Escala de 1 a 5" },
    ],
  },
  {
    titulo: "Percepção e Satisfação",
    perguntas: [
      { enunciado: "O programa Cartão CRIA é de fácil acesso e entendimento?", tipo: "ESCOLHA_UNICA", opcoes: ["Sim", "Parcialmente", "Não"] },
      { enunciado: "De 1 a 5, quanto a família está satisfeita com o Cartão CRIA?", tipo: "NUMERO", ajuda: "Escala de 1 a 5" },
      { enunciado: "A família recomenda que o programa continue/expanda?", tipo: "ESCOLHA_UNICA", opcoes: ["Sim", "Não", "Não sabe"] },
      { enunciado: "Em uma escala de 0 a 10, o quanto você recomendaria os benefícios do Cartão CRIA para um amigo ou familiar?", tipo: "NUMERO", ajuda: "Escala de 0 a 10" },
      { enunciado: "Por qual meio você soube da existência do Cartão CRIA?", tipo: "TEXTO" },
      { enunciado: "Diário de Campo", tipo: "CAMPO_ABERTO", obrigatoria: true, ajuda: "Registro objetivo de percepções observadas durante a entrevista, considerando quando pertinentes: condições do território e da moradia; dinâmica familiar e cuidado com a criança; acesso às políticas públicas; sinais de invisibilização social; segurança alimentar e bem-estar da família e da criança. Sem julgamentos de valor, interpretações pessoais ou diagnósticos clínicos." },
    ],
  },
];

// ── Pesquisa: Cartão CRIA — Gestante ────────────────────────────────────────
export const secoesGestante: SecaoDef[] = [
  {
    titulo: "Identificação",
    perguntas: [
      { enunciado: "Nome completo da beneficiária", tipo: "TEXTO", obrigatoria: true },
      { enunciado: "CPF", tipo: "TEXTO" },
      { enunciado: "NIS", tipo: "TEXTO", obrigatoria: true, ajuda: "Número de Identificação Social — usado em programas sociais como Bolsa Família ou CadÚnico." },
      { enunciado: "Zona", tipo: "ESCOLHA_UNICA", obrigatoria: true, opcoes: ["Rural", "Urbana"], ajuda: "Você mora na zona rural (sítio, povoado) ou na cidade?" },
      { enunciado: "Município", tipo: "ESCOLHA_UNICA", obrigatoria: true, opcoes: MUNICIPIOS_AL },
      { enunciado: "Orientação sexual", tipo: "ESCOLHA_UNICA", ajuda: "Como você se identifica em relação à sua orientação afetiva? (Se preferir não responder, pode deixar em branco.)", opcoes: ["Heterossexual", "Homossexual", "Bissexual", "Assexual", "Pansexual", "Outro"] },
      { enunciado: "Sexo biológico", tipo: "ESCOLHA_UNICA", opcoes: ["Feminino", "Intersexo", "Outro"] },
      { enunciado: "Identidade de gênero", tipo: "ESCOLHA_UNICA", opcoes: ["Cisgênero", "Transgênero"] },
      { enunciado: "Idade", tipo: "NUMERO" },
      { enunciado: "Raça", tipo: "ESCOLHA_UNICA", ajuda: "Como você se considera em relação à sua cor?", opcoes: racaOpts },
      { enunciado: "Estado civil", tipo: "ESCOLHA_UNICA", opcoes: ["Solteira", "Casada/União estável", "Separada", "Viúva", "Outro"] },
      { enunciado: "Escolaridade", tipo: "ESCOLHA_UNICA", ajuda: "Até que série você estudou?", opcoes: escolaridade },
      { enunciado: "A família pertence a Grupos Populacionais Tradicionais e Específicos?", tipo: "ESCOLHA_UNICA", ajuda: "Sua família faz parte de algum desses grupos?", opcoes: gruposPopulacionais },
      { enunciado: "Qual a gestação?", tipo: "ESCOLHA_UNICA", ajuda: "Essa é sua primeira gravidez ou você já teve outras?", opcoes: ["1ª Gestação", "2ª Gestação", "3ª Gestação", "4ª Gestação", "5ª Gestação", "Superior a 5 gestações"] },
      { enunciado: "Quantos partos você já teve?", tipo: "ESCOLHA_UNICA", ajuda: "Quantos filhos você já teve antes desta gravidez?", opcoes: ["1 parto", "2 partos", "3 partos", "4 partos", "5 partos", "6 partos ou mais"] },
      { enunciado: "Houve gestação planejada? — Gestações anteriores", tipo: "ESCOLHA_UNICA", opcoes: simNao, ajuda: "Gravidez planejada: houve preparo antes de engravidar (conversar sobre ter o bebê, orientação no posto de saúde, acompanhamento médico, organizar condições). Sem planejamento prévio = não planejada." },
      { enunciado: "Houve gestação planejada? — Gestação atual", tipo: "ESCOLHA_UNICA", opcoes: simNao },
    ],
  },
  {
    titulo: "Participação no Cartão CRIA",
    perguntas: [
      { enunciado: "Em que dia, mês e ano você fez o cadastro/atualização no CRAS para solicitar o Cartão CRIA?", tipo: "DATA", obrigatoria: true, ajuda: "Você lembra aproximadamente quando fez o cadastro no CRAS para pedir o Cartão CRIA?" },
      { enunciado: "Em que dia, mês e ano você começou a receber o benefício do Cartão CRIA?", tipo: "DATA", obrigatoria: true },
      { enunciado: "Após o cadastro no CRAS, quanto tempo demorou para você começar a receber o Cartão CRIA durante a gestação?", tipo: "ESCOLHA_UNICA", opcoes: ["Recebi em até 30 dias", "Entre 31 e 90 dias", "Entre 91 e 120 dias", "Mais de 120 dias", "Ainda não comecei a receber"] },
      { enunciado: "Recebeu visitas do Serviço de Proteção Social Básica no Domicílio (Programa Criança Feliz) — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: visitas },
      { enunciado: "Recebeu visitas do Serviço de Proteção Social Básica no Domicílio (Programa Criança Feliz) — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: visitas },
      { enunciado: "A gestante e a família participam de atividades propostas pelo CRAS? — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: simNao, ajuda: "Atividades podem incluir: reuniões, palestras, acompanhamento familiar e/ou grupos de gestantes. Ações promovidas pela Assistência Social." },
      { enunciado: "A gestante e a família participam de atividades propostas pelo CRAS? — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: simNao },
      { enunciado: "Recebeu alguma orientação sobre aleitamento materno? — Gestações anteriores", tipo: "ESCOLHA_UNICA", opcoes: simNao },
      { enunciado: "Recebeu alguma orientação sobre aleitamento materno? — Gestação atual", tipo: "ESCOLHA_UNICA", opcoes: simNao },
      { enunciado: "Quando iniciou o pré-natal?", tipo: "ESCOLHA_UNICA", ajuda: "Pré-natal é o acompanhamento da gestação por profissionais de saúde (consultas em posto de saúde com enfermeira ou médico).", opcoes: ["Iniciou antes de 12 semanas (3 meses)", "Iniciou após 12 semanas (3 meses)", "Não soube informar", "Sem pré-natal"] },
      { enunciado: "Tipo de risco da gestação", tipo: "ESCOLHA_UNICA", obrigatoria: true, ajuda: "Alto risco: quando a gestante ou o bebê precisam de acompanhamento mais cuidadoso (ex.: pressão alta, diabetes, anemia grave, infecção, gravidez de gêmeos, idade muito jovem ou avançada, histórico de complicações). Pode haver encaminhamento a serviços especializados/maternidades de referência.", opcoes: ["Risco habitual (baixo)", "Alto risco (ex.: hipertensão, diabetes, idade materna, histórico)"] },
      { enunciado: "Exames laboratoriais obrigatórios realizados (protocolo do Ministério da Saúde) — Gestações anteriores", tipo: "MULTIPLA_ESCOLHA", ajuda: "Sumário/urocultura = exames de urina; testes rápidos = sífilis e HIV; ultrassom = ver o bebê.", opcoes: ["Urocultura", "Sumário de urina", "Exames de sangue", "Testes rápidos", "Ultrassom"] },
      { enunciado: "Exames laboratoriais obrigatórios realizados (protocolo do Ministério da Saúde) — Gestação atual", tipo: "MULTIPLA_ESCOLHA", opcoes: ["Urocultura", "Sumário de urina", "Exames de sangue", "Testes rápidos", "Ultrassom"] },
      { enunciado: "Quais dificuldades você enfrenta em relação ao Cartão CRIA?", tipo: "MULTIPLA_ESCOLHA", opcoes: dificuldades },
    ],
  },
  {
    titulo: "Condições Socioeconômicas",
    perguntas: [
      { enunciado: "Número de pessoas na residência", tipo: "NUMERO", ajuda: "Contar todas as pessoas que moram na casa da gestante." },
      { enunciado: "Quantas crianças de 0 a 6 anos vivem no domicílio (além da criança que está sendo gestada)?", tipo: "ESCOLHA_UNICA", obrigatoria: true, opcoes: ["1 criança", "2 crianças", "3 crianças", "4 crianças", "5 crianças ou mais", "Não há crianças"] },
      { enunciado: "Renda mensal total da família (R$)", tipo: "NUMERO", ajuda: "Somar todas as fontes de renda da casa (salários de todos os moradores)." },
      { enunciado: "Benefícios que a gestante/família recebia ANTES do Cartão CRIA (federal/estadual/municipal)", tipo: "MULTIPLA_ESCOLHA", opcoes: beneficios },
      { enunciado: "Benefícios que a gestante/família recebe APÓS o Cartão CRIA (federal/estadual/municipal)", tipo: "MULTIPLA_ESCOLHA", opcoes: beneficios },
      { enunciado: "Atualmente, qual é a situação de trabalho da gestante?", tipo: "ESCOLHA_UNICA", obrigatoria: true, opcoes: ["Emprego formal (com carteira assinada)", "Trabalho informal (sem carteira assinada)", "Trabalho por conta própria / autônoma", "Desempregada", "Estudante", "Trabalho doméstico não remunerado (do lar)", "Afastada do trabalho / em auxílio-doença ou licença", "Não trabalha no momento"] },
      { enunciado: "Você se considera a principal responsável pelos cuidados e sustento durante toda a gestação, sem o apoio de um companheiro(a)?", tipo: "ESCOLHA_UNICA", opcoes: simNao },
      { enunciado: "Em que o benefício é mais utilizado?", tipo: "MULTIPLA_ESCOLHA", ajuda: "Marcar até 3", opcoes: ["Alimentação da gestante", "Alimentação da família", "Transporte para consultas", "Medicamentos e vitaminas", "Roupas/itens da gravidez", "Preparação do enxoval", "Contas e despesas básicas", "Realização de exames", "Outro"] },
      { enunciado: "Tipo de moradia", tipo: "ESCOLHA_UNICA", opcoes: ["Própria", "Alugada", "Cedida/Ocupação", "Outro"] },
    ],
  },
  {
    titulo: "Saúde, Alimentação e Segurança Alimentar",
    perguntas: [
      { enunciado: "A gestante consegue realizar, no mínimo, 3 refeições por dia? — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: freqRefeicoes },
      { enunciado: "A gestante consegue realizar, no mínimo, 3 refeições por dia? — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: freqRefeicoes },
      { enunciado: "Todos os integrantes da família conseguem realizar 3 refeições por dia — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: freqRefeicoes },
      { enunciado: "Todos os integrantes da família conseguem realizar 3 refeições por dia — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: freqRefeicoes },
      { enunciado: "A gestante recebeu orientações sobre a importância do aleitamento materno exclusivo até os 6 meses? — ANTES do Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: ["Sim, recebeu orientações adequadas", "Sim, recebeu orientações superficiais", "Não recebeu orientações", "Não se aplica"] },
      { enunciado: "A gestante recebeu orientações sobre a importância do aleitamento materno exclusivo até os 6 meses? — APÓS o Cartão CRIA", tipo: "ESCOLHA_UNICA", opcoes: ["Sim, recebeu orientações adequadas", "Sim, recebeu orientações superficiais", "Não recebeu orientações", "Não se aplica"] },
      { enunciado: "Qual a altura da gestante em metros (atual)?", tipo: "NUMERO" },
      { enunciado: "Qual era o peso da gestante antes de engravidar (aproximadamente)?", tipo: "NUMERO", ajuda: "em kg" },
      { enunciado: "Qual é o peso atual da gestante?", tipo: "NUMERO", ajuda: "em kg" },
      { enunciado: "Semana gestacional atual", tipo: "NUMERO", ajuda: "Semanas completas de gestação (número inteiro de 1 a 42)" },
      { enunciado: "Nos últimos três meses, os alimentos acabaram antes que você tivesse dinheiro para comprar mais comida?", tipo: "ESCOLHA_UNICA", opcoes: simNao },
      { enunciado: "Nos últimos três meses, você comeu apenas alguns alimentos que ainda tinha porque o dinheiro acabou?", tipo: "ESCOLHA_UNICA", opcoes: simNao },
      { enunciado: "A caderneta/carteira de vacinação da gestante está atualizada conforme orientação da unidade de saúde?", tipo: "ESCOLHA_UNICA", opcoes: ["Sim, está atualizada", "Não, está atrasada", "Não sabe informar"] },
      { enunciado: "Qual o motivo da vacinação não estar atualizada?", tipo: "MULTIPLA_ESCOLHA", ajuda: "Pode marcar mais de uma opção", opcoes: ["Falta de informação", "Dificuldade de acesso à unidade de saúde", "Esquecimento / falta de tempo", "Orientação médica para adiar", "Outro"] },
    ],
  },
  {
    titulo: "Percepção e Satisfação",
    perguntas: [
      { enunciado: "De 1 a 5, quanto o Cartão CRIA contribuiu para o bem-estar da gestante — Segurança financeira", tipo: "NUMERO", obrigatoria: true, ajuda: "Escala de 1 a 5" },
      { enunciado: "De 1 a 5, quanto o Cartão CRIA contribuiu para o bem-estar da gestante — Alimentação", tipo: "NUMERO", obrigatoria: true, ajuda: "Escala de 1 a 5" },
      { enunciado: "De 1 a 5, quanto o Cartão CRIA contribuiu para o bem-estar da gestante — Saúde da gestante", tipo: "NUMERO", obrigatoria: true, ajuda: "Escala de 1 a 5" },
      { enunciado: "De 1 a 5, quanto o Cartão CRIA contribuiu para o bem-estar da gestante — Bem-estar emocional", tipo: "NUMERO", obrigatoria: true, ajuda: "Escala de 1 a 5" },
      { enunciado: "O programa Cartão CRIA é de fácil acesso e entendimento?", tipo: "ESCOLHA_UNICA", obrigatoria: true, opcoes: ["Sim", "Parcialmente", "Não"] },
      { enunciado: "De 1 a 5, quanto a gestante está satisfeita com o Cartão CRIA?", tipo: "NUMERO", obrigatoria: true, ajuda: "1 — Não ajudou; 2 — Ajudou pouco; 3 — Ajudou razoavelmente; 4 — Ajudou bastante; 5 — Ajudou muito" },
      { enunciado: "Em uma escala de 0 a 10, o quanto você recomendaria os benefícios do Cartão CRIA para um amigo ou familiar?", tipo: "NUMERO", ajuda: "Escala de 0 a 10" },
      { enunciado: "Por qual meio você soube da existência do Cartão CRIA?", tipo: "TEXTO" },
      { enunciado: "Diário de Campo", tipo: "CAMPO_ABERTO", obrigatoria: true, ajuda: "Registro objetivo de percepções observadas durante a entrevista, considerando quando pertinentes: condições do território e da moradia; dinâmica familiar e cuidado com a criança; acesso às políticas públicas; sinais de invisibilização social; segurança alimentar e bem-estar da família e da criança. Sem julgamentos de valor, interpretações pessoais ou diagnósticos clínicos." },
    ],
  },
];

export const PESQUISAS_CARTAO_CRIA = [
  { titulo: "Cartão CRIA — Criança", descricao: "Pesquisa de acompanhamento e avaliação de impacto do Programa Cartão CRIA — perfil da criança beneficiária. SECRIA/AL.", secoes: secoesCrianca },
  { titulo: "Cartão CRIA — Gestante", descricao: "Pesquisa de acompanhamento e avaliação de impacto do Programa Cartão CRIA — perfil da gestante beneficiária. SECRIA/AL.", secoes: secoesGestante },
];

// (Re)cria uma pesquisa completa a partir da definição. Remove uma versão anterior
// de mesmo título (e o que estiver pendurado nela) antes de recriar — idempotente.
export async function criarPesquisaCompleta(opts: {
  titulo: string;
  descricao: string;
  secoes: SecaoDef[];
  gestorId: string;
  adminId: string;
}): Promise<{ id: string; totalPerguntas: number }> {
  const anterior = await prisma.pesquisa.findFirst({ where: { titulo: opts.titulo, deletedAt: null } });
  if (anterior) {
    const perguntaIds = (await prisma.pergunta.findMany({ where: { pesquisaId: anterior.id }, select: { id: true } })).map((p) => p.id);
    await prisma.itemResposta.deleteMany({ where: { perguntaId: { in: perguntaIds } } });
    await prisma.resposta.deleteMany({ where: { pesquisaId: anterior.id } });
    await prisma.opcaoPergunta.deleteMany({ where: { perguntaId: { in: perguntaIds } } });
    await prisma.pergunta.deleteMany({ where: { pesquisaId: anterior.id } });
    await prisma.secao.deleteMany({ where: { pesquisaId: anterior.id } });
    await prisma.pesquisaVersao.deleteMany({ where: { pesquisaId: anterior.id } });
    await prisma.pesquisa.delete({ where: { id: anterior.id } });
  }

  const pesquisa = await prisma.pesquisa.create({
    data: {
      titulo: opts.titulo,
      descricao: opts.descricao,
      responsavelId: opts.gestorId,
      createdById: opts.adminId,
      status: "PUBLICADA",
      publicadaEm: new Date(),
    },
  });

  let ordem = 0;
  let totalPerguntas = 0;
  for (let s = 0; s < opts.secoes.length; s++) {
    const sec = opts.secoes[s];
    const secao = await prisma.secao.create({ data: { pesquisaId: pesquisa.id, titulo: sec.titulo, descricao: sec.descricao, ordem: s } });
    for (const q of sec.perguntas) {
      await prisma.pergunta.create({
        data: {
          pesquisaId: pesquisa.id,
          secaoId: secao.id,
          enunciado: q.enunciado,
          tipo: q.tipo,
          obrigatoria: q.obrigatoria ?? false,
          ordem: ordem++,
          ajuda: q.ajuda,
          opcoes: q.opcoes ? { create: q.opcoes.map((texto, idx) => ({ texto, ordem: idx })) } : undefined,
        },
      });
      totalPerguntas++;
    }
  }
  return { id: pesquisa.id, totalPerguntas };
}
