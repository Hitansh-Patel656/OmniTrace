import { Pool, QueryResultRow } from "pg";
import dotenv from "dotenv";

dotenv.config();

let pool: Pool | null = null;

/**
 * Returns (and lazily creates) the shared pg.Pool.
 * DATABASE_URL format: postgresql://user:pass@host:port/dbname
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL || "postgresql://localhost:5432/omnidb";

    const isRemote =
      connectionString.includes(".tech") ||
      connectionString.includes(".supabase.") ||
      connectionString.includes(".render.com") ||
      connectionString.includes("sslmode=require") ||
      (process.env.NODE_ENV === "production" &&
        !connectionString.includes("localhost") &&
        !connectionString.includes("postgres:5432"));

    pool = new Pool({
      connectionString,
      ssl: isRemote ? { rejectUnauthorized: false } : undefined,
    });

    pool.on("error", (err) => {
      console.error("PostgreSQL pool error:", err);
    });
  }
  return pool;
}

/**
 * Thin query wrapper so callers don't import pg directly.
 * Returns typed rows.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

/**
 * Run multiple statements in a single transaction.
 * Rolls back automatically on any thrown error.
 */
export async function withTransaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Verify the connection by running a trivial query.
 * Called once on server startup.
 */
export async function verifyPostgres(): Promise<void> {
  await query("SELECT 1");
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
