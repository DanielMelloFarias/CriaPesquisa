# Dicionário de dados — Pesquisas do Cartão CRIA

> Gerado automaticamente por `backend/scripts/gerar-dicionario.ts` a partir do banco.
> Fonte da verdade das definições: `backend/prisma/pesquisas-cartao-cria.ts`. Não editar à mão.

**Convenções de modelagem** (o sistema não tem tipo grade/matriz):
- Grades *Antes/Após o Cartão CRIA* e *Gestação anterior/atual* → uma pergunta por linha.
- Grade de nota 1–5 por dimensão → uma pergunta **Número** por dimensão.
- Grade de caixas (marcar vários) → **Múltipla escolha** por linha.
- Opção "Outro:" do Google Forms → opção **Outro** (sem campo de texto acoplado).
- Escalas 1–5 e 0–10 → **Número** (permite média/funil no painel).

## Cartão CRIA — Criança

**Status:** PUBLICADA · **Seções:** 7 · **Perguntas:** 64 · **Obrigatórias:** 6

### Identificação

| # | Pergunta | Tipo | Obrig. | Opções |
|---|---|---|:--:|---|
| 1 | Nome completo da entrevistado(a) | Texto | ✔ | — |
| 2 | CPF | Texto | ✔ | — |
| 3 | NIS | Texto |  | — |
| 4 | Zona | Escolha única |  | Rural; Urbana |
| 5 | Município | Texto |  | — |
| 6 | Grau de parentesco da beneficiário(a) com a criança | Escolha única |  | Mãe; Pai; Avós; Outro |
| 7 | Orientação sexual | Escolha única |  | Heterossexual; Homossexual; Bissexual; Assexual; Pansexual |
| 8 | Sexo biológico | Escolha única |  | Masculino; Feminino; Intersexo |
| 9 | Identidade de gênero | Escolha única |  | Cisgênero; Transgênero; Outro |
| 10 | Idade | Número |  | — |
| 11 | Raça | Escolha única |  | Branca; Preta; Parda; Amarelo; Indígena |
| 12 | Estado civil | Escolha única |  | Solteira; Casada/União estável; Separada; Viúva; Outro |
| 13 | Escolaridade | Escolha única |  | Não estudou; Fundamental incompleto; Fundamental completo; Médio incompleto; Médio completo; Superior incompleto; Superior completo |
| 14 | A família pertence a Grupos Populacionais Tradicionais e Específicos? | Escolha única |  | Família Agricultores; Família de Assentamento (Movimento MST); Família Acampada; Família de Catadores de Material Reciclável; Família de Comunidade Tradicional de Terreiro; Família de Pescadores; Família Ribeirinha; Família Extrativista; Família Romani (Cigana); Família de Preso do Sistema Carcerário; Família Quilombola; Família Atingida por Empreendimentos de Infraestrutura; Família Beneficiária do Programa Nacional do Crédito Fundiário; Família Indígena; Famílias refugiadas ou imigrantes internacionais; Família em situação de rua; Nenhuma; Outro |
| 15 | Nome da criança | Texto |  | — |
| 16 | CPF da criança | Texto |  | — |
| 17 | Data de nascimento da criança | Data |  | — |
| 18 | Sexo biológico da criança | Escolha única |  | Masculino; Feminino; Intersexo |

### Perfil da criança (Desenvolvimento e Educação)

| # | Pergunta | Tipo | Obrig. | Opções |
|---|---|---|:--:|---|
| 19 | A criança está na educação infantil | Escolha única |  | Creche CRIA; Creche (Outra); Pré-escola; Não faz parte a nenhum grupo |

### Condições Socioeconômicas

