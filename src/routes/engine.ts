import { Router, Request, Response } from "express";
import { getCollection } from "../db/mongo";
import { processBatch } from "../services/engine";
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
      res.json({
        message: "Batch processing complete",
        totalProcessed: result.totalProcessed,
        results: result.results,
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
 * Returns the count of unprocessed events in MongoDB without processing them.
 * Useful for monitoring how far behind the engine is.
 */
router.get(
  "/engine/status",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const collection = await getCollection("raw_events");
      const pendingCount = await collection.countDocuments({
        processed: { $ne: true },
      });
      const processedCount = await collection.countDocuments({
        processed: true,
      });

      res.json({
        pending: pendingCount,
        processed: processedCount,
        total: pendingCount + processedCount,
      });
    } catch (err) {
      console.error("GET /engine/status error:", err);
      sendError(res, 500, "Internal server error", errorMessage(err));
    }
  }
);

export default router;
