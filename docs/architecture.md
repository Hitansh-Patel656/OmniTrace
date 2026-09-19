# Architecture — OmniTrace

## Related Documents

* [[requirements]]
* [[database]]
* [[api]]
* [[decisions]]
* [[features]]

## System Overview

OmniTrace is composed of five stages, each a separable module:

```
                CHANNEL SOURCES
   Mobile App │ Website │ Call Center │ POS
                        │  raw events
                        ▼
              INGESTION LAYER (Kafka / API)
        Schema validation • Event buffering
                        │
                        ▼
           IDENTITY RESOLUTION SERVICE
   Deterministic matching (email/phone/loyalty ID)
   Probabilistic matching (device/behavioral)
   Identity Graph (nodes = raw IDs, edges = match confidence)
                        │
                        ▼
        EVENT NORMALIZATION & STITCHING
   Common event schema • Chronological timeline builder
                        │
                        ▼
           UNIFIED CUSTOMER TIMELINE
              (PostgreSQL datastore)
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
   ANALYTICS ENGINE            VISUALIZATION DASHBOARD
   Drop-off detection          Journey timeline (per customer)
   Escalation detection        Funnel / drop-off charts
   Churn correlation (ML)      Churn & repeat-contact heatmaps
   Repeat-contact clustering   Search & filter by customer/channel
```

## Module Responsibilities

### 1. Ingestion Layer

* Accepts raw events from each channel source (via Kafka topics or a REST endpoint per channel).
* Validates incoming events against the raw channel-specific schema.
* Buffers/queues events for downstream processing.
* See `docs/features.md` → Ingestion for event format details per channel.

### 2. Identity Resolution Service

* Builds an  **identity graph** : every raw identifier (device ID, email, phone, loyalty ID,
  cookie/session ID) is a node.
* Deterministic matches (exact email, phone, account ID) create high-confidence edges.
* Probabilistic matches (device fingerprint similarity, IP + time proximity, name/address
  similarity) create weighted edges above a confidence threshold.
* Connected components in the graph collapse into one `customer_id`.
* Runs incrementally — new events update the graph rather than recomputing from scratch.
* See `docs/decisions.md` for the specific algorithm/library chosen.

### 3. Event Normalization & Stitching

* Converts every channel-specific event into the **common event schema** (see `database.md`).
* Orders all of a customer's events chronologically into a single timeline.
* Tags each event with channel, event type, and any resolution/escalation metadata.

### 4. Analytics Engine

* **Drop-off detection** : identifies where a customer's journey ends mid-funnel
  (e.g., cart abandonment, incomplete application).
* **Escalation detection** : flags events tagged as escalations or supervisor handoffs.
* **Repeat-contact detection** : clusters customers who contact support multiple times
  for a similar unresolved issue within a time window.
* **Churn correlation** : uses historical churn labels (or a proxy, e.g., account closure/inactivity)
  to find which journey patterns correlate with churn (Scikit-learn: logistic regression /
  decision tree / simple correlation analysis, depending on time available).

### 5. Analyst Dashboard

* Search a customer by ID/email/phone → view their full stitched timeline.
* Aggregate views: funnel drop-off chart, escalation frequency by channel, churn-risk
  distribution, repeat-contact leaderboard.
* Built with React/Next.js + Recharts/D3.js (see `docs/features.md` → Dashboard).

## Data Flow Summary

1. Event generated on a channel → sent to ingestion layer.
2. Ingestion validates & forwards to identity resolution.
3. Identity resolution assigns/confirms a `customer_id`.
4. Stitching service normalizes the event and inserts it into that customer's timeline.
5. Analytics engine runs (batch or near-real-time) over timelines to produce flags/scores.
6. Dashboard queries the unified timeline + analytics results for display.

## Non-Functional Considerations

* **Latency** : identity resolution should be incremental, not batch-recompute, to keep
  ingestion-to-timeline latency low.
* **Accuracy** : track a confidence score per identity merge so analysts can audit/override
  incorrect stitches (surface this in the dashboard as a trust indicator).
