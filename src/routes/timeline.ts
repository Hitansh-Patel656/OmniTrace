import { Router, Request, Response } from "express";
import { query } from "../db/postgres";
import { TimelineEvent, CHANNELS } from "../types";
import { validateUUID } from "../middleware/validation";
import { sendError, errorMessage } from "../utils/errors";
import { parsePagination, paginatedResponse } from "../utils/pagination";

const router = Router();

// ---------------------------------------------------------------------------
// IMPORTANT: /customers/search must be registered BEFORE /customers/:customer_id/timeline
// so Express does not try to match the literal string "search" as a UUID param.
// ---------------------------------------------------------------------------

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
