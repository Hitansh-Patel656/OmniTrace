export type Channel = "web" | "mobile_app" | "call_center" | "in_person";

export const CHANNELS: Channel[] = ["web", "mobile_app", "call_center", "in_person"];

export interface Customer {
  customer_id: string;
  created_at: string;
  updated_at: string;
}

export interface IdentityLink {
  id: string;
  customer_id: string;
  identifier_type: "email" | "phone" | "device_id" | "cookie_id" | "loyalty_id" | "ip_address" | string;
  identifier_value: string;
  confidence_score: number;
  linked_at: string;
}

export interface CustomerIdentityResponse {
  customer: Customer;
  data: IdentityLink[];
  pagination: Pagination;
}

export interface TimelineEvent {
  id: string;
  customer_id: string;
  channel: Channel;
  event_type: string;
  event_time: string;
  is_escalation: boolean;
  is_dropoff: boolean;
  resolution_status: "resolved" | "unresolved" | "pending";
  raw_event_ref: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface CustomerSearchResult {
  customer_id: string;
  created_at: string;
  updated_at: string;
  identifier_type: string;
  identifier_value: string;
  confidence_score: number;
}

export interface DropoffItem {
  channel: Channel;
  event_type: string;
  dropoff_count: number;
}

export interface EscalationItem {
  channel: Channel;
  day: string;
  escalation_count: number;
}

export interface RepeatContactItem {
  customer_id: string;
  score: number;
  computed_at: string;
  details: {
    issue_category?: string;
    contact_count?: number;
    channels?: Channel[];
    recent_events?: Array<{ channel: Channel; event_type: string; timestamp: string }>;
    [key: string]: unknown;
  } | null;
}

export interface ChurnRiskItem {
  customer_id: string;
  score: number;
  computed_at: string;
  details: {
    risk_level?: "high" | "medium" | "low";
    rule?: string;
    days_inactive?: number;
    unresolved_escalations?: number;
    primary_channel?: Channel;
    last_event_time?: string;
    [key: string]: unknown;
  } | null;
}

export interface EngineStatus {
  pending: number;
  processed: number;
  total: number;
  totalCustomers?: number;
  totalTimelineEvents?: number;
  totalDropoffs?: number;
  totalEscalations?: number;
  churnRiskCount?: number;
  repeatContactCount?: number;
}

export interface FunnelStage {
  step: number;
  name: string;
  events: string;
  volume: number;
  pctOfTotal: number;
  retention: string;
  dropPct: string;
  status: string;
  color: string;
}

export interface ChannelFrictionItem {
  channel: Channel;
  totalEvents: number;
  dropoffs: number;
  escalations: number;
  share: number;
  status: string;
}

export interface AbandonmentItem {
  channel: Channel;
  event_type: string;
  dropoff_count: number;
  example_customer_id: string | null;
  share: number;
}

export interface FunnelAnalyticsResponse {
  overallConversionRate: number;
  totalEvents: number;
  totalConvertedOrders: number;
  totalDropoffs: number;
  stages: FunnelStage[];
  channels: ChannelFrictionItem[];
  abandonments: AbandonmentItem[];
}

export interface CustomerDirectoryItem {
  customer_id: string;
  created_at: string;
  total_events: number;
  channels: Channel[];
  primary_identifier: string | null;
  has_escalation: boolean;
  has_dropoff: boolean;
  is_churn_risk: boolean;
}

export interface EngineRunResponse {
  message: string;
  totalProcessed: number;
  results?: unknown[];
}

export interface IngestRequestPayload {
  raw_identifiers: Record<string, string | null>;
  event_type: string;
  event_payload: Record<string, unknown>;
  timestamp: string;
}

export interface IngestResponse {
  id: string;
}

export interface MergeResponse {
  message: string;
  surviving_customer_id: string;
  merged_customer_id: string;
  reason: string;
}

export interface SplitResponse {
  message: string;
  original_customer_id: string;
  new_customer_id: string;
  reason: string;
}

export interface DemoScenario {
  id: string;
  name: string;
  /** Populated at runtime by searching the API — NOT hardcoded. */
  resolvedCustomerId?: string;
  /** Identifier type to search with. Undefined for fully anonymous sessions (e.g. Grace). */
  lookupKey?: "email" | "phone" | "loyalty_id";
  /** Identifier value for the search. Undefined when lookupKey is undefined. */
  lookupVal?: string;
  tagline: string;
  description: string;
  channels: Channel[];
  isChurn?: boolean;
  isDropoff?: boolean;
  isEscalation?: boolean;
  isRepeat?: boolean;
}
