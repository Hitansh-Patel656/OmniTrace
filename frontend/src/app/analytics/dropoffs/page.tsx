"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  GitFork,
  ArrowDownRight,
  TrendingDown,
  Compass,
  ArrowRight,
  AlertCircle,
  BarChart3,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Globe,
  Smartphone,
  Headphones,
  Store,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { FunnelAnalyticsResponse, Channel } from "@/lib/types";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { MetricCard } from "@/components/dashboard/MetricCard";

const CHANNEL_META: Record<
  Channel,
  {
    name: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    primaryCause: string;
  }
> = {
  web: {
    name: "Web Browser",
    icon: Globe,
    primaryCause: "Payment gateway timeout & cart abandonment",
  },
  mobile_app: {
    name: "Mobile App",
    icon: Smartphone,
    primaryCause: "Biometric 1-click checkout eliminates cart stall",
  },
  call_center: {
    name: "Call Center",
    icon: Headphones,
    primaryCause: "Agent assisted ordering (escalations logged separately)",
  },
  in_person: {
    name: "In-Person Store",
    icon: Store,
    primaryCause: "POS direct cash/card swipe",
  },
};

export default function DropoffsPage() {
  const [funnelData, setFunnelData] = useState<FunnelAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.getFunnel();
      setFunnelData(res);
    } catch (err) {
      console.error("Failed to load dynamic funnel data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalDropoffs = funnelData?.totalDropoffs ?? 0;
  const overallConversion = funnelData?.overallConversionRate ?? 0;
  const stages = funnelData?.stages || [];
  const channels = funnelData?.channels || [];
  const abandonments = funnelData?.abandonments || [];

  // Identify peak friction stage dynamically
  const peakFrictionStage = stages.reduce(
    (max, curr) => {
      const dropVal = Math.abs(parseFloat(curr.dropPct) || 0);
      return dropVal > max.val ? { name: curr.name, val: dropVal } : max;
    },
    { name: "Checkout Step", val: 0 }
  );

  // Highest drop-off channel
  const topFrictionChannel = channels.reduce(
    (top, curr) => (curr.dropoffs > top.dropoffs ? curr : top),
    channels[0] || { channel: "web", dropoffs: 0 }
  );

  const topAbandonment = abandonments[0];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b]/70 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-rose-400">
            <GitFork size={14} />
            <span>Friction & Drop-Off Analytics</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            End-to-End Customer Conversion Funnel
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic live progression velocity and friction points computed from database via{" "}
            <code className="text-slate-300">GET /api/analytics/funnel</code>.
          </p>
        </div>

        {topAbandonment?.example_customer_id && (
          <Link
            href={`/customers/${topAbandonment.example_customer_id}`}
            className="flex items-center gap-2 rounded-xl border border-amber-900/50 bg-amber-950/20 px-4 py-2 text-xs text-amber-300 hover:bg-amber-900/30 transition-all shadow-sm"
          >
            <ArrowDownRight size={14} className="text-amber-400" />
            <span>Inspect Example Drop-off Customer →</span>
          </Link>
        )}
      </div>

      {/* KPI Cards — 100% Dynamic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Overall Conversion"
          value={`${overallConversion}%`}
          subtitle={`${funnelData?.totalConvertedOrders ?? 0} of ${funnelData?.totalEvents ?? 0} touchpoints convert`}
          icon={TrendingDown}
          accentColor="emerald"
        />
        <MetricCard
          title="Total Drop-off Events"
          value={totalDropoffs}
          subtitle="Events with is_dropoff = true"
          icon={AlertTriangle}
          accentColor="rose"
        />
        <MetricCard
          title="Peak Friction Stage"
          value={peakFrictionStage.name}
          subtitle={`${peakFrictionStage.val}% attrition rate`}
          icon={AlertCircle}
          accentColor="amber"
        />
        <MetricCard
          title="Vulnerable Channel"
          value={CHANNEL_META[topFrictionChannel.channel]?.name || topFrictionChannel.channel}
          subtitle={`${topFrictionChannel.dropoffs} recorded drop-offs`}
          icon={Compass}
          accentColor="indigo"
        />
      </div>

      {/* VISUAL JOURNEY CONVERSION FUNNEL */}
      <div className="rounded-2xl border border-[#1e293b] bg-[#0c121e] p-7 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#1e293b]/70 pb-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Layers size={18} className="text-cyan-400" />
              <span>Full-Journey Multi-Stage Conversion Flow</span>
            </h2>
            <p className="text-xs text-slate-400">
              Live progression velocity through each normalized touchpoint with attrition loss indicators.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>Live DB Aggregation</span>
            </div>
            <div className="flex items-center gap-1.5 text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>Friction Hole</span>
            </div>
          </div>
        </div>

        {/* 5-Stage Step Flow Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
            <RefreshCw size={18} className="animate-spin text-indigo-400" />
            <span className="text-xs">Computing live conversion funnel...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {stages.map((st, i) => (
              <div
                key={st.step}
                className="relative rounded-xl border border-[#1e293b] bg-[#080d16] p-4 space-y-3 flex flex-col justify-between hover:border-slate-700 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] font-mono font-bold text-slate-300">
                      {st.step}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {st.retention} step
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="text-xs font-bold text-white">{st.name}</h3>
                    <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5" title={st.events}>
                      {st.events}
                    </p>
                  </div>

                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="text-2xl font-extrabold font-mono text-white">
                      {st.volume}
                    </span>
                    <span className="text-xs font-mono font-semibold text-cyan-400">
                      {st.pctOfTotal}%
                    </span>
                  </div>

                  {/* Volume Bar */}
                  <div className="mt-2 w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${st.color}`}
                      style={{ width: `${Math.max(st.pctOfTotal, 4)}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#1e293b]/60 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400">Step Attrition:</span>
                  <span
                    className={
                      parseFloat(st.dropPct) < 0
                        ? "text-rose-400 font-bold"
                        : "text-emerald-400 font-semibold"
                    }
                  >
                    {st.dropPct}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Highlighted Friction Callout */}
        {topAbandonment && (
          <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-rose-950 p-2 text-rose-400 border border-rose-800/80 shrink-0 mt-0.5">
                <AlertTriangle size={18} />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Critical Drop-off: {topAbandonment.event_type} on {topAbandonment.channel}</span>
                  <span className="rounded bg-rose-900/60 px-2 py-0.5 text-[10px] font-mono text-rose-300">
                    {topAbandonment.dropoff_count} incidents ({topAbandonment.share}%)
                  </span>
                </p>
                <p className="text-xs text-slate-300">
                  Customers enter the funnel but stall at checkout abandonment due to friction.
                </p>
              </div>
            </div>

            {topAbandonment.example_customer_id && (
              <Link
                href={`/customers/${topAbandonment.example_customer_id}`}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600/20 border border-rose-500/40 px-3.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-600/30 transition-all shrink-0"
              >
                <span>View Customer Timeline</span>
                <ChevronRight size={14} />
              </Link>
            )}
          </div>
        )}
      </div>

      {/* CHANNEL FRICTION MATRIX — 100% Dynamic */}
      <div className="rounded-2xl border border-[#1e293b] bg-[#0c121e] p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#1e293b]/70 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-indigo-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Channel Friction Comparison Matrix
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {channels.length} Stitched Interaction Streams
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {channels.map((ch) => {
            const meta = CHANNEL_META[ch.channel] || {
              name: ch.channel,
              icon: Globe,
              primaryCause: "Channel activity",
            };
            const Icon = meta.icon;
            const isHighFriction = ch.dropoffs > 0;
            return (
              <div
                key={ch.channel}
                className="rounded-xl border border-[#1e293b] bg-[#080d16] p-5 space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-slate-800 p-2 text-slate-300">
                        <Icon size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{meta.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400 uppercase">
                          {ch.channel}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border ${
                        isHighFriction
                          ? "text-rose-400 bg-rose-950/70 border-rose-800"
                          : "text-emerald-400 bg-emerald-950/70 border-emerald-800"
                      }`}
                    >
                      {ch.status}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold font-mono text-white">
                        {ch.dropoffs}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {ch.totalEvents} events
                      </span>
                    </div>

                    <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isHighFriction ? "bg-rose-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${isHighFriction ? Math.max(ch.share, 10) : 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed border-t border-[#1e293b]/60 pt-2.5">
                  {meta.primaryCause}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* DETAILED FRICTION INCIDENTS TABLE — 100% Dynamic */}
      <div className="rounded-2xl border border-[#1e293b] bg-[#0c121e] shadow-xl overflow-hidden">
        <div className="p-4 border-b border-[#1e293b] bg-[#080d16] flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Stitched Abandonment Points Log
          </h3>
          <span className="text-xs text-slate-400">
            Events with <code className="text-slate-300">is_dropoff = true</code>
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#1e293b] bg-[#080d16]/60 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3.5 font-semibold">Channel</th>
              <th className="px-5 py-3.5 font-semibold">Event Action / Stage</th>
              <th className="px-5 py-3.5 font-semibold">Drop-off Incidents</th>
              <th className="px-5 py-3.5 font-semibold">Relative Share</th>
              <th className="px-5 py-3.5 font-semibold">Example Customer</th>
              <th className="px-5 py-3.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]/60">
            {abandonments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  No drop-off events recorded in database.
                </td>
              </tr>
            ) : (
              abandonments.map((ab, i) => (
                <tr key={`${ab.channel}-${ab.event_type}-${i}`} className="hover:bg-slate-900/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <ChannelBadge channel={ab.channel} size="sm" />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-200 font-bold">{ab.event_type}</span>
                      <span className="rounded bg-rose-950/80 px-1.5 py-0.2 text-[10px] font-bold text-rose-300 border border-rose-800">
                        Drop-off
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono font-bold text-rose-400 text-sm">
                    {ab.dropoff_count}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-rose-500 h-full rounded-full" style={{ width: `${ab.share}%` }} />
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">{ab.share}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-300">
                    <span className="font-mono text-xs text-indigo-300">
                      {ab.example_customer_id ? `${ab.example_customer_id.slice(0, 8)}...` : "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {ab.example_customer_id ? (
                      <Link
                        href={`/customers/${ab.example_customer_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                      >
                        <span>Inspect Timeline</span>
                        <ArrowRight size={13} />
                      </Link>
                    ) : (
                      <span className="text-slate-500 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
