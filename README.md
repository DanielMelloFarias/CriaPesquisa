# CriaPesquisa

Sistema de pesquisas do **Cartão CRIA** — Secretaria de Estado da Primeira Infância de Alagoas (SECRIA).
Permite montar questionários, coletar respostas em campo, acompanhar indicadores em painel e auditar alterações.

## Stack

| Camada | Tecnologias |
|---|---|
| Frontend | React 18, Vite, TypeScript, styled-components, TanStack Query, React Router, Chart.js |
| Backend | Node.js, Express, TypeScript, Prisma, PostgreSQL, JWT, Zod |
| Testes | Vitest (backend e frontend), Supertest |

## Estrutura

```
backend/     API REST (Express + Prisma)
  prisma/    schema, seed e definição das pesquisas
  scripts/   Postgres embutido para dev e utilitários
  src/       controllers, models, routes, middleware, helpers
frontend/    SPA React (Vite)
docs/        modelo ER e documentação das pesquisas
```

## Pré-requisitos

- Node.js 22+
- PostgreSQL — **opcional**: o projeto sobe um Postgres embutido em dev (`npm run db`), sem precisar instalar nada. Também há um `docker-compose.yml` se preferir container.

## Como rodar

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # ajuste os valores
npm run db                  # sobe o Postgres embutido na porta 5433 (deixe aberto)
npm run prisma:deploy       # aplica as migrations e cria o schema
npx prisma generate
npm run seed                # popula usuários, municípios e as pesquisas
npm run dev                 # API em http://localhost:3333/api
```

> Atalho: `npm run dev:full` sobe **banco + API** num comando só (Ctrl+C encerra os dois).

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173
```

## Variáveis de ambiente

### `backend/.env`

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | não | Porta da API (padrão `3333`) |
| `DATABASE_URL` | **sim** | String de conexão do PostgreSQL |
| `JWT_SECRET` | **em produção** | Segredo de assinatura dos tokens. Com `NODE_ENV=production` a API **recusa subir** sem ele |
| `JWT_EXPIRES` | não | Validade do token (padrão `8h`) |
| `SEED_PASSWORD` | não | Senha inicial das contas criadas pelo seed |
| `SEED_EMAIL_DOMINIO` | não | Domínio dos e-mails das contas-base (padrão `@exemplo.local`) |
| `CORS_ORIGIN` | não | Origens permitidas, separadas por vírgula |
| `TRUST_PROXY` | **atrás de proxy** | De quem aceitar o `X-Forwarded-For`. Atrás de proxies em rede privada (contêineres), `uniquelocal`; um número conta saltos. Sem isso o rate limit enxerga o IP do proxy e trata a instituição inteira como um IP só |

### `frontend/.env`

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | URL base da API (ex.: `http://localhost:3333/api`) |
| `VITE_EMAIL_DOMINIO` | Domínio usado ao montar e-mails na criação de usuários |
| `VITE_SENHA_PADRAO` | Pré-preenche a senha no formulário de novo usuário (deixe vazio em produção) |

## Scripts

**Backend**

| Comando | O que faz |
|---|---|
| `npm run dev` | API em modo watch |
| `npm run db` | Sobe o Postgres embutido (porta 5433) |
| `npm run dev:full` | Banco + API juntos |
| `npm run seed` | Popula o banco |
| `npm run prisma:deploy` | Aplica as migrations pendentes (usar no deploy) |
| `npm run prisma:migrate` | Cria uma nova migration a partir de mudanças no schema (dev) |
| `npm run backup` | Gera um dump em `backups/` e aplica a retenção |
| `npm run restaurar -- <arquivo> --confirmar` | Restaura um dump (destrutivo) |
| `npm run build` / `npm start` | Compila / roda a build |
| `npm test` | Testes (Vitest) |

**Frontend**

| Comando | O que faz |
|---|---|
| `npm run dev` | Vite em modo dev |
| `npm run build` | Type-check + build de produção |
| `npm test` | Testes (Vitest) |

## Perfis de acesso

