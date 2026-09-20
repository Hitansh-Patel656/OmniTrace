# OmniTrace — Cross-Channel Journey Stitching Platform

> **PS-4: Cross-Channel Journey Stitching**  
> A unified identity-resolution and event-stitching platform that stitches customer interactions across app, web, call-center, and in-person channels into a single, analyst-ready journey timeline.

---

## Problem Statement

Customer interactions today are scattered across multiple channels — mobile apps, websites, call centers, and physical branches/stores. Because these channels operate in silos, organizations lose visibility into the *complete* customer journey and cannot pinpoint:

* Where customers **drop off**
* Where **escalations** occur
* Which issues remain **unresolved**
* Which experiences correlate with **churn**
* Where customers **repeatedly contact support**

**OmniTrace** solves this by resolving customer identities across channels and stitching their raw event streams into one coherent, chronological journey — surfaced through an analyst-facing dashboard.

---

## Key Features

| Feature | Description |
|---|---|
| **Identity Resolution Engine** | 3-pass hybrid engine: deterministic (email / phone / loyalty ID) → device/cookie probabilistic → IP-proximity probabilistic. Merges all identifiers into a single `customer_id`. |
| **Event Stitching Pipeline** | Ingests raw events into MongoDB, then normalizes and time-orders them into a unified PostgreSQL timeline per customer. |
| **Unified Customer Timeline** | Chronological, cross-channel view of every touchpoint per customer, filterable by channel. |
| **Drop-off & Escalation Detection** | Flags funnel exits (`is_dropoff`) and tier-2 escalations (`is_escalation`) at stitch-time via `CANONICAL_TYPE_MAP`. |
| **Churn Risk Detection** | Rule-based engine per ADR-005: flags customers with an unresolved escalation followed by 30+ days of silence across all channels. |
| **Repeat-Contact Detection** | Counts distinct support contact initiations (`call_initiated` + web `issue_reported`). Flags customers with ≥2 contacts. |
| **Analyst Dashboard** | Next.js 16 dashboard with customer search, cross-channel timeline viewer, drop-off funnel, escalation trends, churn radar, and repeat-contact list. |
| **Analyst Override API** | REST endpoints to manually merge or split customer identities when the engine can't auto-resolve. |

---

## System Architecture

```
                      CHANNEL SOURCES
         Mobile App │ Website │ Call Center │ POS
                              │  raw events
                              ▼
              ┌───────────────────────────────────┐
              │     INGESTION LAYER (REST API)     │
              │  POST /api/ingest/:channel         │
              │  Zod schema validation             │
              │  MongoDB raw event store (write)   │
              └──────────────┬────────────────────┘
                             │
                             ▼
              ┌───────────────────────────────────┐
              │   IDENTITY RESOLUTION SERVICE      │
              │  Pass 1: Deterministic             │
              │    email / phone / loyalty_id      │
              │    confidence = 1.0                │
              │  Pass 2: Device/Cookie             │
              │    device_id / cookie_id           │
              │    confidence = 0.85               │
              │  Pass 3: IP Proximity              │
              │    ip_address + 30-min window      │
              │    confidence = 0.80               │
              └──────────────┬────────────────────┘
                             │
                             ▼
              ┌───────────────────────────────────┐
              │   EVENT NORMALIZATION & STITCHING  │
              │  CANONICAL_TYPE_MAP (14 types)     │
              │  is_escalation / is_dropoff flags  │
              │  raw_event_ref → MongoDB _id       │
              │  ORDER BY event_time ASC           │
              └──────────────┬────────────────────┘
                             │
                             ▼
              ┌───────────────────────────────────┐
              │      UNIFIED CUSTOMER TIMELINE     │
              │  PostgreSQL — timeline_events      │
              └────────────┬──────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
   ┌─────────────────────┐   ┌──────────────────────────┐
   │  ANALYTICS ENGINE   │   │  VISUALIZATION DASHBOARD  │
   │  Drop-off stats     │   │  Customer search          │
   │  Escalation trends  │   │  Journey timeline viewer  │
   │  Churn risk (ADR-005│   │  Drop-off funnel          │
   │  Repeat contacts    │   │  Escalation trends        │
   └─────────────────────┘   │  Churn radar              │
                             │  Repeat-contact list      │
                             └──────────────────────────┘
```

---

## Identity Resolution Details

