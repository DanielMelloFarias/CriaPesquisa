# ── Etapa 1: build ────────────────────────────────────────────────────────────
FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Variáveis VITE_* são embutidas no bundle em tempo de build — não existe
# configurá-las depois, na hora de subir o contêiner. Por isso vêm como
# argumento de build, e por isso nenhum segredo pode entrar aqui: o que está no
# bundle é visível para qualquer pessoa que abrir o navegador.
ARG VITE_API_URL=/api
ARG VITE_EMAIL_DOMINIO=@exemplo.local
ARG VITE_SENHA_PADRAO=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_EMAIL_DOMINIO=$VITE_EMAIL_DOMINIO
ENV VITE_SENHA_PADRAO=$VITE_SENHA_PADRAO

RUN npm run build

# ── Etapa 2: servir ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
