FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS builder
COPY . .
RUN if [ -L frontend/.env.local ]; then unlink frontend/.env.local; fi
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @supply/frontend... build

FROM node:22-alpine AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/frontend/public ./frontend/public
USER nextjs
EXPOSE 3000
CMD ["node", "frontend/server.js"]
