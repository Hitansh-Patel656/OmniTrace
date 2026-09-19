import { query, withTransaction } from "../db/postgres";
import { RawIdentifiers, Customer } from "../types";
import { v4 as uuidv4 } from "uuid";

export interface ResolveIdentityResult {
  customer_id: string;
  is_new: boolean;
  merged?: boolean;
}

const STRONG_IDENTIFIERS = new Set(["email", "phone", "loyalty_id"]);
const WEAK_IDENTIFIERS = new Set(["device_id", "cookie_id"]);
const IP_PROXIMITY_HOURS = 24;

/**
 * Resolves raw identifiers to a single unified customer_id.
 * Follows ADR-002:
 * 1. Deterministic match on strong identifiers (email, phone, loyalty_id) with confidence 1.0.
 * 2. Probabilistic match on weak identifiers (device_id, cookie_id) with confidence 0.85.
 * 3. Fallback to IP address proximity matching within 24h window if no other identifier matches.
 * 4. Merges multiple customer entities if an event bridges previously separate graphs.
 * 5. Persists any new identifiers into identity_links with appropriate confidence score.
 */
export async function resolveIdentity(
  rawIdentifiers: RawIdentifiers,
  eventTimestamp?: string | Date
): Promise<ResolveIdentityResult> {
  const timestamp = eventTimestamp ? new Date(eventTimestamp) : new Date();

  // Normalize identifiers: filter out empty/null/undefined
  const normalizedEntries: Array<{ type: string; value: string }> = [];
  for (const [key, val] of Object.entries(rawIdentifiers)) {
    if (val !== null && val !== undefined && typeof val === "string" && val.trim() !== "") {
      normalizedEntries.push({ type: key, value: val.trim() });
    }
  }

  if (normalizedEntries.length === 0) {
    // Completely anonymous without any identifier: create an isolated guest customer
    const [newCustomer] = await query<Customer>(
      "INSERT INTO customers (created_at, updated_at) VALUES ($1, $1) RETURNING customer_id, created_at, updated_at",
      [timestamp.toISOString()]
    );
    return { customer_id: newCustomer.customer_id, is_new: true };
  }

  const strongEntries = normalizedEntries.filter((e) => STRONG_IDENTIFIERS.has(e.type));
  const weakEntries = normalizedEntries.filter((e) => WEAK_IDENTIFIERS.has(e.type));
  const ipEntry = normalizedEntries.find((e) => e.type === "ip_address");

  let matchedCustomerIds: string[] = [];

  // Pass 1: Deterministic match (strong identifiers)
  if (strongEntries.length > 0) {
    const conditions = strongEntries.map((_, i) => `(identifier_type = $${i * 2 + 1} AND identifier_value = $${i * 2 + 2})`).join(" OR ");
    const params: string[] = [];
    strongEntries.forEach((e) => params.push(e.type, e.value));

    const rows = await query<{ customer_id: string }>(
      `SELECT DISTINCT customer_id FROM identity_links WHERE ${conditions}`,
      params
    );
    matchedCustomerIds = rows.map((r) => r.customer_id);
  }

  // Pass 2: Probabilistic match (weak identifiers) if no strong matches found
  if (matchedCustomerIds.length === 0 && weakEntries.length > 0) {
    const conditions = weakEntries.map((_, i) => `(identifier_type = $${i * 2 + 1} AND identifier_value = $${i * 2 + 2})`).join(" OR ");
    const params: string[] = [];
    weakEntries.forEach((e) => params.push(e.type, e.value));

    const rows = await query<{ customer_id: string }>(
      `SELECT DISTINCT customer_id FROM identity_links WHERE ${conditions}`,
      params
    );
    matchedCustomerIds = rows.map((r) => r.customer_id);
  }

  // Pass 3: IP Address proximity match if still no matches and IP is present
  if (matchedCustomerIds.length === 0 && ipEntry) {
    const rows = await query<{ customer_id: string }>(
      `SELECT customer_id FROM identity_links
        WHERE identifier_type = 'ip_address'
          AND identifier_value = $1
          AND linked_at >= ($2::timestamptz - INTERVAL '${IP_PROXIMITY_HOURS} hours')
          AND linked_at <= ($2::timestamptz + INTERVAL '${IP_PROXIMITY_HOURS} hours')
        ORDER BY linked_at DESC
        LIMIT 1`,
      [ipEntry.value, timestamp.toISOString()]
    );
    if (rows.length > 0) {
      matchedCustomerIds = [rows[0].customer_id];
    }
  }

  let resolvedCustomerId: string;
  let isNew = false;
  let didMerge = false;

  if (matchedCustomerIds.length === 0) {
    // No matches -> Create a new customer
    const [newCustomer] = await query<Customer>(
      "INSERT INTO customers (created_at, updated_at) VALUES ($1, $1) RETURNING customer_id, created_at, updated_at",
      [timestamp.toISOString()]
    );
    resolvedCustomerId = newCustomer.customer_id;
    isNew = true;
  } else if (matchedCustomerIds.length === 1) {
    resolvedCustomerId = matchedCustomerIds[0];
  } else {
    // Disjoint Merge: Multiple existing customers must be consolidated
    didMerge = true;
    const primaryId = matchedCustomerIds[0];
    const secondaryIds = matchedCustomerIds.slice(1);

    await withTransaction(async (client) => {
      for (const secondaryId of secondaryIds) {
        // Re-point identity_links
        await client.query(
          "UPDATE identity_links SET customer_id = $1 WHERE customer_id = $2",
          [primaryId, secondaryId]
        );

        // Re-point timeline_events
        await client.query(
          "UPDATE timeline_events SET customer_id = $1 WHERE customer_id = $2",
          [primaryId, secondaryId]
        );

        // Re-point analytics_flags
        await client.query(
          "UPDATE analytics_flags SET customer_id = $1 WHERE customer_id = $2",
          [primaryId, secondaryId]
        );

        // Delete merged customer
        await client.query(
          "DELETE FROM customers WHERE customer_id = $1",
          [secondaryId]
        );

        // Record merge audit flag
        await client.query(
          `INSERT INTO analytics_flags (id, customer_id, flag_type, score, computed_at, details)
           VALUES ($1, $2, 'escalation', 1.0, NOW(), $3::jsonb)`,
          [
            uuidv4(),
            primaryId,
            JSON.stringify({
              action: "auto_merge",
              merged_from: secondaryId,
              reason: "Identity graph connected component collapse",
              timestamp: timestamp.toISOString(),
            }),
          ]
        );
      }

      await client.query(
        "UPDATE customers SET updated_at = NOW() WHERE customer_id = $1",
        [primaryId]
      );
    });

    resolvedCustomerId = primaryId;
  }

  // Persist all observed identifiers to identity_links if not already present
  for (const entry of normalizedEntries) {
    let confidenceScore = 0.85;
    if (STRONG_IDENTIFIERS.has(entry.type)) {
      confidenceScore = 1.0;
    } else if (entry.type === "ip_address") {
      confidenceScore = 0.8;
    }

    await query(
      `INSERT INTO identity_links (id, customer_id, identifier_type, identifier_value, confidence_score, linked_at)
       SELECT $1::uuid, $2::uuid, $3::varchar, $4::varchar, $5::float8, $6::timestamptz
       WHERE NOT EXISTS (
         SELECT 1 FROM identity_links
          WHERE customer_id = $2::uuid AND identifier_type = $3::varchar AND identifier_value = $4::varchar
       )`,
      [
        uuidv4(),
        resolvedCustomerId,
        entry.type,
        entry.value,
        confidenceScore,
        timestamp.toISOString(),
      ]
    );

  }

  // Update customer's updated_at
  await query(
    "UPDATE customers SET updated_at = GREATEST(updated_at, $2::timestamptz) WHERE customer_id = $1",
    [resolvedCustomerId, timestamp.toISOString()]
  );

  return {
    customer_id: resolvedCustomerId,
    is_new: isNew,
    merged: didMerge,
  };
}
