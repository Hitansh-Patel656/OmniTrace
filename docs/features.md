# Features — OmniTrace

## Related Documents

* [[architecture]]
* [[requirements]]
* [[database]]

---

## Feature: Event Ingestion

### Goal

Accept raw customer interaction events from all four channels and get them into
the pipeline reliably.

### Requirements

* One ingestion endpoint per channel: `POST /api/ingest/:channel` (web / mobile_app / call_center / in_person).
* Validate required fields: at least one raw identifier, `event_type`, `timestamp` (Zod).
* Store raw event in MongoDB immediately (before any processing) so nothing is lost on downstream failure.
* Return `202 Accepted` with the MongoDB raw event `_id`.
* No Kafka — REST endpoint + benchmark script simulates event stream (see ADR-003).

### Future

* Real-time streaming via Kafka Connect from actual channel systems.
* Dead-letter queue for malformed events.

---

## Feature: Identity Resolution

### Goal

Resolve every raw event to a single `customer_id`, even across channels with
different identifiers.

### Requirements

* Deterministic match on email, phone, loyalty ID, or account ID.
* Probabilistic match fallback using device fingerprint + IP + time proximity for
  anonymous/guest events.
* Every merge is logged with a confidence score in `identity_links`.
* Provide manual merge/split endpoints for analyst correction.

### Future

* ML-based probabilistic matching (e.g., trained similarity model instead of
  hand-tuned rules).
* Real-time identity graph updates via streaming instead of periodic batch.

---

## Feature: Event Stitching & Timeline

### Goal

Produce one chronological, cross-channel timeline per customer.

### Requirements

* Normalize each raw event into the common event schema (see `database.md`).
* Order all of a customer's events by `event_time`.
* Tag escalation and drop-off events at write time where determinable, otherwise
  leave for the analytics engine to flag retroactively.

### Future

* Real-time timeline updates pushed to the dashboard via WebSocket.

---

## Feature: Analytics Engine

### Goal

Surface actionable patterns: drop-offs, escalations, repeat contacts, churn correlation.

### Requirements

* **Drop-off detection**: rule-based — `is_dropoff` flag set at stitch-time via `CANONICAL_TYPE_MAP`
  for known abandonment event types. Aggregated by channel for the funnel view.
* **Escalation detection**: `is_escalation` flag set at stitch-time for known escalation event
  types. Aggregated by channel + day for the escalation trends view.
* **Repeat-contact detection**: counts distinct support contact initiations per customer:
  - `call_center` channel: one `call_initiated` = one contact.
  - `web` channel: one `issue_reported` = one contact.
  - Customers with ≥2 initiations are flagged `repeat_contact` with score = initiation count.
  - Configurable threshold parameter on the API (`?threshold=3`).
* **Churn detection (ADR-005)**: rule-based — a customer is flagged `churn_risk` when they have
  an unresolved escalation followed by ≥30 days of silence across all channels. Score = 0.95.

### Future

* ML-based churn scoring: correlate journey features (escalation count, drop-off count,
  repeat-contact count) with a churn label/proxy using Scikit-learn logistic regression.
* More sophisticated churn modeling (survival analysis, gradient boosting).
* Anomaly detection for unusual journey patterns.

---

## Feature: Analyst Dashboard

### Goal

Give a non-technical analyst a way to explore customer journeys and spot patterns
without querying the database directly.

### Requirements

* **Customer search** — look up by email / phone / loyalty_id / customer_id.
* **Journey timeline view** — chronological, cross-channel view of one customer's events,
  with channel badges, highlighted escalations (`is_escalation`) and drop-offs (`is_dropoff`),
  and an expandable raw-event payload viewer.
* **Drop-off funnel view** — 5-stage e-commerce funnel showing conversion rate and abandonment
  breakdown by channel (`/analytics/dropoffs`).
* **Escalation trends** — daily escalation frequency grouped by channel, with KPI cards
  (`/analytics/escalations`).
* **Churn-risk view** — ranked list of customers by churn-risk score (ADR-005), with
  contributing factors shown (`/analytics/churn`).
* **Repeat-contact view** — customers with ≥N distinct support contact initiations, with
  configurable threshold filter and expandable event detail (`/analytics/repeat`).
* **Dashboard overview** — metric cards (customers, events, dropoffs, escalations, churn,
  repeat) and demo persona scenario cards with live UUID resolution.

### Future

* Alerting (e.g., notify a team when churn-risk crosses a threshold).
* Exportable reports for stakeholders.