O seed cria quatro contas-base, uma por papel: **ADMIN**, **GESTOR**, **COLETADOR** e **VISUALIZADOR**.
A senha delas vem de `SEED_PASSWORD`, e as quatro nascem marcadas como **senha provisória**.

### Primeiro acesso

Toda conta criada pelo seed ou por um administrador nasce com senha que **outra pessoa conhece**.
Enquanto ela não for trocada, o sistema não consegue afirmar quem agiu — e é exatamente isso
que a trilha de auditoria precisa afirmar. Por isso:

1. Quem recebe a conta entra com a senha provisória.
2. O sistema leva direto para a tela de troca e **não libera nenhuma outra tela** antes disso.
3. A partir daí, só essa pessoa sabe a senha.

Depois, a troca fica disponível a qualquer momento em **Trocar senha**, no menu lateral.
Um administrador pode redefinir a senha de alguém que perdeu o acesso — e essa senha também
entra como provisória.

### Política de senha

Mínimo de **10 caracteres**, com recusa de sequências (`123456…`), repetições (`aaaaaa…`),
senhas só numéricas e palavras óbvias (`senha`, `cria`, `admin`…).

Não exigimos maiúscula, número e símbolo de propósito: seguindo a orientação atual do
NIST (SP 800-63B), regra de composição produz `Senha@123` e senha colada no monitor.
Comprimento e lista de bloqueio protegem mais. Uma frase curta é uma ótima senha.

## Backup

Os dados são de beneficiários: backup não é opcional, e **backup que nunca foi restaurado
é só um arquivo**. Exercite a restauração num banco de teste de tempos em tempos.

```bash
cd backend
npm run backup                                    # gera backups/criapesquisa-<data>.dump
npm run restaurar -- backups/<arquivo>.dump --confirmar
```

Requer o `pg_dump`/`pg_restore` do pacote cliente do PostgreSQL (o Postgres embutido de
desenvolvimento traz só os binários de servidor). Se não estiverem no PATH, aponte
`PG_DUMP` e `PG_RESTORE`.

| Variável | Padrão | Para quê |
|---|---|---|
| `BACKUP_DIR` | `backups` | Onde gravar |
| `BACKUP_RETENCAO` | `30` | Quantos dumps manter (nunca apaga o último) |

**Agende a execução** — no Linux, um `cron` diário; no Windows, o Agendador de Tarefas:

```cron
0 3 * * * cd /opt/criapesquisa/backend && npm run backup >> /var/log/criapesquisa-backup.log 2>&1
```

`backups/` está no `.gitignore` e precisa continuar assim: os dumps contêm respostas,
IPs e hashes de senha. Guarde uma cópia **fora do servidor** — backup que mora junto do
banco não protege contra perda da máquina.

## Deploy

Roteiro para a VM da SECRIA, a partir do código no GitHub. Em todos os comandos abaixo,
`C` é um atalho:

```bash
C="docker compose -f docker-compose.prod.yml --env-file .env.prod"
```

Sobem quatro serviços: `postgres`, `migracao` (aplica as migrations e sai), `api` e `web`
(nginx servindo o front e encaminhando `/api`). A API só inicia depois que a migração termina
bem. O Postgres **não expõe porta no host** (acesso administrativo só por túnel), e o TLS
**termina num proxy à frente do `web`** — não sirva o sistema em HTTP na internet.
`TRUST_PROXY=uniquelocal` já vem no compose: é o que faz o limite de tentativas de login (e a
auditoria) enxergar o IP real de quem chama, tanto com só o nginx na frente quanto com mais um
proxy antes dele (o Traefik do Coolify, por exemplo).

### Primeira instalação

1. **Pré-requisitos na VM:** Docker com o plugin `compose`, `git`, e o domínio já apontando
   para o proxy com HTTPS que vai encaminhar para a porta do `web` (`WEB_PORT`, padrão 8080).

2. **Código:**

   ```bash
   git clone https://github.com/mraphaely/CriaPesquisa.git /opt/criapesquisa
   cd /opt/criapesquisa
   ```