1. **Deterministic Matching** — exact match on email, phone number, or loyalty/account ID. Confidence score: **1.0**.
2. **Device/Cookie Probabilistic** — matches `device_id` or `cookie_id` across events. Confidence score: **0.85**.
3. **IP-Proximity Probabilistic** — links anonymous sessions sharing the same IP address within a 30-minute window. Confidence score: **0.80**.
4. **Confidence Scoring** — every `identity_links` row carries a `confidence_score`. Analysts can audit and override any merge.
5. **Manual Override** — `POST /api/identity/merge` and `POST /api/identity/split` for analyst corrections.

> See **ADR-002** in `docs/decisions.md` for the full threshold rationale.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend / API | Node.js 20, Express 4, TypeScript 5 |
| Identity + Stitching + Analytics | TypeScript services (`src/services/`) |
| Database — unified timeline | PostgreSQL (node-postgres `pg`) |
| Database — raw event store | MongoDB 6 |
| Schema Validation | Zod |
| Frontend Dashboard | Next.js 16 (Turbopack), React 18, Tailwind CSS, Lucide Icons |
| Benchmark Harness | `ts-node data/run-engine.ts` |

---

## Project Structure

```
OmniTrace/
├── src/
│   ├── index.ts                  # Express server entry point (port 3001)
│   ├── routes/
│   │   ├── ingest.ts             # POST /api/ingest/:channel
│   │   ├── identity.ts           # GET/POST /api/identity/* + merge/split
│   │   ├── timeline.ts           # GET /api/customers/:id/timeline
│   │   ├── analytics.ts          # GET /api/analytics/* (dropoffs, escalations, churn, repeat)
│   │   ├── engine.ts             # POST /api/engine/run
│   │   └── customers.ts          # GET /api/customers, /api/customers/search
│   ├── services/
│   │   ├── identity.ts           # 3-pass identity resolution engine
│   │   ├── stitching.ts          # Event normalization + timeline builder
│   │   ├── analytics.ts          # Churn risk + repeat-contact flag computation
│   │   └── engine.ts             # Orchestrates identity → stitch → analytics
│   ├── db/
│   │   ├── postgres.ts           # PostgreSQL connection pool
│   │   └── mongo.ts              # MongoDB connection
│   ├── middleware/
│   │   └── validation.ts         # Zod request validators
│   └── utils/
│       └── pagination.ts         # Pagination helpers
├── frontend/                     # Next.js 16 analyst dashboard (port 3000)
│   └── src/
│       ├── app/
│       │   ├── page.tsx                      # Dashboard overview + scenario cards
│       │   ├── customers/
│       │   │   ├── page.tsx                  # Customer Explorer (search)
│       │   │   └── [id]/page.tsx             # Customer timeline detail
│       │   └── analytics/
│       │       ├── dropoffs/page.tsx         # Drop-off funnel
│       │       ├── escalations/page.tsx      # Escalation trends
│       │       ├── churn/page.tsx            # Churn risk radar
│       │       └── repeat/page.tsx           # Repeat-contact list
│       ├── components/
│       │   ├── dashboard/                    # MetricCard, etc.
│       │   ├── layout/                       # Sidebar, Header
│       │   └── ui/                           # ChannelBadge, etc.
│       └── lib/
│           ├── api.ts                        # Typed API client
│           ├── types.ts                      # Shared TypeScript types
│           └── formatters.ts                 # DEMO_SCENARIOS, formatters
├── data/
│   ├── sample_events.json        # 7-persona benchmark dataset (47 events)
│   ├── schema.sql                # PostgreSQL schema definitions
│   ├── run-engine.ts             # Benchmark harness (seed → engine → score)
│   └── test-endpoints.ts         # Manual endpoint smoke tests
└── docs/
    ├── requirements.md
    ├── architecture.md
    ├── database.md
    ├── api.md
    ├── features.md
    └── decisions.md              # ADR-001 through ADR-008
```

---

## Getting Started

### Prerequisites

* Node.js ≥ 18
* PostgreSQL ≥ 14 (running locally or via Docker)
* MongoDB ≥ 6 (running locally or via Docker)

### Environment Setup

Copy `.env.example` to `.env` and fill in your connection strings:

```bash
cp .env.example .env
```

Key variables:
```
MONGODB_URI=mongodb://localhost:27017/omnitrace
POSTGRES_URL=postgresql://user:password@localhost:5432/omnitrace
PORT=3001
```

### Database Setup

```bash
# Create the PostgreSQL schema
psql -U <user> -d omnitrace -f data/schema.sql
```

