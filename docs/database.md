# Database — OmniTrace

## Related Documents

* [[architecture]]
* [[api]]
* [[decisions]]

## Storage Strategy

* **MongoDB** — stores raw, channel-specific events as they arrive (flexible schema,
  since each channel's raw event shape differs).
* **PostgreSQL** — stores the resolved identity graph, unified customer records, and
  the normalized/stitched timeline (relational, since this needs joins, indexing by
  customer, and transactional consistency for analyst queries).

> Record the final decision on this split in `decisions.md` once confirmed — this is
> the suggested default from `requirements.md`'s tech stack.

## MongoDB Collections (raw events)

### `raw_events`

```json
{
  "_id": "ObjectId",
  "channel": "web | mobile_app | call_center | in_person",
  "raw_identifiers": {
    "email": "string | null",
    "phone": "string | null",
    "device_id": "string | null",
    "cookie_id": "string | null",
    "loyalty_id": "string | null",
    "ip_address": "string | null"
  },
  "event_type": "string",          // e.g. page_view, call_initiated, escalation
  "event_payload": "object",       // raw channel-specific fields
  "timestamp": "ISODate",
  "ingested_at": "ISODate"
}
```

## PostgreSQL Schema (resolved / unified data)

### `customers`

| Column      | Type      | Notes                |
| ----------- | --------- | -------------------- |
| customer_id | UUID (PK) | unified identity     |
| created_at  | TIMESTAMP | first resolved event |
| updated_at  | TIMESTAMP | last resolved event  |

### `identity_links`

| Column           | Type                   | Notes                                              |
| ---------------- | ---------------------- | -------------------------------------------------- |
| id               | UUID (PK)              |                                                    |
| customer_id      | UUID (FK → customers) |                                                    |
| identifier_type  | VARCHAR                | email / phone / device_id / cookie_id / loyalty_id |
| identifier_value | VARCHAR                | the raw value                                      |
| confidence_score | FLOAT                  | 1.0 for deterministic, <1.0 for probabilistic      |
| linked_at        | TIMESTAMP              |                                                    |

### `timeline_events`

| Column            | Type                   | Notes                                      |
| ----------------- | ---------------------- | ------------------------------------------ |
| id                | UUID (PK)              |                                            |
| customer_id       | UUID (FK → customers) |                                            |
| channel           | VARCHAR                | web / mobile_app / call_center / in_person |
| event_type        | VARCHAR                | normalized event type (see below)          |
| event_time        | TIMESTAMP              | when it actually happened                  |
| is_escalation     | BOOLEAN                |                                            |
| is_dropoff        | BOOLEAN                | flagged by analytics engine                |
| resolution_status | VARCHAR                | resolved / unresolved / pending            |
| raw_event_ref     | VARCHAR                | reference back to the MongoDB `_id`      |

### `analytics_flags`

| Column      | Type                   | Notes                                              |
| ----------- | ---------------------- | -------------------------------------------------- |
| id          | UUID (PK)              |                                                    |
| customer_id | UUID (FK → customers) |                                                    |
| flag_type   | VARCHAR                | dropoff / escalation / repeat_contact / churn_risk / identity_merge |
| score       | FLOAT                  | confidence/severity score                          |
| computed_at | TIMESTAMP              |                                                    |
| details     | JSONB                  | supporting metadata for the dashboard              |

## Normalized Event Type Vocabulary

Keep this list consistent across all channels so the timeline is comparable:

* `session_start`, `session_end`
* `page_view`, `add_to_cart`, `checkout_started`, `checkout_abandoned`
* `app_login`, `app_logout`
* `call_initiated`, `call_ended`
* `issue_reported`, `issue_resolved`, `issue_unresolved`
* `escalation`
* `in_person_visit`
* `order_placed`, `order_cancelled`
* `account_closed` (churn proxy, if no explicit churn label exists)

Add new types here as you encounter them — don't let raw channel-specific event
names leak into `timeline_events.event_type`.
