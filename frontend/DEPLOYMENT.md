# Frontend deployment — Vercel

Create a Vercel project from this repository and set its **Root Directory** to
`frontend`. Keep **Include source files outside of the Root Directory** enabled
because the frontend imports `packages/database` and `packages/domain`.

The checked-in `vercel.json` installs the root pnpm workspace and builds this
Next.js project. Add these production environment variables in Vercel:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` — the public Vercel/custom-domain URL
- `RESEND_API_KEY` and `AUTH_EMAIL_FROM`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` when overriding defaults
- `SUPER_ADMIN_USER_IDS` when platform administration is enabled

Run database migrations against the production database before the first
deployment:

```bash
DATABASE_URL="postgresql://..." pnpm --filter @supply/database migrate:deploy
```

This is a full-stack Next.js project: its authenticated server components,
Better Auth handler, and `/api` route handlers run as Vercel Functions. They
must be able to reach the production PostgreSQL database.
