FROM oven/bun:1 AS base

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs hono

# Copy workspace configuration files first
COPY --chown=hono:nodejs package.json ./package.json
COPY --chown=hono:nodejs bun.lockb ./bun.lockb 2>/dev/null || true

# Copy the application and its dependencies
COPY --chown=hono:nodejs apps/api ./apps/api
COPY --chown=hono:nodejs packages/db ./packages/db
COPY --chown=hono:nodejs packages/ui ./packages/ui
COPY --chown=hono:nodejs packages/eslint-config ./packages/eslint-config
COPY --chown=hono:nodejs packages/typescript-config ./packages/typescript-config

# Install dependencies using Bun
RUN bun install --production --cwd apps/api

# Switch to non-root user
USER hono

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Run with Bun
CMD ["bun", "run", "apps/api/server.ts"]
