FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/

# Install ALL dependencies (including devDependencies needed for build)
# Explicitly unset NODE_ENV to prevent Coolify's production setting from skipping devDependencies
RUN NODE_ENV= pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configuration first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/

# Copy node_modules from deps stage BEFORE source code
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Restore pnpm workspace links (fast, uses existing node_modules)
RUN pnpm install --frozen-lockfile

# Ensure public directory exists (create if missing)
RUN mkdir -p apps/api/public

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS='--max-old-space-size=8192'
ENV SENTRY_DISABLE_SOURCEMAPS=1

RUN pnpm --filter api run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/apps/api/.next/standalone ./
COPY --from=builder /app/apps/api/.next/static ./apps/api/.next/static
COPY --from=builder /app/apps/api/public ./apps/api/public

# Set proper ownership
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/api/server.js"]
