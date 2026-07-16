# ADR 0002: Better Auth organizations define authentication tenancy

## Status

Accepted

## Context

Users need a global identity, a role inside a company, and potentially a separate platform administration role. Storing one company role directly on a user cannot represent those boundaries safely.

## Decision

Use Better Auth with the Prisma, Organization, and Admin plugins. Organization memberships hold `owner`, `manager`, or `employee`. The Better Auth user role is reserved for `user` or platform `super_admin`. Domain rows are scoped by an organization-linked `BusinessProfile` whose ID equals the organization ID.

Workers join through verified, expiring invitations. Company creation is limited to one organization per initial owner. Production authentication email must use the configured webhook provider.

## Consequences

Company and platform permissions cannot be confused. Every domain query must resolve the active organization from the server session. Existing user rows cannot carry a direct company role or business ID.
