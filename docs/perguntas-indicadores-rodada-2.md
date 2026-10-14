# Indicadores do Cartão CRIA — perguntas da 2ª rodada

Obrigado pelas respostas da 1ª rodada (`docs/perguntas-indicadores-abertas.md`): nove das
treze ficaram fechadas. Quatro respostas, ao virar cálculo, esbarraram em algo que só
apareceu agora. Cada item explica o problema em duas linhas e traz alternativas — dá para
responder só com a letra. Onde está **(sugestão)**, é o que adotaríamos se você concordar.

## 1. Desnutrição e obesidade pelo percentil da própria amostra

Você escolheu o percentil da própria amostra (resposta 10-b). O problema: por definição,
10% de qualquer grupo fica abaixo do P10 desse mesmo grupo, e 15% fica acima do P85. Então,
calculado sobre todas as crianças, o resultado seria sempre ~10% de desnutrição e ~15% de
obesidade — em qualquer ano, com ou sem o programa. Além disso, o IMC muda muito com a
idade: um corte único compara bebês com crianças de 5 anos.

- a) usar as curvas da OMS por idade e sexo (o padrão da Caderneta da Criança) — **(sugestão)**
- b) manter o percentil da amostra, mas só para comparar municípios/regionais contra o estado
  (o número do estado inteiro fica fixo em ~10% e ~15% e não é exibido)
- c) outra: \_\_\_

## 2. Índice Socioeconômico Familiar em z-score

Você escolheu z-score (resposta 9-b). O z-score diz quantos desvios-padrão cada família está
acima ou abaixo da média. Duas consequências: a média do grupo de referência é sempre zero, e
o valor não fica entre 0 e 100 (vai de cerca de −3 a +3).

**2.1. Contra quem cada família é comparada?**

- a) todas as famílias entrevistadas da mesma pesquisa (Criança ou Gestante) — **(sugestão)**
- b) todas as famílias das duas pesquisas juntas
- c) outra: \_\_\_

**2.2. Como mostrar no painel?**

- a) média do z-score do recorte filtrado (município, regional): positivo = acima da média do
  estado, negativo = abaixo — **(sugestão)**
- b) converter para 0–100 (percentil da família dentro da referência) e mostrar a média
- c) mostrar as duas coisas

**2.3. Peso dos três componentes (renda, escolaridade, moradia):**

- a) iguais — média simples dos três z-scores — **(sugestão)**
- b) pesos diferentes — quais? \_\_\_

## 3. IMC da gestante pela tabela de Atalah

Você escolheu a tabela de Atalah (resposta 11-d). Ela classifica o IMC conforme a semana da
gestação, mas o questionário da Gestante não pergunta a semana gestacional nem a data da
última menstruação. A única pergunta de tempo é "Quando iniciou o pré-natal?" (antes ou
depois de 12 semanas), que não serve para isso.

- a) incluir no questionário a pergunta "Semana gestacional atual" (número) e usar Atalah;
  enquanto as respostas antigas não tiverem esse dado, elas ficam fora da classificação — **(sugestão)**
- b) incluir "Data da última menstruação (DUM)" e calcular a semana a partir dela
- c) não incluir pergunta e classificar o IMC atual pelas faixas comuns de adulto

(O IMC pré-gestacional usa as faixas comuns de adulto em qualquer das alternativas.)

## 4. CPUER — quantas consultas valem 100

Você escolheu o preconizado pelo Ministério da Saúde para a idade (resposta 4-a). A idade
sai da "Data de nascimento da criança". Falta fixar a tabela. A pergunta é "Número de
consultas de puericultura no último ano", então o esperado é o dos 12 meses antes da entrevista.

- a) Caderneta da Criança: 7 consultas no 1º ano de vida (1ª semana, 1, 2, 4, 6, 9 e 12 meses),
  2 no 2º ano (18 e 24 meses) e 1 por ano a partir do 3º ano. A criança que fez o esperado
  ou mais vale 100; abaixo disso, proporcional (ex.: 4 de 7 = 57) — **(sugestão)**
- b) outra tabela — qual? \_\_\_

Como a idade cruza o ano (uma criança de 18 meses viveu parte do 1º e parte do 2º ano nos
últimos 12 meses):

- c) usar a faixa da idade atual na data da entrevista — mais simples — **(sugestão)**
- d) somar proporcionalmente os meses vividos em cada faixa — mais exato

## Respostas (Emerson, 2026-10-14)

Todas as sugestões foram aceitas:

| Item | Resposta |
|---|---|
| 1 | **a** — curvas da OMS por idade e sexo |
| 2.1 | **a** — referência: todas as famílias da mesma pesquisa |
| 2.2 | **a** — painel mostra a média do z-score do recorte filtrado |
| 2.3 | **a** — pesos iguais |
| 3 | **a** — incluir "Semana gestacional atual" e classificar por Atalah; respostas antigas sem o dado ficam fora |
| 4 | **a** + **c** — tabela da Caderneta, faixa pela idade na data da entrevista |
