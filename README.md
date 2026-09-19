
# OmniTrace — Cross-Channel Journey Stitching Platform

> **PS-4: Cross-Channel Journey Stitching**
> A unified identity-resolution and event-stitching platform that stitches customer interactions across app, web, call-center, and in-person channels into a single, analyst-ready journey timeline.

---

## Problem Statement

Customer interactions today are scattered across multiple channels — mobile apps, websites, call centers, and physical branches/stores. Because these channels operate in silos, organizations lose visibility into the *complete* customer journey and cannot pinpoint:

* Where customers **drop off**
* Where **escalations** occur
* Which issues remain **unresolved**
* Which experiences correlate with **churn**
* Where customers **repeatedly contact support**

**UnifyX** solves this by resolving customer identities across channels and stitching their raw event streams into one coherent, chronological journey — surfaced through an analyst-facing visualization interface.

---

##  Key Features

| Feature                                           | Description                                                                                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Identity Resolution Engine**            | Probabilistic + deterministic matching to merge identifiers (device ID, email, phone, loyalty ID, cookie ID, CRM ID) into a single unified `customer_id` |
| **Event Stitching Pipeline**              | Ingests, normalizes, and time-orders events from disparate channel schemas into one unified event format                                                   |

| **Unified Customer Timeline**             | Chronological, cross-channel view of every touchpoint for a given customer                                                                                 |

| **Drop-off & Escalation Detection**       | Automatically flags funnel exits, ticket escalations, and support loops                                                                                    |

| **Repeat-Contact & Churn Pattern Mining** | ML-driven detection of behaviors correlated with churn and repeated support contact                                                                        |

| **Analyst Visualization Dashboard**       | Interactive journey maps, funnels, and heatmaps for non-technical stakeholders                                                                             |

| **Low-Latency Ingestion**                 | Streaming pipeline built for near-real-time event stitching                                                                                                |


---

##  System Architecture

```
                        ┌─────────────────────────────────────────┐
                        │              CHANNEL SOURCES              │
                        │  Mobile App │ Website │ Call Center │ POS │
                        └───────────────────┬─────────────────────┘
                                            │  raw events
                                            ▼
                        ┌─────────────────────────────────────────┐
                        │        INGESTION LAYER (Kafka / API)     │
                        │   Schema validation • Event buffering    │
                        └───────────────────┬─────────────────────┘
                                            ▼
                        ┌─────────────────────────────────────────┐
                        │     IDENTITY RESOLUTION SERVICE          │
                        │  Deterministic matching (email/phone)    │
                        │  Probabilistic matching (device/behavior)│
                        │  Identity Graph (nodes = IDs, edges =    │
                        │  match confidence)                       │
                        └───────────────────┬─────────────────────┘
                                            ▼
                        ┌─────────────────────────────────────────┐
                        │     EVENT NORMALIZATION & STITCHING      │
                        │  Common event schema • Timeline builder  │
                        └───────────────────┬─────────────────────┘
                                            ▼
                        ┌─────────────────────────────────────────┐
                        │         UNIFIED CUSTOMER TIMELINE        │
                        │       (PostgreSQL / MongoDB store)       │
                        └───────────────────┬─────────────────────┘
                                            ▼
                ┌───────────────────────────┴───────────────────────────┐
                ▼                                                       ▼
┌─────────────────────────────┐                         ┌─────────────────────────────┐
│  ANALYTICS ENGINE            │                         │  VISUALIZATION DASHBOARD     │
│  Drop-off detection          │                         │  Journey maps (D3/Recharts) │
│  Escalation detection        │                         │  Funnels & heatmaps          │
│  Churn correlation (ML)      │                         │  Analyst search & filters    │
│  Repeat-contact clustering   │                         │  Alerts & annotations        │
└─────────────────────────────┘                         └─────────────────────────────┘
```

---

##  Identity Resolution Approach

