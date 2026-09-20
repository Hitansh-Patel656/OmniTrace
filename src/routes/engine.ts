import { Router, Request, Response } from "express";
import { getCollection } from "../db/mongo";
import { query } from "../db/postgres";
import { processBatch } from "../services/engine";
import { computeAnalyticsFlags } from "../services/analytics";
import { sendError, errorMessage } from "../utils/errors";

const router = Router();

/**
 * POST /api/engine/run
 *
 * Triggers a batch run of the identity-resolution + event-stitching engine
 * over all MongoDB raw_events documents that have not yet been processed
 * (i.e. processed field is absent or false).
 *
 * Optional query param: ?limit=<number>  (default: 1000)
 *
 * Use this endpoint to:
 *  - Recover events that failed silent processing during ingestion (see ingest.ts).
 *  - Process events ingested before the engine was wired up.
 *  - Trigger a manual re-run during development/demos.
 */
router.post(
  "/engine/run",
  async (req: Request, res: Response): Promise<void> => {
    const rawLimit = req.query.limit;
    const limit =
      rawLimit !== undefined && !isNaN(Number(rawLimit)) && Number(rawLimit) > 0
        ? Math.min(Number(rawLimit), 10000)
        : 1000;

    try {
      const result = await processBatch(limit);
      const analyticsResult = await computeAnalyticsFlags();

      res.json({
        message: "Batch processing and analytics computation complete",
        totalProcessed: result.totalProcessed,
        results: result.results,
        analytics: analyticsResult,
      });
    } catch (err) {
      console.error("POST /engine/run error:", err);
      sendError(res, 500, "Engine batch processing failed", errorMessage(err));
    }
  }
);

/**
 * GET /api/engine/status
 *
 * Returns live operational telemetry across both MongoDB and PostgreSQL:
 * - MongoDB: pending and processed raw events
 * - PostgreSQL: total customers, timeline events, dropoffs, escalations, churn risks, repeat contacts
 */
router.get(
  "/engine/status",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const collection = await getCollection("raw_events");
      const [pendingCount, processedCount] = await Promise.all([
        collection.countDocuments({ processed: { $ne: true } }),
        collection.countDocuments({ processed: true }),
      ]);

      const [
        [custRes],
        [eventRes],
        [dropoffRes],
        [escalationRes],
        [churnRes],
        [repeatRes],
      ] = await Promise.all([
        query<{ count: string }>("SELECT COUNT(*)::text AS count FROM customers"),
        query<{ count: string }>("SELECT COUNT(*)::text AS count FROM timeline_events"),
        query<{ count: string }>("SELECT COUNT(*)::text AS count FROM timeline_events WHERE is_dropoff = true"),
        query<{ count: string }>("SELECT COUNT(*)::text AS count FROM timeline_events WHERE is_escalation = true"),
        query<{ count: string }>("SELECT COUNT(*)::text AS count FROM analytics_flags WHERE flag_type = 'churn_risk'"),
        query<{ count: string }>("SELECT COUNT(*)::text AS count FROM analytics_flags WHERE flag_type = 'repeat_contact'"),
      ]);

      const totalCustomers = parseInt(custRes?.count || "0", 10);
      const totalTimelineEvents = parseInt(eventRes?.count || "0", 10);
      const totalDropoffs = parseInt(dropoffRes?.count || "0", 10);
      const totalEscalations = parseInt(escalationRes?.count || "0", 10);
      const churnRiskCount = parseInt(churnRes?.count || "0", 10);
      const repeatContactCount = parseInt(repeatRes?.count || "0", 10);

      res.json({
        pending: pendingCount,
        processed: processedCount,
        total: pendingCount + processedCount,
        totalCustomers,
        totalTimelineEvents,
        totalDropoffs,
        totalEscalations,
        churnRiskCount,
        repeatContactCount,
      });
    } catch (err) {
      console.error("GET /engine/status error:", err);
      sendError(res, 500, "Internal server error", errorMessage(err));
    }
  }
);

export default router;
