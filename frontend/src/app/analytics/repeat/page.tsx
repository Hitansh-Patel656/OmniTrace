"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Repeat,
  Headphones,
  Globe,
  Sliders,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { RepeatContactItem, Channel } from "@/lib/types";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { formatDateTime, formatShortUUID } from "@/lib/formatters";

export default function RepeatContactsPage() {
  const [threshold, setThreshold] = useState<number>(3);
  const [data, setData] = useState<RepeatContactItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRepeats = async (th: number) => {
    setLoading(true);
    try {
      const res = await api.getRepeatContacts(th);
      setData(res.data || []);
    } catch (err) {
      console.error("Failed to load repeat contacts:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepeats(threshold);
  }, [threshold]);

  const topRepeat = data[0];
  const channelsUsed = topRepeat?.details?.channels || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b]/70 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
            <Repeat size={14} />
            <span>Multi-Channel Friction Loop Detection</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Repeat Support Contact Detector
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Identify customers contacting support repeatedly across fragmented channels via{" "}
            <code className="text-slate-300">GET /api/analytics/repeat-contacts?threshold={threshold}</code>.
          </p>
        </div>

        {topRepeat && (
          <Link
            href={`/customers/${topRepeat.customer_id}`}
            className="flex items-center gap-2 rounded-xl bg-purple-950/60 border border-purple-800/80 px-4 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-900/40 transition-all shadow-lg shadow-purple-950/50"
          >
            <Repeat size={14} className="text-purple-400" />
            <span>Inspect Top Loop ({formatShortUUID(topRepeat.customer_id)}) →</span>
          </Link>
        )}
      </div>

      {/* Interactive Threshold Bar */}
      <div className="rounded-xl border border-[#1e293b] bg-[#0c121e] p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-950 p-2 text-purple-400 border border-purple-800/60">
            <Sliders size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Repeat Frequency Threshold</h2>
            <p className="text-xs text-slate-400">
              Trigger detection when contact count &ge; threshold (OQ-4 default: 3)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((val) => (
            <button
              key={val}
              onClick={() => setThreshold(val)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-bold font-mono transition-all ${
                threshold === val
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30 border border-purple-400"
                  : "bg-[#080d16] text-slate-400 border border-[#1e293b] hover:text-white"
              }`}
            >
              &ge; {val} contacts
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards — 100% Dynamic */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Repeat Contact Customers"
          value={data.length}
          subtitle={`Customers with ≥ ${threshold} contacts`}
          icon={Repeat}
          accentColor="purple"
        />
        <MetricCard
          title="Peak Friction Frequency"
          value={topRepeat ? `${topRepeat.score} Contacts` : "—"}
          subtitle="Highest incident frequency"
          icon={Globe}
          accentColor="cyan"
        />
        <MetricCard
          title="Active Threshold Filter"
          value={`≥ ${threshold} contacts`}
          subtitle="Configured via query parameter"
          icon={Sliders}
          accentColor="indigo"
        />
      </div>

      {/* Ranked Repeat Contacts Table — 100% Dynamic */}
      <div className="rounded-xl border border-[#1e293b] bg-[#0c121e] shadow-xl overflow-hidden space-y-4">
        <div className="p-4 border-b border-[#1e293b] bg-[#080d16] flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Flagged Repeat Contact Incidents ({data.length})
          </h3>
          <span className="text-[11px] font-mono text-purple-400">
            Threshold Filter: &ge; {threshold}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
            <RefreshCw size={16} className="animate-spin text-purple-400" />
            <span className="text-xs">Evaluating repeat contact thresholds...</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#1e293b] bg-[#080d16]/50 text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Customer ID</th>
                <th className="px-5 py-3 font-semibold">Contact Frequency</th>
                <th className="px-5 py-3 font-semibold">Channels Crossed</th>
                <th className="px-5 py-3 font-semibold">Recurring Issue Category</th>
                <th className="px-5 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b]/60">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No customers found with &ge; {threshold} support contacts in database.
                  </td>
                </tr>
              ) : (
                data.map((row) => {
                  const chs = row.details?.channels || [];
                  const category = row.details?.issue_category || "General Support Inquiry";
                  return (
                    <tr key={row.customer_id} className="hover:bg-slate-900/40 transition-colors bg-purple-950/10">
                      <td className="px-5 py-3 font-mono text-slate-200">
                        <div className="flex items-center gap-2">
                          <span title={row.customer_id}>{formatShortUUID(row.customer_id)}</span>
                          <span className="rounded bg-purple-950/80 px-1.5 py-0.2 text-[10px] font-bold text-purple-300 border border-purple-800">
                            Repeat Loop
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono font-bold text-purple-400 text-sm">
                        {row.score} contacts
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {chs.length > 0 ? (
                            chs.map((ch: Channel) => (
                              <ChannelBadge key={ch} channel={ch} size="sm" />
                            ))
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-300 font-medium">
                        {category}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/customers/${row.customer_id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600/20 border border-purple-500/40 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-600/30 transition-all"
                        >
                          <span>Inspect Stitched Timeline</span>
                          <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
