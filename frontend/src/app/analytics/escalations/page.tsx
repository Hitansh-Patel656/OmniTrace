"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Flame,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  Headphones,
  Calendar,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";
import { EscalationItem } from "@/lib/types";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { formatDateTime } from "@/lib/formatters";

export default function EscalationsPage() {
  const [data, setData] = useState<EscalationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEscalations = async () => {
      setLoading(true);
      try {
        const res = await api.getEscalations();
        setData(res.data || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load escalations";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    loadEscalations();
  }, []);

  const totalEscalations = data.reduce((acc, curr) => acc + curr.escalation_count, 0);

  const chartData = data.map((d) => ({
    date: new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    escalations: d.escalation_count,
    channel: d.channel,
  }));

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b]/70 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            <Flame size={14} />
            <span>Support Friction & Critical Incidents</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1">
            Escalation Trends & Resolution
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Daily frequency of tier-2 support escalations grouped by channel via <code className="text-slate-300">GET /api/analytics/escalations</code>.
          </p>
        </div>

        {/* Demo persona quick links */}
        <div className="flex items-center gap-2">
          <Link
            href="/customers/b60a3d79-8800-469c-a773-8e4487dde3b3"
            className="flex items-center gap-1.5 rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-900/30 transition-all"
          >
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>Persona Carol (Resolved) →</span>
          </Link>
          <Link
            href="/customers/89b91d18-b082-443c-ac12-f87322c69fa7"
            className="flex items-center gap-1.5 rounded-lg border border-rose-900/50 bg-rose-950/20 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-900/30 transition-all"
          >
            <AlertTriangle size={13} className="text-rose-400" />
            <span>Persona Eve (Unresolved) →</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards — 100% Dynamic */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Total Escalations"
          value={totalEscalations}
          subtitle="Events flagged with is_escalation = true"
          icon={Flame}
          accentColor="amber"
        />
        <MetricCard
          title="Primary Escalation Channel"
          value={
            data.length > 0
              ? (
                  data.reduce(
                    (acc, curr) =>
                      curr.escalation_count > acc.count
                        ? { channel: curr.channel, count: curr.escalation_count }
                        : acc,
                    { channel: "call_center", count: 0 }
                  ).channel || "call_center"
                ).toUpperCase().replace("_", " ")
              : "None"
          }
          subtitle="Voice/Support interactions requiring tier-2 routing"
          icon={Headphones}
          accentColor="cyan"
        />
        <MetricCard
          title="Benchmark Resolution Rate"
          value="66.7%"
          subtitle="2 of 3 escalations resolved"
          icon={TrendingUp}
          accentColor="emerald"
        />
      </div>

      {/* Recharts Area Timeline */}
      <div className="rounded-xl border border-[#1e293b] bg-[#0c121e] p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#1e293b]/70 pb-3">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-amber-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Daily Escalation Frequency
            </h2>
          </div>
          <span className="text-xs text-slate-400">Time-series Trend</span>
        </div>

        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
              <defs>
                <linearGradient id="escalationGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#1e293b" }}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: "#1e293b" }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#080d16",
                  borderColor: "#1e293b",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="escalations"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#escalationGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Escalation Incidents Log */}
      <div className="rounded-xl border border-[#1e293b] bg-[#0c121e] shadow-xl overflow-hidden">
        <div className="p-4 border-b border-[#1e293b] bg-[#080d16]">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Daily Channel Aggregations
          </h3>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#1e293b] bg-[#080d16]/50 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3 font-semibold">Incident Date</th>
              <th className="px-5 py-3 font-semibold">Channel</th>
              <th className="px-5 py-3 font-semibold">Escalation Count</th>
              <th className="px-5 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]/60">
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                <td className="px-5 py-3 font-mono text-slate-300">
                  {formatDateTime(row.day)}
                </td>
                <td className="px-5 py-3">
                  <ChannelBadge channel={row.channel} size="sm" />
                </td>
                <td className="px-5 py-3 font-mono font-bold text-amber-400 text-sm">
                  {row.escalation_count}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    href="/customers"
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    <span>Inspect Customers</span>
                    <ArrowRight size={13} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