| # | Pergunta | Tipo | Obrig. | Opções |
|---|---|---|:--:|---|
| 20 | Número de pessoas na residência | Número |  | — |
| 21 | Quantas crianças de 0–6 anos no domicílio | Número |  | — |
| 22 | Renda mensal total da família (R$) | Número |  | — |
| 23 | Benefícios que a criança/família recebia ANTES do Cartão CRIA (federal/estadual/municipal) | Múltipla escolha |  | Bolsa Família; Incentivo Municipal; BPC |
| 24 | Benefícios que a criança/família recebe APÓS o Cartão CRIA (federal/estadual/municipal) | Múltipla escolha |  | Bolsa Família; Incentivo Municipal; BPC |
| 25 | Ocupação do responsável principal | Escolha única |  | Empregado, formal; Empregado, informal; Desempregado; Aposentado; Estudante |
| 26 | Tipo de moradia | Escolha única |  | Própria; Alugada; Cedida/Ocupação; Outro |
| 27 | Em que dia, mês e ano você fez o cadastro/atualização no CRAS para solicitar o Cartão CRIA? | Data | ✔ | — |
| 28 | Em que dia, mês e ano você começou a receber o benefício do Cartão CRIA? | Data | ✔ | — |
| 29 | Há quanto tempo a família recebe o benefício do Cartão CRIA? | Escolha única | ✔ | Menos de 6 meses; Entre 6 meses - 1 ano; Entre 1 - 2 anos; Entre 2 - 3 anos; Entre 3 - 4 anos; Entre 4 - 5 anos; Entre 5 anos - 5 anos e 11 meses |
| 30 | Em que o benefício é mais utilizado?<br><sub>Marcar até 3</sub> | Múltipla escolha |  | Alimentação da criança; Alimentação da família; Transporte para consultas; Medicamentos e vitaminas; Contas e despesas básicas; Realização de exames; Outro |
| 31 | Você se considera a principal responsável pelos cuidados e sustento da criança, sem o apoio de um companheiro(a)? | Escolha única |  | Sim; Não |

### Participação no Cartão CRIA

| # | Pergunta | Tipo | Obrig. | Opções |
|---|---|---|:--:|---|
| 32 | Recebeu visitas do Serviço de Proteção Social Básica no Domicílio (Programa Criança Feliz) — ANTES do Cartão CRIA | Escolha única |  | Sim, pouca frequência; Sim, muita frequência; Não |
| 33 | Recebeu visitas do Serviço de Proteção Social Básica no Domicílio (Programa Criança Feliz) — APÓS o Cartão CRIA | Escolha única |  | Sim, pouca frequência; Sim, muita frequência; Não |
| 34 | A criança e a família participam de atividades propostas pelo CRAS? — ANTES do Cartão CRIA | Escolha única |  | Sim; Não |
| 35 | A criança e a família participam de atividades propostas pelo CRAS? — APÓS o Cartão CRIA | Escolha única |  | Sim; Não |
| 36 | Quais dificuldades você enfrenta em relação ao Cartão CRIA da criança? | Múltipla escolha |  | Bloqueio ou suspensão do benefício; Atraso no pagamento; Dificuldade de transporte para sacar ou utilizar o benefício; Falta de informações claras sobre regras e condicionalidades; Dificuldade de acesso ou atendimento no CRAS; Problemas no Aplicativo CAIXA TEM; Não há dificuldade; Outro |

### Saúde, Alimentação e Segurança Alimentar

