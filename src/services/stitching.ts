import { query } from "../db/postgres";
import { RawEventDoc, TimelineEvent } from "../types";
import { v4 as uuidv4 } from "uuid";


// Canonical vocabulary mapping dictionary for common raw variations
const CANONICAL_TYPE_MAP: Record<string, string> = {
  session_start: "session_start",
  session_end: "session_end",
  page_view: "page_view",
  pageview: "page_view",
  add_to_cart: "add_to_cart",
  cart_add: "add_to_cart",
  checkout_started: "checkout_started",
  checkout_start: "checkout_started",
  checkout_abandoned: "checkout_abandoned",
  checkout_abandon: "checkout_abandoned",
  cart_abandoned: "checkout_abandoned",
  app_login: "app_login",
  login: "app_login",
  app_logout: "app_logout",
  logout: "app_logout",
  call_initiated: "call_initiated",
  call_start: "call_initiated",
  call_ended: "call_ended",
  call_end: "call_ended",
  issue_reported: "issue_reported",
  issue_resolved: "issue_resolved",
  issue_unresolved: "issue_unresolved",
  escalation: "escalation",
  in_person_visit: "in_person_visit",
  store_visit: "in_person_visit",
  order_placed: "order_placed",
  purchase: "order_placed",
  order_cancelled: "order_cancelled",
  account_closed: "account_closed",
};

/**
 * Normalizes an incoming raw event and stitches it into the PostgreSQL timeline_events table.
 * Adheres to docs/database.md common schema and vocabulary.
 */
export async function stitchAndNormalizeEvent(
  customerId: string,
  rawEvent: RawEventDoc
): Promise<TimelineEvent> {
  const payload = rawEvent.event_payload || {};
  const rawType = (rawEvent.event_type || "").trim().toLowerCase();
  const canonicalType = CANONICAL_TYPE_MAP[rawType] || rawType;

  // Infer escalation flag
  const isEscalation =
    canonicalType === "escalation" ||
    payload.is_escalation === true ||
    payload.escalated === true;

  // Infer drop-off flag
  const isDropoff =
    canonicalType === "checkout_abandoned" ||
    payload.is_dropoff === true ||
    payload.dropoff === true;

  // Infer resolution status
  let resolutionStatus: "resolved" | "unresolved" | "pending" = "pending";
  if (canonicalType === "issue_resolved" || payload.resolution_status === "resolved") {
    resolutionStatus = "resolved";
  } else if (
    canonicalType === "issue_unresolved" ||
    payload.resolution_status === "unresolved" ||
    payload.resolved === false
  ) {
    resolutionStatus = "unresolved";
  } else if (payload.resolution_status === "pending" || isEscalation || canonicalType === "issue_reported") {
    resolutionStatus = "pending";
  } else if (
    canonicalType === "order_placed" ||
    canonicalType === "page_view" ||
    canonicalType === "session_end"
  ) {
    resolutionStatus = "resolved";
  }

  const eventTime = new Date(rawEvent.timestamp).toISOString();
  const rawRef = rawEvent._id ? String(rawEvent._id) : uuidv4();
  const id = uuidv4();

  const [inserted] = await query<TimelineEvent>(
    `INSERT INTO timeline_events (
      id, customer_id, channel, event_type, event_time,
      is_escalation, is_dropoff, resolution_status, raw_event_ref
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, customer_id, channel, event_type, event_time, is_escalation, is_dropoff, resolution_status, raw_event_ref`,
    [
      id,
      customerId,
      rawEvent.channel,
      canonicalType,
      eventTime,
      isEscalation,
      isDropoff,
      resolutionStatus,
      rawRef,
    ]
  );

  return inserted;
}
