# ADR 0001: Modular monolith with approval-gated AI

## Status

Accepted

## Context

One café does not require distributed domain services, but web requests and long-running AI/OCR jobs have different runtime characteristics. AI output must never become inventory truth without manager approval.

## Decision

Use one TypeScript monorepo with `web` and `worker` runtimes sharing domain and database packages. Store inventory as immutable movements. Treat model output as versioned proposals; only deterministic, role-checked application services may commit transactions after approval.

## Consequences

Deployment stays understandable while workers can scale independently. Domain changes remain atomic. AI workflows require an explicit proposal and approval boundary, adding a small amount of orchestration in exchange for auditability and safety.
