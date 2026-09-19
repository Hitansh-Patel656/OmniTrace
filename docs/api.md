# API — OmniTrace

## Related Documents

* [[architecture]]
* [[database]]

> This file should be updated as endpoints are actually implemented. The list below
> is the planned initial surface — treat it as a spec, not a guarantee of what exists yet.

## Ingestion Endpoints

### `POST /api/ingest/:channel`

Accepts a raw event from a given channel (`web`, `mobile_app`, `call_center`, `in_person`).

**Request body:**

```json
{
  "raw_identifiers": { "email": "...", "device_id": "..." },
  "event_type": "string",
  "event_payload": { },
  "timestamp": "ISO8601 string"
}
```

**Response:** `202 Accepted` with the generated raw event ID.

## Identity Resolution Endpoints

### `GET /api/identity/:customer_id`

Returns all raw identifiers linked to a resolved `customer_id`, with confidence scores.

### `POST /api/identity/merge`

Manually merge two `customer_id`s (analyst override for incorrect resolution).

**Request body:**

```json
{ "customer_id_a": "uuid", "customer_id_b": "uuid", "reason": "string" }
```

### `POST /api/identity/split`

Manually split an incorrectly merged identity.

## Timeline Endpoints

### `GET /api/customers/:customer_id/timeline`

Returns the full stitched, chronological timeline for one customer.

**Query params:** `channel` (optional filter), `from`, `to` (date range).

### `GET /api/customers/search?email=&phone=&loyalty_id=`

Look up a `customer_id` by any known identifier.

## Analytics Endpoints

### `GET /api/analytics/dropoffs`

Returns aggregate drop-off points across all customers, grouped by funnel stage/channel.

### `GET /api/analytics/escalations`

Returns escalation frequency, grouped by channel and time period.

### `GET /api/analytics/repeat-contacts`

Returns customers with repeat support contacts above a configurable threshold,
with the underlying issue category.

### `GET /api/analytics/churn-risk`

Returns customers ranked by churn-risk score, with the contributing journey factors.

## Response Conventions

* All list endpoints support `?page=` and `?limit=` pagination.
* All timestamps are ISO 8601, UTC.
* Errors return `{ "error": "string", "details": "string" }` with an appropriate HTTP status code.