| # | Pergunta | Tipo | Obrig. | Opções |
|---|---|---|:--:|---|
| 37 | A criança consegue realizar 3 refeições por dia — ANTES do Cartão CRIA | Escolha única |  | Sempre; Quase sempre; Raramente; Nunca |
| 38 | A criança consegue realizar 3 refeições por dia — APÓS o Cartão CRIA | Escolha única |  | Sempre; Quase sempre; Raramente; Nunca |
| 39 | Desde que passaram a receber o Cartão CRIA, as frequências das refeições diárias da família | Escolha única |  | Aumentou muito; Aumentou pouco; Não mudou; Diminuiu |
| 40 | Todos os integrantes da família conseguem realizar 3 refeições por dia — ANTES do Cartão CRIA | Escolha única |  | Sempre; Quase sempre; Raramente; Nunca |
| 41 | Todos os integrantes da família conseguem realizar 3 refeições por dia — APÓS o Cartão CRIA | Escolha única |  | Sempre; Quase sempre; Raramente; Nunca |
| 42 | Nos últimos três meses, os alimentos acabaram antes que você tivesse dinheiro para comprar mais comida? | Escolha única |  | Sim; Não |
| 43 | Nos últimos três meses, você comeu apenas alguns alimentos que ainda tinha porque o dinheiro acabou? | Escolha única |  | Sim; Não |
| 44 | Houve aleitamento materno exclusivo até os 6 meses (crianças de 0–6 meses) — ANTES do Cartão CRIA | Escolha única |  | Sim, recebeu exclusivamente leite materno; Não, recebia fórmula/leite além do leite materno; Não, já recebia alimentos além do leite materno; Não mamou no peito |
| 45 | Houve aleitamento materno exclusivo até os 6 meses (crianças de 0–6 meses) — APÓS o Cartão CRIA | Escolha única |  | Sim, recebeu exclusivamente leite materno; Não, recebia fórmula/leite além do leite materno; Não, já recebia alimentos além do leite materno; Não mamou no peito |
| 46 | Classificação do peso ao nascer | Escolha única |  | Baixo peso ao nascer (< 2.500 g); Muito baixo peso (< 1.500 g); Extremo baixo peso (< 1.000 g); Peso normal |
| 47 | Altura da criança em metros (atual) | Número |  | — |
| 48 | Peso da criança em kg (atual) | Número |  | — |
| 49 | A criança possui diagnóstico de deficiência ou síndrome | Escolha única |  | Não; Sim, diagnóstico de Síndrome Congênita por Zika; Outro |
| 50 | A criança já teve consulta odontológica — ANTES do Cartão CRIA | Escolha única |  | Sim; Não |
| 51 | A criança já teve consulta odontológica — APÓS o Cartão CRIA | Escolha única |  | Sim; Não |
| 52 | Carteira de vacinação da criança atualizada — ANTES do Cartão CRIA | Escolha única |  | Sim; Não; Não soube informar |
| 53 | Carteira de vacinação da criança atualizada — APÓS o Cartão CRIA | Escolha única |  | Sim; Não; Não soube informar |
| 54 | Número de consultas de puericultura no último ano | Número |  | — |
| 55 | A família tem dificuldade de levar a criança às consultas na UBS? | Escolha única |  | Não; Sim, transporte; Sim, falta de vaga; Sim, trabalho/cuidado com outros filhos; Sim, distância; Outro |
| 56 | A criança recebeu suplementação de ferro nos últimos 12 meses?<br><sub>Para crianças de 6 meses a 1 ano e 11 meses</sub> | Escolha única |  | Sim, no último ano; Sim, nos últimos 6 meses; Não; Não sabe; Sim, em tratamento (para crianças acima de 1 ano e 11 meses) |
| 57 | A criança recebeu vitamina A no último ano?<br><sub>Para crianças de 6 meses a 4 anos e 11 meses</sub> | Escolha única |  | Sim, no último ano; Sim, nos últimos 6 meses; Não; Não sabe; Não se aplica, sendo maior que 5 anos |

### Bem-estar, Segurança e Autonomia

| # | Pergunta | Tipo | Obrig. | Opções |
|---|---|---|:--:|---|
| 58 | De 1 a 5, quanto o Cartão CRIA contribuiu para o bem-estar da família?<br><sub>Escala de 1 a 5</sub> | Número |  | — |

### Percepção e Satisfação

| # | Pergunta | Tipo | Obrig. | Opções |
|---|---|---|:--:|---|
| 59 | O programa Cartão CRIA é de fácil acesso e entendimento? | Escolha única |  | Sim; Parcialmente; Não |
| 60 | De 1 a 5, quanto a família está satisfeita com o Cartão CRIA?<br><sub>Escala de 1 a 5</sub> | Número |  | — |
| 61 | A família recomenda que o programa continue/expanda? | Escolha única |  | Sim; Não; Não sabe |
| 62 | Em uma escala de 0 a 10, o quanto você recomendaria os benefícios do Cartão CRIA para um amigo ou familiar?<br><sub>Escala de 0 a 10</sub> | Número |  | — |
| 63 | Por qual meio você soube da existência do Cartão CRIA? | Texto |  | — |
| 64 | Diário de Campo<br><sub>Registro objetivo de percepções observadas durante a entrevista, considerando quando pertinentes: condições do território e da moradia; dinâmica familiar e cuidado com a criança; acesso às políticas públicas; sinais de invisibilização social; segurança alimentar e bem-estar da família e da criança. Sem julgamentos de valor, interpretações pessoais ou diagnósticos clínicos.</sub> | Campo aberto | ✔ | — |

