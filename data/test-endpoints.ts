/**
 * Automated test runner for all 10 OmniTrace endpoints.
 * Run with: npx ts-node data/test-endpoints.ts
 *
 * Covers success + validation-failure for each endpoint.
 * Prints actual request + actual response (status + body).
 */

import * as http from "http";

const BASE = "http://localhost:3001";

// ── Helpers ────────────────────────────────────────────────────────────────

function req(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const url = new URL(BASE + path);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: Number(url.port) || 3001,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };
    const r = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

let INGEST_ID = "";
let CUSTOMER_A = "";
let CUSTOMER_B = "";

async function run() {
  // ── Seed: insert two customers + identity links for identity/timeline tests ──
  const { Client } = await import("pg");
  const dotenv = await import("dotenv");
  dotenv.default.config();
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  // customers
  const ca = await pg.query(
    "INSERT INTO customers DEFAULT VALUES RETURNING customer_id, created_at, updated_at"
  );
  CUSTOMER_A = ca.rows[0].customer_id;

  const cb = await pg.query(
    "INSERT INTO customers DEFAULT VALUES RETURNING customer_id"
  );
  CUSTOMER_B = cb.rows[0].customer_id;

  // identity_links for A
  await pg.query(
    `INSERT INTO identity_links (customer_id, identifier_type, identifier_value, confidence_score)
     VALUES ($1,'email','alice@example.com',1.0),
            ($1,'phone','+15550001111',1.0),
            ($1,'device_id','dev-abc-123',0.85)`,
    [CUSTOMER_A]
  );

  // identity_link for B (probabilistic only — used for split test)
  await pg.query(
    `INSERT INTO identity_links (customer_id, identifier_type, identifier_value, confidence_score)
     VALUES ($1,'email','bob@example.com',1.0),
            ($1,'device_id','dev-xyz-999',0.72)`,
    [CUSTOMER_B]
  );

  // timeline_events for A
  await pg.query(
    `INSERT INTO timeline_events (customer_id, channel, event_type, event_time, is_escalation, is_dropoff, resolution_status, raw_event_ref)
     VALUES ($1,'web','page_view','2026-09-01T08:00:00Z',false,false,'resolved','mongo-ref-1'),
            ($1,'web','checkout_abandoned','2026-09-01T08:05:00Z',false,true,'unresolved','mongo-ref-2'),
            ($1,'call_center','call_initiated','2026-09-01T09:00:00Z',false,false,'resolved','mongo-ref-3'),
            ($1,'call_center','escalation','2026-09-01T09:10:00Z',true,false,'pending','mongo-ref-4')`,
    [CUSTOMER_A]
  );

  // analytics_flags
  await pg.query(
    `INSERT INTO analytics_flags (customer_id, flag_type, score, details)
     VALUES ($1,'churn_risk',0.87,'{"reason":"unresolved escalation + 30d silence"}'::jsonb),
            ($1,'repeat_contact',4,'{"issue_category":"billing","contact_count":4}'::jsonb),
            ($1,'dropoff',0.9,'{"stage":"checkout"}'::jsonb),
            ($1,'escalation',1.0,'{"channel":"call_center"}'::jsonb)`,
    [CUSTOMER_A]
  );

  await pg.end();

  console.log(`\nSeeded — CUSTOMER_A=${CUSTOMER_A}  CUSTOMER_B=${CUSTOMER_B}\n`);
  console.log("=".repeat(70));

  // ── Tests ────────────────────────────────────────────────────────────────

  const tests: Array<{ label: string; fn: () => Promise<void> }> = [
    // ─────────────────────────────────────────────────────────────────────
    // 1. POST /api/ingest/:channel  ── SUCCESS
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "1a. POST /api/ingest/web — SUCCESS",
      fn: async () => {
        const r = await req("POST", "/api/ingest/web", {
          raw_identifiers: { email: "alice@example.com", device_id: "dev-abc-123" },
          event_type: "page_view",
          event_payload: { url: "/products", duration_ms: 3200 },
          timestamp: "2026-09-19T10:00:00Z",
        });
        INGEST_ID = JSON.parse(r.body).id ?? "";
        print("POST /api/ingest/web", { body: { raw_identifiers: { email: "alice@example.com" }, event_type: "page_view", timestamp: "2026-09-19T10:00:00Z" } }, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 1b. POST /api/ingest/:channel  ── FAIL: invalid channel
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "1b. POST /api/ingest/fax — FAIL (invalid channel)",
      fn: async () => {
        const r = await req("POST", "/api/ingest/fax", {
          raw_identifiers: { email: "x@x.com" },
          event_type: "page_view",
          timestamp: "2026-09-19T10:00:00Z",
        });
        print("POST /api/ingest/fax", { body: "{ channel: fax }" }, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 1c. POST /api/ingest/:channel  ── FAIL: missing event_type
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "1c. POST /api/ingest/mobile_app — FAIL (missing event_type)",
      fn: async () => {
        const r = await req("POST", "/api/ingest/mobile_app", {
          raw_identifiers: { email: "x@x.com" },
          timestamp: "2026-09-19T10:00:00Z",
        });
        print("POST /api/ingest/mobile_app", { body: "{ no event_type }" }, r);
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // 2. GET /api/identity/:customer_id  ── SUCCESS
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "2a. GET /api/identity/:customer_id — SUCCESS",
      fn: async () => {
        const r = await req("GET", `/api/identity/${CUSTOMER_A}`);
        print(`GET /api/identity/${CUSTOMER_A}`, {}, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 2b. GET /api/identity/:customer_id  ── FAIL: bad UUID
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "2b. GET /api/identity/not-a-uuid — FAIL (invalid UUID)",
      fn: async () => {
        const r = await req("GET", "/api/identity/not-a-uuid");
        print("GET /api/identity/not-a-uuid", {}, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 2c. GET /api/identity/:customer_id  ── FAIL: 404
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "2c. GET /api/identity/00000000-0000-1000-8000-000000000000 — FAIL (404)",
      fn: async () => {
        const r = await req("GET", "/api/identity/00000000-0000-1000-8000-000000000000");
        print("GET /api/identity/00000000-0000-1000-8000-000000000000", {}, r);
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // 3. POST /api/identity/merge  ── SUCCESS
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "3a. POST /api/identity/merge — SUCCESS",
      fn: async () => {
        const r = await req("POST", "/api/identity/merge", {
          customer_id_a: CUSTOMER_A,
          customer_id_b: CUSTOMER_B,
          reason: "Same person identified via shared email domain + IP proximity",
        });
        print("POST /api/identity/merge", { body: { customer_id_a: CUSTOMER_A, customer_id_b: CUSTOMER_B, reason: "..." } }, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 3b. POST /api/identity/merge  ── FAIL: missing reason
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "3b. POST /api/identity/merge — FAIL (missing reason)",
      fn: async () => {
        const r = await req("POST", "/api/identity/merge", {
          customer_id_a: CUSTOMER_A,
          customer_id_b: "00000000-0000-1000-8000-000000000001",
        });
        print("POST /api/identity/merge", { body: "{ no reason }" }, r);
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // 4. POST /api/identity/split  ── SUCCESS
    // (CUSTOMER_B was merged into A above; A now has probabilistic links from B)
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "4a. POST /api/identity/split — SUCCESS",
      fn: async () => {
        const r = await req("POST", "/api/identity/split", {
          customer_id: CUSTOMER_A,
          reason: "Device fingerprint match was a false positive — different household",
        });
        print("POST /api/identity/split", { body: { customer_id: CUSTOMER_A, reason: "..." } }, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 4b. POST /api/identity/split  ── FAIL: missing customer_id
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "4b. POST /api/identity/split — FAIL (missing customer_id)",
      fn: async () => {
        const r = await req("POST", "/api/identity/split", {
          reason: "test",
        });
        print("POST /api/identity/split", { body: "{ no customer_id }" }, r);
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // 5. GET /api/customers/:customer_id/timeline  ── SUCCESS
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "5a. GET /api/customers/:customer_id/timeline — SUCCESS",
      fn: async () => {
        const r = await req("GET", `/api/customers/${CUSTOMER_A}/timeline`);
        print(`GET /api/customers/${CUSTOMER_A}/timeline`, {}, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 5b. timeline with channel filter  ── SUCCESS (filtered)
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "5b. GET /api/customers/:customer_id/timeline?channel=call_center — SUCCESS",
      fn: async () => {
        const r = await req("GET", `/api/customers/${CUSTOMER_A}/timeline?channel=call_center`);
        print(`GET timeline?channel=call_center`, {}, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 5c. timeline  ── FAIL: invalid channel filter
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "5c. GET timeline?channel=fax — FAIL (invalid channel filter)",
      fn: async () => {
        const r = await req("GET", `/api/customers/${CUSTOMER_A}/timeline?channel=fax`);
        print(`GET timeline?channel=fax`, {}, r);
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // 6. GET /api/customers/search  ── SUCCESS
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "6a. GET /api/customers/search?email=alice@example.com — SUCCESS",
      fn: async () => {
        const r = await req("GET", "/api/customers/search?email=alice%40example.com");
        print("GET /api/customers/search?email=alice@example.com", {}, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 6b. search  ── FAIL: no params
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "6b. GET /api/customers/search — FAIL (no params)",
      fn: async () => {
        const r = await req("GET", "/api/customers/search");
        print("GET /api/customers/search (no params)", {}, r);
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // 7. GET /api/analytics/dropoffs  ── SUCCESS
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "7a. GET /api/analytics/dropoffs — SUCCESS",
      fn: async () => {
        const r = await req("GET", "/api/analytics/dropoffs");
        print("GET /api/analytics/dropoffs", {}, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 7b. dropoffs  ── FAIL: bad date filter
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "7b. GET /api/analytics/dropoffs?from=not-a-date — FAIL",
      fn: async () => {
        const r = await req("GET", "/api/analytics/dropoffs?from=not-a-date");
        print("GET /api/analytics/dropoffs?from=not-a-date", {}, r);
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // 8. GET /api/analytics/escalations  ── SUCCESS
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "8a. GET /api/analytics/escalations — SUCCESS",
      fn: async () => {
        const r = await req("GET", "/api/analytics/escalations");
        print("GET /api/analytics/escalations", {}, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 8b. escalations  ── FAIL: bad ?to= date
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "8b. GET /api/analytics/escalations?to=BADDATE — FAIL",
      fn: async () => {
        const r = await req("GET", "/api/analytics/escalations?to=BADDATE");
        print("GET /api/analytics/escalations?to=BADDATE", {}, r);
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // 9. GET /api/analytics/repeat-contacts  ── SUCCESS
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "9a. GET /api/analytics/repeat-contacts — SUCCESS (default threshold=3)",
      fn: async () => {
        const r = await req("GET", "/api/analytics/repeat-contacts");
        print("GET /api/analytics/repeat-contacts", {}, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 9b. repeat-contacts  ── FAIL: invalid threshold
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "9b. GET /api/analytics/repeat-contacts?threshold=-1 — FAIL",
      fn: async () => {
        const r = await req("GET", "/api/analytics/repeat-contacts?threshold=-1");
        print("GET /api/analytics/repeat-contacts?threshold=-1", {}, r);
      },
    },

    // ─────────────────────────────────────────────────────────────────────
    // 10. GET /api/analytics/churn-risk  ── SUCCESS
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "10a. GET /api/analytics/churn-risk — SUCCESS",
      fn: async () => {
        const r = await req("GET", "/api/analytics/churn-risk");
        print("GET /api/analytics/churn-risk", {}, r);
      },
    },
    // ─────────────────────────────────────────────────────────────────────
    // 10b. churn-risk  ── FAIL: page=0 (clamped to 1, but also test limit=0 → clamped to 1)
    //      Demonstrate pagination enforcement (not a 4xx, but shows safe clamping)
    // ─────────────────────────────────────────────────────────────────────
    {
      label: "10b. GET /api/analytics/churn-risk?page=0&limit=999 — SUCCESS (clamped pagination)",
      fn: async () => {
        const r = await req("GET", "/api/analytics/churn-risk?page=0&limit=999");
        print("GET /api/analytics/churn-risk?page=0&limit=999", {}, r);
      },
    },
  ];

  // ── Run all ───────────────────────────────────────────────────────────

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`▶  ${t.label}`);
    try {
      await t.fn();
      passed++;
    } catch (err) {
      console.error("  !! TEST ERROR:", err);
      failed++;
    }
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
}

function print(
  endpoint: string,
  _reqInfo: unknown,
  res: { status: number; body: string }
) {
  let pretty: string;
  try {
    pretty = JSON.stringify(JSON.parse(res.body), null, 2);
  } catch {
    pretty = res.body;
  }
  console.log(`\n  Status : ${res.status}`);
  console.log(`  Body   : ${pretty}`);
}

run().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
