# Supplai

Supplai is a human-in-the-loop inventory operations platform for cafés. It gives managers one place to review stock health, supplier cutoffs, team access, and AI-assisted inventory counts while keeping operational changes under human control.

## What is included

- A responsive manager dashboard with stock, supplier, task, and recommendation views.
- Inventory search and filtering by status, category, and supplier.
- Manual inventory counts in half-unit increments.
- Photo-based count proposals through Gemini, with confidence, warnings, and explicit manager approval.
- Mobile supplier baskets that employees can adjust and send to managers for approval, with copy-ready approved order lists.
- Email/password authentication and email verification with Better Auth.
- Organization workspaces with `owner`, `manager`, and `employee` memberships.
- Receipt-driven onboarding that accepts one receipt per supplier, combines the extracted catalog with Gemini OCR, and then requires an editable review.
- Worker invitations and a separate platform `super_admin` role.
- PostgreSQL-backed inventory with immutable count movements and audit events.
- A Prisma domain model for locations, products, suppliers, inventory movements, and audit history.
- Independent web and worker health endpoints.

> [!IMPORTANT]
> Inventory, receipt history, dashboard metrics, and ordering recommendations are connected to organization-scoped PostgreSQL data. Purchase-order submission and persisted AI proposal review are still under development.

## Architecture

Supplai is a TypeScript modular monolith managed with pnpm and Turborepo:

```text
apps/
  web/       Next.js application, authentication, UI, and API routes
  worker/    Asynchronous worker runtime and health server
packages/
  database/  Prisma schema and shared PostgreSQL client
  domain/    Shared Zod schemas and approval rules
docs/adr/    Architecture decision records
scripts/     Administrative utilities
```

The system follows two core rules:

1. Inventory truth is represented by immutable movements instead of silently overwriting history.
2. AI output is a proposal. Only deterministic, role-checked application code may apply an approved change.

See [ADR 0001](docs/adr/0001-modular-monolith.md) and [ADR 0002](docs/adr/0002-better-auth-tenancy.md) for the architectural and tenancy decisions.

## Technology

| Area           | Tools                                                      |
| -------------- | ---------------------------------------------------------- |
| Web            | Next.js 15, React 19, TypeScript                           |
| UI             | Tailwind CSS 4, Radix UI primitives, Lucide icons, Zustand |
| Authentication | Better Auth with Prisma, Organization, and Admin plugins   |
| Database       | PostgreSQL 17, Prisma 6                                    |
| AI counting    | Gemini structured JSON responses                           |
| Email          | Resend, with an optional webhook fallback                  |
| Workspace      | pnpm 11, Turborepo                                         |
| Testing        | Vitest, ESLint, TypeScript, Prettier                       |

## Local development

### Requirements

- Node.js 22 or newer
- pnpm 11.9.0
- Docker Desktop or another Docker-compatible runtime

### 1. Configure the environment

```bash
cp .env.example .env
ln -s ../../.env apps/web/.env.local
```

The symlink lets both the root database commands and the Next.js app use the same local values. If `apps/web/.env.local` already exists, keep it. On systems where symlinks are inconvenient, copy `.env` to `apps/web/.env.local` instead.

Generate a strong authentication secret before signing in:

```bash
openssl rand -base64 32
```

Place the result in `BETTER_AUTH_SECRET` inside `.env`.

### 2. Start PostgreSQL

```bash
docker compose up -d postgres
```

The local database is exposed on port `5433` so it does not collide with a default PostgreSQL installation on `5432`.

### 3. Install and initialize

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

The seed creates the demo `Supply Café` organization and its business profile.

### 4. Run Supplai

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

| Service          | URL                                      |
| ---------------- | ---------------------------------------- |
| Web app          | `http://localhost:3000`                  |
| Web liveness     | `http://localhost:3000/api/health/live`  |
| Web readiness    | `http://localhost:3000/api/health/ready` |
| Worker liveness  | `http://localhost:3001/health/live`      |
| Worker readiness | `http://localhost:3001/health/ready`     |

## Environment variables

| Variable                 | Required               | Purpose                                                                                 |
| ------------------------ | ---------------------- | --------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | Yes                    | PostgreSQL connection used by Prisma and readiness checks.                              |
| `BETTER_AUTH_SECRET`     | Yes                    | Secret used to sign and secure authentication state. Use at least 32 random characters. |
| `BETTER_AUTH_URL`        | Yes                    | Public base URL for authentication callbacks and invitation links.                      |
| `RESEND_API_KEY`         | Production email       | Sends verification and invitation emails through Resend.                                |
| `AUTH_EMAIL_FROM`        | Production with Resend | Sender identity, for example `Supplai <onboarding@example.com>`.                        |
| `AUTH_EMAIL_WEBHOOK_URL` | Optional               | Alternative authentication-email delivery endpoint.                                     |
| `SUPER_ADMIN_USER_IDS`   | Optional               | Comma-separated Better Auth user IDs with platform administration access.               |
| `GEMINI_API_KEY`         | Optional               | Enables authenticated receipt extraction and inventory photo-count proposals.           |
| `GEMINI_MODEL`           | Optional               | Gemini model used by the receipt and photo-count routes.                                |
| `GEMINI_FALLBACK_MODEL`  | Optional               | Stable fallback used after transient Gemini capacity failures.                          |
| `LOG_LEVEL`              | Optional               | Application logging level.                                                              |

In development, authentication links are logged when neither Resend nor the webhook fallback is configured. Production refuses to discard authentication email silently.

## Authentication flow

1. Register at `/register`.
2. Verify the email address.
3. Create a company workspace during onboarding.
4. Add the first location and upload one receipt for each supplier.
5. Review and correct the OCR draft before Supplai creates suppliers, products, and opening inventory movements.
6. Invite workers from `/company/workers` as a manager or employee.

Organization membership controls company access. The global Better Auth role is reserved for ordinary platform users and `super_admin`; it is not used as a company role.

To promote an existing, verified account to platform administrator:

```bash
pnpm auth:bootstrap-admin you@example.com
```

The account must already exist. This command does not register a user or bypass email verification.

## Useful commands

| Command             | Purpose                                        |
| ------------------- | ---------------------------------------------- |
| `pnpm dev`          | Run the web and worker development processes.  |
| `pnpm build`        | Build every workspace package and application. |
| `pnpm lint`         | Run workspace lint checks.                     |
| `pnpm typecheck`    | Type-check all workspaces.                     |
| `pnpm test`         | Run the Vitest suites.                         |
| `pnpm format:check` | Check formatting without changing files.       |
| `pnpm format`       | Format the workspace with Prettier.            |
| `pnpm db:generate`  | Generate the Prisma client.                    |
| `pnpm db:migrate`   | Create or apply a development migration.       |
| `pnpm db:seed`      | Seed the demo organization.                    |

Run the same validation sequence used by CI with:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Safety model

- AI counts require an authenticated user and an active organization.
- Uploaded count images are limited to 10 MB and must use a supported image MIME type.
- Model output is schema-validated before it reaches the interface.
- Confidence and warnings remain visible to the reviewer.
- Owners and managers are the roles intended to approve operational changes.
- Company data is scoped through the active Better Auth organization.

## Project status

The repository contains the working application shell, authentication and tenancy foundation, receipt-driven business onboarding, organization-scoped inventory persistence, audited count movements, live dashboard and ordering recommendations, employee-to-manager basket approvals, copy-ready supplier lists, receipt history and exports, and Gemini receipt/photo extraction routes. The next major step is storing AI proposals before approval and expanding approved baskets into purchase orders with supplier transmission and receiving states.