## Cartão CRIA — Gestante

**Status:** PUBLICADA · **Seções:** 5 · **Perguntas:** 63 · **Obrigatórias:** 16

### Identificação

| # | Pergunta | Tipo | Obrig. | Opções |
|---|---|---|:--:|---|
| 1 | Nome completo da beneficiária | Texto | ✔ | — |
| 2 | CPF | Texto |  | — |
| 3 | NIS<br><sub>Número de Identificação Social — usado em programas sociais como Bolsa Família ou CadÚnico.</sub> | Texto | ✔ | — |
| 4 | Zona<br><sub>Você mora na zona rural (sítio, povoado) ou na cidade?</sub> | Escolha única | ✔ | Rural; Urbana |
| 5 | Município | Escolha única | ✔ | Água Branca; Anadia; Arapiraca; Atalaia; Barra de Santo Antônio; Barra de São Miguel; Batalha; Belém; Belo Monte; Boca da Mata; Branquinha; Cacimbinhas; Cajueiro; Campestre; Campo Alegre; Campo Grande; Canapi; Capela; Carneiros; Chã Preta; Coité do Nóia; Colônia Leopoldina; Coqueiro Seco; Coruripe; Craíbas; Delmiro Gouveia; Dois Riachos; Estrela de Alagoas; Feira Grande; Feliz Deserto; Flexeiras; Girau do Ponciano; Ibateguara; Igaci; Igreja Nova; Inhapi; Jacaré dos Homens; Jacuípe; Japaratinga; Jaramataia; Jequiá da Praia; Joaquim Gomes; Jundiá; Junqueiro; Lagoa da Canoa; Limoeiro de Anadia; Maceió; Major Isidoro; Mar Vermelho; Maragogi; Maravilha; Marechal Deodoro; Maribondo; Mata Grande; Matriz de Camaragibe; Messias; Minador do Negrão; Monteirópolis; Murici; Novo Lino; Olho d'Água das Flores; Olho d'Água do Casado; Olho d'Água Grande; Olivença; Ouro Branco; Palestina; Palmeira dos Índios; Pão de Açúcar; Pariconha; Paripueira; Passo de Camaragibe; Paulo Jacinto; Penedo; Piaçabuçu; Pilar; Pindoba; Piranhas; Poço das Trincheiras; Porto Calvo; Porto de Pedras; Porto Real do Colégio; Quebrangulo; Rio Largo; Roteiro; Santa Luzia do Norte; Santana do Ipanema; Santana do Mundaú; São Brás; São José da Laje; São José da Tapera; São Luís do Quitunde; São Miguel dos Campos; São Miguel dos Milagres; São Sebastião; Satuba; Senador Rui Palmeira; Tanque d'Arca; Taquarana; Teotônio Vilela; Traipu; União dos Palmares; Viçosa |
| 6 | Orientação sexual<br><sub>Como você se identifica em relação à sua orientação afetiva? (Se preferir não responder, pode deixar em branco.)</sub> | Escolha única |  | Heterossexual; Homossexual; Bissexual; Assexual; Pansexual; Outro |
| 7 | Sexo biológico | Escolha única |  | Feminino; Intersexo; Outro |
| 8 | Identidade de gênero | Escolha única |  | Cisgênero; Transgênero |
| 9 | Idade | Número |  | — |
| 10 | Raça<br><sub>Como você se considera em relação à sua cor?</sub> | Escolha única |  | Branca; Preta; Parda; Amarelo; Indígena |
| 11 | Estado civil | Escolha única |  | Solteira; Casada/União estável; Separada; Viúva; Outro |
| 12 | Escolaridade<br><sub>Até que série você estudou?</sub> | Escolha única |  | Não estudou; Fundamental incompleto; Fundamental completo; Médio incompleto; Médio completo; Superior incompleto; Superior completo |
| 13 | A família pertence a Grupos Populacionais Tradicionais e Específicos?<br><sub>Sua família faz parte de algum desses grupos?</sub> | Escolha única |  | Família Agricultores; Família de Assentamento (Movimento MST); Família Acampada; Família de Catadores de Material Reciclável; Família de Comunidade Tradicional de Terreiro; Família de Pescadores; Família Ribeirinha; Família Extrativista; Família Romani (Cigana); Família de Preso do Sistema Carcerário; Família Quilombola; Família Atingida por Empreendimentos de Infraestrutura; Família Beneficiária do Programa Nacional do Crédito Fundiário; Família Indígena; Famílias refugiadas ou imigrantes internacionais; Família em situação de rua; Nenhuma; Outro |
| 14 | Qual a gestação?<br><sub>Essa é sua primeira gravidez ou você já teve outras?</sub> | Escolha única |  | 1ª Gestação; 2ª Gestação; 3ª Gestação; 4ª Gestação; 5ª Gestação; Superior a 5 gestações |
| 15 | Quantos partos você já teve?<br><sub>Quantos filhos você já teve antes desta gravidez?</sub> | Escolha única |  | 1 parto; 2 partos; 3 partos; 4 partos; 5 partos; 6 partos ou mais |
| 16 | Houve gestação planejada? — Gestações anteriores<br><sub>Gravidez planejada: houve preparo antes de engravidar (conversar sobre ter o bebê, orientação no posto de saúde, acompanhamento médico, organizar condições). Sem planejamento prévio = não planejada.</sub> | Escolha única |  | Sim; Não |
| 17 | Houve gestação planejada? — Gestação atual | Escolha única |  | Sim; Não |

