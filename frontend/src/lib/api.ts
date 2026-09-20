import {
  CustomerIdentityResponse,
  CustomerSearchResult,
  DropoffItem,
  EngineRunResponse,
  EngineStatus,
  EscalationItem,
  IngestRequestPayload,
  IngestResponse,
  MergeResponse,
  PaginatedResponse,
  RepeatContactItem,
  SplitResponse,
  TimelineEvent,
  ChurnRiskItem,
  Channel,
  FunnelAnalyticsResponse,
  CustomerDirectoryItem,
} from "./types";

const API_BASE =
  typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    // Prevent caching for real-time observability telemetry
    cache: "no-store",
  });

  if (!res.ok) {
    let errorDetail = "";
    try {
      const errJson = await res.json();
      errorDetail = errJson.details || errJson.error || res.statusText;
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(errorDetail || `Request failed with status ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  // System Health & Engine
  async getHealth(): Promise<{ status: string; service: string }> {
    return fetchJson(`${API_BASE}/health`);
  },

  async getEngineStatus(): Promise<EngineStatus> {
    return fetchJson(`${API_BASE}/api/engine/status`);
  },

  async runEngine(limit = 1000): Promise<EngineRunResponse> {
    return fetchJson(`${API_BASE}/api/engine/run?limit=${limit}`, {
      method: "POST",
    });
  },

  // Ingestion
  async ingestEvent(channel: Channel, payload: IngestRequestPayload): Promise<IngestResponse> {
    return fetchJson(`${API_BASE}/api/ingest/${channel}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Customers & Identity Resolution
  async getCustomersList(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<CustomerDirectoryItem>> {
    const sp = new URLSearchParams();
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit || 50));
    return fetchJson(`${API_BASE}/api/customers?${sp.toString()}`);
  },

  async searchCustomers(params: {
    email?: string;
    phone?: string;
    loyalty_id?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<CustomerSearchResult>> {
    const sp = new URLSearchParams();
    if (params.email) sp.set("email", params.email.trim());
    if (params.phone) sp.set("phone", params.phone.trim());
    if (params.loyalty_id) sp.set("loyalty_id", params.loyalty_id.trim());
    if (params.page) sp.set("page", String(params.page));
    if (params.limit) sp.set("limit", String(params.limit));

    return fetchJson(`${API_BASE}/api/customers/search?${sp.toString()}`);
  },

  async getCustomerIdentity(
    customerId: string,
    page = 1,
    limit = 20
  ): Promise<CustomerIdentityResponse> {
    return fetchJson(`${API_BASE}/api/identity/${customerId}?page=${page}&limit=${limit}`);
  },

  async mergeIdentities(
    customer_id_a: string,
    customer_id_b: string,
    reason: string
  ): Promise<MergeResponse> {
    return fetchJson(`${API_BASE}/api/identity/merge`, {
      method: "POST",
      body: JSON.stringify({ customer_id_a, customer_id_b, reason }),
    });
  },

  async splitIdentity(customer_id: string, reason: string): Promise<SplitResponse> {
    return fetchJson(`${API_BASE}/api/identity/split`, {
      method: "POST",
      body: JSON.stringify({ customer_id, reason }),
    });
  },

  // Customer Timeline
  async getCustomerTimeline(
    customerId: string,
    params?: {
      channel?: string;
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<PaginatedResponse<TimelineEvent>> {
    const sp = new URLSearchParams();
    if (params?.channel && params.channel !== "all") sp.set("channel", params.channel);
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit || 50));

    return fetchJson(`${API_BASE}/api/customers/${customerId}/timeline?${sp.toString()}`);
  },

  // Analytics
  async getFunnel(): Promise<FunnelAnalyticsResponse> {
    return fetchJson(`${API_BASE}/api/analytics/funnel`);
  },

  async getDropoffs(params?: {
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<DropoffItem>> {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit || 50));

    return fetchJson(`${API_BASE}/api/analytics/dropoffs?${sp.toString()}`);
  },

  async getEscalations(params?: {
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<EscalationItem>> {
    const sp = new URLSearchParams();
    if (params?.from) sp.set("from", params.from);
    if (params?.to) sp.set("to", params.to);
    if (params?.page) sp.set("page", String(params.page));
    if (params?.limit) sp.set("limit", String(params.limit || 50));

    return fetchJson(`${API_BASE}/api/analytics/escalations?${sp.toString()}`);
  },

  async getRepeatContacts(
    threshold = 3,
    page = 1,
    limit = 20
  ): Promise<{ threshold: number } & PaginatedResponse<RepeatContactItem>> {
    return fetchJson(
      `${API_BASE}/api/analytics/repeat-contacts?threshold=${threshold}&page=${page}&limit=${limit}`
    );
  },

  async getChurnRisk(page = 1, limit = 20): Promise<PaginatedResponse<ChurnRiskItem>> {
    return fetchJson(`${API_BASE}/api/analytics/churn-risk?page=${page}&limit=${limit}`);
  },
};
