import "dotenv/config";
import express from "express";
import router from "./routes/ingest";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// API routes
app.use("/api", router);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "omni-trace-ingestion" });
});

// Root status
app.get("/", (req, res) => {
  res.json({ message: "OmniTrace Ingestion Service is running" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found", details: `Route ${req.method} ${req.path} not found` });
});

/**
 * Start server and ensure MongoDB connection is ready.
 */
async function startServer() {
  try {
    // Verify MongoDB connection on startup
    const collection = await import("./db/mongo").then((m) => m.getCollection("raw_events"));

    app.listen(PORT, () => {
      console.log(`OmniTrace Ingestion Service listening on http://localhost:${PORT}`);
      console.log(`POST /api/ingest/:channel — web | mobile_app | call_center | in_person`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();

export default app;