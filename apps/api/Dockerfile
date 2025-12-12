FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install pnpm
RUN bun install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/

# Install dependencies with production flag to skip devDependencies
RUN pnpm install --frozen-lockfile --prod

# Production image - simplified, no build stage needed
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs hono

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy only necessary application files
COPY --chown=hono:nodejs apps/api ./apps/api
COPY --chown=hono:nodejs packages ./packages
COPY --chown=hono:nodejs package.json ./package.json

# Switch to non-root user
USER hono

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Run with Bun
CMD ["bun", "run", "apps/api/server.ts"]
