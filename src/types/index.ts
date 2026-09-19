import { ObjectId } from "mongodb";

export const CHANNELS = ["web", "mobile_app", "call_center", "in_person"] as const;

export type Channel = (typeof CHANNELS)[number];

export interface IngestRequest {
  raw_identifiers: Record<string, string | null>;
  event_type: string;
  event_payload: Record<string, unknown>;
  timestamp: string;
}

export interface RawEventDoc {
  _id: ObjectId;
  channel: Channel;
  raw_identifiers: Record<string, string | null>;
  event_type: string;
  event_payload: Record<string, unknown>;
  timestamp: string;
  ingested_at: Date;
}

export interface ErrorResponse {
  error: string;
  details: string;
}

export interface IngestSuccess {
  id: string;
}
