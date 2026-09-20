import "dotenv/config";
import express from "express";

import ingestRouter from "./routes/ingest";
import identityRouter from "./routes/identity";
import timelineRouter from "./routes/timeline";
import analyticsRouter from "./routes/analytics";
import engineRouter from "./routes/engine";

import { getCollection } from "./db/mongo";
import { verifyPostgres } from "./db/postgres";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

// Ingestion (MongoDB-backed)
app.use("/api", ingestRouter);

// Identity resolution (PostgreSQL-backed)
app.use("/api", identityRouter);

// Timeline / customer search (PostgreSQL-backed)
app.use("/api", timelineRouter);

// Analytics (PostgreSQL-backed)
app.use("/api", analyticsRouter);

// Engine admin — batch processing + status
app.use("/api", engineRouter);

// ---------------------------------------------------------------------------
// Utility routes
// ---------------------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "omni-trace-api" });
});

app.get("/", (_req, res) => {
  res.json({ message: "OmniTrace API is running" });
});

// 404 handler (must be last)
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    details: `Route ${req.method} ${req.path} not found`,
  });
});

// ---------------------------------------------------------------------------
// Startup — verify both DB connections before accepting traffic
// ---------------------------------------------------------------------------

async function startServer() {
  try {
    console.log("Connecting to MongoDB…");
    await getCollection("raw_events");
    console.log("✓ MongoDB connected");

    console.log("Connecting to PostgreSQL…");
    await verifyPostgres();
    console.log("✓ PostgreSQL connected");

    app.listen(PORT, () => {
      console.log(`\nOmniTrace API listening on http://localhost:${PORT}`);
      console.log(`\nEndpoints:`);
      console.log(`  POST   /api/ingest/:channel`);
      console.log(`  GET    /api/identity/:customer_id`);
      console.log(`  POST   /api/identity/merge`);
      console.log(`  POST   /api/identity/split`);
      console.log(`  GET    /api/customers/:customer_id/timeline`);
      console.log(`  GET    /api/customers/search`);
      console.log(`  GET    /api/analytics/dropoffs`);
      console.log(`  GET    /api/analytics/escalations`);
      console.log(`  GET    /api/analytics/repeat-contacts`);
      console.log(`  GET    /api/analytics/churn-risk`);
      console.log(`  POST   /api/engine/run`);
      console.log(`  GET    /api/engine/status`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();

export default app;