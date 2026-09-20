import { Router, Request, Response } from "express";
import { query } from "../db/postgres";
import { TimelineEvent, CHANNELS } from "../types";
import { validateUUID } from "../middleware/validation";
import { sendError, errorMessage } from "../utils/errors";
import { parsePagination, paginatedResponse } from "../utils/pagination";

const router = Router();

// ---------------------------------------------------------------------------
// IMPORTANT: /customers and /customers/search must be registered BEFORE
// /customers/:customer_id/timeline so Express does not try to match the literal strings as a UUID param.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// GET /api/customers
// Live directory of all stitched customers with aggregated metrics.
// ---------------------------------------------------------------------------

router.get("/customers", async (req: Request, res: Response): Promise<void> => {
  const { page, limit, offset } = parsePagination(req.query);

  try {
    const [countRes] = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM customers");
    const total = parseInt(countRes?.count || "0", 10);

    const rows = await query<{
      customer_id: string;
      created_at: string;
      total_events: string;
      channels: string[];
      primary_identifier: string | null;
      has_escalation: boolean;
      has_dropoff: boolean;
      is_churn_risk: boolean;
    }>(`
      SELECT c.customer_id,
             c.created_at,
             COALESCE(e.total_events, 0) AS total_events,
             COALESCE(e.channels, ARRAY[]::varchar[]) AS channels,
             (
               SELECT il.identifier_value
                 FROM identity_links il
                WHERE il.customer_id = c.customer_id
                ORDER BY il.confidence_score DESC, il.linked_at ASC
                LIMIT 1
             ) AS primary_identifier,
             COALESCE(e.has_escalation, false) AS has_escalation,
             COALESCE(e.has_dropoff, false) AS has_dropoff,
             EXISTS(
               SELECT 1 FROM analytics_flags af
                WHERE af.customer_id = c.customer_id
                  AND af.flag_type = 'churn_risk'
             ) AS is_churn_risk
        FROM customers c
        LEFT JOIN (
          SELECT customer_id,
                 COUNT(*) AS total_events,
                 ARRAY_AGG(DISTINCT channel) AS channels,
                 BOOL_OR(is_escalation) AS has_escalation,
                 BOOL_OR(is_dropoff) AS has_dropoff
            FROM timeline_events
           GROUP BY customer_id
        ) e ON e.customer_id = c.customer_id
       ORDER BY c.created_at DESC
       LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const data = rows.map((r) => ({
      customer_id: r.customer_id,
      created_at: r.created_at,
      total_events: parseInt(String(r.total_events), 10),
      channels: r.channels || [],
      primary_identifier: r.primary_identifier,
      has_escalation: Boolean(r.has_escalation),
      has_dropoff: Boolean(r.has_dropoff),
      is_churn_risk: Boolean(r.is_churn_risk),
    }));

    res.json(paginatedResponse(data, total, page, limit));
  } catch (err) {
    console.error("GET /customers error:", err);
    sendError(res, 500, "Internal server error", errorMessage(err));
  }
});

// ---------------------------------------------------------------------------
// GET /api/customers/search?email=&phone=&loyalty_id=
// Look up one or more customer_ids by any known identifier.
// At least one query param is required.
// ---------------------------------------------------------------------------

router.get(
  "/customers/search",
  async (req: Request, res: Response): Promise<void> => {
    const { email, phone, loyalty_id } = req.query as Record<string, string | undefined>;
    const { page, limit, offset } = parsePagination(req.query);

    if (!email && !phone && !loyalty_id) {
      sendError(
        res,
        400,
        "Missing search parameters",
        "At least one of ?email=, ?phone=, or ?loyalty_id= is required"
      );
      return;
    }

    try {
      // Build a dynamic WHERE clause: match any of the provided identifiers.
      const conditions: string[] = [];
      const params: string[] = [];
      let idx = 1;

      if (email) {
        conditions.push(`(identifier_type = 'email' AND identifier_value = $${idx++})`);
        params.push(email);
      }
      if (phone) {
        conditions.push(`(identifier_type = 'phone' AND identifier_value = $${idx++})`);
        params.push(phone);
      }
      if (loyalty_id) {
        conditions.push(`(identifier_type = 'loyalty_id' AND identifier_value = $${idx++})`);
        params.push(loyalty_id);
      }

      const whereClause = conditions.join(" OR ");

      // Count distinct matching customers
      const [countResult] = await query<{ count: string }>(
        `SELECT COUNT(DISTINCT il.customer_id)::text AS count
           FROM identity_links il
          WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.count, 10);

      // Fetch paginated customers with their matching links
      const rows = await query<{
        customer_id: string;
        created_at: string;
        updated_at: string;
        identifier_type: string;
        identifier_value: string;
        confidence_score: number;
      }>(
        `SELECT DISTINCT ON (il.customer_id)
                il.customer_id,
                c.created_at AT TIME ZONE 'UTC' AS created_at,
                c.updated_at AT TIME ZONE 'UTC' AS updated_at,
                il.identifier_type,
                il.identifier_value,
                il.confidence_score
           FROM identity_links il
           JOIN customers c ON c.customer_id = il.customer_id
          WHERE ${whereClause}
          ORDER BY il.customer_id, il.confidence_score DESC
          LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      );

      res.json(paginatedResponse(rows, total, page, limit));
    } catch (err) {
      console.error("GET /customers/search error:", err);
      sendError(res, 500, "Internal server error", errorMessage(err));
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/customers/:customer_id/timeline
// Returns the full stitched, chronological timeline for one customer.
// Optional filters: ?channel=, ?from=, ?to= (ISO 8601 dates)
// ---------------------------------------------------------------------------

router.get(
  "/customers/:customer_id/timeline",
  validateUUID("customer_id"),
  async (req: Request, res: Response): Promise<void> => {
    const { customer_id } = req.params;
    const { channel, from, to } = req.query as Record<string, string | undefined>;
    const { page, limit, offset } = parsePagination(req.query);

    // Validate optional channel filter
    if (channel && !CHANNELS.includes(channel as (typeof CHANNELS)[number])) {
      sendError(
        res,
        400,
        "Invalid channel filter",
        `?channel must be one of: ${CHANNELS.join(", ")}`
      );
      return;
    }

    // Validate optional date filters
    if (from && isNaN(Date.parse(from))) {
      sendError(res, 400, "Invalid date filter", "?from must be a valid ISO 8601 date string");
      return;
    }
    if (to && isNaN(Date.parse(to))) {
      sendError(res, 400, "Invalid date filter", "?to must be a valid ISO 8601 date string");
      return;
    }

    try {
      // Confirm customer exists
      const customers = await query(
        "SELECT customer_id FROM customers WHERE customer_id = $1",
        [customer_id]
      );
      if (customers.length === 0) {
        sendError(res, 404, "Not found", `No customer found with customer_id: ${customer_id}`);
        return;
      }

      // Build dynamic WHERE conditions
      const conditions: string[] = ["customer_id = $1"];
      const params: unknown[] = [customer_id];
      let idx = 2;

      if (channel) {
        conditions.push(`channel = $${idx++}`);
        params.push(channel);
      }
      if (from) {
        conditions.push(`event_time >= $${idx++}`);
        params.push(from);
      }
      if (to) {
        conditions.push(`event_time <= $${idx++}`);
        params.push(to);
      }

      const whereClause = conditions.join(" AND ");

      const [countResult] = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM timeline_events WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.count, 10);

      const events = await query<TimelineEvent>(
        `SELECT id, customer_id, channel, event_type,
                event_time AT TIME ZONE 'UTC' AS event_time,
                is_escalation, is_dropoff, resolution_status, raw_event_ref
           FROM timeline_events
          WHERE ${whereClause}
          ORDER BY event_time ASC
          LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      );

      res.json(paginatedResponse(events, total, page, limit));
    } catch (err) {
      console.error("GET /customers/:customer_id/timeline error:", err);
      sendError(res, 500, "Internal server error", errorMessage(err));
    }
  }
);

export default router;
