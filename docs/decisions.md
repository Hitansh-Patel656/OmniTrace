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

### Reason

Deterministic matching is fast, explainable, and low-risk to implement in a hackathon
timeframe. Probabilistic matching covers anonymous/guest sessions but needs a
confidence threshold to avoid false merges — starting simple and adding probabilistic
matching only if time allows.

### Date

2026-09-19

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

## ADR-006: (template — copy this for new decisions)

### Decision

*What was decided.*

### Reason

*Why this option was chosen over alternatives.*

### Date

YYYY-MM-DD

---


## ADR-006: Synthetic dataset includes ground-truth labels for evaluation only

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
