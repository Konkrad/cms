# syntax=docker/dockerfile:1
#
# Two build targets from this one file, selected with `docker build --target=<name>`:
#
#   runtime         Theme baked in at `docker build` time. Slim final image,
#                    no build tooling kept around. The default (a bare
#                    `docker build .` with no --target builds this one, since
#                    it's the last stage in the file) — use it unless you
#                    specifically need the other target.
#                    docker build --target=runtime -t your-registry/cms:latest .
#
#   runtime-theme   Builds client+server at CONTAINER STARTUP instead, against
#                    whichever theme/ directory is mounted at /theme-src (falls
#                    back to this repo's own bundled theme/ if nothing is
#                    mounted). One published image then serves any theme —
#                    swap the mount and restart, no rebuild. Keeps full build
#                    tooling in the final image; pays for it in startup
#                    latency and a larger runtime image. See
#                    docs/deployment.md ("Runtime theme build") for the
#                    tradeoffs against the runtime target.
#                    docker build --target=runtime-theme -t your-registry/cms:runtime-theme .

# ---- Shared: installed deps (native-module toolchain + npm ci) -----------
FROM node:24-bookworm-slim AS deps

# Toolchain for native modules (better-sqlite3, sharp). ca-certificates is
# needed at runtime too (outbound TLS to S3/Stripe/Telegram/SMTP), not just
# for npm here — kept in both final images below, not purged.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ---- Shared: Litestream binary (fetched once, copied into both targets) --
FROM node:24-bookworm-slim AS litestream

ARG LITESTREAM_VERSION=0.3.13
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget \
  && wget -qO /tmp/litestream.tar.gz \
     "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-amd64.tar.gz" \
  && tar -C /usr/local/bin -xzf /tmp/litestream.tar.gz \
  && rm /tmp/litestream.tar.gz

# ---- Build: compiles client+server once, at `docker build` time ----------
# Only used by the `runtime` target below.
FROM deps AS build

# VITE_S3_BASE_URL is compiled into the client bundle (import.meta.env), so it MUST
# be available at build time — pass it via `docker build --build-arg`.
ARG VITE_S3_BASE_URL
ENV VITE_S3_BASE_URL=${VITE_S3_BASE_URL}

COPY . .

# Bundle only (client + server). We intentionally skip `build.types` (tsc): type
# checking is a CI/local concern and must not gate the deployable artifact.
RUN npm run build.client && npm run build.server

# ---- runtime-theme: builds at container startup against a mounted theme --
FROM deps AS runtime-theme

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream

COPY . .

COPY litestream.yml ./litestream.yml
COPY docker/entrypoint-runtime-theme.sh ./docker/entrypoint-runtime-theme.sh
RUN chmod +x ./docker/entrypoint-runtime-theme.sh

# Deployers mount their own theme/ directory here (read-only bind mount,
# ConfigMap, PVC, etc.) — see docker/entrypoint-runtime-theme.sh. When
# nothing is mounted, the entrypoint falls back to the image's own bundled
# theme/, copied in above via `COPY . .`.
VOLUME /theme-src

EXPOSE 3000

ENTRYPOINT ["./docker/entrypoint-runtime-theme.sh"]

# ---- runtime: slim final image, theme baked in ----------------------------
# Last stage in the file, so this is also what a bare `docker build .`
# (no --target) produces.
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# ca-certificates for outbound TLS at runtime (S3/Stripe/Telegram/SMTP, and
# Litestream's own S3 replication below) — this stage starts fresh from the
# base image, not from `deps`, so it needs its own copy.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream

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
