import { Channel, DemoScenario } from "./types";

export function formatShortUUID(uuid?: string | null): string {
  if (!uuid) return "—";
  if (uuid.length <= 12) return uuid;
  return `${uuid.slice(0, 8)}...${uuid.slice(-4)}`;
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  } catch {
    return isoString;
  }
}

export const CHANNEL_CONFIG: Record<
  Channel,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dotBg: string;
    glow: string;
  }
> = {
  web: {
    label: "Web Browser",
    badgeBg: "bg-indigo-950/60",
    badgeText: "text-indigo-400",
    badgeBorder: "border-indigo-800/60",
    dotBg: "bg-indigo-400",
    glow: "shadow-[0_0_12px_rgba(99,102,241,0.35)]",
  },
  mobile_app: {
    label: "Mobile App",
    badgeBg: "bg-emerald-950/60",
    badgeText: "text-emerald-400",
    badgeBorder: "border-emerald-800/60",
    dotBg: "bg-emerald-400",
    glow: "shadow-[0_0_12px_rgba(16,185,129,0.35)]",
  },
  call_center: {
    label: "Call Center",
    badgeBg: "bg-amber-950/60",
    badgeText: "text-amber-400",
    badgeBorder: "border-amber-800/60",
    dotBg: "bg-amber-400",
    glow: "shadow-[0_0_12px_rgba(245,158,11,0.35)]",
  },
  in_person: {
    label: "In-Person POS",
    badgeBg: "bg-rose-950/60",
    badgeText: "text-rose-400",
    badgeBorder: "border-rose-800/60",
    dotBg: "bg-rose-400",
    glow: "shadow-[0_0_12px_rgba(244,63,94,0.35)]",
  },
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: "cust_001",
    name: "Alice",
    lookupKey: "email",
    lookupVal: "alice@example.com",
    tagline: "Seamless Multi-Channel Journey",
    description: "Clean cross-channel journey: Web session → cart → order → App login → reorder. 100% resolution.",
    channels: ["web", "mobile_app"],
  },
  {
    id: "cust_002",
    name: "Bob",
    lookupKey: "email",
    lookupVal: "bob@example.com",
    tagline: "Cart Checkout Abandonment",
    description: "Web shopper: item added to cart, checkout started, then abandoned at payment step.",
    channels: ["web"],
    isDropoff: true,
  },
  {
    id: "cust_003",
    name: "Carol",
    lookupKey: "phone",
    lookupVal: "+1-555-0303",
    tagline: "Resolved Call Center Escalation",
    description: "Inbound call center issue triggered escalation flag, successfully resolved by tier-2 agent.",
    channels: ["call_center"],
    isEscalation: true,
  },
  {
    id: "cust_004",
    name: "Dave",
    lookupKey: "email",
    lookupVal: "dave@example.com",
    tagline: "Cross-Channel Repeat Support Contact",
    description: "Customer contacts support across both call-center & web portal for recurring billing discrepancy.",
    channels: ["web", "call_center"],
    isRepeat: true,
  },
  {
    id: "cust_005",
    name: "Eve",
    lookupKey: "phone",
    lookupVal: "+1-555-0505",
    tagline: "High Churn Risk (ADR-005)",
    description: "Unresolved tier-2 escalation followed by 30+ days of silence across all channels.",
    channels: ["call_center"],
    isChurn: true,
    isEscalation: true,
  },
  {
    id: "cust_006",
    name: "Frank",
    lookupKey: "loyalty_id",
    lookupVal: "LOY-1006",
    tagline: "Full 4-Channel Deterministic Identity Stitching",
    description: "Anonymous web cookie → login email → app device ID → call center phone → store POS loyalty scan.",
    channels: ["web", "mobile_app", "call_center", "in_person"],
  },
  {
    id: "cust_007",
    name: "Grace",
    // Grace is fully anonymous — no email, phone, or loyalty_id in any event.
    // Her two sessions are linked only via IP-address proximity (probabilistic).
    // There is no searchable identifier for the /api/customers/search endpoint.
    tagline: "Probabilistic IP-Proximity Link",
    description: "Two anonymous sessions linked through IP proximity + time-window heuristic (confidence < 1.0). No searchable identifier.",
    channels: ["web"],
  },
];
