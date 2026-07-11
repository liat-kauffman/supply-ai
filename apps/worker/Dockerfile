FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @supply/worker... build

FROM node:22-alpine AS runner
ENV NODE_ENV=production HEALTH_PORT=3001
WORKDIR /app
RUN addgroup --system --gid 1001 supply && adduser --system --uid 1001 worker
COPY --from=builder --chown=worker:supply /app/apps/worker/dist ./dist
USER worker
EXPOSE 3001
CMD ["node", "dist/index.js"]
