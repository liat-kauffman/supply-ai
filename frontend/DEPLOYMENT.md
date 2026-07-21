# Frontend deployment — Vercel

Create a Vercel project from this repository and set its **Root Directory** to
`frontend`. Keep **Include source files outside of the Root Directory** enabled
because the frontend imports `packages/database` and `packages/domain`.

The checked-in `vercel.json` installs the root pnpm workspace and builds this
Next.js project. Add these production environment variables in Vercel:

- `DATABASE_URL` — the AWS RDS PostgreSQL URL ending in `?sslmode=require`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` — the public Vercel/custom-domain URL
- `RESEND_API_KEY` and `AUTH_EMAIL_FROM`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` when overriding defaults
- `SUPER_ADMIN_USER_IDS` when platform administration is enabled

Provision the production database using
`backend/aws/rds-postgres.yaml`. Store the resulting RDS URL as a Vercel secret;
never copy the local Docker URL into production.

Run database migrations against RDS before the first deployment and whenever a
release contains a new Prisma migration:

```bash
DATABASE_URL="postgresql://user:url-encoded-password@rds-endpoint:5432/supplai?sslmode=require" \
  pnpm --filter @supply/database migrate:deploy
```

This is a full-stack Next.js project: its authenticated server components,
Better Auth handler, and `/api` route handlers run as Vercel Functions. They
must be able to reach the production PostgreSQL database.

Keep RDS private when Vercel has private connectivity into the AWS VPC. For a
direct public RDS connection, allow only a stable Vercel outbound CIDR in the
RDS security group. Never allow `0.0.0.0/0` on port 5432.
