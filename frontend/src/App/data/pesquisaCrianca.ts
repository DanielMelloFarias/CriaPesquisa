// Pesquisa Cartão CRIA (Criança) — transcrição do formulário oficial.
// Usada como dado de demonstração (lista + preview) enquanto o backend não
// está conectado; o mesmo conteúdo é semeado no backend (prisma/seed.ts).

export type TipoCampo =
  | "texto"
  | "paragrafo"
  | "numero"
  | "data"
  | "unica"
  | "multipla"
  | "selecao"
  | "escala"
  | "grade";

export interface Campo {
  n: number;
  enunciado: string;
  tipo: TipoCampo;
  obrigatoria?: boolean;
  ajuda?: string;
  opcoes?: string[];
  outro?: boolean;
  limite?: number;
  escala?: { min: number; max: number };
  grade?: { linhas: string[]; colunas: string[] };
  full?: boolean; // força ocupar a linha inteira (ex.: nome completo)
  novaLinha?: boolean; // força começar numa nova linha da grade (coluna 1)
  dropdown?: boolean; // força escolha única a renderizar como dropdown (ex.: opções longas)
  formato?: "cpf" | "nis"; // restringe a dígitos e valida o formato
}

export interface Secao {
  titulo: string;
  campos: Campo[];
}

export interface PesquisaDemo {
  id: string;
  titulo: string;
  descricao: string;
  status: "PUBLICADA" | "RASCUNHO" | "ENCERRADA";
  tipo: "Criança" | "Gestante";
  secoes: Secao[];
}

const ANTES_APOS = ["Antes do Cartão CRIA", "Após o Cartão CRIA"];

