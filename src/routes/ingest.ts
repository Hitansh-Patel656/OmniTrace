import { Router, Request, Response } from "express";
import { getCollection } from "../db/mongo";
import { IngestRequest, RawEventDoc, IngestSuccess, Channel } from "../types";
import { validateChannel, validateIngestBody } from "../middleware/validation";
import { sendError, errorMessage } from "../utils/errors";
import { processRawEvent } from "../services/engine";

const router = Router();

/**
 * POST /api/ingest/:channel
 *
 * Accepts a raw event from a given channel (web | mobile_app | call_center | in_person).
 * Stores the validated event exactly as received into MongoDB raw_events — no transformation.
 * Normalization belongs to the stitching service, not this endpoint (see CLAUDE.md, ADR-003).
 *
 * Response: 202 Accepted with the generated MongoDB document ID.
 */
router.post(
  "/ingest/:channel",
  validateChannel,
  validateIngestBody,
  async (req: Request, res: Response): Promise<void> => {
    const channel = req.params.channel as Channel;
    const body = req.body as IngestRequest;

    try {
      const collection = await getCollection("raw_events");

      const document: Omit<RawEventDoc, "_id"> = {
        channel,
        raw_identifiers: body.raw_identifiers,
        event_type: body.event_type,
        event_payload: body.event_payload ?? {},
        timestamp: body.timestamp,
        ingested_at: new Date(),
      };

      const result = await collection.insertOne(document);

      const rawEventDoc: RawEventDoc = {
        ...document,
        _id: result.insertedId,
      };

      // Process event through identity resolution & event stitching engine
      try {
        await processRawEvent(rawEventDoc);
      } catch (engineErr) {
        // Engine failure is non-fatal for the ingest response — the raw event is
        // safely stored in MongoDB with processed: undefined. Use POST /api/engine/run
        // to retry unprocessed events.
        console.error(
          `[ENGINE] Processing failed for event ${result.insertedId.toString()} — event is persisted in MongoDB and can be recovered via POST /api/engine/run`,
          engineErr
        );
      }

      const success: IngestSuccess = { id: result.insertedId.toString() };
      res.status(202).json(success);
    } catch (err) {
      console.error("Error ingesting event:", err);
      sendError(res, 500, "Internal server error", errorMessage(err));
    }

  }
);

export default router;