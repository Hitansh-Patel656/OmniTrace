import dotenv from "dotenv";
import { computeAnalyticsFlags } from "../services/analytics";
import { closePool } from "../db/postgres";

dotenv.config();

async function run() {
  console.log("=================================================");
  console.log("🚀 OmniTrace Automated Analytics Flags Calculator");
  console.log("=================================================\n");

  try {
    const result = await computeAnalyticsFlags();
    console.log("\nSummary:");
    console.log(`- High Churn Risk Flags:     ${result.churnFlagsCount}`);
    console.log(`- Repeat Contact Loop Flags: ${result.repeatContactFlagsCount}`);
    console.log(`- Total Analytics Flags:     ${result.totalComputed}\n`);
    console.log("✅ Database successfully updated with analytics flags.");
  } catch (err) {
    console.error("❌ Analytics computation failed:", err);
    process.exit(1);
  } finally {
    await closePool();
  }
}

run();
