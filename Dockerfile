# syntax=docker/dockerfile:1

# ---- Build stage ---------------------------------------------------------
FROM node:24-bookworm-slim AS build

# Toolchain for native modules (better-sqlite3, sharp).
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Bundle only (client + server). We intentionally skip `build.types` (tsc): type
# checking is a CI/local concern and must not gate the deployable artifact.
RUN npm run build.client && npm run build.server

# ---- Runtime stage -------------------------------------------------------
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000

# Litestream for continuous SQLite -> object-storage replication.
ARG LITESTREAM_VERSION=0.3.13
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget \
  && wget -qO /tmp/litestream.tar.gz \
     "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-amd64.tar.gz" \
  && tar -C /usr/local/bin -xzf /tmp/litestream.tar.gz \
  && rm /tmp/litestream.tar.gz \
  && apt-get purge -y wget && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# node_modules carries the Linux-compiled native modules from the build stage.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./package.json
COPY litestream.yml ./litestream.yml
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./docker/entrypoint.sh"]
