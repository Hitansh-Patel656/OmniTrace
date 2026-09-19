import { Router, Request, Response } from "express";
import { getCollection } from "../db/mongo";
import { IngestRequest, RawEventDoc, ErrorResponse, IngestSuccess, Channel } from "../types";
import { validateChannel, validateIngestBody } from "../middleware/validation";

const router = Router();

/**
 * POST /api/ingest/:channel
 * Ingest raw event from given channel, store in MongoDB exactly as received,
 * return 202 Accepted with generated ID.
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
        event_payload: body.event_payload,
        timestamp: body.timestamp,
        ingested_at: new Date(),
      };

      const result = await collection.insertOne(document);

      const success: IngestSuccess = { id: result.insertedId.toString() };
      res.status(202).json(success);
    } catch (err) {
      console.error("Error ingesting event:", err);
      const error: ErrorResponse = {
        error: "Internal server error",
        details:
          err instanceof Error ? err.message : "An unknown error occurred",
      };
      res.status(500).json(error);
    }
  }
);

export default router;