3. **Configuração:** `cp .env.prod.example .env.prod` e preencha (cada variável está
   comentada no arquivo). Gere os segredos assim:

   ```bash
   openssl rand -hex 24      # POSTGRES_PASSWORD (hex: não precisa de escape dentro da DATABASE_URL)
   openssl rand -base64 48   # JWT_SECRET
   ```

   - `DATABASE_URL` usa a mesma senha do `POSTGRES_PASSWORD` e o host `postgres`.
   - `CORS_ORIGIN` = o endereço público do sistema (`https://…`, sem barra no final).
   - `SEED_PASSWORD` = senha inicial das contas-base. Precisa atender à política de senha
     (o seed recusa senha fraca em produção). Combine com a coordenação como ela vai ser
     entregue — ela abre as quatro contas-base até a primeira troca.
   - `.env.prod` nunca vai para o Git (já está no `.gitignore`).

4. **Subir:**

   ```bash
   $C up -d --build
   $C ps                                   # api e web "healthy"; migracao "exited (0)"
   curl -s http://localhost:8080/api/health   # {"status":"ok", ... "banco":"ok"}
   ```

5. **Seed (uma vez):** contas-base, municípios e as pesquisas do Cartão CRIA.

   ```bash
   $C --profile seed run --rm seed
   ```

   Saída esperada: `Seed concluído.`

6. **Pergunta "Semana gestacional atual"** (idempotente):

   ```bash
   $C --profile seed run --rm seed npx tsx scripts/adicionar-semana-gestacional.ts
   ```

   Numa instalação nova a saída é `já existia: <id>` — o seed já cria a pergunta. Em banco
   antigo é `pergunta criada: <id>`. **Saída vazia significa que o script não rodou**: pare e
   reporte.

7. **Importar os indicadores da planilha** (uma vez):
   1. A coordenação entrega a planilha "Exportação Indicadores" em `.xlsx`, por canal privado,
      com o conteúdo das colunas "DtRegistro" e "Usuario" apagado (os títulos ficam — o
      importador confere o cabeçalho). Copie para a VM em `/tmp/indicadores.xlsx`.
      **Nunca** coloque o arquivo dentro do repositório (o `.gitignore` bloqueia `*.xlsx`).
   2. Confirme que o arquivo existe: `ls -l /tmp/indicadores.xlsx`. **Se não existir, pare**
      (com o arquivo ausente o docker cria um diretório vazio nesse caminho).
   3. Rode:

      ```bash
      $C --profile seed run --rm -v /tmp/indicadores.xlsx:/tmp/indicadores.xlsx:ro \
        seed npx tsx scripts/importar-indicadores.ts /tmp/indicadores.xlsx
      ```

   4. A primeira linha da saída deve ser
      `110 lidas · 23 importadas pelo mapa · 79 por sugestão · 0 já existiam · 18 auxiliares`.
      Saída vazia = o script não rodou. Rodar de novo é seguro: o que já foi importado (e
      revisado) não é tocado.
   5. Apague o arquivo: `rm /tmp/indicadores.xlsx`.

8. **Ativar os indicadores com definição pronta** (idempotente; passa pela mesma validação e
   auditoria da tela de revisão):

   ```bash
   $C --profile seed run --rm seed npx tsx scripts/ativar-indicadores-prontos.ts
   ```

   Saída esperada: `34 ativados · 0 recusados`. Se algum for recusado, a saída diz qual e por
   quê; ele continua "para revisar" na tela Indicadores. Os demais indicadores importados
   ficam para a revisão da coordenação na tela **Indicadores** (menu Administração).

9. **Reinicie a API** (o cache dos indicadores vive no processo dela e não enxerga o que os
   scripts gravaram):

   ```bash
   $C restart api
   ```

