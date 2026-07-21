FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @supply/database generate
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@supply/database", "migrate:deploy"]
