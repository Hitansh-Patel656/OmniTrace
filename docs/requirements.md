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

| # | Deliverable                                                  | Status         |
| - | ------------------------------------------------------------ | -------------- |
| 1 | Identity-resolution algorithm design                         | ⬜ Not started |
| 2 | Link customer interactions across multiple channels          | ⬜ Not started |
| 3 | Data pipeline for event ingestion                            | ⬜ Not started |
| 4 | Normalize and stitch events into a unified customer timeline | ⬜ Not started |
| 5 | Analyst-facing journey visualization interface               | ⬜ Not started |
| 6 | Highlight drop-off points and escalations                    | ⬜ Not started |
| 7 | Identify patterns associated with churn and repeat contacts  | ⬜ Not started |
| 8 | Optimize identity-resolution accuracy and data latency       | ⬜ Not started |

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
