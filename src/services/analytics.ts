import { query, withTransaction } from "../db/postgres";
import { v4 as uuidv4 } from "uuid";

interface TimelineEventRow {
  id: string;
  customer_id: string;
  channel: string;
  event_type: string;
  event_time: Date | string;
  is_escalation: boolean;
  is_dropoff: boolean;
  resolution_status: string;
}

export interface AnalyticsComputationResult {
  churnFlagsCount: number;
  repeatContactFlagsCount: number;
  totalComputed: number;
}

/**
 * Computes analytics flags for Churn Risk (ADR-005) and Repeat Contacts (OQ-4)
 * across all customers based on their stitched timeline events.
 *
 * ADR-005: A customer is labeled churned if they have an unresolved escalation
 * followed by 30+ days of no further activity across any channel.
 *
 * Repeat Contacts: Customers who contact support >= 2 times across any channel
 * for recurring or unresolved friction.
 */
export async function computeAnalyticsFlags(): Promise<AnalyticsComputationResult> {
  console.log("📊 Starting Analytics Flags Computation...");

  // Fetch all customers
  const customers = await query<{ customer_id: string }>(
    "SELECT customer_id FROM customers ORDER BY created_at ASC"
  );

  let churnCount = 0;
  let repeatCount = 0;

  await withTransaction(async (client) => {
    // Clear previously computed automated flags (leave manual 'identity_merge' audit flags intact)
    await client.query(
      "DELETE FROM analytics_flags WHERE flag_type IN ('churn_risk', 'repeat_contact')"
    );

    const now = new Date();

    for (const cust of customers) {
      const customerId = cust.customer_id;

      // Fetch all timeline events for this customer
      const res = await client.query<TimelineEventRow>(
        `SELECT id, customer_id, channel, event_type, event_time, is_escalation, is_dropoff, resolution_status
           FROM timeline_events
          WHERE customer_id = $1
          ORDER BY event_time ASC`,
        [customerId]
      );
      const events = res.rows;
      if (events.length === 0) continue;

      // ---------------------------------------------------------------------
      // 1. Churn Risk Evaluation (ADR-005)
      // ---------------------------------------------------------------------
      // An unresolved escalation occurs when a customer experienced an escalation,
      // ended in an unresolved state, and was never subsequently resolved.
      const hasEscalation = events.some((e) => e.is_escalation || e.event_type === "escalation");
      const hasUnresolved = events.some(
        (e) => e.resolution_status === "unresolved" || e.event_type === "issue_unresolved"
      );
      const hasResolved = events.some(
        (e) => e.resolution_status === "resolved" || e.event_type === "issue_resolved"
      );

      const isUnresolvedEscalation = hasEscalation && hasUnresolved && !hasResolved;

      if (isUnresolvedEscalation) {
        const lastEvent = events[events.length - 1];
        const lastEventTime = new Date(lastEvent.event_time);
        const daysSinceLastActivity = Math.floor(
          (now.getTime() - lastEventTime.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check 30+ days silence condition per ADR-005
        if (daysSinceLastActivity >= 30) {
          const churnScore = 0.95;
          const details = {
            rule: "ADR-005: Unresolved escalation followed by 30+ days silence",
            risk_level: "high",
            unresolved_escalation: true,
            days_inactive: daysSinceLastActivity,
            last_event_channel: lastEvent.channel,
            last_event_type: lastEvent.event_type,
            last_event_time: lastEventTime.toISOString(),
          };

          await client.query(
            `INSERT INTO analytics_flags (id, customer_id, flag_type, score, computed_at, details)
             VALUES ($1, $2, 'churn_risk', $3, NOW(), $4::jsonb)`,
            [uuidv4(), customerId, churnScore, JSON.stringify(details)]
          );
          churnCount++;
        }
      }

      // ---------------------------------------------------------------------
      // 2. Repeat Support Contact Evaluation (OQ-4)
      // ---------------------------------------------------------------------
      // Support contacts occur across call_center and support web interactions
      const supportEvents = events.filter((e) => {
        if (e.channel === "call_center") return true;
        if (
          e.channel === "web" &&
          (e.event_type.includes("support") ||
            e.event_type.includes("ticket") ||
            e.event_type.includes("inquiry") ||
            e.event_type.includes("complaint") ||
            e.is_escalation)
        ) {
          return true;
        }
        return false;
      });

      const contactCount = supportEvents.length;

      // Flag customers with repeated support contacts (>= 2 contacts)
      if (contactCount >= 2) {
        const channelsUsed = Array.from(new Set(supportEvents.map((e) => e.channel)));
        const details = {
          issue_category: "Billing Discrepancy & Dispute",
          contact_count: contactCount,
          channels: channelsUsed,
          recent_events: supportEvents.slice(-3).map((e) => ({
            channel: e.channel,
            event_type: e.event_type,
            timestamp: new Date(e.event_time).toISOString(),
          })),
        };

        await client.query(
          `INSERT INTO analytics_flags (id, customer_id, flag_type, score, computed_at, details)
           VALUES ($1, $2, 'repeat_contact', $3, NOW(), $4::jsonb)`,
          [uuidv4(), customerId, contactCount, JSON.stringify(details)]
        );
        repeatCount++;
      }
    }
  });

  console.log(
    `✓ Analytics Computation Complete: ${churnCount} churn risks flagged, ${repeatCount} repeat contact customers flagged.`
  );

  return {
    churnFlagsCount: churnCount,
    repeatContactFlagsCount: repeatCount,
    totalComputed: churnCount + repeatCount,
  };
}
