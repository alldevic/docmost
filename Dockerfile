FROM node:22-alpine AS base
LABEL org.opencontainers.image.source="https://github.com/docmost/docmost"

FROM base AS builder

WORKDIR /app

RUN npm install -g pnpm@10.4.0

COPY patches patches
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json .npmrc crowdin.yml ./
COPY apps/client/package.json apps/client/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/editor-ext/package.json packages/editor-ext/package.json

RUN pnpm install --frozen-lockfile

COPY packages packages
RUN pnpm editor-ext:build

COPY apps/server apps/server
RUN NX_DAEMON=false pnpm server:build

COPY apps/client apps/client
RUN NX_DAEMON=false pnpm client:build

FROM base AS installer

RUN apk add --no-cache curl bash

RUN npm install -g pnpm@10.4.0

WORKDIR /app

# Copy apps
COPY --from=builder /app/apps/server/dist /app/apps/server/dist
COPY --from=builder /app/apps/client/dist /app/apps/client/dist
COPY --from=builder /app/apps/server/package.json /app/apps/server/package.json

# Copy packages
COPY --from=builder /app/packages/editor-ext/dist /app/packages/editor-ext/dist
COPY --from=builder /app/packages/editor-ext/package.json /app/packages/editor-ext/package.json

# Copy root package files
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm*.yaml /app/

# Copy patches
COPY --from=builder /app/patches /app/patches

RUN chown -R node:node /app

USER node

RUN pnpm install --frozen-lockfile --prod

RUN mkdir -p /app/data/storage

VOLUME ["/app/data/storage"]

EXPOSE 3000

CMD ["pnpm", "start"]