export const PESQUISA_CRIANCA: PesquisaDemo = {
  id: "cria-crianca",
  titulo: "Pesquisa Cartão CRIA (Criança)",
  descricao: "Acompanhamento de crianças beneficiárias do Cartão CRIA — SECRIA/AL.",
  status: "PUBLICADA",
  tipo: "Criança",
  secoes: [
    {
      titulo: "Identificação e perfil sociodemográfico",
      campos: [
        { n: 1, enunciado: "Nome completo do(a) entrevistado(a)", tipo: "texto", obrigatoria: true, full: true },
        { n: 2, enunciado: "CPF", tipo: "texto", obrigatoria: true, formato: "cpf" },
        { n: 3, enunciado: "NIS", tipo: "texto", formato: "nis" },
        { n: 4, enunciado: "Zona", tipo: "unica", obrigatoria: true, opcoes: ["Rural", "Urbana"] },
        { n: 5, enunciado: "Município", tipo: "texto", obrigatoria: true },
        { n: 6, enunciado: "Grau de parentesco do(a) beneficiário(a) com a criança", tipo: "unica", opcoes: ["Mãe", "Pai", "Avós"], outro: true },
        { n: 7, enunciado: "Orientação sexual", tipo: "unica", opcoes: ["Heterosexual", "Homossexual", "Bissexual", "Assexual", "Pansexual"] },
        { n: 8, enunciado: "Sexo biológico", tipo: "unica", opcoes: ["Masculino", "Feminino", "Intersexo"] },
        { n: 9, enunciado: "Identidade de gênero", tipo: "unica", opcoes: ["Cisgênero", "Transgênero"], outro: true },
        { n: 10, enunciado: "Idade", tipo: "numero" },
        { n: 11, enunciado: "Raça", tipo: "unica", opcoes: ["Branca", "Preta", "Parda", "Amarelo", "Indígena"] },
        { n: 12, enunciado: "Estado civil", tipo: "unica", opcoes: ["Solteira", "Casada/União estável", "Separada", "Viúva"], outro: true },
        { n: 13, enunciado: "Escolaridade", tipo: "unica", opcoes: ["Não estudou", "Fundamental incompleto", "Fundamental completo", "Médio incompleto", "Médio completo", "Superior incompleto", "Superior completo"] },
        {
          n: 14,
          enunciado: "A família pertence a Grupos Populacionais Tradicionais e Específicos?",
          tipo: "multipla",
          outro: true,
          opcoes: [
            "Família Agricultores", "Família de Assentamento (Movimento MST)", "Família Acampada",
            "Família de Catadores de Material Reciclável", "Família de Comunidade Tradicional de Terreiro",
            "Família de Pescadores", "Família Ribeirinha", "Família Extrativista", "Família Romani (Cigana)",
            "Família de Preso do Sistema Carcerário", "Família Quilombola",
            "Família Atingida por Empreendimentos de Infraestrutura",
            "Família Beneficiária do Programa Nacional do Crédito Fundiário", "Família Indígena",
            "Famílias refugiadas ou imigrantes internacionais", "Família em situação de rua", "Nenhuma",
          ],
        },
      ],
    },
    {
      titulo: "Dados da criança",
      campos: [
        { n: 15, enunciado: "Nome da criança", tipo: "texto" },
        { n: 16, enunciado: "CPF da criança", tipo: "texto", formato: "cpf" },
        { n: 17, enunciado: "Data de nascimento da criança", tipo: "data" },
        { n: 18, enunciado: "Sexo biológico da criança", tipo: "unica", opcoes: ["Masculino", "Feminino", "Intersexo"] },
      ],
    },
    {
      titulo: "Perfil da criança (Desenvolvimento e Educação)",
      campos: [
        { n: 19, enunciado: "A criança está na educação infantil", tipo: "unica", opcoes: ["Creche CRIA", "Creche (Outra)", "Pré-escola", "Não faz parte de nenhum grupo"] },
      ],
    },
    {
      titulo: "Condições socioeconômicas",
      campos: [
        { n: 20, enunciado: "Número de pessoas na residência", tipo: "numero" },
        { n: 21, enunciado: "Quantas crianças de 0–6 anos no domicílio", tipo: "numero" },
        { n: 22, enunciado: "Renda mensal total da família (R$)", tipo: "numero" },
        {
          n: 23,
          enunciado: "A criança ou a família recebem outros benefícios (federal/estadual/municipal)?",
          tipo: "grade",
          grade: { linhas: ANTES_APOS, colunas: ["Bolsa Família", "Incentivo Municipal", "BPC"] },
        },
        { n: 24, enunciado: "Ocupação do responsável principal", tipo: "unica", opcoes: ["Empregado, formal", "Empregado, informal", "Desempregado", "Aposentado", "Estudante"] },
        { n: 25, enunciado: "Tipo de moradia", tipo: "unica", opcoes: ["Própria", "Alugada", "Cedida/Ocupação"], outro: true },
        { n: 26, enunciado: "Data do cadastro/atualização no CRAS para solicitar o Cartão CRIA", tipo: "data", obrigatoria: true },
        { n: 27, enunciado: "Data em que começou a receber o benefício do Cartão CRIA", tipo: "data", obrigatoria: true },
        { n: 28, enunciado: "Há quanto tempo a família recebe o benefício do Cartão CRIA?", tipo: "unica", obrigatoria: true, opcoes: ["Menos de 6 meses", "Entre 6 meses e 1 ano", "Entre 1 e 2 anos", "Entre 2 e 3 anos", "Entre 4 e 5 anos", "Entre 5 anos e 5 anos e 11 meses"] },
        { n: 29, enunciado: "Em que o benefício é mais utilizado?", tipo: "multipla", limite: 3, outro: true, opcoes: ["Alimentação da criança", "Alimentação da família", "Transporte para consultas", "Medicamentos e vitaminas", "Contas e despesas básicas", "Realização de exames"] },
        { n: 30, enunciado: "Você se considera o principal responsável pelos cuidados e sustento da criança, sem o apoio de um companheiro(a)?", tipo: "unica", opcoes: ["Sim", "Não"] },
      ],
    },
    {
      titulo: "Participação no Cartão CRIA",
      campos: [
        { n: 31, enunciado: "A criança e a família já receberam visitas do Programa Criança Feliz (SPSBD-GC)?", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Sim, pouca frequência", "Sim, muita frequência", "Não"] } },
        { n: 32, enunciado: "A criança e a família participam de atividades propostas pelo CRAS?", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Sim", "Não"] } },
        { n: 33, enunciado: "Quais dificuldades você enfrenta em relação ao Cartão CRIA da criança?", tipo: "multipla", outro: true, opcoes: ["Bloqueio ou suspensão do benefício", "Atraso no pagamento", "Dificuldade de transporte para sacar ou utilizar o benefício", "Falta de informações claras sobre regras e condicionalidades", "Dificuldade de acesso ou atendimento no CRAS", "Problemas no Aplicativo CAIXA TEM", "Não há dificuldade"] },
      ],
    },
    {
      titulo: "Saúde, alimentação e segurança alimentar",
      campos: [
        { n: 34, enunciado: "A criança consegue realizar 3 refeições por dia", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Sempre", "Quase sempre", "Raramente", "Nunca"] } },
        { n: 35, enunciado: "Desde que passaram a receber o Cartão CRIA, a frequência das refeições diárias da família", tipo: "unica", opcoes: ["Aumentou muito", "Aumentou pouco", "Não mudou", "Diminuiu"] },
        { n: 36, enunciado: "Todos os integrantes da família conseguem realizar 3 refeições por dia", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Sempre", "Quase sempre", "Raramente", "Nunca"] } },
        { n: 37, enunciado: "Nos últimos três meses, os alimentos acabaram antes que você tivesse dinheiro para comprar mais comida?", tipo: "unica", opcoes: ["Sim", "Não"] },
        { n: 38, enunciado: "Nos últimos três meses, você comeu apenas alguns alimentos que ainda tinha porque o dinheiro acabou?", tipo: "unica", opcoes: ["Sim", "Não"] },
        { n: 39, enunciado: "Houve aleitamento materno exclusivo até os 6 meses? (crianças de 0–6 meses)", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Sim, exclusivamente leite materno", "Não, fórmula/leite além do materno", "Não, já recebia alimentos além do leite materno", "Não mamou no peito"] } },
        { n: 40, enunciado: "Classificação do peso ao nascer", tipo: "unica", opcoes: ["Baixo peso (< 2.500 g)", "Muito baixo peso (< 1.500 g)", "Extremo baixo peso (< 1.000 g)", "Peso normal"] },
        { n: 41, enunciado: "Altura da criança em metros (atual)", tipo: "numero" },
        { n: 42, enunciado: "Peso da criança em kg (atual)", tipo: "numero" },
        { n: 43, enunciado: "A criança possui diagnóstico de deficiência ou síndrome?", tipo: "unica", outro: true, opcoes: ["Não", "Sim, Síndrome Congênita por Zika"] },
        { n: 44, enunciado: "A criança já teve consulta odontológica", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Sim", "Não"] } },
        { n: 45, enunciado: "Carteira de vacinação da criança atualizada", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Sim", "Não", "Não soube informar"] } },
        { n: 46, enunciado: "Número de consultas de puericultura no último ano", tipo: "numero" },
        { n: 47, enunciado: "A família tem dificuldade de levar a criança às consultas na UBS?", tipo: "unica", outro: true, opcoes: ["Não", "Sim, transporte", "Sim, falta de vaga", "Sim, trabalho/cuidado com outros filhos", "Sim, distância"] },
        { n: 48, enunciado: "A criança recebeu suplementação de ferro nos últimos 12 meses? (6 meses a 1 ano e 11 meses)", tipo: "unica", novaLinha: true, opcoes: ["Sim, no último ano", "Sim, nos últimos 6 meses", "Não", "Não sabe", "Sim, em tratamento (acima de 1 ano e 11 meses)"] },
        { n: 49, enunciado: "A criança recebeu vitamina A no último ano? (6 meses a 4 anos e 11 meses)", tipo: "unica", opcoes: ["Sim, no último ano", "Sim, nos últimos 6 meses", "Não", "Não sabe", "Não se aplica (maior que 5 anos)"] },
      ],
    },
    {
      titulo: "Bem-estar, segurança e autonomia",
      campos: [
        { n: 50, enunciado: "De 1 a 5, quanto o Cartão CRIA contribuiu para o bem-estar da família?", tipo: "escala", escala: { min: 1, max: 5 } },
      ],
    },
    {
      titulo: "Percepção e satisfação",
      campos: [
        { n: 51, enunciado: "O programa Cartão CRIA é de fácil acesso e entendimento?", tipo: "unica", opcoes: ["Sim", "Parcialmente", "Não"] },
        { n: 52, enunciado: "De 1 a 5, quanto a família está satisfeita com o Cartão CRIA?", tipo: "escala", escala: { min: 1, max: 5 } },
        { n: 53, enunciado: "A família recomenda que o programa continue/expanda?", tipo: "unica", opcoes: ["Sim", "Não", "Não sabe"] },
        { n: 54, enunciado: "De 0 a 10, o quanto você recomendaria os benefícios do Cartão CRIA para um amigo ou familiar?", tipo: "escala", escala: { min: 0, max: 10 } },
        { n: 55, enunciado: "Por qual meio você soube da existência do Cartão CRIA?", tipo: "texto" },
      ],
    },
    {
      titulo: "Diário de campo",
      campos: [
        {
          n: 56,
          enunciado: "Registro de percepções qualitativas observadas durante a entrevista",
          tipo: "paragrafo",
          obrigatoria: true,
          ajuda: "Condições do território e da moradia; dinâmica familiar e cuidado com a criança; acesso às políticas públicas; sinais de invisibilização social; segurança alimentar e bem-estar. Sem julgamentos de valor, interpretações pessoais ou diagnósticos clínicos.",
        },
      ],
    },
  ],
};

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

const ANTERIOR_ATUAL = ["Gestações anteriores", "Gestação atual"];

export const PESQUISA_GESTANTE: PesquisaDemo = {
  id: "cria-gestante",
  titulo: "Pesquisa Cartão CRIA (Gestantes)",
  descricao: "Acompanhamento de gestantes beneficiárias do Cartão CRIA — SECRIA/AL.",
  status: "PUBLICADA",
  tipo: "Gestante",
  secoes: [
    {
      titulo: "Identificação e perfil sociodemográfico",
      campos: [
        { n: 1, enunciado: "Nome completo da beneficiária", tipo: "texto", obrigatoria: true, full: true },
        { n: 2, enunciado: "CPF", tipo: "texto", formato: "cpf" },
        { n: 3, enunciado: "NIS (Número de Identificação Social)", tipo: "texto", obrigatoria: true, formato: "nis", ajuda: "Número usado para programas sociais como Bolsa Família ou CadÚnico." },
        { n: 4, enunciado: "Zona", tipo: "unica", obrigatoria: true, opcoes: ["Rural", "Urbana"], ajuda: "Você mora na zona rural (sítio, povoado) ou na cidade?" },
        { n: 5, enunciado: "Município", tipo: "selecao", obrigatoria: true, opcoes: MUNICIPIOS_AL },
        { n: 6, enunciado: "Orientação sexual", tipo: "unica", outro: true, opcoes: ["Heterosexual", "Homossexual", "Bissexual", "Assexual", "Pansexual"], ajuda: "Se preferir não responder, pode deixar em branco." },
        { n: 7, enunciado: "Sexo biológico", tipo: "unica", outro: true, opcoes: ["Feminino", "Intersexo"] },
        { n: 8, enunciado: "Identidade de gênero", tipo: "unica", opcoes: ["Cisgênero", "Transgênero"] },
        { n: 9, enunciado: "Idade", tipo: "numero" },
        { n: 10, enunciado: "Raça", tipo: "unica", opcoes: ["Branca", "Preta", "Parda", "Amarelo", "Indígena"], ajuda: "Como você se considera em relação à sua cor?" },
        { n: 11, enunciado: "Estado civil", tipo: "unica", outro: true, opcoes: ["Solteira", "Casada/União estável", "Separada", "Viúva"] },
        { n: 12, enunciado: "Escolaridade", tipo: "unica", opcoes: ["Não estudou", "Fundamental incompleto", "Fundamental completo", "Médio incompleto", "Médio completo", "Superior incompleto", "Superior completo"], ajuda: "Até que série você estudou?" },
        {
          n: 13, enunciado: "A família pertence a Grupos Populacionais Tradicionais e Específicos?", tipo: "multipla", outro: true,
          opcoes: [
            "Família Agricultores", "Família de Assentamento (Movimento MST)", "Família Acampada",
            "Família de Catadores de Material Reciclável", "Família de Comunidade Tradicional de Terreiro",
            "Família de Pescadores", "Família Ribeirinha", "Família Extrativista", "Família Romani (Cigana)",
            "Família de Preso do Sistema Carcerário", "Família Quilombola",
            "Família Atingida por Empreendimentos de Infraestrutura",
            "Família Beneficiária do Programa Nacional do Crédito Fundiário", "Família Indígena",
            "Famílias refugiadas ou imigrantes internacionais", "Família em situação de rua", "Nenhuma",
          ],
        },
        { n: 14, enunciado: "Qual a gestação?", tipo: "unica", opcoes: ["1ª Gestação", "2ª Gestação", "3ª Gestação", "4ª Gestação", "5ª Gestação", "Superior a 5 gestações"], ajuda: "Essa é sua primeira gravidez ou você já teve outras?" },
        { n: 15, enunciado: "Quantos partos você já teve?", tipo: "unica", opcoes: ["1 parto", "2 partos", "3 partos", "4 partos", "5 partos", "6 partos ou mais"] },
        { n: 16, enunciado: "Houve alguma gestação planejada?", tipo: "grade", grade: { linhas: ANTERIOR_ATUAL, colunas: ["Sim", "Não"] }, ajuda: "Gravidez planejada é quando houve preparo antes de engravidar (conversar, orientação no posto, acompanhamento médico)." },
      ],
    },
    {
      titulo: "Participação no Cartão CRIA",
      campos: [
        { n: 17, enunciado: "Data do cadastro/atualização no CRAS para solicitar o Cartão CRIA", tipo: "data", obrigatoria: true },
        { n: 18, enunciado: "Data em que começou a receber o benefício do Cartão CRIA", tipo: "data", obrigatoria: true },
        { n: 19, enunciado: "Após o cadastro no CRAS, quanto tempo demorou para começar a receber o Cartão CRIA na gestação?", tipo: "unica", opcoes: ["Recebi em até 30 dias", "Entre 31 e 90 dias", "Entre 91 e 120 dias", "Mais de 120 dias", "Ainda não comecei a receber"] },
        { n: 20, enunciado: "A gestante e a família já receberam visitas do Programa Criança Feliz (SPSBD-GC)?", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Sim, pouca frequência", "Sim, muita frequência", "Não"] } },
        { n: 21, enunciado: "A gestante e a família participam de atividades propostas pelo CRAS?", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Sim", "Não"] }, ajuda: "Reuniões, palestras, acompanhamento familiar, grupos de gestantes." },
        { n: 22, enunciado: "Recebeu alguma orientação sobre aleitamento materno?", tipo: "grade", grade: { linhas: ANTERIOR_ATUAL, colunas: ["Sim", "Não"] } },
        { n: 23, enunciado: "Quando iniciou o pré-natal?", tipo: "unica", opcoes: ["Antes de 12 semanas (3 meses)", "Após 12 semanas (3 meses)", "Não soube informar", "Sem pré-natal"], ajuda: "Pré-natal é o acompanhamento da gestação por profissionais de saúde." },
        { n: 24, enunciado: "Tipo de risco da gestação", tipo: "unica", obrigatoria: true, dropdown: true, opcoes: ["Risco habitual (baixo)", "Alto risco (ex.: hipertensão, diabetes, idade materna, histórico)"], ajuda: "Alto risco: maior possibilidade de problema de saúde na gestante ou no bebê." },
        { n: 25, enunciado: "A gestante realizou os exames laboratoriais obrigatórios (protocolo do Ministério da Saúde)?", tipo: "grade", grade: { linhas: ANTERIOR_ATUAL, colunas: ["Urocultura", "Sumário de urina", "Exames de sangue", "Testes rápidos", "Ultrassom"] }, ajuda: "Testes rápidos: sífilis e HIV. Ultrassom: exame para ver o bebê." },
        { n: 26, enunciado: "Quais dificuldades você enfrenta em relação ao Cartão CRIA?", tipo: "multipla", outro: true, opcoes: ["Bloqueio ou suspensão do benefício", "Atraso no pagamento", "Dificuldade de transporte para sacar ou utilizar o benefício", "Falta de informações claras sobre regras e condicionalidades", "Dificuldade de acesso ou atendimento no CRAS", "Problemas no Aplicativo CAIXA TEM", "Não há dificuldade"] },
      ],
    },
    {
      titulo: "Condições socioeconômicas",
      campos: [
        { n: 27, enunciado: "Número de pessoas na residência", tipo: "numero", ajuda: "Contar todas as pessoas que moram na casa da gestante." },
        { n: 28, enunciado: "Quantas crianças de 0 a 6 anos vivem no domicílio (além da que está sendo gestada)?", tipo: "unica", obrigatoria: true, opcoes: ["1 criança", "2 crianças", "3 crianças", "4 crianças", "5 crianças ou mais", "Não há crianças"] },
        { n: 29, enunciado: "Renda mensal total da família (R$)", tipo: "numero", ajuda: "Some todas as fontes de renda da casa." },
        { n: 30, enunciado: "A gestante ou a família recebem outros benefícios (federal/estadual/municipal)?", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Bolsa Família", "Incentivo Municipal", "BPC"] } },
        { n: 31, enunciado: "Atualmente, qual é a situação de trabalho da gestante?", tipo: "unica", obrigatoria: true, opcoes: ["Emprego formal (com carteira assinada)", "Trabalho informal (sem carteira)", "Trabalho por conta própria / autônoma", "Desempregada", "Estudante", "Trabalho doméstico não remunerado (do lar)", "Afastada do trabalho / auxílio-doença ou licença", "Não trabalha no momento"] },
        { n: 32, enunciado: "Você se considera a principal responsável pelos cuidados e sustento durante toda a gestação, sem apoio de um companheiro(a)?", tipo: "unica", opcoes: ["Sim", "Não"] },
        { n: 33, enunciado: "Em que o benefício é mais utilizado?", tipo: "multipla", limite: 3, outro: true, opcoes: ["Alimentação da gestante", "Alimentação da família", "Transporte para consultas", "Medicamentos e vitaminas", "Roupas/itens da gravidez", "Preparação do enxoval", "Contas e despesas básicas", "Realização de exames"] },
        { n: 34, enunciado: "Tipo de moradia", tipo: "unica", outro: true, opcoes: ["Própria", "Alugada", "Cedida/Ocupação"] },
      ],
    },
    {
      titulo: "Saúde, alimentação e segurança alimentar",
      campos: [
        { n: 35, enunciado: "A gestante consegue realizar, no mínimo, 3 refeições por dia?", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Sempre", "Quase sempre", "Raramente", "Nunca"] } },
        { n: 36, enunciado: "Todos os integrantes da família conseguem realizar 3 refeições por dia?", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Sempre", "Quase sempre", "Raramente", "Nunca"] } },
        { n: 37, enunciado: "A gestante recebeu orientações sobre a importância do aleitamento materno exclusivo até os 6 meses?", tipo: "grade", grade: { linhas: ANTES_APOS, colunas: ["Sim, adequadas", "Sim, superficiais", "Não recebeu", "Não se aplica"] } },
        { n: 38, enunciado: "Altura da gestante em metros (atual)", tipo: "numero" },
        { n: 39, enunciado: "Peso da gestante antes de engravidar (aproximado, em kg)", tipo: "numero" },
        { n: 40, enunciado: "Peso atual da gestante (em kg)", tipo: "numero" },
        { n: 41, enunciado: "Nos últimos três meses, os alimentos acabaram antes que você tivesse dinheiro para comprar mais comida?", tipo: "unica", opcoes: ["Sim", "Não"] },
        { n: 42, enunciado: "Nos últimos três meses, você comeu apenas alguns alimentos que ainda tinha porque o dinheiro acabou?", tipo: "unica", opcoes: ["Sim", "Não"] },
        { n: 43, enunciado: "A caderneta de vacinação da gestante está atualizada?", tipo: "unica", opcoes: ["Sim, está atualizada", "Não, está atrasada", "Não sabe informar"] },
        { n: 44, enunciado: "Qual o motivo da vacinação não estar atualizada?", tipo: "multipla", outro: true, opcoes: ["Falta de informação", "Dificuldade de acesso à unidade de saúde", "Esquecimento / falta de tempo", "Orientação médica para adiar"], ajuda: "Pode marcar mais de uma opção." },
      ],
    },
    {
      titulo: "Percepção e satisfação",
      campos: [
        { n: 45, enunciado: "De 1 a 5, quanto o Cartão CRIA contribuiu para o bem-estar da gestante?", tipo: "grade", obrigatoria: true, grade: { linhas: ["Segurança financeira", "Alimentação", "Saúde da gestante", "Bem-estar emocional"], colunas: ["1", "2", "3", "4", "5"] } },
        { n: 46, enunciado: "O programa Cartão CRIA é de fácil acesso e entendimento?", tipo: "unica", obrigatoria: true, opcoes: ["Sim", "Parcialmente", "Não"] },
        { n: 47, enunciado: "De 1 a 5, quanto a gestante está satisfeita com o Cartão CRIA?", tipo: "escala", obrigatoria: true, escala: { min: 1, max: 5 }, ajuda: "1 — Não ajudou · 2 — Ajudou pouco · 3 — Razoavelmente · 4 — Bastante · 5 — Muito." },
        { n: 48, enunciado: "De 0 a 10, o quanto você recomendaria os benefícios do Cartão CRIA para um amigo ou familiar?", tipo: "escala", escala: { min: 0, max: 10 } },
        { n: 49, enunciado: "Por qual meio você soube da existência do Cartão CRIA?", tipo: "texto" },
      ],
    },
    {
      titulo: "Diário de campo",
      campos: [
        {
          n: 50, enunciado: "Registro de percepções qualitativas observadas durante a entrevista", tipo: "paragrafo", obrigatoria: true,
          ajuda: "Condições do território e da moradia; dinâmica familiar; acesso às políticas públicas; sinais de invisibilização social; segurança alimentar e bem-estar. Sem julgamentos de valor ou diagnósticos clínicos.",
        },
      ],
    },
  ],
};

export function totalPerguntas(p: PesquisaDemo): number {
  return p.secoes.reduce((s, sec) => s + sec.campos.length, 0);
}

export const PESQUISAS_DEMO: PesquisaDemo[] = [PESQUISA_CRIANCA, PESQUISA_GESTANTE];