### Participação no Cartão CRIA

| # | Pergunta | Tipo | Obrig. | Opções |
|---|---|---|:--:|---|
| 18 | Em que dia, mês e ano você fez o cadastro/atualização no CRAS para solicitar o Cartão CRIA?<br><sub>Você lembra aproximadamente quando fez o cadastro no CRAS para pedir o Cartão CRIA?</sub> | Data | ✔ | — |
| 19 | Em que dia, mês e ano você começou a receber o benefício do Cartão CRIA? | Data | ✔ | — |
| 20 | Após o cadastro no CRAS, quanto tempo demorou para você começar a receber o Cartão CRIA durante a gestação? | Escolha única |  | Recebi em até 30 dias; Entre 31 e 90 dias; Entre 91 e 120 dias; Mais de 120 dias; Ainda não comecei a receber |
| 21 | Recebeu visitas do Serviço de Proteção Social Básica no Domicílio (Programa Criança Feliz) — ANTES do Cartão CRIA | Escolha única |  | Sim, pouca frequência; Sim, muita frequência; Não |
| 22 | Recebeu visitas do Serviço de Proteção Social Básica no Domicílio (Programa Criança Feliz) — APÓS o Cartão CRIA | Escolha única |  | Sim, pouca frequência; Sim, muita frequência; Não |
| 23 | A gestante e a família participam de atividades propostas pelo CRAS? — ANTES do Cartão CRIA<br><sub>Atividades podem incluir: reuniões, palestras, acompanhamento familiar e/ou grupos de gestantes. Ações promovidas pela Assistência Social.</sub> | Escolha única |  | Sim; Não |
| 24 | A gestante e a família participam de atividades propostas pelo CRAS? — APÓS o Cartão CRIA | Escolha única |  | Sim; Não |
| 25 | Recebeu alguma orientação sobre aleitamento materno? — Gestações anteriores | Escolha única |  | Sim; Não |
| 26 | Recebeu alguma orientação sobre aleitamento materno? — Gestação atual | Escolha única |  | Sim; Não |
| 27 | Quando iniciou o pré-natal?<br><sub>Pré-natal é o acompanhamento da gestação por profissionais de saúde (consultas em posto de saúde com enfermeira ou médico).</sub> | Escolha única |  | Iniciou antes de 12 semanas (3 meses); Iniciou após 12 semanas (3 meses); Não soube informar; Sem pré-natal |
| 28 | Tipo de risco da gestação<br><sub>Alto risco: quando a gestante ou o bebê precisam de acompanhamento mais cuidadoso (ex.: pressão alta, diabetes, anemia grave, infecção, gravidez de gêmeos, idade muito jovem ou avançada, histórico de complicações). Pode haver encaminhamento a serviços especializados/maternidades de referência.</sub> | Escolha única | ✔ | Risco habitual (baixo); Alto risco (ex.: hipertensão, diabetes, idade materna, histórico) |
| 29 | Exames laboratoriais obrigatórios realizados (protocolo do Ministério da Saúde) — Gestações anteriores<br><sub>Sumário/urocultura = exames de urina; testes rápidos = sífilis e HIV; ultrassom = ver o bebê.</sub> | Múltipla escolha |  | Urocultura; Sumário de urina; Exames de sangue; Testes rápidos; Ultrassom |
| 30 | Exames laboratoriais obrigatórios realizados (protocolo do Ministério da Saúde) — Gestação atual | Múltipla escolha |  | Urocultura; Sumário de urina; Exames de sangue; Testes rápidos; Ultrassom |
| 31 | Quais dificuldades você enfrenta em relação ao Cartão CRIA? | Múltipla escolha |  | Bloqueio ou suspensão do benefício; Atraso no pagamento; Dificuldade de transporte para sacar ou utilizar o benefício; Falta de informações claras sobre regras e condicionalidades; Dificuldade de acesso ou atendimento no CRAS; Problemas no Aplicativo CAIXA TEM; Não há dificuldade; Outro |

