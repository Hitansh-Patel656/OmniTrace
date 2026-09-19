# Local Development Setup — OmniTrace

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 18 | `node --version` to check — [nodejs.org](https://nodejs.org) |
| npm | ≥ 9 | bundled with Node.js |
| MongoDB | ≥ 7 | [mongodb.com/try/download/community](https://www.mongodb.com/try/download/community) |
| PostgreSQL | ≥ 15 | [postgresql.org/download](https://www.postgresql.org/download/) |

---

## Dependencies (Node.js equivalent of requirements.txt)

Node.js uses [`package.json`](package.json) instead of a `requirements.txt`. It lists every dependency with its pinned version — `npm install` reads it automatically.

### Runtime dependencies

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.19.2 | HTTP server and routing |
| `mongodb` | ^6.8.0 | MongoDB driver — stores raw channel events |
| `pg` | ^8.23.0 | PostgreSQL driver — identity graph, timeline, analytics |
| `uuid` | ^14.0.2 | Generate UUIDs for merge/split operations |
| `dotenv` | ^16.4.5 | Load `.env` into `process.env` |
| `zod` | ^3.23.8 | Schema validation (available for future use) |

### Dev-only dependencies (not needed in production)

| Package | Version | Purpose |
|---|---|---|
| `typescript` | ^5.4.5 | TypeScript compiler |
| `ts-node` | ^10.9.2 | Run `.ts` files directly (used by `npm run dev`) |
| `@types/express` | ^4.17.21 | TypeScript types for Express |
| `@types/node` | ^20.14.2 | TypeScript types for Node.js built-ins |
| `@types/pg` | ^8.23.1 | TypeScript types for pg |
| `@types/uuid` | ^10.0.0 | TypeScript types for uuid |
| `eslint` | ^8.57.0 | Linter |

> All of the above are installed with a single `npm install` command.
> The exact versions used (including all transitive/indirect packages) are locked in
> [`package-lock.json`](package-lock.json) — this guarantees every teammate gets the
> identical dependency tree regardless of when they install.

---

## 1. Clone and install all dependencies

```bash
git clone <repo-url>
cd OmniTrace

# This reads package.json and installs everything in the table above
npm install
```

---

## 2. Configure environment

```bash
# Copy the example env file
cp .env.example .env    # Windows: copy .env.example .env
```

Open `.env` and fill in your values:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017
DB_NAME=omnidb
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/omnidb
```

> **Never commit `.env`** — it contains your credentials and is listed in `.gitignore`.

---

## 3. Create the databases and apply the schema

Make sure MongoDB and PostgreSQL are both running, then:

```bash
npx ts-node data/setup-db.ts
```

Expected output:
```
✓ Connected to postgres admin DB
✓ Created database: omnidb
✓ Connected to omnidb
✓ Schema applied successfully

Tables in omnidb: analytics_flags, customers, identity_links, timeline_events

✓ Setup complete.
```

This script:
- Creates the `omnidb` PostgreSQL database if it doesn't exist
- Creates all 4 tables: `customers`, `identity_links`, `timeline_events`, `analytics_flags`
- Is **idempotent** — safe to re-run (`CREATE TABLE IF NOT EXISTS`)
- MongoDB needs no schema — the `raw_events` collection is created on first ingest

The full SQL is in [`data/schema.sql`](data/schema.sql) if you want to review or run it manually in pgAdmin.

---

## 4. Start the development server

```bash
npm run dev
```

Expected output:
```
✓ MongoDB connected
✓ PostgreSQL connected

OmniTrace API listening on http://localhost:3001

Endpoints:
  POST   /api/ingest/:channel
  GET    /api/identity/:customer_id
  POST   /api/identity/merge
  POST   /api/identity/split
  GET    /api/customers/:customer_id/timeline
  GET    /api/customers/search
  GET    /api/analytics/dropoffs
  GET    /api/analytics/escalations
  GET    /api/analytics/repeat-contacts
  GET    /api/analytics/churn-risk
```

---

## 5. Verify everything works

```bash
# Health check
curl http://localhost:3001/health

# Test ingestion — should return 202 + a MongoDB _id
curl -X POST http://localhost:3001/api/ingest/web \
  -H "Content-Type: application/json" \
  -d '{"raw_identifiers":{"email":"test@example.com"},"event_type":"page_view","event_payload":{},"timestamp":"2026-09-19T10:00:00Z"}'

# Run the full endpoint test suite (seeds data + tests all 10 endpoints)
npx ts-node data/test-endpoints.ts
```

---

## npm scripts reference

| Command | What it does |
|---|---|
| `npm run dev` | Start server with ts-node (hot-reloads on file save if using nodemon) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled `dist/index.js` (production) |
| `npm run lint` | Run ESLint on all `src/**/*.ts` files |

---

## Troubleshooting

| Error | Fix |
|---|---|
| `password authentication failed` | Check `DATABASE_URL` password in `.env` |
| `ECONNREFUSED` on port 27017 | MongoDB isn't running — start it with `mongod` or start the service |
| `ECONNREFUSED` on port 5432 | PostgreSQL isn't running — start the service |
| `EADDRINUSE: port 3001` | Something else owns port 3001 — kill it or change `PORT` in `.env` |
| `Cannot find module` errors | Run `npm install` — node_modules may be missing |
| Tables missing | Re-run `npx ts-node data/setup-db.ts` |

---

## Database overview

| Database | Engine | Purpose | How to browse |
|---|---|---|---|
| `omnidb` → `raw_events` | MongoDB | Raw channel events as ingested (no transformation) | MongoDB Compass |
| `omnidb` → `customers` | PostgreSQL | Unified customer identities | pgAdmin |
| `omnidb` → `identity_links` | PostgreSQL | Email/phone/device links with confidence scores | pgAdmin |
| `omnidb` → `timeline_events` | PostgreSQL | Normalised, stitched chronological event timeline | pgAdmin |
| `omnidb` → `analytics_flags` | PostgreSQL | Pre-computed churn risk, escalation, repeat-contact flags | pgAdmin |
