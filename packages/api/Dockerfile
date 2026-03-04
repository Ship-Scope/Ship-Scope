# ============================================================
# Stage 1: Build
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files for npm workspaces resolution
COPY package.json package-lock.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/

# Install ALL dependencies (including devDependencies for tsc)
RUN npm ci --workspace=packages/core --workspace=packages/api --include-workspace-root

# Copy source code for core (shared types) and api
COPY packages/core/ ./packages/core/
COPY packages/api/ ./packages/api/

# Build core first (api depends on it), then api
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=packages/api

# Generate Prisma client for production
RUN npx prisma generate --schema=packages/api/prisma/schema.prisma

# ============================================================
# Stage 2: Production
# ============================================================
FROM node:20-slim AS production

# Install OpenSSL for Prisma (required by node:20-slim)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace config
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/

# Install production dependencies only
RUN npm ci --workspace=packages/core --workspace=packages/api \
    --include-workspace-root --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist

# Copy Prisma schema and generated client
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 shipscope && \
    chown -R shipscope:nodejs /app
USER shipscope

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy --schema=packages/api/prisma/schema.prisma && node packages/api/dist/index.js"]