### Backend

```bash
# Install dependencies
npm install

# Start the API server (port 3001)
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

### Seed & Run the Engine

```bash
# Seed sample_events.json → ingest → resolve → stitch → compute analytics → score
npm run engine:benchmark

# Re-seed from scratch (clears all existing data first)
npm run engine:benchmark:clean

# Re-compute analytics flags only (without re-seeding)
npm run compute:analytics
```

---

## API Overview

All endpoints are prefixed `/api/`. Full schema in `docs/api.md`.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/ingest/:channel` | Ingest a raw event (web / mobile_app / call_center / in_person) |
| `GET` | `/api/customers` | Paginated customer directory |
| `GET` | `/api/customers/search` | Search by email / phone / loyalty_id |
| `GET` | `/api/identity/:customer_id` | Identity links for a customer |
| `POST` | `/api/identity/merge` | Analyst: merge two customer records |
| `POST` | `/api/identity/split` | Analyst: split a probabilistic merge |
| `GET` | `/api/customers/:id/timeline` | Stitched cross-channel timeline |
| `GET` | `/api/analytics/dropoffs` | Drop-off events by channel |
| `GET` | `/api/analytics/escalations` | Escalations grouped by channel + day |
| `GET` | `/api/analytics/churn-risk` | Churn-risk flags (ADR-005) |
| `GET` | `/api/analytics/repeat-contacts` | Repeat-contact flags (`?threshold=3`) |
| `POST` | `/api/engine/run` | Trigger identity resolution + stitching + analytics |

---

## Benchmark Personas (Sample Dataset)

| ID | Name | Scenario | Flags |
|---|---|---|---|
| cust_001 | Alice | Clean multi-channel journey (Web → App) | — |
| cust_002 | Bob | Cart checkout abandonment | `is_dropoff` |
| cust_003 | Carol | Resolved call-center escalation | `is_escalation` |
| cust_004 | Dave | Cross-channel repeat support contact | `repeat_contact` |
| cust_005 | Eve | High churn risk (ADR-005) | `churn_risk`, `is_escalation` |
| cust_006 | Frank | 4-channel deterministic identity stitching | — |
| cust_007 | Grace | Probabilistic IP-proximity link (anonymous) | — |

---

## Sample Use Case Walkthrough

1. A customer browses products on the **website** (`session_start`, `add_to_cart`).
2. Abandons the cart and calls the **call center** (`call_initiated`, `issue_reported`).
3. The call escalates to a supervisor — the stitching engine sets `is_escalation = true`.
4. The same customer opens the **mobile app** two days later using the same logged-in account (`app_login`, `order_placed`).
5. **OmniTrace** resolves all touchpoints to one `customer_id` via deterministic identity matching, stitches them into a single timeline ordered by `event_time`, and surfaces the journey in the dashboard — revealing a *cart abandonment → support escalation → recovery* pattern.

---

## Architecture Decision Records

Key decisions recorded in `docs/decisions.md`:

| ADR | Decision |
|---|---|
| ADR-001 | PostgreSQL for timeline + MongoDB for raw events |
| ADR-002 | Hybrid deterministic + probabilistic identity resolution (confidence: 1.0 / 0.85 / 0.80) |
| ADR-003 | No Kafka — REST ingestion endpoint + benchmark script simulates event stream |
| ADR-004 | Single Node.js/TypeScript stack (no Python split) |
| ADR-005 | Synthetic churn label: unresolved escalation + 30+ days silence |
| ADR-006 | *(removed — duplicate template)* |
| ADR-007 | `ground_truth_customer_id` for evaluation only — never used in resolution logic |
| ADR-008 | Known limitation: no auto-merge without a bridge event (analyst merge endpoint is the fallback) |

---

## Roadmap / Future Enhancements

* [ ] ML-based churn scoring (Scikit-learn logistic regression on journey features)
* [ ] Real-time timeline updates via WebSockets
* [ ] Graph-based visualization of the identity resolution graph
* [ ] Configurable alerting (Slack/email) on churn-risk journeys
* [ ] Support for additional channels (chatbot, social media, email campaigns)
* [ ] Dead-letter queue for malformed ingestion events

---

## Team

| Name | Role |
|---|---|
| Hitansh | API, Databases, Identity Resolution |
| Hanuj | Stitching Pipeline, Analytics Engine |
| Neel | *In progress* |
| Tirth | *In progress* |

---

## License

Built as a hackathon submission. License TBD.
