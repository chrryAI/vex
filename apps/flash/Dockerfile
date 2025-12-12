FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/flash/package.json apps/flash/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/

# Install ALL dependencies (including devDependencies needed for build)
# Explicitly unset NODE_ENV to prevent production setting from skipping devDependencies
RUN NODE_ENV= pnpm install --frozen-lockfile

# Build the source code
FROM base AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace configuration first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/flash/package.json apps/flash/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/

# Copy node_modules from deps stage BEFORE source code
COPY --from=deps /app/node_modules ./node_modules

# Copy source code (this includes workspace packages)
COPY . .

# Remove node_modules to prevent pnpm from prompting for confirmation
RUN rm -rf node_modules

# Restore pnpm workspace links (install ALL dependencies including devDependencies for build)
RUN NODE_ENV= pnpm install --frozen-lockfile

# Build the Vite application (client + server)
ENV NODE_OPTIONS='--max-old-space-size=8192'

RUN pnpm --filter flash run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 viteuser

# Install pnpm for production dependencies
RUN npm install -g pnpm

# Copy package files for production install with proper ownership
COPY --chown=viteuser:nodejs package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=viteuser:nodejs apps/flash/package.json apps/flash/
COPY --chown=viteuser:nodejs packages/db/package.json packages/db/
COPY --chown=viteuser:nodejs packages/ui/package.json packages/ui/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application with proper ownership
COPY --chown=viteuser:nodejs --from=builder /app/apps/flash/dist ./apps/flash/dist
COPY --chown=viteuser:nodejs --from=builder /app/apps/flash/server.js ./apps/flash/
COPY --chown=viteuser:nodejs --from=builder /app/apps/flash/public ./apps/flash/public
COPY --chown=viteuser:nodejs --from=builder /app/apps/flash/index.html ./apps/flash/

# Copy workspace packages (needed for imports) with proper ownership
COPY --chown=viteuser:nodejs --from=builder /app/packages ./packages

# Switch to non-root user
USER viteuser

EXPOSE 5173

ENV PORT=5173
ENV HOST="0.0.0.0"

WORKDIR /app/apps/flash

CMD ["node", "server.js"]
