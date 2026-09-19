import { getCollection } from "../db/mongo";
import { RawEventDoc, TimelineEvent } from "../types";
import { resolveIdentity, ResolveIdentityResult } from "./identity";
import { stitchAndNormalizeEvent } from "./stitching";

export interface ProcessedEventResult extends ResolveIdentityResult {
  timeline_event: TimelineEvent;
}

/**
 * Processes a single raw event from MongoDB:
 * 1. Resolves identity to unified customer_id.
 * 2. Normalizes and stitches the event into PostgreSQL timeline_events.
 * 3. Marks the MongoDB document as processed.
 */
export async function processRawEvent(
  rawEvent: RawEventDoc
): Promise<ProcessedEventResult> {
  const identityResult = await resolveIdentity(
    rawEvent.raw_identifiers || {},
    rawEvent.timestamp
  );

  const timelineEvent = await stitchAndNormalizeEvent(
    identityResult.customer_id,
    rawEvent
  );

  // Update MongoDB document status if _id exists
  if (rawEvent._id) {
    try {
      const collection = await getCollection("raw_events");
      await collection.updateOne(
        { _id: rawEvent._id },
        {
          $set: {
            processed: true,
            resolved_customer_id: identityResult.customer_id,
            processed_at: new Date(),
          },
        }
      );
    } catch (err) {
      console.error("Failed to mark MongoDB event as processed:", err);
    }
  }

  return {
    ...identityResult,
    timeline_event: timelineEvent,
  };
}

/**
 * Processes a batch of unprocessed events from MongoDB in chronological order.
 */
export async function processBatch(
  limit: number = 1000
): Promise<{ totalProcessed: number; results: Array<{ id: string; customer_id: string }> }> {
  const collection = await getCollection("raw_events");
  const rawEvents = (await collection
    .find({ processed: { $ne: true } })
    .sort({ timestamp: 1 })
    .limit(limit)
    .toArray()) as unknown as RawEventDoc[];

  const results: Array<{ id: string; customer_id: string }> = [];

  for (const event of rawEvents) {
    const res = await processRawEvent(event);
    results.push({
      id: event._id.toString(),
      customer_id: res.customer_id,
    });
  }

  return {
    totalProcessed: results.length,
    results,
  };
}
