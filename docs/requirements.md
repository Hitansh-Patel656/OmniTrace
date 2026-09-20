# Requirements — OmniTrace

## Problem Statement (PS-4: Cross-Channel Journey Stitching)

Customer interactions are distributed across multiple channels — mobile apps, websites,
call centers, and physical locations. When these interactions remain siloed,
organizations struggle to understand the complete customer journey and identify
exactly where customers experience problems.

## Goal

Build a cross-channel identity-resolution and event-stitching platform that creates
a unified customer journey by combining interactions from different channels.

The platform must allow organizations to understand:

* Where customers **drop off**
* Where **escalations** occur
* Which issues remain **unresolved**
* Which experiences correlate with **churn**
* Where customers **repeatedly contact support**

## Deliverables

| # | Deliverable                                                  | Status       | Notes |
| - | ------------------------------------------------------------ | ------------ | ----- |
| 1 | Identity-resolution algorithm design                         | ✅ Completed | 3-pass hybrid (deterministic + device/cookie + IP proximity). Thresholds documented in ADR-002. |
| 2 | Link customer interactions across multiple channels          | ✅ Completed | Automatic for customers with a shared identifier. Cross-channel gap without a bridge event requires analyst merge (ADR-008). |
| 3 | Data pipeline for event ingestion                            | ✅ Completed | REST endpoint per channel, Zod validation, MongoDB raw store, 202 response. |
| 4 | Normalize and stitch events into a unified customer timeline | ✅ Completed | CANONICAL_TYPE_MAP (14 types), is_escalation/is_dropoff flags, raw_event_ref, ORDER BY event_time. |
| 5 | Analyst-facing journey visualization interface               | ✅ Completed | 7-page Next.js 16 dashboard: overview, explorer, timeline, dropoffs, escalations, churn, repeat-contacts. |
| 6 | Highlight drop-off points and escalations                    | ✅ Completed | Drop-off funnel (/analytics/dropoffs) and escalation trends (/analytics/escalations) both live. |
| 7 | Identify patterns associated with churn and repeat contacts  | ✅ Completed | Rule-based per ADR-005 (churn) and contact-initiation counting (repeat). ML scoring is a future enhancement. |
| 8 | Optimize identity-resolution accuracy and data latency       | ✅ Completed | Incremental resolution, confidence scoring per link, benchmark harness measures accuracy (run-engine.ts). |


Update the Status column as you progress — this doubles as a hackathon checklist.

## Suggested Tech Stack

| Layer           | Technology                                  |
| --------------- | ------------------------------------------- |
| Frontend        | React / Next.js                             |
| Backend         | Node.js / Python / Java                     |
| Data Processing | Python / Kafka / event-processing pipelines |
| Database        | PostgreSQL / MongoDB                        |
| Analytics       | Python / Scikit-learn                       |
| Visualization   | Recharts / D3.js                            |

> Note: the problem statement allows any feasible stack. Our actual chosen stack
> is recorded in `decisions.md`, not here — this table is the *suggested* baseline
> from the problem statement only.

## Expected Outcome

A unified customer journey platform that provides actionable visibility into
customer interactions across app, web, call-center, and in-person channels.

## Channels In Scope

* Mobile app
* Website
* Call center
* In-person / physical location (POS or branch visits)

## Out of Scope (for hackathon timeframe)

* Real-time production-grade Kafka cluster (a simplified/simulated event stream is acceptable)
* Full GDPR/PII compliance tooling (note it as a future consideration in `decisions.md` if relevant)
* Multi-tenant support (single organization/dataset for the demo)
