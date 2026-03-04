# ============================================================
# Stage 1: Build
# ============================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files (no lockfile — resolves platform-native packages)
COPY package.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/web/package.json ./packages/web/

# Install dependencies
# --ignore-scripts skips the husky prepare hook which isn't needed in Docker
RUN npm install --workspace=packages/core --workspace=packages/web --include-workspace-root --ignore-scripts

# Copy source
COPY packages/core/ ./packages/core/
COPY packages/web/ ./packages/web/

# Build web (core is types-only, no build needed)
RUN npm run build --workspace=packages/web

# ============================================================
# Stage 2: Production (nginx)
# ============================================================
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY packages/web/nginx.conf /etc/nginx/conf.d/shipscope.conf

# Copy built assets from builder stage
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html

# Run nginx as non-root
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
