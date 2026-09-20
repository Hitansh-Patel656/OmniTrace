# Architecture — OmniTrace

## Related Documents

* [[requirements]]
* [[database]]
* [[api]]
* [[decisions]]
* [[features]]

## System Overview

OmniTrace is composed of five stages, each a separable TypeScript module under `src/`:

```
                    CHANNEL SOURCES
       Mobile App │ Website │ Call Center │ POS
                            │  raw events
                            ▼
            ┌─────────────────────────────────────┐
            │     INGESTION LAYER (REST API)       │
            │  POST /api/ingest/:channel           │
            │  Zod schema validation               │
            │  MongoDB raw event write             │
            │  (no Kafka — see ADR-003)            │
            └──────────────┬──────────────────────┘
                           │
                           ▼
            ┌─────────────────────────────────────┐
            │   IDENTITY RESOLUTION SERVICE        │
            │  src/services/identity.ts            │
            │                                      │
            │  Pass 1 — Deterministic              │
            │    email / phone / loyalty_id        │
            │    confidence = 1.0                  │
            │                                      │
            │  Pass 2 — Device/Cookie              │
            │    device_id / cookie_id             │
            │    confidence = 0.85                 │
            │                                      │
            │  Pass 3 — IP Proximity               │
            │    ip_address + 30-min window        │
            │    confidence = 0.80                 │
            │                                      │
            │  Merges → identity_links table       │
            └──────────────┬──────────────────────┘
                           │
                           ▼
            ┌─────────────────────────────────────┐
            │  EVENT NORMALIZATION & STITCHING     │
            │  src/services/stitching.ts           │
            │                                      │
            │  CANONICAL_TYPE_MAP (14 raw types)   │
            │  is_escalation / is_dropoff at write │
            │  raw_event_ref → MongoDB _id         │
            │  ORDER BY event_time ASC             │
            └──────────────┬──────────────────────┘
                           │
                           ▼
            ┌─────────────────────────────────────┐
            │     UNIFIED CUSTOMER TIMELINE        │
            │  PostgreSQL — timeline_events table  │
            └──────────┬──────────────────────────┘
                       │
           ┌───────────┴───────────┐
           ▼                       ▼
  ┌──────────────────┐   ┌───────────────────────────┐
  │ ANALYTICS ENGINE │   │  VISUALIZATION DASHBOARD   │
  │ src/services/    │   │  frontend/ (Next.js 16)    │
  │ analytics.ts     │   │                            │
  │                  │   │  /              Dashboard  │
  │  Churn risk      │   │  /customers     Explorer   │
  │  (ADR-005 rule)  │   │  /customers/[id] Timeline  │
  │                  │   │  /analytics/dropoffs       │
  │  Repeat contact  │   │  /analytics/escalations    │
  │  (contact count) │   │  /analytics/churn          │
  │                  │   │  /analytics/repeat         │
  │  → analytics_    │   │                            │
  │    flags table   │   │  API client: lib/api.ts    │
  └──────────────────┘   └───────────────────────────┘
```

## Module Responsibilities

### 1. Ingestion Layer — `src/routes/ingest.ts`

* Accepts raw events from each channel via `POST /api/ingest/:channel`.
* Validates the payload with Zod (requires at least one raw identifier, `event_type`, `timestamp`).
* Writes the raw event to **MongoDB** immediately — before any processing — so no event is lost on downstream failure.
* Returns `202 Accepted` with the MongoDB `_id` as the raw event reference.
* No Kafka or message broker — see **ADR-003** in `docs/decisions.md`.

### 2. Identity Resolution Service — `src/services/identity.ts`

* **Pass 1 — Deterministic**: exact match on `email`, `phone`, `loyalty_id`. Confidence **1.0**.
* **Pass 2 — Device/Cookie**: exact match on `device_id`, `cookie_id`. Confidence **0.85**.
* **Pass 3 — IP Proximity**: same `ip_address` within a 30-minute event window. Confidence **0.80**.
* Each resolved link is written to `identity_links` with its confidence score.
* New events are evaluated incrementally against existing links — no full recompute.
* Analyst override endpoints: `POST /api/identity/merge` and `POST /api/identity/split`.
* **ADR-007**: `ground_truth_customer_id` in the sample dataset is never read by this service — only used by the benchmark harness to score accuracy.
* **ADR-008**: When a customer's identifiers across two channels never co-appear in a single event, the engine cannot auto-merge. Analyst merge is the correct resolution path.

### 3. Event Normalization & Stitching — `src/services/stitching.ts`

* Maps every raw `event_type` string to a canonical form via `CANONICAL_TYPE_MAP` (14 entries covering all 4 channels).
* Sets `is_escalation = true` for known escalation event types at write time.
* Sets `is_dropoff = true` for known abandonment event types at write time.
* Stores the original MongoDB `_id` as `raw_event_ref` for audit traceability.
* Inserts normalized events into `timeline_events` ordered by `event_time ASC`.

### 4. Analytics Engine — `src/services/analytics.ts`

Runs as a batch pass over all customers in PostgreSQL after stitching completes.

* **Churn Risk (ADR-005)**: flags a customer `churn_risk` with score `0.95` when they have an unresolved escalation followed by ≥30 days of no activity across any channel.
* **Repeat Contact Detection**: counts distinct support contact initiations per customer:
  * `call_center` channel: one `call_initiated` event = one contact.
  * `web` channel: one `issue_reported` event = one contact.
  * Flags customers with ≥2 contacts as `repeat_contact` with score = contact count.
  * Issue category inferred from resolution status (`"Recurring Unresolved Issue"` or `"Repeat Support Contact"`).
* Both flag types are written to the `analytics_flags` table and cleared/recomputed on each engine run.

> **Note**: Churn detection is rule-based (ADR-005). ML-based churn scoring (Scikit-learn logistic regression) is listed as a future enhancement.

### 5. Analyst Dashboard — `frontend/`

* **Next.js 16** (Turbopack) React app served on port 3000.
* Calls the backend API exclusively via `frontend/src/lib/api.ts`.
* Dashboard personas (`DEMO_SCENARIOS`) resolve their customer UUIDs dynamically from the live DB on mount — no hardcoded UUIDs.
* Seven pages: Overview, Customer Explorer, Timeline Detail, Drop-off Funnel, Escalation Trends, Churn Radar, Repeat Contacts.

## Data Flow Summary

1. Event generated on a channel → `POST /api/ingest/:channel`.
2. Ingestion validates (Zod) → writes raw event to MongoDB.
3. `POST /api/engine/run` (or `npm run engine:benchmark`) triggers:
   a. Identity resolution assigns/confirms a `customer_id`.
   b. Stitching normalizes the event and inserts it into `timeline_events`.
   c. Analytics computes churn + repeat-contact flags into `analytics_flags`.
4. Dashboard queries the unified timeline and analytics results for display.

## Non-Functional Considerations

* **Latency**: identity resolution is incremental (new events re-evaluate existing links without recomputing the full graph).
* **Accuracy**: every identity merge carries a `confidence_score` — visible in the customer timeline view so analysts can audit and override.
* **Auditability**: `raw_event_ref` on every `timeline_event` links back to the original MongoDB document.
* **Precision over recall**: the engine deliberately avoids speculative merges that can't be confirmed by a shared identifier (ADR-008). The analyst merge endpoint is the escape hatch.
