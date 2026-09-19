import { ObjectId } from "mongodb";

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

export const CHANNELS = ["web", "mobile_app", "call_center", "in_person"] as const;
export type Channel = (typeof CHANNELS)[number];

// ---------------------------------------------------------------------------
// MongoDB — raw_events collection
// ---------------------------------------------------------------------------

export interface RawIdentifiers {
  email?: string | null;
  phone?: string | null;
  device_id?: string | null;
  cookie_id?: string | null;
  loyalty_id?: string | null;
  ip_address?: string | null;
  [key: string]: string | null | undefined;
}

export interface IngestRequest {
  raw_identifiers: RawIdentifiers;
  event_type: string;
  event_payload: Record<string, unknown>;
  timestamp: string;
}

export interface RawEventDoc {
  _id: ObjectId;
  channel: Channel;
  raw_identifiers: RawIdentifiers;
  event_type: string;
  event_payload: Record<string, unknown>;
  timestamp: string;
  ingested_at: Date;
}

// ---------------------------------------------------------------------------
// PostgreSQL — customers table
// ---------------------------------------------------------------------------

export interface Customer {
  customer_id: string; // UUID
  created_at: string;  // ISO 8601
  updated_at: string;  // ISO 8601
}

// ---------------------------------------------------------------------------
// PostgreSQL — identity_links table
// ---------------------------------------------------------------------------

export interface IdentityLink {
  id: string;               // UUID
  customer_id: string;      // UUID FK → customers
  identifier_type: string;  // email | phone | device_id | cookie_id | loyalty_id
  identifier_value: string;
  confidence_score: number; // 1.0 = deterministic, <1.0 = probabilistic
  linked_at: string;        // ISO 8601
}

// ---------------------------------------------------------------------------
// PostgreSQL — timeline_events table
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  id: string;                // UUID
  customer_id: string;       // UUID FK → customers
  channel: Channel;
  event_type: string;        // normalised vocabulary (see database.md)
  event_time: string;        // ISO 8601
  is_escalation: boolean;
  is_dropoff: boolean;
  resolution_status: "resolved" | "unresolved" | "pending";
  raw_event_ref: string;     // reference to MongoDB _id
}

// ---------------------------------------------------------------------------
// PostgreSQL — analytics_flags table
// ---------------------------------------------------------------------------

export interface AnalyticsFlag {
  id: string;          // UUID
  customer_id: string; // UUID FK → customers
  flag_type: "dropoff" | "escalation" | "repeat_contact" | "churn_risk";
  score: number;
  computed_at: string; // ISO 8601
  details: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Request body shapes
// ---------------------------------------------------------------------------

export interface MergeRequest {
  customer_id_a: string;
  customer_id_b: string;
  reason: string;
}

export interface SplitRequest {
  customer_id: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Shared response shapes
// ---------------------------------------------------------------------------

export interface ErrorResponse {
  error: string;
  details: string;
}

export interface IngestSuccess {
  id: string;
}