### Condições Socioeconômicas

| # | Pergunta | Tipo | Obrig. | Opções |
|---|---|---|:--:|---|
| 32 | Número de pessoas na residência<br><sub>Contar todas as pessoas que moram na casa da gestante.</sub> | Número |  | — |
| 33 | Quantas crianças de 0 a 6 anos vivem no domicílio (além da criança que está sendo gestada)? | Escolha única | ✔ | 1 criança; 2 crianças; 3 crianças; 4 crianças; 5 crianças ou mais; Não há crianças |
| 34 | Renda mensal total da família (R$)<br><sub>Somar todas as fontes de renda da casa (salários de todos os moradores).</sub> | Número |  | — |
| 35 | Benefícios que a gestante/família recebia ANTES do Cartão CRIA (federal/estadual/municipal) | Múltipla escolha |  | Bolsa Família; Incentivo Municipal; BPC |
| 36 | Benefícios que a gestante/família recebe APÓS o Cartão CRIA (federal/estadual/municipal) | Múltipla escolha |  | Bolsa Família; Incentivo Municipal; BPC |
| 37 | Atualmente, qual é a situação de trabalho da gestante? | Escolha única | ✔ | Emprego formal (com carteira assinada); Trabalho informal (sem carteira assinada); Trabalho por conta própria / autônoma; Desempregada; Estudante; Trabalho doméstico não remunerado (do lar); Afastada do trabalho / em auxílio-doença ou licença; Não trabalha no momento |
| 38 | Você se considera a principal responsável pelos cuidados e sustento durante toda a gestação, sem o apoio de um companheiro(a)? | Escolha única |  | Sim; Não |
| 39 | Em que o benefício é mais utilizado?<br><sub>Marcar até 3</sub> | Múltipla escolha |  | Alimentação da gestante; Alimentação da família; Transporte para consultas; Medicamentos e vitaminas; Roupas/itens da gravidez; Preparação do enxoval; Contas e despesas básicas; Realização de exames; Outro |
| 40 | Tipo de moradia | Escolha única |  | Própria; Alugada; Cedida/Ocupação; Outro |

### Saúde, Alimentação e Segurança Alimentar

