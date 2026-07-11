# Supplying

Supplying is a human-in-the-loop inventory operations assistant for a single café. It helps managers review stock, supplier cutoffs, receipts, and AI recommendations without allowing AI to silently change inventory or place orders.

## Local setup

Requirements: Node.js 22+, pnpm 11+, and Docker.

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`. Web liveness is at `/api/health/live`, readiness at `/api/health/ready`, and worker health at `http://localhost:3001/health/live`.

## Architecture

This repository is a modular monolith with two runtimes:

- `apps/web`: Next.js manager PWA and deterministic API layer.
- `apps/worker`: asynchronous job intake and, in later phases, LangGraph proposal workflows.
- `packages/domain`: typed schemas and authorization-independent business safeguards.
- `packages/database`: Prisma schema and PostgreSQL access.

The event ledger is authoritative. AI output is always stored as a proposal with evidence and confidence; approval-gated services perform all business writes. See [ADR 0001](docs/adr/0001-modular-monolith.md).

## Validation

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker compose config
```

AWS, Kubernetes, LangGraph, receipt, and photo workflows belong to later roadmap phases and are intentionally not simulated in Phase 1.
