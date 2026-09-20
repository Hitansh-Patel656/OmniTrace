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

// ---------------------------------------------------------------------------
// GET /api/analytics/funnel
// Dynamic multi-stage conversion funnel and channel friction matrix.
// Aggregated in real time from timeline_events.
// ---------------------------------------------------------------------------

router.get("/analytics/funnel", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      [stage1Res],
      [stage2Res],
      [stage3Res],
      [stage4Res],
      [stage5Res],
    ] = await Promise.all([
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM timeline_events"),
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM timeline_events WHERE event_type IN ('page_view', 'app_login', 'issue_reported', 'add_to_cart', 'checkout_started', 'checkout_abandoned', 'order_placed')"),
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM timeline_events WHERE event_type IN ('add_to_cart', 'checkout_started', 'checkout_abandoned', 'order_placed')"),
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM timeline_events WHERE event_type IN ('checkout_started', 'checkout_abandoned', 'order_placed')"),
      query<{ count: string }>("SELECT COUNT(*)::text AS count FROM timeline_events WHERE event_type IN ('order_placed', 'purchase')"),
    ]);

    const s1 = parseInt(stage1Res?.count || "0", 10);
    const s2 = parseInt(stage2Res?.count || "0", 10);
    const s3 = parseInt(stage3Res?.count || "0", 10);
    const s4 = parseInt(stage4Res?.count || "0", 10);
    const s5 = parseInt(stage5Res?.count || "0", 10);

    const calcRetention = (curr: number, prev: number) => {
      if (prev === 0) return "100%";
      return `${((curr / prev) * 100).toFixed(1)}%`;
    };

    const calcDrop = (curr: number, prev: number) => {
      if (prev === 0) return "0%";
      const diff = curr - prev;
      return `${((diff / prev) * 100).toFixed(1)}%`;
    };

    const stages = [
      {
        step: 1,
        name: "Session Ingestion",
        events: "session_start, store_visit, in_person_visit, call_initiated",
        volume: s1,
        pctOfTotal: s1 > 0 ? 100 : 0,
        retention: "100%",
        dropPct: "0%",
        status: "optimal",
        color: "from-indigo-600 to-indigo-500",
      },
      {
        step: 2,
        name: "Engagement & Browse",
        events: "page_view, app_login, issue_reported",
        volume: s2,
        pctOfTotal: s1 > 0 ? Number(((s2 / s1) * 100).toFixed(1)) : 0,
        retention: calcRetention(s2, s1),
        dropPct: calcDrop(s2, s1),
        status: "healthy",
        color: "from-blue-600 to-cyan-500",
      },
      {
        step: 3,
        name: "Cart Intent",
        events: "add_to_cart",
        volume: s3,
        pctOfTotal: s1 > 0 ? Number(((s3 / s1) * 100).toFixed(1)) : 0,
        retention: calcRetention(s3, s2),
        dropPct: calcDrop(s3, s2),
        status: "healthy",
        color: "from-cyan-600 to-teal-500",
      },
      {
        step: 4,
        name: "Checkout Initiated",
        events: "checkout_started",
        volume: s4,
        pctOfTotal: s1 > 0 ? Number(((s4 / s1) * 100).toFixed(1)) : 0,
        retention: calcRetention(s4, s3),
        dropPct: calcDrop(s4, s3),
        status: "warning",
        color: "from-amber-600 to-amber-500",
      },
      {
        step: 5,
        name: "Order Placed",
        events: "order_placed, purchase",
        volume: s5,
        pctOfTotal: s1 > 0 ? Number(((s5 / s1) * 100).toFixed(1)) : 0,
        retention: calcRetention(s5, s4),
        dropPct: calcDrop(s5, s4),
        status: "optimal",
        color: "from-emerald-600 to-emerald-500",
      },
    ];

    // Channel friction matrix
    const channelRows = await query<{
      channel: string;
      total_events: string;
      dropoff_count: string;
      escalation_count: string;
    }>(`
      SELECT channel,
             COUNT(*) AS total_events,
             COUNT(*) FILTER (WHERE is_dropoff = true) AS dropoff_count,
             COUNT(*) FILTER (WHERE is_escalation = true) AS escalation_count
        FROM timeline_events
       GROUP BY channel
       ORDER BY dropoff_count DESC, total_events DESC
    `);

    const totalDropoffs = channelRows.reduce((acc, r) => acc + parseInt(r.dropoff_count, 10), 0);

    const channels = channelRows.map((r) => {
      const dropoffs = parseInt(r.dropoff_count, 10);
      const total = parseInt(r.total_events, 10);
      const share = totalDropoffs > 0 ? Number(((dropoffs / totalDropoffs) * 100).toFixed(1)) : 0;
      return {
        channel: r.channel,
        totalEvents: total,
        dropoffs,
        escalations: parseInt(r.escalation_count, 10),
        share,
        status: dropoffs > 0 ? "High Friction" : "Smooth Flow",
      };
    });

    // Top abandonment points with customer examples
    const abandonmentPoints = await query<{
      channel: string;
      event_type: string;
      dropoff_count: string;
      example_customer_id: string | null;
    }>(`
      SELECT te.channel,
             te.event_type,
             COUNT(*) AS dropoff_count,
             (SELECT customer_id FROM timeline_events sub WHERE sub.channel = te.channel AND sub.event_type = te.event_type AND sub.is_dropoff = true LIMIT 1) AS example_customer_id
        FROM timeline_events te
       WHERE is_dropoff = true
       GROUP BY te.channel, te.event_type
       ORDER BY dropoff_count DESC
    `);

    const abandonments = abandonmentPoints.map((r) => ({
      channel: r.channel,
      event_type: r.event_type,
      dropoff_count: parseInt(r.dropoff_count, 10),
      example_customer_id: r.example_customer_id,
      share: totalDropoffs > 0 ? Number(((parseInt(r.dropoff_count, 10) / totalDropoffs) * 100).toFixed(1)) : 100,
    }));

    res.json({
      overallConversionRate: s1 > 0 ? Number(((s5 / s1) * 100).toFixed(1)) : 0,
      totalEvents: s1,
      totalConvertedOrders: s5,
      totalDropoffs,
      stages,
      channels,
      abandonments,
    });
  } catch (err) {
    console.error("GET /analytics/funnel error:", err);
    sendError(res, 500, "Internal server error", errorMessage(err));
  }
});

export default router;
