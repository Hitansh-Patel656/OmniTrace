"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Users,
  Headphones,
  Globe,
  BarChart3,
  Repeat2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { RepeatContactItem, Channel } from "@/lib/types";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { formatDateTime, formatShortUUID } from "@/lib/formatters";

export default function RepeatContactsPage() {
  const [data, setData] = useState<RepeatContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(3);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = async (t = threshold) => {
    setLoading(true);
    try {
      const res = await api.getRepeatContacts(t);
      setData(res.data || []);
    } catch (err) {
      console.error("Failed to load repeat contacts:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avgScore =
    data.length > 0
      ? (data.reduce((s, d) => s + d.score, 0) / data.length).toFixed(1)
      : "0";

  const maxScore = data.length > 0 ? Math.max(...data.map((d) => d.score)) : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b]/70 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
            <Repeat2 size={14} />
            <span>Support Loop Detection</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Repeat Contact Patterns
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Customers with multiple distinct support contact initiations — indicating unresolved friction
            driving repeat outreach. Score = number of distinct contact sessions.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => loadData(threshold)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1e293b] bg-[#0c121e] text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
          <Link
            href="/customers"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-700/60 to-indigo-700/60 border border-purple-700/50 text-xs font-semibold text-purple-200 hover:brightness-110 transition-all"
          >
            <span>Customer Directory</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>

      {/* Threshold Control */}
      <div className="rounded-xl border border-[#1e293b] bg-[#0c121e]/80 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-200">Contact Threshold Filter</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Show customers with at least{" "}
              <span className="font-bold text-purple-300">{threshold}</span> distinct support contact initiations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[2, 3, 4, 5].map((t) => (
              <button
                key={t}
                onClick={() => {
                  setThreshold(t);
                  loadData(t);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  threshold === t
                    ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(147,51,234,0.4)]"
                    : "border border-[#1e293b] bg-[#080d16] text-slate-400 hover:text-white hover:border-purple-700/40"
                }`}
              >
                {t}+
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Repeat Contact Customers"
          value={loading ? "—" : data.length}
          subtitle={`At ${threshold}+ contact threshold`}
          icon={Users}
          accentColor="indigo"
        />
        <MetricCard
          title="Avg Contact Count"
          value={loading ? "—" : avgScore}
          subtitle="Contact sessions per flagged customer"
          icon={Headphones}
          accentColor="rose"
        />
        <MetricCard
          title="Max Contact Count"
          value={loading ? "—" : maxScore}
          subtitle="Highest repeat contact score"
          icon={BarChart3}
          accentColor="amber"
        />
      </div>

      {/* Customer List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
          <Sparkles size={14} className="text-purple-400" />
          <span>Flagged Customers</span>
          <span className="ml-2 rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-normal text-slate-400">
            {data.length} customers
          </span>
        </div>

        {loading ? (
          <div className="rounded-xl border border-[#1e293b] bg-[#0c121e]/80 p-12 flex items-center justify-center">
            <RefreshCw size={20} className="animate-spin text-slate-500 mr-3" />
            <span className="text-slate-400 text-sm">Loading repeat-contact data…</span>
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-[#1e293b] bg-[#0c121e]/80 p-12 text-center">
            <AlertCircle size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No repeat contacts at threshold {threshold}+.</p>
            <p className="text-slate-500 text-xs mt-1">
              Try lowering the threshold or run the engine benchmark.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item) => {
              const channels: Channel[] = (item.details?.channels as Channel[]) || [];
              const contactCount = item.details?.contact_count ?? item.score;
              const isExpanded = expandedId === item.customer_id;
              const recentEvents = item.details?.recent_events || [];
              const issueCategory = item.details?.issue_category || "Support Contact";

              return (
                <div
                  key={item.customer_id}
                  className="rounded-xl border border-[#1e293b] bg-[#0c121e]/80 overflow-hidden hover:border-purple-700/40 transition-all"
                >
                  <div className="flex items-center justify-between px-5 py-4 gap-4">
                    {/* Left: identity */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-purple-900/50 border border-purple-700/40 flex items-center justify-center shrink-0">
                        <Repeat2 size={15} className="text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400 truncate">
                            {formatShortUUID(item.customer_id)}
                          </span>
                          <span className="rounded bg-purple-950/80 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-purple-800/60 shrink-0">
                            {contactCount} CONTACTS
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-200 mt-0.5 truncate">
                          {issueCategory}
                        </p>
                      </div>
                    </div>

                    {/* Middle: channels */}
                    <div className="flex flex-wrap gap-1.5 shrink-0">
                      {channels.map((ch) => (
                        <ChannelBadge key={ch} channel={ch} size="sm" />
                      ))}
                    </div>

                    {/* Right: score + actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Score bar */}
                      <div className="hidden sm:flex flex-col items-end gap-1">
                        <span className="text-xs text-slate-400">
                          Score <span className="font-bold text-white">{item.score}</span>
                        </span>
                        <div className="w-24 h-1.5 rounded-full bg-[#1e293b] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-400"
                            style={{ width: `${Math.min(100, (item.score / 10) * 100)}%` }}
                          />
                        </div>
                      </div>

                      <Link
                        href={`/customers/${item.customer_id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1e293b] bg-[#080d16] text-xs font-medium text-slate-300 hover:text-white hover:border-purple-700/40 transition-all"
                      >
                        <Globe size={12} />
                        <span>Timeline</span>
                      </Link>

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.customer_id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded: recent contact events */}
                  {isExpanded && recentEvents.length > 0 && (
                    <div className="border-t border-[#1e293b]/70 bg-[#080d16] px-5 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
                        Recent Contact Initiations
                      </p>
                      <div className="space-y-2">
                        {(recentEvents as Array<{ channel: Channel; event_type: string; timestamp: string }>).map(
                          (ev, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs">
                              <ChannelBadge channel={ev.channel} size="sm" />
                              <span className="text-slate-300 font-medium">{ev.event_type}</span>
                              <span className="text-slate-500 ml-auto">
                                {formatDateTime(ev.timestamp)}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#1e293b]/40 text-[11px] text-slate-500">
                        Computed {formatDateTime(item.computed_at)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