1. **Deterministic Matching** — exact matches on strong identifiers: verified email, phone number, loyalty/account ID, CRM customer ID.
2. **Probabilistic Matching** — fuzzy/weighted matching on weaker signals: device fingerprint, IP + user-agent, name + address similarity, session/cookie continuity, behavioral time-proximity.
3. **Identity Graph** — each raw identifier is a node; matches (deterministic or probabilistic above a confidence threshold) form edges. Connected components are collapsed into a single  **unified customer ID** .
4. **Confidence Scoring** — every merge carries a confidence score, enabling analysts to audit and override incorrect stitches.
5. **Incremental Resolution** — new events re-evaluate the graph incrementally rather than recomputing from scratch, keeping latency low.

---

##  Tech Stack

| Layer                               | Technology                                              |
| ----------------------------------- | ------------------------------------------------------- |
| Frontend                            | React / Next.js, Recharts, D3.js                        |
| Backend / API                       | Node.js (Express) or Python (FastAPI)                   |
| Event Streaming                     | Apache Kafka                                            |
| Identity Resolution & Analytics     | Python, Scikit-learn, Pandas, NetworkX (identity graph) |
| Database (unified timeline)         | PostgreSQL                                              |
| Database (raw/flexible event store) | MongoDB                                                 |
| Cache / Session store               | Redis (optional)                                        |
| Containerization                    | Docker, Docker Compose                                  |

> ⚠️ Adjust this table to match what you actually implement — this reflects the suggested stack from the problem statement.

---

## 📂 Project Structure

```
unifyx/
├── frontend/                 # React/Next.js analyst dashboard
│   ├── components/
│   │   ├── JourneyTimeline/
│   │   ├── FunnelView/
│   │   └── ChurnHeatmap/
│   └── pages/
├── backend/
│   ├── ingestion-service/    # Kafka producers/consumers, schema validation
│   ├── identity-resolution/  # Matching engine + identity graph
│   ├── stitching-service/    # Event normalization + timeline builder
│   ├── analytics-service/    # Drop-off, escalation, churn models
│   └── api-gateway/          # REST/GraphQL API for the frontend
├── data/
│   ├── sample-events/        # Sample app/web/call-center/POS event data
│   └── schemas/              # Unified event schema definitions
├── ml/
│   └── churn-model/          # Churn correlation & repeat-contact clustering
├── infra/
│   └── docker-compose.yml
└── README.md
```

---

##  Getting Started

### Prerequisites

* Node.js ≥ 18
* Python ≥ 3.10


### Installation

```bash
# Clone the repo
git clone https://github.com/<your-username>/unifyx.git
cd unifyx



# Backend setup
cd backend/api-gateway
npm install
npm run dev

# Identity resolution & analytics services
cd ../identity-resolution
pip install -r requirements.txt
python app.py

# Frontend setup
cd ../../frontend
npm install
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

---

## Sample Use Case Walkthrough

1. A customer browses products on the **website** (event: `page_view`, `add_to_cart`).
2. Abandons the cart and later calls the **call center** (event: `call_initiated`, `issue_reported`).
3. The call escalates to a supervisor (event: `escalation`).
4. The same customer opens the **mobile app** two days later using the same logged-in account (event: `app_login`, `order_placed`).
5. **UnifyX** resolves all four touchpoints to one `customer_id`, stitches them into a single timeline, flags the escalation, and surfaces this journey in the drop-off/escalation dashboard — revealing a pattern of  *cart abandonment → support escalation → recovery* .

---

##  Roadmap / Future Enhancements

* [ ] Real-time streaming dashboard updates via WebSockets
* [ ] Graph-based visualization of the identity resolution graph itself
* [ ] Configurable alerting (Slack/email) on churn-risk journeys
* [ ] Support for additional channels (chatbots, social media, email campaigns)
* [ ] Explainable AI layer for churn predictions

---

## 👥 Team

| Name                | Role     |
| ------------------- | -------- |
| Hitansh | DB+API |
| Hanuj | Stitching service |
| Neel | "In progress" |
| Tirth | "In progress" |

---

##  License

This project was built as part of a hackathon submission. License TBD.
