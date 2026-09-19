# Project Instructions — OmniTrace

## Project

OmniTrace is a cross-channel identity-resolution and event-stitching platform
built for a hackathon (PS-4: Cross-Channel Journey Stitching).

It ingests customer interaction events from multiple channels (mobile app, website,
call center, in-person/POS), resolves them to a single unified customer identity,
stitches them into one chronological timeline, and surfaces drop-offs, escalations,
unresolved issues, churn patterns, and repeat-contact patterns to analysts via a
dashboard.

## Core Modules

1. **Ingestion layer** — accepts raw events from each channel (Kafka or REST API), validates schema.
2. **Identity resolution engine** — deterministic (email/phone/loyalty ID) + probabilistic
   (device fingerprint, IP, behavioral proximity) matching. Produces a unified `customer_id`.
3. **Event stitching / normalization service** — converts channel-specific events into a
   common schema and orders them chronologically per customer.
4. **Analytics engine** — detects drop-offs, escalations, unresolved issues, churn correlation,
   repeat-contact patterns (Python / Scikit-learn).
5. **Analyst dashboard** — React/Next.js frontend with journey timeline view, funnel view,
   churn/repeat-contact charts (Recharts/D3).

## Before Making Changes

Before modifying code:

1. Inspect the existing project structure.
2. Read the relevant documentation in `docs/`.
3. Understand the existing implementation.
4. Avoid unnecessary architectural changes without discussing them first.

## Documentation

Important project documentation:

* `docs/requirements.md` — PS-4 problem statement and deliverables
* `docs/architecture.md` — system architecture and data flow
* `docs/database.md` — database schema (PostgreSQL unified timeline, MongoDB raw events)
* `docs/api.md` — API endpoint documentation
* `docs/decisions.md` — architectural decisions log (ADRs)
* `docs/features/` — one file per feature (identity-resolution.md, dashboard.md, ingestion.md, etc.)
* `docs/research/` — notes on identity resolution techniques, churn modeling, etc.

## Coding Rules

* Keep the identity-resolution logic isolated from the stitching/normalization logic — separate services/modules.
* Use TypeScript for the frontend and any Node.js backend services.
* Use Python for identity-resolution matching, analytics, and ML (Scikit-learn).
* Keep functions small and modular; one responsibility per module.
* Do not modify the database schema without documenting the change in `docs/database.md` and `docs/decisions.md`.
* Add tests for identity-resolution matching logic and event-stitching logic — these are the highest-risk areas for bugs.
* Since this is a hackathon build, favor working, demoable functionality over premature optimization — but call out any shortcuts taken so they can be fixed later if time allows.

## Testing

Before considering a feature complete:

1. Run the relevant tests.
2. Check for errors.
3. Verify that existing functionality (especially identity resolution and timeline stitching) still works.

## Documentation Rules

When a change affects:

* architecture → update `docs/architecture.md`
* database schema → update `docs/database.md`
* API behavior → update `docs/api.md`
* major technical decisions (e.g., choosing Kafka vs. simple REST polling, matching algorithm choice) → update `docs/decisions.md`
* a specific feature → update the matching file in `docs/features/`

## Git

* Do not create commits unless explicitly asked.
* Before making large changes, explain what will be changed and why.

## Workflow

1. Understand the existing code and relevant docs.
2. Explain the proposed change before implementing it.
3. Implement the change.
4. Run tests.
5. Update documentation if architecture, schema, API, or feature behavior changed.