10. **Primeiro acesso:** entre com `admin<SEED_EMAIL_DOMINIO>` e a `SEED_PASSWORD`; o sistema
    leva direto para a troca de senha (ver [Primeiro acesso](#primeiro-acesso)). As outras três
    contas-base (gestor, coletador, visualizador) usam a mesma senha provisória: entregue a
    quem vai usar ou desative em **Usuários**.

11. **Backup:** agende `scripts/backup-docker.sh` (o `npm run backup` roda no host e não alcança
    o banco, que não publica porta). Ele faz o `pg_dump` dentro do contêiner, grava em
    `backups/` e aplica a retenção (`BACKUP_RETENCAO`, padrão 30):

    ```cron
    0 3 * * * cd /opt/criapesquisa && ./scripts/backup-docker.sh >> /var/log/criapesquisa-backup.log 2>&1
    ```

    Guarde uma cópia **fora da VM** — backup que mora junto do banco não protege contra perda
    da máquina. Teste a restauração num banco de teste:

    ```bash
    $C exec -T postgres createdb -U cria_user restauro_teste
    $C exec -T postgres pg_restore -U cria_user -d restauro_teste --no-owner < backups/<arquivo>.dump
    ```

### Atualizar uma instalação existente

```bash
cd /opt/criapesquisa
git pull
$C up -d --build      # a migração roda sozinha antes da API
```

**Antes de subir a versão que trouxe a importação de indicadores** (num banco que já
existia): ela remove a coluna antiga `Indicador.origemPlanilha`. Confira que está vazia — tem
de imprimir `0`:

```bash
$C exec -T postgres psql -U cria_user -d criapesquisa -tAc 'SELECT count(*) FROM "Indicador" WHERE "origemPlanilha" IS NOT NULL'
```

Os scripts dos passos 6 a 8 são idempotentes: numa atualização, rode os que ainda não foram
rodados naquele banco e depois `$C restart api`.

## Segurança e dados pessoais

Este sistema lida com dados de beneficiários (LGPD). Cuidados adotados no repositório:

- `.env` e `backups/` são **ignorados pelo Git** — backups contêm respostas, IPs e hashes de senha e **nunca** devem ser versionados.
- Nenhuma credencial real fica no código: senhas e segredos vêm de variáveis de ambiente.
- `JWT_SECRET` é obrigatório em produção (sem fallback previsível).
- As alterações são registradas em log de auditoria, com exclusão lógica (soft-delete).
- O login tem limite de 10 tentativas malsucedidas por IP a cada 15 minutos (login correto não conta).
- Senha só pode ser trocada pela própria pessoa.
- Conta com senha provisória (definida pelo seed ou por um admin) é travada **na API**, não só na tela: até a troca, qualquer rota além de `GET /api/auth/me` e `PUT /api/auth/senha` responde `403 SENHA_PROVISORIA`.
- Usuário desativado ou removido perde o acesso **na hora**: o token é conferido contra o banco a cada requisição, sem esperar expirar — e o papel vale o que está no banco, não o que estava no token.
- `/api/health` consulta o banco: a API não se declara saudável se não consegue ler dados.
- `SIGTERM` encerra com calma — as requisições em andamento terminam antes do processo sair.
- As listagens têm teto de 200 itens por página: ninguém leva a base inteira numa requisição só.
- O log de acesso registra método, rota, IP, status e tempo — com `Authorization` e `Cookie` redigidos.
- O cálculo de indicadores carrega a base aprovada inteira a cada requisição: uma única resposta antiga com itens duplicados faz o endpoint de indicadores responder `409 DADO_INCONSISTENTE` para qualquer filtro (respostas novas já não podem ser salvas com duplicidade).
- O schema evolui por migrations versionadas (`prisma/migrations/`), não por `db push`.

## Direitos e licença

Este repositório é publicado **sem licença de uso**. Na ausência de uma licença explícita,
**todos os direitos são reservados**: o código pode ser lido e consultado, mas não é
concedida permissão de uso, cópia, modificação ou redistribuição.

O software foi desenvolvido no contexto de um programa da **Secretaria de Estado da
Primeira Infância de Alagoas (SECRIA)**. A definição de uma licença (e a eventual
liberação como software público) cabe à instituição responsável pela titularidade —
até lá, esta condição permanece.

Nenhum dado pessoal de beneficiários acompanha este repositório: os dados de exemplo
são sintéticos e os backups reais estão fora do controle de versão.