| # | Pergunta | Tipo | Obrig. | Opções |
|---|---|---|:--:|---|
| 41 | A gestante consegue realizar, no mínimo, 3 refeições por dia? — ANTES do Cartão CRIA | Escolha única |  | Sempre; Quase sempre; Raramente; Nunca |
| 42 | A gestante consegue realizar, no mínimo, 3 refeições por dia? — APÓS o Cartão CRIA | Escolha única |  | Sempre; Quase sempre; Raramente; Nunca |
| 43 | Todos os integrantes da família conseguem realizar 3 refeições por dia — ANTES do Cartão CRIA | Escolha única |  | Sempre; Quase sempre; Raramente; Nunca |
| 44 | Todos os integrantes da família conseguem realizar 3 refeições por dia — APÓS o Cartão CRIA | Escolha única |  | Sempre; Quase sempre; Raramente; Nunca |
| 45 | A gestante recebeu orientações sobre a importância do aleitamento materno exclusivo até os 6 meses? — ANTES do Cartão CRIA | Escolha única |  | Sim, recebeu orientações adequadas; Sim, recebeu orientações superficiais; Não recebeu orientações; Não se aplica |
| 46 | A gestante recebeu orientações sobre a importância do aleitamento materno exclusivo até os 6 meses? — APÓS o Cartão CRIA | Escolha única |  | Sim, recebeu orientações adequadas; Sim, recebeu orientações superficiais; Não recebeu orientações; Não se aplica |
| 47 | Qual a altura da gestante em metros (atual)? | Número |  | — |
| 48 | Qual era o peso da gestante antes de engravidar (aproximadamente)?<br><sub>em kg</sub> | Número |  | — |
| 49 | Qual é o peso atual da gestante?<br><sub>em kg</sub> | Número |  | — |
| 50 | Semana gestacional atual<br><sub>Semanas completas de gestação (número inteiro de 1 a 42)</sub> | Número |  | — |
| 51 | Nos últimos três meses, os alimentos acabaram antes que você tivesse dinheiro para comprar mais comida? | Escolha única |  | Sim; Não |
| 52 | Nos últimos três meses, você comeu apenas alguns alimentos que ainda tinha porque o dinheiro acabou? | Escolha única |  | Sim; Não |
| 53 | A caderneta/carteira de vacinação da gestante está atualizada conforme orientação da unidade de saúde? | Escolha única |  | Sim, está atualizada; Não, está atrasada; Não sabe informar |
| 54 | Qual o motivo da vacinação não estar atualizada?<br><sub>Pode marcar mais de uma opção</sub> | Múltipla escolha |  | Falta de informação; Dificuldade de acesso à unidade de saúde; Esquecimento / falta de tempo; Orientação médica para adiar; Outro |

### Percepção e Satisfação

| # | Pergunta | Tipo | Obrig. | Opções |
|---|---|---|:--:|---|
| 55 | De 1 a 5, quanto o Cartão CRIA contribuiu para o bem-estar da gestante — Segurança financeira<br><sub>Escala de 1 a 5</sub> | Número | ✔ | — |
| 56 | De 1 a 5, quanto o Cartão CRIA contribuiu para o bem-estar da gestante — Alimentação<br><sub>Escala de 1 a 5</sub> | Número | ✔ | — |
| 57 | De 1 a 5, quanto o Cartão CRIA contribuiu para o bem-estar da gestante — Saúde da gestante<br><sub>Escala de 1 a 5</sub> | Número | ✔ | — |
| 58 | De 1 a 5, quanto o Cartão CRIA contribuiu para o bem-estar da gestante — Bem-estar emocional<br><sub>Escala de 1 a 5</sub> | Número | ✔ | — |
| 59 | O programa Cartão CRIA é de fácil acesso e entendimento? | Escolha única | ✔ | Sim; Parcialmente; Não |
| 60 | De 1 a 5, quanto a gestante está satisfeita com o Cartão CRIA?<br><sub>1 — Não ajudou; 2 — Ajudou pouco; 3 — Ajudou razoavelmente; 4 — Ajudou bastante; 5 — Ajudou muito</sub> | Número | ✔ | — |
| 61 | Em uma escala de 0 a 10, o quanto você recomendaria os benefícios do Cartão CRIA para um amigo ou familiar?<br><sub>Escala de 0 a 10</sub> | Número |  | — |
| 62 | Por qual meio você soube da existência do Cartão CRIA? | Texto |  | — |
| 63 | Diário de Campo<br><sub>Registro objetivo de percepções observadas durante a entrevista, considerando quando pertinentes: condições do território e da moradia; dinâmica familiar e cuidado com a criança; acesso às políticas públicas; sinais de invisibilização social; segurança alimentar e bem-estar da família e da criança. Sem julgamentos de valor, interpretações pessoais ou diagnósticos clínicos.</sub> | Campo aberto | ✔ | — |
