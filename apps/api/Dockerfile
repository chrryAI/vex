FROM oven/bun:1 AS base

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs hono

# Copy only the API application files (no workspace dependencies)
COPY --chown=hono:nodejs apps/api ./apps/api
COPY --chown=hono:nodejs packages/db ./packages/db
COPY --chown=hono:nodejs packages/ui ./packages/ui

# Install ONLY the dependencies needed at runtime using Bun
# This will be much faster than pnpm
RUN cd apps/api && bun install --production

# Switch to non-root user
USER hono

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Run with Bun
CMD ["bun", "run", "apps/api/server.ts"]
