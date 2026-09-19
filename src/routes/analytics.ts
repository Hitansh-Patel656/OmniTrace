import { Router, Request, Response } from "express";
import { query } from "../db/postgres";
import { sendError, errorMessage } from "../utils/errors";
import { parsePagination, paginatedResponse } from "../utils/pagination";

const router = Router();

// ---------------------------------------------------------------------------
// Shared date-range helper
// ---------------------------------------------------------------------------

function parseDateFilters(
  req: Request
): { from?: string; to?: string; error?: string } {
  const { from, to } = req.query as Record<string, string | undefined>;
  if (from && isNaN(Date.parse(from))) {
    return { error: "?from must be a valid ISO 8601 date string" };
  }
  if (to && isNaN(Date.parse(to))) {
    return { error: "?to must be a valid ISO 8601 date string" };
  }
  return { from, to };
}

// ---------------------------------------------------------------------------
// GET /api/analytics/dropoffs
// Aggregate drop-off points across all customers, grouped by channel + event_type.
// Reads pre-computed is_dropoff flag on timeline_events (set by analytics engine).
// ---------------------------------------------------------------------------

router.get(
  "/analytics/dropoffs",
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, offset } = parsePagination(req.query);
    const dates = parseDateFilters(req);
    if (dates.error) {
      sendError(res, 400, "Invalid date filter", dates.error);
      return;
    }

    try {
      const conditions: string[] = ["is_dropoff = true"];
      const params: unknown[] = [];
      let idx = 1;

      if (dates.from) {
        conditions.push(`event_time >= $${idx++}`);
        params.push(dates.from);
      }
      if (dates.to) {
        conditions.push(`event_time <= $${idx++}`);
        params.push(dates.to);
      }

      const whereClause = conditions.join(" AND ");

      const [countResult] = await query<{ count: string }>(
        `SELECT COUNT(DISTINCT (channel, event_type))::text AS count
           FROM timeline_events WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.count, 10);

      const rows = await query<{
        channel: string;
        event_type: string;
        dropoff_count: string;
      }>(
        `SELECT channel, event_type, COUNT(*) AS dropoff_count
           FROM timeline_events
          WHERE ${whereClause}
          GROUP BY channel, event_type
          ORDER BY dropoff_count DESC
          LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      );

      const data = rows.map((r) => ({
        channel: r.channel,
        event_type: r.event_type,
        dropoff_count: parseInt(String(r.dropoff_count), 10),
      }));

      res.json(paginatedResponse(data, total, page, limit));
    } catch (err) {
      console.error("GET /analytics/dropoffs error:", err);
      sendError(res, 500, "Internal server error", errorMessage(err));
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/analytics/escalations
// Escalation frequency grouped by channel and day.
// Reads is_escalation flag on timeline_events.
// ---------------------------------------------------------------------------

router.get(
  "/analytics/escalations",
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, offset } = parsePagination(req.query);
    const dates = parseDateFilters(req);
    if (dates.error) {
      sendError(res, 400, "Invalid date filter", dates.error);
      return;
    }

    try {
      const conditions: string[] = ["is_escalation = true"];
      const params: unknown[] = [];
      let idx = 1;

      if (dates.from) {
        conditions.push(`event_time >= $${idx++}`);
        params.push(dates.from);
      }
      if (dates.to) {
        conditions.push(`event_time <= $${idx++}`);
        params.push(dates.to);
      }

      const whereClause = conditions.join(" AND ");

      const [countResult] = await query<{ count: string }>(
        `SELECT COUNT(DISTINCT (channel, DATE_TRUNC('day', event_time)))::text AS count
           FROM timeline_events WHERE ${whereClause}`,
        params
      );
      const total = parseInt(countResult.count, 10);

      const rows = await query<{
        channel: string;
        day: string;
        escalation_count: string;
      }>(
        `SELECT channel,
                DATE_TRUNC('day', event_time AT TIME ZONE 'UTC') AS day,
                COUNT(*) AS escalation_count
           FROM timeline_events
          WHERE ${whereClause}
          GROUP BY channel, day
          ORDER BY day DESC, escalation_count DESC
          LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      );

      const data = rows.map((r) => ({
        channel: r.channel,
        day: new Date(r.day).toISOString(),
        escalation_count: parseInt(String(r.escalation_count), 10),
      }));

      res.json(paginatedResponse(data, total, page, limit));
    } catch (err) {
      console.error("GET /analytics/escalations error:", err);
      sendError(res, 500, "Internal server error", errorMessage(err));
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/analytics/repeat-contacts?threshold=3
// Customers with repeat support contacts above a configurable threshold.
// Reads analytics_flags where flag_type = 'repeat_contact'.
// threshold defaults to 3 (OQ-4 resolved default).
// ---------------------------------------------------------------------------

router.get(
  "/analytics/repeat-contacts",
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, offset } = parsePagination(req.query);

    const rawThreshold = req.query.threshold;
    const threshold = rawThreshold
      ? parseInt(String(rawThreshold), 10)
      : 3;

    if (isNaN(threshold) || threshold < 1) {
      sendError(
        res,
        400,
        "Invalid threshold",
        "?threshold must be a positive integer (default: 3)"
      );
      return;
    }

    try {
      const [countResult] = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM analytics_flags
          WHERE flag_type = 'repeat_contact' AND score >= $1`,
        [threshold]
      );
      const total = parseInt(countResult.count, 10);

      const rows = await query<{
        customer_id: string;
        score: number;
        computed_at: string;
        details: Record<string, unknown> | null;
      }>(
        `SELECT af.customer_id,
                af.score,
                af.computed_at AT TIME ZONE 'UTC' AS computed_at,
                af.details
           FROM analytics_flags af
          WHERE af.flag_type = 'repeat_contact' AND af.score >= $1
          ORDER BY af.score DESC, af.computed_at DESC
          LIMIT $2 OFFSET $3`,
        [threshold, limit, offset]
      );

      res.json({
        threshold,
        ...paginatedResponse(rows, total, page, limit),
      });
    } catch (err) {
      console.error("GET /analytics/repeat-contacts error:", err);
      sendError(res, 500, "Internal server error", errorMessage(err));
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/analytics/churn-risk
// Customers ranked by churn-risk score, with contributing journey factors.
// Reads analytics_flags where flag_type = 'churn_risk' (pre-computed by Python engine).
// Churn label definition: ADR-005 (unresolved escalation + 30+ days no activity).
// ---------------------------------------------------------------------------

router.get(
  "/analytics/churn-risk",
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit, offset } = parsePagination(req.query);

    try {
      const [countResult] = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM analytics_flags
          WHERE flag_type = 'churn_risk'`,
        []
      );
      const total = parseInt(countResult.count, 10);

      const rows = await query<{
        customer_id: string;
        score: number;
        computed_at: string;
        details: Record<string, unknown> | null;
      }>(
        `SELECT af.customer_id,
                af.score,
                af.computed_at AT TIME ZONE 'UTC' AS computed_at,
                af.details
           FROM analytics_flags af
          WHERE af.flag_type = 'churn_risk'
          ORDER BY af.score DESC, af.computed_at DESC
          LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      res.json(paginatedResponse(rows, total, page, limit));
    } catch (err) {
      console.error("GET /analytics/churn-risk error:", err);
      sendError(res, 500, "Internal server error", errorMessage(err));
    }
  }
);

export default router;
