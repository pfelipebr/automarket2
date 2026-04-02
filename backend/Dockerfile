# ── Etapa 1: build TypeScript ─────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Prisma requer openssl no Alpine
RUN apk add --no-cache openssl

# Instala dependências (incluindo devDependencies para o build)
COPY package*.json ./
RUN npm install

# Gera o Prisma Client
COPY prisma ./prisma
RUN npx prisma generate

# Compila o TypeScript
COPY . .
RUN npm run build

# ── Etapa 2: imagem de produção ───────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Prisma requer openssl no Alpine
RUN apk add --no-cache openssl

# Instala apenas dependências de produção
COPY package*.json ./
RUN npm install --omit=dev

# Copia o build e os artefatos necessários
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Script de entrypoint (executa migrations e inicia o servidor)
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s \
  CMD wget -q -O /dev/null http://localhost:3000/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
