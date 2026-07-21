FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @supply/backend... build

FROM node:22-alpine AS runner
ENV NODE_ENV=production HEALTH_PORT=3001
WORKDIR /app
RUN addgroup --system --gid 1001 supply && adduser --system --uid 1001 worker
COPY --from=builder --chown=worker:supply /app/backend/dist ./dist
USER worker
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health/ready >/dev/null || exit 1
CMD ["node", "dist/index.js"]
