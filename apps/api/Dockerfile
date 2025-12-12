FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy only package files for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

# Install all dependencies (hono is needed at runtime)
RUN pnpm install --frozen-lockfile

# Build only the DB package (UI package doesn't need building for API)
RUN cd packages/db && pnpm run build || true

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 hono

# Copy the ENTIRE node_modules including workspace structure
COPY --from=deps --chown=hono:nodejs /app ./

# Copy bunfig.toml for Bun path mappings
COPY --chown=hono:nodejs bunfig.toml ./bunfig.toml

# Copy application code
COPY --chown=hono:nodejs apps/api ./apps/api
COPY --chown=hono:nodejs packages ./packages

# Install Bun for runtime (much faster than Node)
RUN npm install -g bun

# Switch to non-root user
USER hono

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

# Run with Bun for better performance
CMD ["bun", "run", "apps/api/server.ts"]
