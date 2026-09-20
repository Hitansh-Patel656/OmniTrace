"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Copy,
  Check,
  GitMerge,
  GitPullRequest,
  ShieldCheck,
  Cpu,
  Flame,
  ArrowDownRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  CustomerIdentityResponse,
  IdentityLink,
  TimelineEvent,
  Channel,
  CHANNELS,
} from "@/lib/types";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfidenceScore } from "@/components/ui/ConfidenceScore";
import { DEMO_SCENARIOS, formatDateTime, formatShortUUID } from "@/lib/formatters";

export default function CustomerTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;

  const [identityData, setIdentityData] = useState<CustomerIdentityResponse | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [escalationsOnly, setEscalationsOnly] = useState(false);
  const [dropoffsOnly, setDropoffsOnly] = useState(false);

  // Expanded payloads state
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});

  // Copy state
  const [copied, setCopied] = useState(false);

  // Merge / Split Modals
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; isError?: boolean } | null>(
    null
  );

  // Check if matches known persona
  const matchingPersona = DEMO_SCENARIOS.find(
    (p) => p.customerId.toLowerCase() === customerId.toLowerCase()
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ident, time] = await Promise.all([
        api.getCustomerIdentity(customerId),
        api.getCustomerTimeline(customerId, {
          channel: selectedChannel !== "all" ? selectedChannel : undefined,
          limit: 100,
        }),
      ]);
      setIdentityData(ident);
      setTimelineEvents(time.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load customer timeline";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [customerId, selectedChannel]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(customerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const togglePayload = (id: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter events client-side for escalation/drop-off flags
  const filteredEvents = timelineEvents.filter((ev) => {
    if (escalationsOnly && !ev.is_escalation) return false;
    if (dropoffsOnly && !ev.is_dropoff) return false;
    return true;
  });

  // Handle Analyst Merge
  const handleMergeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mergeTargetId.trim()) return;
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await api.mergeIdentities(customerId, mergeTargetId.trim(), overrideReason || "Analyst manual merge");
      setActionMessage({ text: `Merged successfully! Surviving ID: ${res.surviving_customer_id}` });
      setTimeout(() => {
        setShowMergeModal(false);
        loadData();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Merge failed";
      setActionMessage({ text: msg, isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Analyst Split
  const handleSplitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await api.splitIdentity(customerId, overrideReason || "Analyst manual split of probabilistic links");
      setActionMessage({ text: `Split successful! Created new customer: ${res.new_customer_id}` });
      setTimeout(() => {
        setShowSplitModal(false);
        loadData();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Split failed";
      setActionMessage({ text: msg, isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Back Navigation & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b]/70 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1e293b] bg-[#0c121e] text-slate-400 hover:border-slate-700 hover:text-white transition-all"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Customer Stitched Profile
              </span>
              {matchingPersona && (
                <span className="rounded-full bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 px-2.5 py-0.5 text-xs font-bold text-cyan-300">
                  {matchingPersona.name} ({matchingPersona.id})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-xl md:text-2xl font-bold font-mono text-white tracking-tight">
                {customerId}
              </h1>
              <button
                onClick={handleCopyId}
                className="text-slate-400 hover:text-white"
                title="Copy Customer ID"
              >
                {copied ? (
                  <Check size={16} className="text-emerald-400" />
                ) : (
                  <Copy size={16} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Analyst Identity Override Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowMergeModal(true);
              setActionMessage(null);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#1e293b] bg-[#0c121e] px-3.5 py-2 text-xs font-medium text-slate-300 hover:border-indigo-500 hover:text-white transition-all"
          >
            <GitMerge size={14} className="text-indigo-400" />
            <span>Merge Customer</span>
          </button>
          <button
            onClick={() => {
              setShowSplitModal(true);
              setActionMessage(null);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-[#1e293b] bg-[#0c121e] px-3.5 py-2 text-xs font-medium text-slate-300 hover:border-rose-500 hover:text-white transition-all"
          >
            <GitPullRequest size={14} className="text-purple-400" />
            <span>Split Probabilistic</span>
          </button>
        </div>
      </div>

      {matchingPersona && (
        <div className="rounded-xl border border-indigo-900/40 bg-indigo-950/20 p-4 flex items-start gap-3">
          <Sparkles size={18} className="text-cyan-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-white">
              Benchmark Scenario: {matchingPersona.tagline}
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {matchingPersona.description}
            </p>
          </div>
        </div>
      )}

      {/* Identity Graph & Linked Clues */}
      <div className="rounded-xl border border-[#1e293b] bg-[#0c121e] p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#1e293b]/70 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Resolved Identity Graph
            </h2>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300 font-mono">
              {identityData?.data.length || 0} Linked Clues
            </span>
          </div>
          {identityData?.customer && (
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>First Seen: {formatDateTime(identityData.customer.created_at)}</span>
              <span>Updated: {formatDateTime(identityData.customer.updated_at)}</span>
            </div>
          )}
        </div>

        {/* Identity Links Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {identityData?.data.map((link) => (
            <div
              key={link.id}
              className="rounded-lg border border-[#1e293b]/80 bg-[#080d16] p-3 space-y-2 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[11px] font-mono text-slate-300 capitalize">
                  {link.identifier_type.replace("_", " ")}
                </span>
                <ConfidenceScore score={link.confidence_score} />
              </div>
              <p className="font-mono text-xs font-semibold text-white truncate" title={link.identifier_value}>
                {link.identifier_value}
              </p>
              <p className="text-[10px] text-slate-400">Linked: {formatDateTime(link.linked_at)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Controls & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-[#1e293b] bg-[#0c121e]/80 p-4">
        {/* Channel tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedChannel("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              selectedChannel === "all"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            All Channels ({timelineEvents.length})
          </button>
          {CHANNELS.map((ch) => (
            <button
              key={ch}
              onClick={() => setSelectedChannel(ch)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                selectedChannel === ch
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {ch.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Flag toggles */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEscalationsOnly(!escalationsOnly)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              escalationsOnly
                ? "border-amber-500 bg-amber-950/60 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
                : "border-[#1e293b] text-slate-400 hover:border-slate-700 hover:text-white"
            }`}
          >
            <Flame size={13} className={escalationsOnly ? "text-amber-400" : "text-slate-400"} />
            <span>Escalations Only</span>
          </button>

          <button
            onClick={() => setDropoffsOnly(!dropoffsOnly)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              dropoffsOnly
                ? "border-rose-500 bg-rose-950/60 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.25)]"
                : "border-[#1e293b] text-slate-400 hover:border-slate-700 hover:text-white"
            }`}
          >
            <ArrowDownRight size={13} className={dropoffsOnly ? "text-rose-400" : "text-slate-400"} />
            <span>Drop-offs Only</span>
          </button>
        </div>
      </div>

      {/* Stitched Chronological Stream */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Clock size={15} className="text-indigo-400" />
            <span>Unified Chronological Event Timeline ({filteredEvents.length})</span>
          </h2>
          <span className="text-xs text-slate-400">Order: Oldest to Newest</span>
        </div>

        {filteredEvents.length > 0 ? (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-indigo-500 before:via-cyan-500/40 before:to-transparent">
            {filteredEvents.map((event, index) => {
              const isExpanded = expandedPayloads[event.id];

              return (
                <div key={event.id} className="relative group">
                  {/* Timeline dot */}
                  <div
                    className={`absolute -left-6 top-3.5 h-3.5 w-3.5 rounded-full border-2 border-[#070a10] transition-transform group-hover:scale-125 ${
                      event.is_escalation
                        ? "bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                        : event.is_dropoff
                        ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                        : "bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                    }`}
                  />

                  {/* Event Card */}
                  <div
                    className={`rounded-xl border bg-[#0c121e] p-5 shadow-lg transition-all ${
                      event.is_escalation
                        ? "border-amber-700/50 bg-gradient-to-r from-amber-950/10 to-[#0c121e]"
                        : event.is_dropoff
                        ? "border-rose-700/50 bg-gradient-to-r from-rose-950/10 to-[#0c121e]"
                        : "border-[#1e293b] hover:border-slate-700"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-slate-400">
                          #{index + 1}
                        </span>
                        <ChannelBadge channel={event.channel} />
                        <h3 className="font-mono text-sm font-bold text-white tracking-wide">
                          {event.event_type}
                        </h3>
                      </div>

                      {/* Flags & Status */}
                      <div className="flex flex-wrap items-center gap-2">
                        {event.is_escalation && <StatusBadge type="escalation" />}
                        {event.is_dropoff && <StatusBadge type="dropoff" />}
                        <StatusBadge type={event.resolution_status} />
                        <span className="text-xs text-slate-400 font-mono">
                          {formatDateTime(event.event_time)}
                        </span>
                      </div>
                    </div>

                    {/* Metadata bar & Raw Payload Toggle */}
                    <div className="mt-4 pt-3 border-t border-[#1e293b]/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                        <span>Event ID: {formatShortUUID(event.id)}</span>
                        <span>•</span>
                        <span>MongoDB Ref: {formatShortUUID(event.raw_event_ref)}</span>
                      </div>

                      <button
                        onClick={() => togglePayload(event.id)}
                        className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300"
                      >
                        <FileCode size={13} />
                        <span>{isExpanded ? "Hide Raw Payload" : "View Raw Event"}</span>
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                    </div>

                    {/* Expandable JSON Inspector */}
                    {isExpanded && (
                      <div className="mt-3 rounded-lg bg-[#070b12] border border-[#1e293b] p-3 font-mono text-xs text-slate-300 animate-fadeIn">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1e293b] text-[11px] text-slate-400">
                          <span>MongoDB Stored Document Reference: {event.raw_event_ref}</span>
                          <span className="text-emerald-400">Status: Normalized</span>
                        </div>
                        <pre className="overflow-x-auto text-[11px] text-cyan-300 leading-relaxed">
                          {JSON.stringify(
                            {
                              id: event.id,
                              customer_id: event.customer_id,
                              channel: event.channel,
                              event_type: event.event_type,
                              event_time: event.event_time,
                              is_escalation: event.is_escalation,
                              is_dropoff: event.is_dropoff,
                              resolution_status: event.resolution_status,
                              raw_event_ref: event.raw_event_ref,
                            },
                            null,
                            2
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1e293b] p-12 text-center bg-[#0c121e]/50">
            <Clock size={32} className="text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-300">No Events Match Selected Filters</p>
            <p className="text-xs text-slate-400 mt-1">
              Try toggling off the escalation or drop-off filter, or switch to All Channels.
            </p>
          </div>
        )}
      </div>

      {/* Merge Modal Dialog */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-[#1e293b] bg-[#0c121e] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-indigo-950 p-2 text-indigo-400 border border-indigo-700/60">
                <GitMerge size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Analyst Identity Merge</h3>
                <p className="text-xs text-slate-400">Merge another customer identity into this one</p>
              </div>
            </div>

            <form onSubmit={handleMergeSubmit} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Surviving Customer ID (Target)
                </label>
                <input
                  type="text"
                  value={customerId}
                  disabled
                  className="w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3 py-1.5 font-mono text-xs text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Customer ID to Merge & Ingest (Will be deleted)
                </label>
                <input
                  type="text"
                  required
                  value={mergeTargetId}
                  onChange={(e) => setMergeTargetId(e.target.value)}
                  placeholder="e.g. 17c83eff-550e-4b30-aa78-356d76c1cf04"
                  className="w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3 py-1.5 font-mono text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Override Justification / Reason
                </label>
                <input
                  type="text"
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Verified matched shipping address in offline audit"
                  className="w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {actionMessage && (
                <div
                  className={`rounded-lg p-3 text-xs border ${
                    actionMessage.isError
                      ? "bg-rose-950/60 border-rose-800 text-rose-300"
                      : "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  }`}
                >
                  {actionMessage.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMergeModal(false)}
                  className="rounded-lg border border-[#1e293b] px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {actionLoading ? "Merging..." : "Confirm Merge"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Split Modal Dialog */}
      {showSplitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-[#1e293b] bg-[#0c121e] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-purple-950 p-2 text-purple-400 border border-purple-700/60">
                <GitPullRequest size={18} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Split Probabilistic Links</h3>
                <p className="text-xs text-slate-400">
                  Detaches links with confidence &lt; 1.0 into a separate customer record
                </p>
              </div>
            </div>

            <form onSubmit={handleSplitSubmit} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Customer ID
                </label>
                <input
                  type="text"
                  value={customerId}
                  disabled
                  className="w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3 py-1.5 font-mono text-xs text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reason for Separation
                </label>
                <input
                  type="text"
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. False IP match — household shared network"
                  className="w-full rounded-lg border border-[#1e293b] bg-[#080d16] px-3 py-1.5 text-xs text-slate-200 focus:border-purple-500 focus:outline-none"
                />
              </div>

              {actionMessage && (
                <div
                  className={`rounded-lg p-3 text-xs border ${
                    actionMessage.isError
                      ? "bg-rose-950/60 border-rose-800 text-rose-300"
                      : "bg-emerald-950/60 border-emerald-800 text-emerald-300"
                  }`}
                >
                  {actionMessage.text}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSplitModal(false)}
                  className="rounded-lg border border-[#1e293b] px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                >
                  {actionLoading ? "Splitting..." : "Confirm Split"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
