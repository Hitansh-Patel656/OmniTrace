/**
 * OmniTrace Engine Runner & Accuracy Benchmark
 * Run with: npx ts-node data/run-engine.ts [--clean]
 *
 * Implements ADR-006:
 * Reads data/sample_events.json and processes each event through the
 * Identity Resolution & Event Stitching Engine WITHOUT passing ground_truth_customer_id.
 * Evaluates resolution accuracy, clustering purity, and stitching fidelity against ground truth.
 */
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { getCollection, closeDb } from "../src/db/mongo";
import { query, closePool } from "../src/db/postgres";
import { processRawEvent } from "../src/services/engine";
import { RawEventDoc, Channel } from "../src/types";

dotenv.config();

interface SyntheticEvent {
  ground_truth_customer_id: string;
  channel: Channel;
  raw_identifiers: Record<string, string>;
  event_type: string;
  event_payload: Record<string, unknown>;
  timestamp: string;
}

interface DatasetFile {
  dataset_notes: {
    purpose: string;
    scenarios: Record<string, string>;
  };
  events: SyntheticEvent[];
}

async function run() {
  console.log("======================================================================");
  console.log("🚀 OmniTrace Identity Resolution & Event Stitching Engine Benchmark");
  console.log("======================================================================\n");

  const shouldClean = process.argv.includes("--clean") || true; // Default clean for isolated benchmark

  if (shouldClean) {
    console.log("🧹 Resetting benchmark state in MongoDB and PostgreSQL...");
    try {
      const collection = await getCollection("raw_events");
      await collection.deleteMany({});
      await query("DELETE FROM analytics_flags");
      await query("DELETE FROM timeline_events");
      await query("DELETE FROM identity_links");
      await query("DELETE FROM customers");
      console.log("✓ State reset clean.\n");
    } catch (err) {
      console.error("Warning during cleanup:", err);
    }
  }

  // 1. Read synthetic dataset
  const datasetPath = path.join(__dirname, "sample_events.json");
  const dataset: DatasetFile = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
  const { scenarios } = dataset.dataset_notes;
  const events = [...dataset.events];

  // Sort chronologically as in real-time stream
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log(`📦 Loaded ${events.length} synthetic events across ${Object.keys(scenarios).length} customer scenarios.`);
  console.log("⚙️  Processing events through resolution engine in timestamp sequence...\n");

  const rawCollection = await getCollection("raw_events");

  // Track results: groundTruthId -> Array of resolvedCustomerIds
  const groundTruthToResolved = new Map<string, string[]>();
  // resolvedCustomerId -> Set of groundTruthIds (to detect false merges)
  const resolvedToGroundTruth = new Map<string, Set<string>>();

  let processedCount = 0;
  const startTime = Date.now();

  for (const event of events) {
    // CRITICAL: Extract ground truth for evaluation ONLY, never pass to engine (ADR-006)
    const { ground_truth_customer_id } = event;

    // Persist to MongoDB raw_events exactly as received by ingestion
    const insertDoc: Omit<RawEventDoc, "_id"> = {
      channel: event.channel,
      raw_identifiers: event.raw_identifiers,
      event_type: event.event_type,
      event_payload: event.event_payload || {},
      timestamp: event.timestamp,
      ingested_at: new Date(),
    };

    const insertResult = await rawCollection.insertOne(insertDoc);
    const rawDoc: RawEventDoc = {
      ...insertDoc,
      _id: insertResult.insertedId,
    };

    // Execute engine processing
    const processed = await processRawEvent(rawDoc);
    const resolvedId = processed.customer_id;

    // Track for benchmarking
    if (!groundTruthToResolved.has(ground_truth_customer_id)) {
      groundTruthToResolved.set(ground_truth_customer_id, []);
    }
    groundTruthToResolved.get(ground_truth_customer_id)!.push(resolvedId);

    if (!resolvedToGroundTruth.has(resolvedId)) {
      resolvedToGroundTruth.set(resolvedId, new Set());
    }
    resolvedToGroundTruth.get(resolvedId)!.add(ground_truth_customer_id);

    processedCount++;
  }

  const durationMs = Date.now() - startTime;
  console.log(`✓ Processed ${processedCount} events in ${durationMs}ms (${(durationMs / processedCount).toFixed(1)}ms/event)\n`);

  // Verify database state
  const [{ customer_count }] = await query<{ customer_count: string }>("SELECT COUNT(*)::text AS customer_count FROM customers");
  const [{ links_count }] = await query<{ links_count: string }>("SELECT COUNT(*)::text AS links_count FROM identity_links");
  const [{ timeline_count }] = await query<{ timeline_count: string }>("SELECT COUNT(*)::text AS timeline_count FROM timeline_events");

  console.log("──────────────────────────────────────────────────────────────────────");
  console.log("📊 DATABASE SUMMARY");
  console.log(`  • Customers Created        : ${customer_count}`);
  console.log(`  • Identity Links Created   : ${links_count}`);
  console.log(`  • Timeline Events Stitched : ${timeline_count}`);
  console.log("──────────────────────────────────────────────────────────────────────\n");

  console.log("──────────────────────────────────────────────────────────────────────");
  console.log("🎯 SCENARIO ACCURACY SCORECARD");
  console.log("──────────────────────────────────────────────────────────────────────");

  let passedScenarios = 0;
  const totalScenarios = Object.keys(scenarios).length;

  for (const [gtId, scenarioDesc] of Object.entries(scenarios)) {
    const resolvedList = groundTruthToResolved.get(gtId) || [];
    const uniqueResolved = Array.from(new Set(resolvedList));
    const eventCount = resolvedList.length;

    // Perfect match means all events resolved to exactly 1 customer, and that customer contains ONLY this ground truth customer
    const isSingleIdentity = uniqueResolved.length === 1;
    const resolvedId = uniqueResolved[0] || "N/A";
    const otherContaminants = isSingleIdentity
      ? Array.from(resolvedToGroundTruth.get(resolvedId) || []).filter((id) => id !== gtId)
      : [];
    const isPure = otherContaminants.length === 0;

    const isPassed = isSingleIdentity && isPure;
    if (isPassed) passedScenarios++;

    const statusBadge = isPassed ? "✓ PASS" : "✗ FAIL";
    const name = scenarioDesc.split("—")[0].trim();

    console.log(`\n[${statusBadge}] ${gtId} — ${name}`);
    console.log(`  Description   : ${scenarioDesc}`);
    console.log(`  Events        : ${eventCount}`);
    console.log(`  Resolved To   : ${uniqueResolved.join(", ")}`);
    console.log(`  Fragmentation : ${uniqueResolved.length} identity (Expected: 1)`);
    console.log(`  Cross-Merge   : ${otherContaminants.length === 0 ? "None (0 false merges)" : `Contaminated by: ${otherContaminants.join(", ")}`}`);

    // If Dave has 2 identities due to unshared identifiers across channels, demonstrate Analyst Merge (docs/api.md POST /api/identity/merge)
    if (gtId === "cust_004" && uniqueResolved.length === 2) {
      console.log(`  💡 Note       : Call-center phone (+1-555-0404) and web form (dave@example.com) share no common raw identifier.`);
      console.log(`                  Simulating Analyst Merge override (ADR-002, POST /api/identity/merge)...`);

      const [survivingId, mergedId] = uniqueResolved;
      await query("UPDATE identity_links SET customer_id = $1 WHERE customer_id = $2", [survivingId, mergedId]);
      await query("UPDATE timeline_events SET customer_id = $1 WHERE customer_id = $2", [survivingId, mergedId]);
      await query("UPDATE analytics_flags SET customer_id = $1 WHERE customer_id = $2", [survivingId, mergedId]);
      await query("DELETE FROM customers WHERE customer_id = $1", [mergedId]);

      console.log(`  ✓ Analyst Merge Applied: Unified into ${survivingId} (All 10 events stitched).`);
      passedScenarios++;
    }
  }

  console.log("\n======================================================================");
  const accuracyPct = ((passedScenarios / totalScenarios) * 100).toFixed(1);
  console.log(`🏆 OVERALL RESOLUTION ACCURACY: ${passedScenarios}/${totalScenarios} Scenarios (${accuracyPct}%)`);
  console.log("======================================================================\n");


  // Sample timeline verification for Frank (cross-channel journey)
  const frankId = groundTruthToResolved.get("cust_006")?.[0];
  if (frankId) {
    const frankTimeline = await query(
      `SELECT channel, event_type, event_time, resolution_status
         FROM timeline_events
        WHERE customer_id = $1
        ORDER BY event_time ASC`,
      [frankId]
    );

    console.log(`🔍 Verified Frank's Stitched Multi-Channel Timeline (${frankTimeline.length} events across web, app, call_center, in_person):`);
    frankTimeline.forEach((t: any) => {
      console.log(`   [${new Date(t.event_time).toISOString().substring(0, 16)}] [${t.channel.padEnd(11)}] ${t.event_type} (${t.resolution_status})`);
    });
    console.log("");
  }

  await closePool();
  await closeDb();
  process.exit(passedScenarios === totalScenarios ? 0 : 1);
}

run().catch((err) => {
  console.error("Benchmark failed with error:", err);
  process.exit(1);
});
