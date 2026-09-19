import { Router, Request, Response } from "express";
import { query, withTransaction } from "../db/postgres";
import { MergeRequest, SplitRequest, IdentityLink, Customer } from "../types";
import {
  validateUUID,
  validateMergeBody,
  validateSplitBody,
} from "../middleware/validation";
import { sendError, errorMessage } from "../utils/errors";
import { parsePagination, paginatedResponse } from "../utils/pagination";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/identity/:customer_id
// Returns all raw identifiers linked to a resolved customer_id.
// ---------------------------------------------------------------------------

router.get(
  "/identity/:customer_id",
  validateUUID("customer_id"),
  async (req: Request, res: Response): Promise<void> => {
    const { customer_id } = req.params;
    const { page, limit, offset } = parsePagination(req.query);

    try {
      // Check the customer exists
      const customers = await query<Customer>(
        "SELECT customer_id, created_at, updated_at FROM customers WHERE customer_id = $1",
        [customer_id]
      );

      if (customers.length === 0) {
        sendError(res, 404, "Not found", `No customer found with customer_id: ${customer_id}`);
        return;
      }

      // Fetch linked identifiers (paginated)
      const [countResult] = await query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM identity_links WHERE customer_id = $1",
        [customer_id]
      );
      const total = parseInt(countResult.count, 10);

      const links = await query<IdentityLink>(
        `SELECT id, customer_id, identifier_type, identifier_value, confidence_score,
                linked_at AT TIME ZONE 'UTC' AS linked_at
           FROM identity_links
          WHERE customer_id = $1
          ORDER BY confidence_score DESC, linked_at ASC
          LIMIT $2 OFFSET $3`,
        [customer_id, limit, offset]
      );

      res.json({
        customer: customers[0],
        ...paginatedResponse(links, total, page, limit),
      });
    } catch (err) {
      console.error("GET /identity/:customer_id error:", err);
      sendError(res, 500, "Internal server error", errorMessage(err));
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/identity/merge
// Analyst override: merge customer_id_b into customer_id_a.
// Runs in a PG transaction — all identity_links for B are re-pointed to A,
// timeline_events for B are re-pointed to A, then B is deleted.
// ---------------------------------------------------------------------------

router.post(
  "/identity/merge",
  validateMergeBody,
  async (req: Request, res: Response): Promise<void> => {
    const { customer_id_a, customer_id_b, reason } = req.body as MergeRequest;

    try {
      await withTransaction(async (client) => {
        // Confirm both customers exist
        const a = await client.query(
          "SELECT customer_id FROM customers WHERE customer_id = $1",
          [customer_id_a]
        );
        if (a.rowCount === 0) {
          throw Object.assign(
            new Error(`customer_id_a not found: ${customer_id_a}`),
            { status: 404 }
          );
        }

        const b = await client.query(
          "SELECT customer_id FROM customers WHERE customer_id = $1",
          [customer_id_b]
        );
        if (b.rowCount === 0) {
          throw Object.assign(
            new Error(`customer_id_b not found: ${customer_id_b}`),
            { status: 404 }
          );
        }

        // Re-point identity_links
        await client.query(
          "UPDATE identity_links SET customer_id = $1 WHERE customer_id = $2",
          [customer_id_a, customer_id_b]
        );

        // Re-point timeline_events
        await client.query(
          "UPDATE timeline_events SET customer_id = $1 WHERE customer_id = $2",
          [customer_id_a, customer_id_b]
        );

        // Re-point analytics_flags
        await client.query(
          "UPDATE analytics_flags SET customer_id = $1 WHERE customer_id = $2",
          [customer_id_a, customer_id_b]
        );

        // Delete the now-empty customer_b record
        await client.query(
          "DELETE FROM customers WHERE customer_id = $1",
          [customer_id_b]
        );

        // Update customer_a's updated_at timestamp
        await client.query(
          "UPDATE customers SET updated_at = NOW() WHERE customer_id = $1",
          [customer_id_a]
        );

        // Record the analyst override as an analytics_flag
        await client.query(
          `INSERT INTO analytics_flags (id, customer_id, flag_type, score, computed_at, details)
           VALUES ($1, $2, 'escalation', 1.0, NOW(), $3::jsonb)`,
          [
            uuidv4(),
            customer_id_a,
            JSON.stringify({
              action: "analyst_merge",
              merged_from: customer_id_b,
              reason,
              performed_at: new Date().toISOString(),
            }),
          ]
        );
      });

      res.json({
        message: "Merge successful",
        surviving_customer_id: customer_id_a,
        merged_customer_id: customer_id_b,
        reason,
      });
    } catch (err: unknown) {
      console.error("POST /identity/merge error:", err);
      const status =
        err instanceof Error && "status" in err && typeof (err as { status: unknown }).status === "number"
          ? (err as { status: number }).status
          : 500;
      const msg = err instanceof Error ? err.message : "An unknown error occurred";
      sendError(res, status, status === 404 ? "Not found" : "Internal server error", msg);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/identity/split
// Analyst override: split an incorrectly merged identity.
// All probabilistic links (confidence_score < 1.0) are detached from
// customer_id into a newly created customer record.
// Deterministic links (confidence_score = 1.0) stay with the original.
// ---------------------------------------------------------------------------

router.post(
  "/identity/split",
  validateSplitBody,
  async (req: Request, res: Response): Promise<void> => {
    const { customer_id, reason } = req.body as SplitRequest;

    try {
      let new_customer_id = "";

      await withTransaction(async (client) => {
        // Confirm the customer exists
        const existing = await client.query(
          "SELECT customer_id FROM customers WHERE customer_id = $1",
          [customer_id]
        );
        if (existing.rowCount === 0) {
          throw Object.assign(
            new Error(`customer_id not found: ${customer_id}`),
            { status: 404 }
          );
        }

        // Find probabilistic links (confidence_score < 1.0)
        const probabilistic = await client.query(
          `SELECT id FROM identity_links
            WHERE customer_id = $1 AND confidence_score < 1.0`,
          [customer_id]
        );

        if (probabilistic.rowCount === 0) {
          throw Object.assign(
            new Error(
              "No probabilistic identity links found to split; only deterministic (confidence = 1.0) links exist"
            ),
            { status: 422 }
          );
        }

        // Create the new customer record
        new_customer_id = uuidv4();
        await client.query(
          "INSERT INTO customers (customer_id, created_at, updated_at) VALUES ($1, NOW(), NOW())",
          [new_customer_id]
        );

        // Re-point probabilistic links to the new customer
        const linkIds = probabilistic.rows.map((r: { id: string }) => r.id);
        await client.query(
          `UPDATE identity_links SET customer_id = $1
            WHERE id = ANY($2::uuid[])`,
          [new_customer_id, linkIds]
        );

        // Update original customer's updated_at
        await client.query(
          "UPDATE customers SET updated_at = NOW() WHERE customer_id = $1",
          [customer_id]
        );

        // Record the analyst override
        await client.query(
          `INSERT INTO analytics_flags (id, customer_id, flag_type, score, computed_at, details)
           VALUES ($1, $2, 'escalation', 1.0, NOW(), $3::jsonb)`,
          [
            uuidv4(),
            customer_id,
            JSON.stringify({
              action: "analyst_split",
              new_customer_id,
              links_moved: linkIds.length,
              reason,
              performed_at: new Date().toISOString(),
            }),
          ]
        );
      });

      res.json({
        message: "Split successful",
        original_customer_id: customer_id,
        new_customer_id,
        reason,
      });
    } catch (err: unknown) {
      console.error("POST /identity/split error:", err);
      const status =
        err instanceof Error && "status" in err && typeof (err as { status: unknown }).status === "number"
          ? (err as { status: number }).status
          : 500;
      const msg = err instanceof Error ? err.message : "An unknown error occurred";
      const label =
        status === 404
          ? "Not found"
          : status === 422
          ? "Unprocessable entity"
          : "Internal server error";
      sendError(res, status, label, msg);
    }
  }
);

export default router;
