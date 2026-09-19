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

// Parse connection string to get the base URL (pointing to 'postgres' DB for initial CREATE DATABASE)
function toAdminUrl(url: string): string {
  return url.replace(/\/[^/]+$/, "/postgres");
}

async function run() {
  const adminUrl = toAdminUrl(DATABASE_URL);
  const dbName = DATABASE_URL.split("/").pop()!;

  // Step 1: Connect to 'postgres' system DB and create target DB if missing
  const adminClient = new Client({ connectionString: adminUrl });
  try {
    await adminClient.connect();
    console.log("✓ Connected to postgres admin DB");

    const exists = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    if (exists.rowCount === 0) {
      // Can't use parameterised query for CREATE DATABASE
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✓ Created database: ${dbName}`);
    } else {
      console.log(`  Database '${dbName}' already exists — skipping create`);
    }
  } finally {
    await adminClient.end();
  }

  // Step 2: Connect to the target DB and apply schema
  const appClient = new Client({ connectionString: DATABASE_URL });
  try {
    await appClient.connect();
    console.log(`✓ Connected to ${dbName}`);

    const schemaPath = path.join(__dirname, "schema.sql");
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
      "\nTables in omnidb:",
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
