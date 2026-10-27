# --------------------------------
# Dependencies
# --------------------------------
FROM node:22-bookworm-slim AS dependencies

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
       ca-certificates \
       openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci


# --------------------------------
# Build
# --------------------------------
FROM dependencies AS build

COPY prisma.config.ts tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
RUN npm run build


# --------------------------------
# Runtime
# --------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
       ca-certificates \
       openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci \
    && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY prisma.config.ts ./
COPY prisma ./prisma

# Nur erforderlich, falls der generierte Prisma Client
# außerhalb von dist liegt:
# COPY --from=build /app/generated ./generated

USER node

EXPOSE 3000

CMD ["npm", "run", "start"]
