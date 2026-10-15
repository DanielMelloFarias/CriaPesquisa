# ── Etapa 1: build ────────────────────────────────────────────────────────────
FROM node:22-slim AS build

# O Prisma precisa do OpenSSL para gerar/rodar o client.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiamos só os manifestos primeiro: enquanto as dependências não mudarem, o
# Docker reaproveita esta camada e o build não refaz o npm ci.
COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
COPY referencias ./referencias
RUN npm run build

# Dados de referência lidos pelo seed (municípios). Ficam só nesta etapa: a
# imagem final não roda seed.
COPY data ./data

# ── Etapa 1b: dependências de produção ───────────────────────────────────────
# O prune fica numa etapa própria: a etapa `build` mantém o tsx, que o serviço
# `seed` do compose usa (o seed é TypeScript).
FROM build AS prod-deps
RUN npm prune --omit=dev

# ── Etapa 2: execução ─────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/referencias ./referencias
COPY --from=build /app/prisma ./prisma
COPY package.json ./

# Roda como usuário sem privilégio: se a aplicação for comprometida, o atacante
# não herda root dentro do contêiner. A imagem node já traz o usuário `node`.
USER node

EXPOSE 3333

# A sonda usa /api/health, que verifica o banco de verdade — um processo vivo
# sem banco não está saudável.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3333/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `node dist/server.js` direto (sem npm): assim o Node é o PID 1 e recebe o
# SIGTERM do orquestrador, que é o que dispara o encerramento gracioso.
CMD ["node", "dist/server.js"]
