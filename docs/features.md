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

* One ingestion endpoint per channel (or one generic endpoint with a `channel` param).
* Validate required fields: at least one raw identifier, event_type, timestamp.
* Store raw event in MongoDB immediately (before any processing) so nothing is lost.
* Publish an "event ingested" message for downstream processing (Kafka topic, or
  a simple in-process queue if Kafka is out of scope for the hackathon timeline).

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

* **Drop-off detection** : rule-based initially (e.g., funnel started but no completion
  event within X time) — expand to statistical/ML detection if time allows.
* **Escalation detection** : flag any event explicitly tagged `escalation`, plus
  optionally infer escalations from repeated `issue_reported` events in one session.
* **Repeat-contact detection** : cluster customers with ≥N support contacts for a
  similar issue category within a rolling time window.
* **Churn correlation** : correlate journey features (escalation count, drop-off count,
  repeat-contact count) with a churn label/proxy using a simple model (logistic
  regression or decision tree via Scikit-learn).

### Future

* More sophisticated churn modeling (survival analysis, gradient boosting).
* Anomaly detection for unusual journey patterns.

---

## Feature: Analyst Dashboard

### Goal

Give a non-technical analyst a way to explore customer journeys and spot patterns
without querying the database directly.

### Requirements

* **Customer search** — look up by email/phone/loyalty ID/customer_id.
* **Journey timeline view** — chronological, cross-channel view of one customer's events,
  with icons per channel and highlighted escalations/drop-offs.
* **Funnel/drop-off view** — aggregate chart showing where customers exit a journey.
* **Escalation dashboard** — frequency and trend of escalations by channel/time period.
* **Churn-risk view** — ranked list of customers by churn-risk score, with contributing factors.
* **Repeat-contact view** — customers with unresolved repeat issues.

### Future

* Alerting (e.g., notify a team when churn-risk crosses a threshold).
* Exportable reports for stakeholders.
