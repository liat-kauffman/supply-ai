# Vercel and Neon migration

This runbook moves the Next.js application from ECS to Vercel and PostgreSQL
from RDS to Neon without taking the current site down during preparation.

The existing AWS deployment workflow must remain enabled until the Vercel
deployment has passed production checks and the domain cutover is complete.

## Target architecture

- Vercel runs the `frontend` Next.js workspace, including its route handlers.
- Neon provides PostgreSQL.
- The standalone `backend` health service is not deployed.
- Vercel receives application secrets through its encrypted environment
  variables.
- Prisma Client uses Neon's pooled connection. Prisma CLI and database tools
  use Neon's direct connection.

## 1. Create Neon

Create one Neon project and choose a region close to the application's users.
Create or select an empty production database, then copy both connection
strings from Neon:

- `DATABASE_URL`: pooled hostname containing `-pooler`
- `DIRECT_URL`: direct hostname without `-pooler`

Do not commit either value. Before selecting the free plan, confirm that the
source database is smaller than the plan's storage allowance.

## 2. Make an initial data copy

Keep AWS serving traffic. Start the existing SSM port-forwarding session to the
private RDS endpoint, then perform the export from a second terminal. Store the
source and destination connection strings in temporary shell environment
variables rather than writing them to the repository.

```bash
pg_dump \
  --format=custom \
  --no-owner \
  --no-acl \
  --dbname="$SOURCE_DATABASE_URL" \
  --file="$TMPDIR/supplai-rds.dump"

pg_restore \
  --no-owner \
  --no-acl \
  --dbname="$NEON_DIRECT_URL" \
  "$TMPDIR/supplai-rds.dump"
```

Use direct connections for both `pg_dump` and `pg_restore`. If the Neon target
is not empty, stop and confirm the target before using any option that cleans or
overwrites existing objects.

Run committed migrations against Neon after the restore:

```bash
DATABASE_URL="$NEON_POOLED_URL" \
DIRECT_URL="$NEON_DIRECT_URL" \
pnpm --filter @supply/database migrate:deploy
```

## 3. Configure Vercel

Import the Git repository as one Vercel project with these settings:

- Framework: Next.js
- Root Directory: `frontend`
- Production branch: `main`
- Install and build commands: use `frontend/vercel.json`

Add these variables for Production. Use separate Neon branches and credentials
for Preview when previews need database access.

```text
DATABASE_URL
DIRECT_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
SUPER_ADMIN_USER_IDS
RESEND_API_KEY
AUTH_EMAIL_FROM
AUTH_EMAIL_WEBHOOK_URL
GEMINI_API_KEY
GEMINI_MODEL
GEMINI_FALLBACK_MODEL
ENABLE_DEMO_MODE
DEMO_USER_EMAIL
DEMO_USER_PASSWORD
```

Set `BETTER_AUTH_URL` to the temporary Vercel production URL for initial
testing. Change it to `https://supplai-pilot.com` immediately before the custom
domain cutover.

Do not put `prisma migrate deploy` in the Vercel build command. Preview builds
must not migrate the production database.

## 4. Validate the Vercel deployment

Use the temporary Vercel URL and verify:

1. `/api/health/live` and `/api/health/ready`
2. login, logout, sessions, and authorization roles
3. inventory reads and writes
4. receipt import and inventory photo analysis with files below 4 MB
5. AI workspace questions and generated reports
6. Resend email delivery
7. mobile layout and browser refreshes on authenticated pages

Compare important table counts between RDS and Neon. Do not switch DNS while
any required check is failing.

## 5. Final cutover

1. Prevent new writes in the AWS application or schedule a short maintenance
   window.
2. Take a fresh RDS dump.
3. Restore it into a clean Neon production database.
4. Run `prisma migrate deploy` against the direct Neon connection.
5. Recheck table counts and one production login.
6. Set Vercel's production `BETTER_AUTH_URL` to the custom HTTPS domain.
7. Add and verify the custom domain in Vercel.
8. Change DNS to Vercel.
9. Re-enable writes and perform the production smoke tests.

Keep AWS intact for 48 to 72 hours so DNS can be reversed if a serious problem
appears.

## 6. Retire AWS after the rollback window

Only after Vercel and Neon have remained healthy:

1. retain a final encrypted database backup according to the retention policy;
2. scale both ECS services to zero;
3. stop and then terminate the temporary database administration instance;
4. delete the load balancer and release public IPv4 resources;
5. delete RDS only after confirming the Neon data and backup;
6. remove unused ECR images, CloudWatch log groups, Secrets Manager secrets,
   IAM permissions, and security groups;
7. disable the AWS deployment job or replace it with validation-only CI.

Domain registration remains a separate recurring cost even when hosting and
database usage fit free allowances.
