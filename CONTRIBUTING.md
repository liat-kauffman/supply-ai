# Contributing

Create focused branches and use Conventional Commits. Every change should include relevant tests and documentation. Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before opening a pull request. Never commit secrets or bypass approval and tenant boundaries.

Company authorization must use Better Auth organization membership permissions. Platform administration must use the independent `super_admin` role. Client state, email addresses, and request-provided organization IDs are never authorization evidence.
