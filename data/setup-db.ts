/**
 * One-shot setup script: creates the omnidb database and applies the OmniTrace schema.
 * Run with: npx ts-node data/setup-db.ts
 */
import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:password123@localhost:5432/omnidb";

const isRemote =
  DATABASE_URL.includes(".tech") ||
  DATABASE_URL.includes(".supabase.") ||
  DATABASE_URL.includes(".render.com") ||
  DATABASE_URL.includes("sslmode=require") ||
  (process.env.NODE_ENV === "production" &&
    !DATABASE_URL.includes("localhost") &&
    !DATABASE_URL.includes("postgres:5432"));

const sslConfig = isRemote ? { rejectUnauthorized: false } : undefined;

// Parse connection string to get the base URL (pointing to 'postgres' DB for initial CREATE DATABASE)
function toAdminUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.pathname = "/postgres";
    return parsed.toString();
  } catch {
    return url.replace(/\/[^/?]+(\?.*)?$/, "/postgres$1");
  }
}

function getDatabaseName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, "") || "omnidb";
  } catch {
    return url.split("/").pop()?.split("?")[0] || "omnidb";
  }
}

async function run() {
  const dbName = getDatabaseName(DATABASE_URL);

  // Step 1: For local environments, try creating the target database if it doesn't exist
  if (!isRemote) {
    const adminUrl = toAdminUrl(DATABASE_URL);
    const adminClient = new Client({ connectionString: adminUrl, ssl: sslConfig });
    try {
      await adminClient.connect();
      console.log("✓ Connected to postgres admin DB");

      const exists = await adminClient.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [dbName]
      );
      if (exists.rowCount === 0) {
        await adminClient.query(`CREATE DATABASE "${dbName}"`);
        console.log(`✓ Created database: ${dbName}`);
      } else {
        console.log(`  Database '${dbName}' already exists — skipping create`);
      }
    } catch (adminErr: any) {
      console.log(`  Note: Admin database check skipped (${adminErr.message}). Connecting directly...`);
    } finally {
      try {
        await adminClient.end();
      } catch {}
    }
  } else {
    console.log(`  Cloud PostgreSQL detected (${dbName}). Skipping CREATE DATABASE step.`);
  }

  // Step 2: Connect to the target DB and apply schema
  const appClient = new Client({ connectionString: DATABASE_URL, ssl: sslConfig });
  try {
    await appClient.connect();
    console.log(`✓ Connected to ${dbName}`);

    const candidatePaths = [
      path.join(__dirname, "schema.sql"),
      path.join(process.cwd(), "data", "schema.sql"),
      path.join(__dirname, "../data/schema.sql"),
    ];
    const schemaPath = candidatePaths.find((p) => fs.existsSync(p));
    if (!schemaPath) {
      throw new Error("Could not locate schema.sql in standard data directories");
    }

    const sql = fs.readFileSync(schemaPath, "utf-8");

    await appClient.query(sql);
    console.log("✓ Schema applied successfully");

    // Verify tables were created
    const tables = await appClient.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name`
    );
    console.log(
      `\nTables in ${dbName}:`,
      tables.rows.map((r: { table_name: string }) => r.table_name).join(", ")
    );
  } finally {
    await appClient.end();
  }

  console.log("\n✓ Setup complete.");
}

run().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
