# Architecture Decisions — OmniTrace

Record every meaningful technical decision here as it's made, so Claude Code
(and your teammates) don't re-litigate or accidentally reverse it later.

## ADR-001: Use PostgreSQL for unified customer timeline + MongoDB for raw events

### Decision

Store raw, channel-specific events in MongoDB. Store resolved identities and the
normalized/stitched timeline in PostgreSQL.

### Reason

Raw events differ in shape per channel (flexible schema fits Mongo). The unified
timeline and identity graph need relational joins, indexing by customer, and
transactional consistency for analyst queries (fits Postgres).

### Date

2026-09-19

---

## ADR-002: Hybrid deterministic + probabilistic identity resolution

### Decision

Use deterministic matching (exact email/phone/loyalty ID match) as the primary
resolution method, with probabilistic matching (device fingerprint, IP+time proximity)
as a secondary pass for sessions with no strong identifier.

Confidence scores assigned per identifier type (stored in `identity_links.confidence_score`):

| Identifier type | Score | Rationale |
|---|---|---|
| `email`, `phone`, `loyalty_id` | **1.0** | Globally unique — deterministic |
| `device_id`, `cookie_id` | **0.85** | Device-scoped but not globally unique |
| `ip_address` | **0.80** | Shared NAT/household risk — lowest confidence |

These values are hardcoded constants in `src/services/identity.ts`. They are not
runtime-configurable at this time.

### Reason

Deterministic matching is fast, explainable, and low-risk to implement in a hackathon
timeframe. Probabilistic matching covers anonymous/guest sessions. The 0.85/0.80
thresholds were chosen conservatively: below 1.0 to flag probabilistic links as
auditable, but above 0.5 to still surface them in analyst views. IP-address links
are scored lowest because a single NAT or household WiFi can produce many distinct
customers sharing one IP.

### Date

2026-09-19 (thresholds documented 2026-09-20)

---

## ADR-003: No real Kafka — use a simulated event stream instead

### Decision

Do not set up a real Kafka cluster. Build a plain REST ingestion endpoint
(`POST /api/ingest/:channel`) that writes directly to MongoDB. Simulate a live
event stream with a standalone script that reads a sample dataset of fake
customer journeys and POSTs events to the ingestion endpoint with a small delay
between each, in timestamp order.

### Reason

No one on the team has Kafka experience, and setting up a broker, topics, and
producer/consumer code would consume hackathon time better spent on identity
resolution, stitching, and analytics — which is what's actually being judged.
A REST endpoint + a script that fires timed HTTP requests achieves the same
"events arriving live" demo effect with far less setup risk.

### Date

2026-09-19

---

## ADR-004: Backend language split

### Decision

Use Python for identity-resolution and analytics services (Scikit-learn lives
there anyway). Use Node.js for the API gateway and ingestion endpoint if the
team is more comfortable with JS on that side. If the team is stronger in one
language overall, default to a single language across the whole backend instead
of splitting.

### Reason

Consistency beats "ideal" architecture under a hackathon timeline. Splitting
languages only makes sense if it removes friction (e.g., avoiding a Python ML
wrapper inside a Node service); otherwise it adds integration overhead for
no benefit.

### Date

2026-09-19

---

## ADR-005: Synthetic churn label

### Decision

Since no real churn data exists, define churn synthetically for the sample
dataset: a customer is labeled "churned" if they have an unresolved escalation
followed by 30+ days of no further activity across any channel.

### Reason

The churn-correlation analytics feature needs a labeled target to correlate
against. A clear, documented synthetic rule lets the sample dataset be generated
consistently and lets the model/analysis be explained honestly to judges as a
proxy rather than real churn data.

### Date

2026-09-19

---

## ADR-007: Synthetic dataset includes ground-truth labels for evaluation only

### Decision

The sample dataset (data/sample_events.json) includes a `ground_truth_customer_id`
field on every event. This field exists solely to measure identity-resolution
accuracy during development. It must never be read by the resolution algorithm
itself — only used afterward to compare against the algorithm's output.

### Reason

Without this rule stated explicitly, it's easy to accidentally wire the ground-truth
field into the resolution logic (directly or indirectly), producing artificially
perfect results that don't reflect real-world accuracy.

### Date

2026-09-19

---

## ADR-008: Known limitation — cross-channel identity without a bridge event

### Decision

When a customer's call-center identifier (phone) and web identifier (email) never
appear together in a single event, the resolution engine cannot automatically merge
them into one customer record. This produces two separate customer records for
what is actually the same person (seen in cust_004 / Dave scenario).

In such cases, the correct resolution path is analyst-assisted merge via
`POST /api/identity/merge`. The engine will not speculatively merge customers
based on behavioral signals alone (e.g. same time-of-day activity, same IP) to
avoid false positives.

### Reason

Adding speculative cross-identifier merges (e.g. "same IP AND phone used within
1 hour — must be same person") would lower precision even if it improves recall.
For a hackathon demo this trade-off favors precision (no false merges) over recall
(may miss some real merges). The analyst override endpoint provides the escape
hatch for known cases.

### Date

2026-09-20
